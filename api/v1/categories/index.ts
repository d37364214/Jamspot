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
const insertCategorySchema = z.object({
  name: z.string().min(1, "Le nom de la catégorie est requis.").max(100, "Le nom ne doit pas dépasser 100 caractères."),
  slug: z.string()
    .min(1, "Le slug est requis.")
    .max(100, "Le slug ne doit pas dépasser 100 caractères.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Le slug doit être en minuscules, sans espaces et utiliser des tirets pour séparer les mots."),
  description: z.string().max(500, "La description ne doit pas dépasser 500 caractères.").optional(),
  image_url: z.string().url("L'URL de l'image est invalide.").optional(),
  parent_category_id: z.number().int("L'ID de la catégorie parente doit être un entier.").nullable().optional(),
  is_active: z.boolean().optional().default(true),
  position: z.number().int("La position doit être un entier.").optional().default(0),
});

// --- Fonctions utilitaires ---

/**
 * Vérifie si l'utilisateur authentifié a un rôle 'admin'.
 * Cette fonction utilise le client de rôle de service pour vérifier le jeton JWT
 * et extraire les métadonnées de l'utilisateur.
 * @param req L'objet CustomApiRequest contenant les en-têtes d'autorisation.
 * @returns Un objet contenant `isAdmin` (booléen) et `userId` (chaîne de caractères ou null).
 */
async function isAdmin(req: CustomApiRequest): Promise<{ isAdmin: boolean; userId: string | null }> { // Type mis à jour ici
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.warn('En-tête d\'autorisation manquant pour la vérification admin.');
    return { isAdmin: false, userId: null };
  }

  const token = authHeader.split(' ')[1]; // Extrait le jeton Bearer
  if (!token) {
    logger.warn('Jeton Bearer manquant pour la vérification admin.');
    return { isAdmin: false, userId: null };
  }

  try {
    // Vérifie le jeton en utilisant le client de rôle de service.
    // C'est nécessaire car le client anon ne peut pas toujours vérifier les jetons.
    const { data: { user }, error } = await supabaseServiceRole.auth.getUser(token);

    if (error || !user) {
      logger.error('Erreur lors de l\'obtention de l\'utilisateur à partir du jeton ou utilisateur non trouvé.', { error });
      return { isAdmin: false, userId: null };
    }

    // Vérifie le rôle de l'utilisateur à partir de ses métadonnées d'application.
    // Vous devez vous assurer que ce rôle est correctement défini lors de l'enregistrement/mise à jour de l'utilisateur.
    const userRole = user.app_metadata?.role;
    const isCurrentUserAdmin = userRole === 'admin';

    if (isCurrentUserAdmin) {
      logger.info('L\'utilisateur est admin.', { userId: user.id });
    } else {
      logger.warn('L\'utilisateur n\'est pas admin.', { userId: user.id, userRole });
    }

    return { isAdmin: isCurrentUserAdmin, userId: user.id };

  } catch (error) {
    logger.error('Erreur inattendue lors de la vérification du rôle admin.', { error });
    return { isAdmin: false, userId: null };
  }
}

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

// --- Gestionnaire d'API ---
export default async function handler(req: CustomApiRequest, res: CustomApiResponse) { // Types mis à jour ici
  switch (req.method) {
    case 'GET':
      try {
        // Pour les requêtes GET (lecture), utilisez le client anon pour respecter le RLS.
        const { data: categoriesList, error } = await supabaseAnon
          .from('categories')
          .select('*');

        if (error) {
          return handleError(res, 500, "Erreur lors de la récupération des catégories.", { error });
        }

        return res.status(200).json(categoriesList);
      } catch (error) {
        return handleError(res, 500, "Erreur inattendue lors de la récupération des catégories.", { error });
      }

    case 'POST':
      // Vérification de l'authentification et de l'autorisation pour l'opération POST.
      const { isAdmin: postIsAdmin, userId } = await isAdmin(req);
      if (!postIsAdmin) {
        return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis pour créer une catégorie.");
      }

      try {
        // 1. Validation du corps de la requête avec Zod.
        const result = insertCategorySchema.safeParse(req.body);
        if (!result.success) {
          return handleError(res, 400, "Données de création invalides.", { errors: result.error.issues, body: req.body });
        }
        const newCategoryData = result.data;

        // 2. Vérification de l'existence de la catégorie parente si parent_category_id est fourni.
        if (newCategoryData.parent_category_id !== null && newCategoryData.parent_category_id !== undefined) {
          const { data: parentCategory, error: parentError } = await supabaseAnon
            .from('categories')
            .select('id')
            .eq('id', newCategoryData.parent_category_id)
            .single();

          if (parentError || !parentCategory) {
            // Si le code d'erreur indique que la ligne n'a pas été trouvée, c'est que la catégorie parente n'existe pas.
            if (parentError?.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
                return handleError(res, 400, "L'ID de la catégorie parente spécifiée n'existe pas.", { parentId: newCategoryData.parent_category_id });
            }
            // Gérer d'autres erreurs éventuelles lors de la vérification de la catégorie parente.
            return handleError(res, 500, "Erreur lors de la vérification de la catégorie parente.", { parentError });
          }
        }

        // 3. Insertion de la nouvelle catégorie en utilisant le client de rôle de service (pour contourner RLS si nécessaire).
        const { data: newCategory, error: insertError } = await supabaseServiceRole
          .from('categories')
          .insert([newCategoryData])
          .select('*')
          .single();

        if (insertError) {
          // Gestion spécifique des erreurs PostgreSQL, comme la violation d'unicité du slug.
          if (insertError.code === SUPABASE_ERROR_CODES.UNIQUE_VIOLATION) {
            return handleError(res, 409, "Un conflit est survenu: une catégorie avec ce slug existe déjà.", { insertError, data: newCategoryData });
          }
          return handleError(res, 500, "Erreur lors de la création de la catégorie.", { insertError, data: newCategoryData });
        }

        // 4. Création du log d'activité.
        // Cette opération est facultative et ne doit pas bloquer la réponse principale.
        if (userId && newCategory) { // S'assurer que l'ID utilisateur et la nouvelle catégorie sont disponibles.
          const { error: activityLogError } = await supabaseServiceRole
            .from('activity_logs') // Assurez-vous que 'activity_logs' est le nom de votre table
            .insert([
              {
                action: "CREATE",
                entity_type: "category",
                entity_id: newCategory.id,
                user_id: userId,
                details: `Catégorie créée: ${newCategory.name}`,
                timestamp: new Date().toISOString(),
              },
            ]);

          if (activityLogError) {
            logger.error('Erreur lors de la création du log d\'activité.', { error: activityLogError, categoryId: newCategory.id, userId });
            // Ne renvoyez pas d'erreur 500 à l'utilisateur final juste pour un problème de log.
          }
        } else {
          logger.warn('Impossible de déterminer l\'ID utilisateur ou la nouvelle catégorie pour le log d\'activité.');
        }

        return res.status(201).json(newCategory); // Renvoie la nouvelle catégorie créée avec un statut 201.
      } catch (error) {
        return handleError(res, 500, "Erreur inattendue lors de la création de la catégorie.", { error, body: req.body });
      }

    default:
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, url: req.url });
  }
}
