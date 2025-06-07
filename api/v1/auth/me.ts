import type { NextApiRequest, NextApiResponse } from 'next'; // Pour le typage
import { createClient } from '@supabase/supabase-js';
import logger from '../../../utils/logger';

// Initialisation du client Supabase pour la vérification du token (utilise la SERVICE_ROLE_KEY)
// Ce client aura les droits admin pour valider les JWT et potentiellement d'autres actions admin.
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// Initialisation du client Supabase pour les requêtes utilisateur (utilise l'Anon Key)
// Ce client respectera les RLS et sera utilisé pour récupérer les données du profil de l'utilisateur.
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, // Utilisation de NEXT_PUBLIC_SUPABASE_URL pour l'URL
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Utilisation de l'Anon Key
);

// Typage de l'utilisateur renvoyé
interface UserFiltered {
  id: string;
  email: string;
  created_at: string;
  // Ajoute d'autres champs ici si tu veux les inclure dans la réponse
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    logger.debug('Received a non-GET request for /api/me', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    // 1. Récupérer le token d'accès de l'en-tête Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.debug('No or malformed Authorization header');
      return res.status(401).json({ error: "Non authentifié: Token manquant ou mal formé." });
    }

    const accessToken = authHeader.split(' ')[1];

    // 2. Vérifier la validité du token avec le client Admin Supabase
    // C'est ici que le service role key est utilisé, pour valider le token, pas pour une opération CRUD d'utilisateur.
    const { data: { user: supabaseAuthUser }, error: verifyError } = await supabaseAdmin.auth.getUser(accessToken);

    if (verifyError || !supabaseAuthUser) {
      logger.error('Token verification failed', { error: verifyError?.message, accessToken });
      return res.status(401).json({ error: "Non authentifié: Token invalide ou expiré." });
    }

    const userId = supabaseAuthUser.id; // L'ID de l'utilisateur validé

    // 3. Utiliser le client Supabase avec l'Anon Key pour récupérer les données du profil
    // Cette requête respectera les RLS configurées sur votre table 'users'.
    const { data: user, error: dbError } = await supabaseAnon
      .from('users')
      .select('id, email, created_at')
      .eq('id', userId)
      .single();

    if (dbError) {
      logger.error('Error fetching user info from Supabase DB', {
        errorMessage: dbError.message,
        userId,
        stack: dbError.stack,
      });
      return res.status(500).json({ error: "Une erreur interne est survenue lors de la récupération des informations utilisateur." });
    }

    if (!user) {
      logger.warn('User profile not found in DB for authenticated user', { userId });
      return res.status(404).json({ error: "Profil utilisateur non trouvé." });
    }

    logger.info(`Successfully retrieved user info for user ${user.email}`, { userId: user.id });

    res.status(200).json(user);

  } catch (error) {
    logger.error('Unhandled error in /api/me', {
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ error: "Erreur interne. Veuillez réessayer plus tard." });
  }
}
