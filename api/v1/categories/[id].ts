import type { CustomApiRequest, CustomApiResponse } from '../../../api/types'; // Chemin ajusté
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire

// --- Clients Supabase ---
// Client pour les opérations qui doivent respecter la sécurité au niveau des lignes (RLS)
// Utilisez process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY s'il s'agit d'une clé publique accessible depuis le frontend
const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Ou votre clé publique équivalente
);

// Client pour les opérations qui nécessitent les privilèges du rôle de service (contourne le RLS)
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Schémas Zod ---
const updateCategorySchema = z.object({
  name: z.string().min(1, "Le nom est requis").optional(),
  slug: z.string().min(1, "Le slug est requis").optional(),
  description: z.string().optional(),
  image_url: z.string().url("L'URL de l'image est invalide").optional(),
  parent_category_id: z.number().int().nullable().optional(),
  is_active: z.boolean().optional(),
  position: z.number().int().optional(),
});

// --- Fonctions utilitaires ---

/**
 * Vérifie si l'utilisateur authentifié a un rôle 'admin'.
 * Ceci est un espace réservé ; vous devrez implémenter votre logique réelle de vérification des rôles.
 * Pour Supabase, cela implique généralement d'interroger les métadonnées de l'utilisateur ou une table 'roles'.
 */
async function isAdmin(req: CustomApiRequest): Promise<boolean> { // Type mis à jour ici
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.warn('En-tête d\'autorisation manquant pour la vérification admin');
    return false;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    logger.warn('Jeton Bearer manquant pour la vérification admin');
    return false;
  }

  try {
    // Vérifiez le jeton en utilisant la clé du rôle de service pour obtenir les données de l'utilisateur
    // Cela suppose que vos rôles d'utilisateur sont intégrés dans le JWT ou liés aux métadonnées de l'utilisateur
    const { data: { user }, error } = await supabaseServiceRole.auth.getUser(token);

    if (error || !user) {
      logger.error('Erreur lors de l\'obtention de l\'utilisateur à partir du jeton ou utilisateur non trouvé', { error });
      return false;
    }

    // Exemple : Vérifiez si les métadonnées de l'application de l'utilisateur contiennent un 'role' 'admin'
    // Vous devez vous assurer que ces métadonnées sont correctement définies lors de la création/mise à jour de l'utilisateur
    const userRole = user.app_metadata?.role;
    if (userRole === 'admin') {
      logger.info('L\'utilisateur est admin', { userId: user.id });
      return true;
    }

    logger.warn('L\'utilisateur n\'est pas admin', { userId: user.id, userRole });
    return false;

  } catch (error) {
    logger.error('Erreur lors de la vérification du rôle admin', { error });
    return false;
  }
}

