import type { CustomApiRequest, CustomApiResponse } from '../../../api/types'; // Chemin ajusté
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire

// --- Constantes pour les codes d'erreur Supabase/PostgreSQL ---
const SUPABASE_ERROR_CODES = {
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  NO_ROWS_FOUND_POSTGREST: 'PGRST116', // Spécifique à PostgREST/Supabase
};

// --- Clients Supabase ---
// Client pour les opérations en lecture (GET) qui doivent respecter la sécurité au niveau des lignes (RLS)
// Utilise une clé publique (NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client pour les opérations d'écriture (POST, PUT, DELETE) ou celles nécessitant des privilèges de service
// Ce client contourne le RLS et doit être utilisé avec prudence pour les opérations critiques.
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Schéma de validation pour la mise à jour d'un utilisateur ---
const updateUserSchema = z.object({
  username: z.string()
    .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères.")
    .max(50, "Le nom d'utilisateur ne doit pas dépasser 50 caractères.")
    .optional(),
  password: z.string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères.")
    .max(100, "Le mot de passe ne doit pas dépasser 100 caractères.")
    .optional(),
  is_admin: z.boolean().optional(),
});

// --- Fonctions utilitaires ---

/**
 * Utilitaire centralisé de gestion des erreurs.
 * Simplifie l'envoi des réponses d'erreur et la journalisation.
 * @param res L'objet CustomApiResponse.
 * @param statusCode Le code d'état HTTP à envoyer.
 * @param message Le message d'erreur convivial à l'utilisateur.
 * @param details Les détails de l'erreur interne pour la journalisation.
 */
function handleError(
  res: CustomApiResponse, // Type mis à jour ici
  statusCode: number,
  message: string,
  details?: any
) {
  logger.error(message, details);
  return res.status(statusCode).json({ error: message });
}

/**
 * Récupère l'utilisateur authentifié à partir du jeton JWT fourni dans les en-têtes de la requête.
 * Utilise le client `supabaseServiceRole` pour vérifier le jeton.
 * @param req L'objet CustomApiRequest.
 * @returns L'objet utilisateur Supabase ou null si non authentifié/invalide.
 */
async function getCurrentUser(req: CustomApiRequest): Promise<any | null> { // Type mis à jour ici
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.debug('En-tête d\'autorisation manquant.');
    return null;
  }

  const token = authHeader.split(' ')[1]; // Extrait le jeton Bearer
  if (!token) {
    logger.debug('Jeton Bearer manquant.');
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseServiceRole.auth.getUser(token);
    if (error || !user) {
      logger.warn('Erreur lors de la récupération de l\'utilisateur ou utilisateur non trouvé.', { error });
      return null;
    }
    return user;
  } catch (error) {
    logger.error('Erreur inattendue lors de la récupération de l\'utilisateur.', { error });
    return null;
  }
}

/**
 * Vérifie si l'utilisateur donné a un rôle d'administrateur.
 * Se base sur les `app_metadata` de l'utilisateur Supabase.
 * @param user L'objet utilisateur Supabase.
 * @returns Vrai si l'utilisateur est admin, faux sinon.
 */
async function isAdmin(user: any): Promise<boolean> {
  // Assurez-vous que le rôle 'admin' est correctement défini dans les app_metadata de vos utilisateurs Supabase.
  const userRole = user?.app_metadata?.role;
  const isCurrentUserAdmin = userRole === 'admin';

  if (!isCurrentUserAdmin) {
    logger.debug('Vérification isAdmin: L\'utilisateur n\'est pas administrateur.', { userId: user?.id, userRole });
  }
  return isCurrentUserAdmin;
}

