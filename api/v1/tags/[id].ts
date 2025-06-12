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

// --- Schéma Zod pour la mise à jour d'un tag ---
const updateTagSchema = z.object({
  name: z.string().min(1, "Le nom du tag est requis.").max(100, "Le nom ne doit pas dépasser 100 caractères.").optional(),
  slug: z.string()
    .min(1, "Le slug est requis.")
    .max(100, "Le slug ne doit pas dépasser 100 caractères.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Le slug doit être en minuscules, sans espaces et utiliser des tirets pour séparer les mots.")
    .optional(),
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
  const tagId = typeof id === 'string' ? parseInt(id, 10) : (Array.isArray(id) ? parseInt(id[0], 10) : undefined);

  // Validation initiale de l'ID
  if (tagId === undefined || isNaN(tagId) || tagId <= 0) {
    return handleError(res, 400, "ID de tag invalide.", { id: req.query.id });
  }

  switch (req.method) {
    case 'GET':
      try {
        // Utilise supabaseAnon pour les requêtes GET afin de respecter le RLS
        const { data: tag, error } = await supabaseAnon
          .from('tags') // Assurez-vous que 'tags' est le nom de votre table
          .select('*')
          .eq('id', tagId)
          .single();

        if (error) {
          if (error.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
            return handleError(res, 404, "Tag non trouvé.", { error, tagId });
          }
          return handleError(res, 500, "Erreur lors de la récupération du tag.", { error, tagId });
        }

        if (!tag) { // Redondant si PGRST116 est géré, mais bon pour une vérification explicite
          return handleError(res, 404, "Tag non trouvé.", { tagId });
        }

        return res.status(200).json(tag);
      } catch (error) {
        return handleError(res, 500, "Erreur inattendue lors de la récupération du tag.", { error, tagId });
      }

    case 'PUT':
      // --- Authentification et Autorisation pour PUT ---
      const currentUserForPut = await getCurrentUser(req);
      if (!currentUserForPut) {
        return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
      }
      const adminCheckForPut = await isAdmin(currentUserForPut);
      if (!adminCheckForPut) {
        return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis pour mettre à jour un tag.");
      }

      try {
        // 1. Validation du corps de la requête avec Zod
        const result = updateTagSchema.safeParse(req.body);
        if (!result.success) {
          return handleError(res, 400, "Données de mise à jour invalides.", { errors: result.error.issues, body: req.body, tagId });
        }
        const dataToUpdate = result.data;

        // 2. Vérification des conflits de SLUG (si le slug est mis à jour)
        if (dataToUpdate.slug) {
          const { data: existingTagWithSlug, error: slugCheckError } = await supabaseAnon
            .from('tags')
            .select('id')
            .eq('slug', dataToUpdate.slug)
            .neq('id', tagId) // Exclure le tag actuel
            .single();

          if (slugCheckError && slugCheckError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
            // Gérer d'autres erreurs éventuelles lors de la vérification du slug
            return handleError(res, 500, "Erreur lors de la vérification de l'unicité du slug.", { slugCheckError, slug: dataToUpdate.slug });
          }
          if (existingTagWithSlug) {
            return handleError(res, 409, "Conflit: Le slug est déjà utilisé par un autre tag.", { slug: dataToUpdate.slug });
          }
        }

        // 3. Exécuter la mise à jour en utilisant le client de rôle de service
        const { data: updatedTag, error: updateError } = await supabaseServiceRole
          .from('tags') // Assurez-vous que 'tags' est le nom de votre table
          .update(dataToUpdate)
          .eq('id', tagId)
          .select('*')
          .single();

        if (updateError) {
          // Gestion des erreurs PostgreSQL spécifiques, comme la violation d'unicité (slug)
          if (updateError.code === SUPABASE_ERROR_CODES.UNIQUE_VIOLATION) {
            return handleError(res, 409, "Conflit: Un tag avec ce slug existe déjà.", { updateError, tagId, dataToUpdate });
          }
          // Gérer d'autres erreurs de mise à jour si nécessaire (ex: foreign key violation si un tag était lié à quelque chose d'autre qui n'existe plus, moins probable ici)
          return handleError(res, 500, "Erreur lors de la mise à jour du tag.", { updateError, tagId, dataToUpdate });
        }

        if (!updatedTag) { // Ne devrait pas arriver si l'ID est valide et les données sont ok
          return handleError(res, 404, "Tag non trouvé pour la mise à jour (peut-être déjà supprimé).", { tagId });
        }

        return res.status(200).json(updatedTag);
      } catch (error) {
        return handleError(res, 500, "Erreur inattendue lors de la mise à jour du tag.", { error, tagId, body: req.body });
      }

    case 'DELETE':
      // --- Authentification et Autorisation pour DELETE ---
      const currentUserForDelete = await getCurrentUser(req);
      if (!currentUserForDelete) {
        return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
      }
      const adminCheckForDelete = await isAdmin(currentUserForDelete);
      if (!adminCheckForDelete) {
        return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis pour supprimer un tag.");
      }

      try {
        // Optionnel: Vérification préalable des dépendances (ex: si le tag est associé à des vidéos)
        // La gestion de l'erreur FOREIGN_KEY_VIOLATION est également présente plus bas.
        // const { data: relatedVideos, error: videosError } = await supabaseAnon
        //   .from('videos_tags_join_table') // Nom de votre table de jointure si elle existe
        //   .select('id')
        //   .eq('tag_id', tagId)
        //   .limit(1);
        // if (videosError && videosError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
        //   logger.error('Erreur lors de la vérification des vidéos liées pour la suppression du tag.', { videosError, tagId });
        // } else if (relatedVideos && relatedVideos.length > 0) {
        //   return handleError(res, 409, "Impossible de supprimer le tag: des vidéos y sont associées.", { tagId });
        // }


        // Exécuter la suppression en utilisant le client de rôle de service
        const { error: deleteError } = await supabaseServiceRole
          .from('tags') // Assurez-vous que 'tags' est le nom de votre table
          .delete()
          .eq('id', tagId);

        if (deleteError) {
          // Gérer les erreurs de clés étrangères si des entités sont liées à ce tag
          if (deleteError.code === SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
            return handleError(res, 409, "Impossible de supprimer le tag car d'autres éléments y sont liés (ex: vidéos).", { deleteError, tagId });
          }
          return handleError(res, 500, "Erreur lors de la suppression du tag.", { deleteError, tagId });
        }

        return res.status(204).send(); // 204 No Content pour une suppression réussie

      } catch (error) {
        return handleError(res, 500, "Erreur inattendue lors de la suppression du tag.", { error, tagId });
      }

    default:
      // Méthode non prise en charge
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, tagId });
  }
}
