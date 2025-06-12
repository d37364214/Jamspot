import type { CustomApiRequest, CustomApiResponse } from '../../../api/types'; // Chemin ajusté
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire

// --- Constantes pour les codes d'erreur Supabase/PostgreSQL ---
const SUPABASE_ERROR_CODES = {
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  NO_ROWS_FOUND_POSTGREST: 'PGRST116', // Spécifique à PostgREST/Supabase
};

// --- Clients Supabase ---
// Client pour les opérations en lecture (GET) qui doivent respecter la sécurité au niveau des lignes (RLS)
// Utilisez process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY qui est accessible publiquement
const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client pour les opérations d'écriture (POST, PUT, DELETE) nécessitant des privilèges de service
// Ce client contourne le RLS et doit être utilisé avec prudence.
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Schéma de validation Zod ---
const updateCommentSchema = z.object({
  content: z.string()
    .min(1, "Le commentaire ne peut pas être vide.")
    .max(1000, "Le commentaire est trop long (max 1000 caractères).")
});

// --- Fonctions utilitaires ---

/**
 * Utilitaire centralisé de gestion des erreurs.
 * Simplifie le retour d'erreurs et la journalisation.
 * @param res L'objet CustomApiResponse.
 * @param statusCode Le code d'état HTTP à renvoyer.
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
  const commentId = req.query.id;
  const commentIdInt = typeof commentId === 'string' ? parseInt(commentId, 10) : (Array.isArray(commentId) ? parseInt(commentId[0], 10) : undefined);

  if (commentIdInt === undefined || isNaN(commentIdInt)) {
    return handleError(res, 400, "ID de commentaire invalide.", { id: req.query.id });
  }

  // --- 1. Authentification et Autorisation ---
  const user = await getCurrentUser(req);
  if (!user) {
    return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
  }

  try {
    // --- 2. Récupération du commentaire pour vérifier les permissions ---
    // Utilisez supabaseAnon ici pour respecter les RLS et ne lire que ce qui est autorisé.
    const { data: comment, error: fetchError } = await supabaseAnon
      .from('comments')
      .select('id, user_id') // Ne récupérez que les champs nécessaires pour la vérification
      .eq('id', commentIdInt)
      .single();

    if (fetchError) {
      if (fetchError.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
        return handleError(res, 404, "Commentaire non trouvé.", { commentId: commentIdInt, fetchError });
      }
      return handleError(res, 500, "Erreur lors de la récupération du commentaire.", { fetchError, commentId: commentIdInt });
    }

    if (!comment) { // Double vérification, utile si le RLS masque le commentaire mais la DB ne renvoie pas d'erreur spécifique
      return handleError(res, 404, "Commentaire non trouvé ou accès non autorisé à ce commentaire.", { commentId: commentIdInt });
    }

    // Vérification des permissions: Est-ce que l'utilisateur est admin OU le propriétaire du commentaire ?
    const isCurrentUserAdmin = await isAdmin(user);
    const isOwner = (comment.user_id === user.id);
    const canModify = isCurrentUserAdmin || isOwner;

    if (!canModify) {
      return handleError(res, 403, "Non autorisé: Vous n'avez pas les permissions nécessaires pour modifier ou supprimer ce commentaire.", { userId: user.id, commentUserId: comment.user_id, commentId: commentIdInt });
    }

    // --- 3. Gestion des méthodes HTTP ---
    if (req.method === 'PUT') {
      const validation = updateCommentSchema.safeParse(req.body);

      if (!validation.success) {
        return handleError(res, 400, "Données de mise à jour invalides.", { errors: validation.error.flatten(), body: req.body, commentId: commentIdInt });
      }

      // Utilisez supabaseServiceRole pour l'opération d'écriture (PUT) après vérification des permissions.
      const { data: updatedComment, error: updateError } = await supabaseServiceRole
        .from('comments')
        .update({ content: validation.data.content })
        .eq('id', commentIdInt)
        .select('*') // Retourne le commentaire mis à jour
        .single();

      if (updateError) {
        return handleError(res, 500, "Erreur lors de la mise à jour du commentaire.", { updateError, commentId: commentIdInt, content: validation.data.content });
      }

      return res.status(200).json(updatedComment);

    } else if (req.method === 'DELETE') {
      // Utilisez supabaseServiceRole pour l'opération d'écriture (DELETE) après vérification des permissions.
      const { error: deleteError } = await supabaseServiceRole
        .from('comments')
        .delete()
        .eq('id', commentIdInt);

      if (deleteError) {
        // Gérer les violations de clés étrangères si d'autres entités dépendent des commentaires.
        if (deleteError.code === SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
          return handleError(res, 409, "Impossible de supprimer ce commentaire car d'autres éléments en dépendent.", { deleteError, commentId: commentIdInt });
        }
        return handleError(res, 500, "Erreur lors de la suppression du commentaire.", { deleteError, commentId: commentIdInt });
      }

      // 204 No Content est la réponse standard pour une suppression réussie sans corps de réponse.
      return res.status(204).send();

    } else {
      // Méthode non prise en charge
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, commentId: commentIdInt });
    }

  } catch (error) {
    // Gestion des erreurs inattendues
    return handleError(res, 500, "Erreur interne du serveur lors de l'opération sur le commentaire.", { error, commentId: commentIdInt });
  }
}