// --- Gestionnaire d'API ---
export default async function handler(req: CustomApiRequest, res: CustomApiResponse) { // Types mis à jour ici
  const id = req.query.id;
  // Validation de l'ID utilisateur : doit être un entier positif
  const userId = typeof id === 'string' ? parseInt(id, 10) : (Array.isArray(id) ? parseInt(id[0], 10) : undefined);

  if (userId === undefined || isNaN(userId) || userId <= 0) {
    return handleError(res, 400, "ID utilisateur invalide.", { id: req.query.id });
  }

  // --- Authentification et Autorisation (globale pour PUT/DELETE) ---
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
  }

  const currentAdmin = await isAdmin(currentUser);

  // Pour les opérations PUT/DELETE, seul un administrateur peut modifier ou supprimer des utilisateurs.
  // Exception: un utilisateur pourrait potentiellement modifier ses PROPRES données non-admin via un autre endpoint.
  if (!currentAdmin) {
    return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis pour gérer les utilisateurs.");
  }

  try {
    if (req.method === 'GET') {
      // Pour les requêtes GET, utilisez supabaseAnon pour respecter le RLS
      const { data: user, error } = await supabaseAnon
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .select('id, username, is_admin, created_at') // Ne sélectionnez JAMAIS le mot de passe ou d'autres données sensibles
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
          return handleError(res, 404, "Utilisateur non trouvé.", { error, userId });
        }
        return handleError(res, 500, "Erreur lors de la récupération de l'utilisateur.", { error, userId });
      }

      if (!user) { // Redondant si PGRST116 est géré, mais pour une vérification explicite
        return handleError(res, 404, "Utilisateur non trouvé.", { userId });
      }

      return res.status(200).json(user);

    } else if (req.method === 'PUT') {
      // 1. Validation du corps de la requête avec Zod
      const result = updateUserSchema.safeParse(req.body);
      if (!result.success) {
        return handleError(res, 400, "Données de mise à jour invalides.", { errors: result.error.issues, body: req.body, userId });
      }

      const updateData = { ...result.data };

      // 2. Hashage du mot de passe si fourni
      if (updateData.password) {
        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        updateData.password = hashedPassword;
      }

      // 3. Vérification des conflits de NOM D'UTILISATEUR (si le username est mis à jour)
      if (updateData.username) {
        const { data: existingUserWithUsername, error: usernameCheckError } = await supabaseAnon
          .from('users')
          .select('id')
          .eq('username', updateData.username)
          .neq('id', userId) // Exclure l'utilisateur actuel
          .single();

        if (usernameCheckError && usernameCheckError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
          return handleError(res, 500, "Erreur lors de la vérification de l'unicité du nom d'utilisateur.", { usernameCheckError, username: updateData.username });
        }
        if (existingUserWithUsername) {
          return handleError(res, 409, "Conflit: Le nom d'utilisateur est déjà utilisé par un autre compte.", { username: updateData.username });
        }
      }

      // 4. Exécuter la mise à jour en utilisant le client de rôle de service
      const { data: updatedUser, error: updateError } = await supabaseServiceRole
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .update(updateData)
        .eq('id', userId)
        .select('id, username, is_admin, created_at') // Ne retournez JAMAIS le mot de passe
        .single();

      if (updateError) {
        // Gérer les erreurs PostgreSQL spécifiques, comme la violation d'unicité (username)
        if (updateError.code === SUPABASE_ERROR_CODES.UNIQUE_VIOLATION) {
          return handleError(res, 409, "Conflit: Un utilisateur avec ce nom existe déjà.", { updateError, userId, data: updateData });
        }
        return handleError(res, 500, "Erreur lors de la mise à jour de l'utilisateur.", { updateError, userId, data: updateData });
      }

      if (!updatedUser) { // Ne devrait pas arriver si l'ID est valide et les données sont ok
        return handleError(res, 404, "Utilisateur non trouvé pour la mise à jour (peut-être déjà supprimé).", { userId });
      }

      return res.status(200).json(updatedUser);

    } else if (req.method === 'DELETE') {
      // 1. Vérification pour empêcher la suppression de son propre compte
      if (currentUser.id === userId) {
        return handleError(res, 400, "Impossible de supprimer votre propre compte.", { userId });
      }

      // 2. Exécuter la suppression en utilisant le client de rôle de service
      const { error: deleteError } = await supabaseServiceRole
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .delete()
        .eq('id', userId);

      if (deleteError) {
        // Gérer les erreurs de clés étrangères si d'autres entités dépendent de cet utilisateur
        if (deleteError.code === SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
          return handleError(res, 409, "Impossible de supprimer l'utilisateur car d'autres éléments y sont liés (ex: commentaires, vidéos).", { deleteError, userId });
        }
        return handleError(res, 500, "Erreur lors de la suppression de l'utilisateur.", { deleteError, userId });
      }

      // 3. Vérifier si la suppression a eu lieu (optionnel, mais assure la cohérence)
      const { data: deletedUserCheck, error: checkError } = await supabaseAnon
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle(); // maybeSingle retourne null si non trouvé, pas d'erreur PGRST116

      if (checkError) {
        logger.error('Erreur lors de la vérification de l\'existence de l\'utilisateur après suppression.', { error: checkError, userId });
        // Ne bloque pas la réponse principale si cette vérification échoue, juste loggue.
      }

      if (deletedUserCheck === null) { // Si l'utilisateur n'est plus trouvé
        return res.status(204).send(); // 204 No Content pour une suppression réussie sans corps de réponse
      } else {
        // Cela signifie que la suppression a échoué côté DB même sans erreur explicite
        return handleError(res, 500, "La suppression de l'utilisateur a échoué inopinément.", { userId });
      }

    } else {
      // --- Gérer les méthodes HTTP non autorisées ---
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, userId });
    }

  } catch (error) {
    // --- Gérer les erreurs inattendues ---
    return handleError(res, 500, "Erreur interne du serveur lors de la gestion de l'utilisateur.", { error, userId });
  }
}
