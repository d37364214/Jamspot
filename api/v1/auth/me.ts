import type { NextApiRequest, NextApiResponse } from 'next';
// Importe withApiAuth et les typages de Supabase nécessaires
import { withApiAuth, User as SupabaseUser, Session } from '@supabase/nextjs';
import logger from '../../../utils/logger'; // Importe le logger configuré

// Typage de l'utilisateur renvoyé depuis Supabase après filtrage
interface UserFiltered {
  id: string;
  email: string;
  created_at: string;
  // Ajoute d'autres champs ici si tu veux les inclure dans la réponse
  // Par exemple, si tu as user_metadata ou app_metadata et que tu les filtres
  // app_metadata?: Record<string, any>;
  // user_metadata?: Record<string, any>;
}

export default withApiAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  // withApiAuth fournit supabaseClient et user (l'utilisateur authentifié) dans le troisième argument
  { supabaseClient, user: authenticatedUser }: { supabaseClient: any; user: SupabaseUser | null; session: Session | null }
) {
  // Vérifie que la requête est de type GET
  if (req.method !== 'GET') {
    logger.debug('Received a non-GET request for /api/me', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    // Vérifie si l'utilisateur est authentifié. authenticatedUser.id est l'UUID de l'utilisateur Supabase.
    if (!authenticatedUser?.id) {
      logger.debug('User not authenticated for /api/me');
      return res.status(401).json({ error: "Non authentifié" });
    }

    const userId = authenticatedUser.id; // Récupère l'ID de l'utilisateur authentifié

    // Utilise le client Supabase fourni par withApiAuth.
    // Ce client est déjà authentifié avec la session de l'utilisateur courant et respecte les RLS.
    const { data: user, error } = await supabaseClient
      .from<UserFiltered>('users') // Assure-toi que 'users' est le nom correct de ta table de profils
      .select('id, email, created_at') // Sélectionne uniquement les champs nécessaires et non sensibles
      .eq('id', userId) // Filtre pour récupérer uniquement le profil de l'utilisateur courant
      .single(); // S'attend à ne récupérer qu'une seule ligne

    // Gère les erreurs de la requête Supabase
    if (error) {
      logger.error('Error fetching user info from Supabase', {
        errorMessage: error.message, // Message de l'erreur Supabase
        userId,
        stack: error.stack, // Trace de l'erreur pour le débogage côté serveur
      });
      return res.status(500).json({ error: "Une erreur interne est survenue lors de la récupération des informations utilisateur." });
    }

    // Gère le cas où l'utilisateur est authentifié mais n'a pas de profil correspondant dans la table 'users'
    if (!user) {
      logger.warn('User not found in Supabase (despite being authenticated)', { userId });
      return res.status(404).json({ error: "Profil utilisateur non trouvé." });
    }

    // Log de succès
    logger.info(`Successfully retrieved user info for user ${user.email}`, { userId: user.id });

    // Retourne les informations filtrées de l'utilisateur avec un statut 200 OK
    res.status(200).json(user);

  } catch (error) {
    // Gère les erreurs inattendues (non liées directement à Supabase)
    logger.error('Unhandled error in /api/me', {
      errorMessage: error instanceof Error ? error.message : String(error), // Gère les erreurs qui ne sont pas des instances d'Error
      stack: error instanceof Error ? error.stack : undefined, // Ajoute la trace si c'est une instance d'Error
    });
    return res.status(500).json({ error: "Erreur interne. Veuillez réessayer plus tard." });
  }
});