/**
 * Utilitaire centralisé de gestion des erreurs.
 * @param res Objet CustomApiResponse.
 * @param statusCode Code d'état HTTP.
 * @param message Message d'erreur convivial.
 * @param details Objet d'erreur détaillé facultatif pour la journalisation.
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

// --- Gestionnaire d'API ---
export default async function handler(req: CustomApiRequest, res: CustomApiResponse) { // Types mis à jour ici
  // Assurez-vous que l'id est une seule chaîne et analysez-la
  const { id } = req.query;
  const categoryId = typeof id === 'string' ? parseInt(id, 10) : undefined;

  if (categoryId === undefined || isNaN(categoryId)) {
    return handleError(res, 400, "ID de catégorie invalide", { id: req.query.id });
  }

  switch (req.method) {
    case 'GET':
      try {
        // Utilisez supabaseAnon pour les requêtes GET afin de respecter le RLS
        const { data: category, error } = await supabaseAnon
          .from('categories')
          .select('*')
          .eq('id', categoryId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') { // Code d'erreur PostgreSQL pour 'Aucune ligne trouvée' (spécifique à Supabase)
            return handleError(res, 404, "Catégorie non trouvée", { error, categoryId });
          }
          return handleError(res, 500, "Erreur lors de la récupération de la catégorie", { error, categoryId });
        }

        if (!category) { // Redondant si PGRST116 est géré, mais bon pour une vérification explicite
          return handleError(res, 404, "Catégorie non trouvée", { categoryId });
        }

        return res.status(200).json(category);
      } catch (error) {
        return handleError(res, 500, "Erreur inattendue lors de la récupération de la catégorie", { error, categoryId });
      }

    case 'PUT':
      // Vérification de l'authentification et de l'autorisation
      const putIsAdmin = await isAdmin(req);
      if (!putIsAdmin) {
        return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis.");
      }

      try {
        // 1. Valider le corps de la requête
        const result = updateCategorySchema.safeParse(req.body);
        if (!result.success) {
          return handleError(res, 400, "Données de mise à jour invalides", { errors: result.error.issues, body: req.body, categoryId });
        }
        const dataToUpdate = result.data;

        // 2. Optionnel : Vérifier si la catégorie existe avant de la mettre à jour (réduit les écritures DB inutiles)
        const { data: existingCategory, error: fetchError } = await supabaseAnon
          .from('categories')
          .select('id')
          .eq('id', categoryId)
          .single();

        if (fetchError || !existingCategory) {
          return handleError(res, 404, "Catégorie non trouvée pour la mise à jour", { categoryId, fetchError });
        }

        // 3. Effectuer la mise à jour en utilisant le client de rôle de service pour des permissions élevées (si RLS empêche la mise à jour avec ANON_KEY)
        // Si RLS permet aux administrateurs de mettre à jour avec ANON_KEY, vous pourriez utiliser supabaseAnon ici.
        const { data: updatedCategory, error: updateError } = await supabaseServiceRole
          .from('categories')
          .update(dataToUpdate)
          .eq('id', categoryId)
          .select('*') // Sélectionner la ligne mise à jour pour la renvoyer
          .single();

        if (updateError) {
          // Gérer les erreurs PostgreSQL spécifiques comme les violations d'unicité (par exemple, pour le slug)
          if (updateError.code === '23505') { // unique_violation
            return handleError(res, 409, "Un conflit est survenu (par exemple, le slug existe déjà).", { updateError, categoryId, dataToUpdate });
          }
          return handleError(res, 500, "Erreur lors de la mise à jour de la catégorie", { updateError, categoryId, dataToUpdate });
        }

        if (!updatedCategory) { // Ne devrait pas arriver si les vérifications précédentes sont bonnes
          return handleError(res, 404, "Catégorie non trouvée après mise à jour (problème interne)", { categoryId });
        }

        return res.status(200).json(updatedCategory);
      } catch (error) {
        return handleError(res, 500, "Erreur inattendue lors de la mise à jour de la catégorie", { error, categoryId, body: req.body });
      }

    case 'DELETE':
      // Vérification de l'authentification et de l'autorisation
      const deleteIsAdmin = await isAdmin(req);
      if (!deleteIsAdmin) {
        return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis.");
      }

      try {
        // 1. Vérifier les vidéos ou sous-catégories associées AVANT de tenter la suppression
        // Cela rend le message d'erreur plus convivial et évite une erreur de la DB si possible.
        const { data: relatedVideos, error: videosError } = await supabaseAnon
          .from('videos') // En supposant que la table 'videos' existe et se lie aux catégories
          .select('id')
          .eq('category_id', categoryId)
          .limit(1);

        if (videosError) {
          logger.error('Erreur lors de la vérification des vidéos liées', { videosError, categoryId });
          // Continuer pour permettre à la DB de détecter la clé étrangère si cette vérification échoue
        } else if (relatedVideos && relatedVideos.length > 0) {
          return handleError(res, 409, "Impossible de supprimer la catégorie: des vidéos y sont associées.", { categoryId });
        }

        const { data: relatedSubcategories, error: subcategoriesError } = await supabaseAnon
          .from('categories') // En supposant que les sous-catégories sont simplement des catégories avec un parent_category_id
          .select('id')
          .eq('parent_category_id', categoryId)
          .limit(1);

        if (subcategoriesError) {
          logger.error('Erreur lors de la vérification des sous-catégories liées', { subcategoriesError, categoryId });
          // Continuer pour permettre à la DB de détecter la clé étrangère si cette vérification échoue
        } else if (relatedSubcategories && relatedSubcategories.length > 0) {
          return handleError(res, 409, "Impossible de supprimer la catégorie: des sous-catégories y sont associées.", { categoryId });
        }

        // 2. Effectuer la suppression en utilisant le client de rôle de service
        const { error: deleteError } = await supabaseServiceRole
          .from('categories')
          .delete()
          .eq('id', categoryId);

        if (deleteError) {
          if (deleteError.code === '23503') { // PostgreSQL foreign_key_violation
            return handleError(res, 409, "Impossible de supprimer une catégorie contenant des éléments liés (vidéos, sous-catégories, etc.).", { deleteError, categoryId });
          }
          return handleError(res, 500, "Erreur lors de la suppression de la catégorie", { deleteError, categoryId });
        }

        return res.status(204).send(); // 204 No Content pour une suppression réussie
      } catch (error) {
        return handleError(res, 500, "Erreur inattendue lors de la suppression de la catégorie", { error, categoryId });
      }

    default:
      return handleError(res, 405, "Méthode non autorisée", { method: req.method, categoryId });
  }
}
