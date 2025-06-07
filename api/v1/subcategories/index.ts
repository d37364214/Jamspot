import type { NextApiRequest, NextApiResponse } from 'next'; // Utilisé uniquement pour les typages
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

// Client pour les opérations d'écriture (POST) ou celles nécessitant des privilèges de service
// Ce client contourne le RLS et doit être utilisé avec prudence pour les opérations critiques.
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Schéma Zod pour la création d'une sous-catégorie ---
const insertSubcategorySchema = z.object({
  name: z.string().min(1, "Le nom est requis.").max(100, "Le nom ne doit pas dépasser 100 caractères."),
  slug: z.string()
    .min(1, "Le slug est requis.")
    .max(100, "Le slug ne doit pas dépasser 100 caractères.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Le slug doit être en minuscules, sans espaces et utiliser des tirets pour séparer les mots."),
  description: z.string().max(500, "La description est trop longue.").optional(),
  category_id: z.number().int("L'ID de la catégorie parente doit être un entier.").positive("L'ID de la catégorie parente est invalide.").nullable(), // category_id ne peut pas être undefined s'il est nullable
  is_active: z.boolean().optional().default(true),
  position: z.number().int("La position doit être un entier.").optional().default(0),
});

// --- Fonctions utilitaires ---

/**
 * Utilitaire centralisé de gestion des erreurs.
 * Simplifie l'envoi des réponses d'erreur et la journalisation.
 * @param res L'objet NextApiResponse.
 * @param statusCode Le code d'état HTTP à envoyer.
 * @param message Le message d'erreur convivial à l'utilisateur.
 * @param details Les détails de l'erreur interne pour la journalisation.
 */
function handleError(
  res: NextApiResponse,
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
 * @param req L'objet NextApiRequest.
 * @returns L'objet utilisateur Supabase ou null si non authentifié/invalide.
 */
async function getCurrentUser(req: NextApiRequest): Promise<any | null> {
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
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const categoryIdQuery = req.query.categoryId;
      const pageQuery = req.query.page;
      const limitQuery = req.query.limit;

      // Validation stricte de categoryId
      const categoryId = typeof categoryIdQuery === 'string' ? parseInt(categoryIdQuery, 10) : (Array.isArray(categoryIdQuery) ? parseInt(categoryIdQuery[0], 10) : undefined);
      if (categoryId !== undefined && (isNaN(categoryId) || categoryId <= 0)) {
        return handleError(res, 400, "ID de catégorie invalide pour le filtre.", { categoryId: categoryIdQuery });
      }

      // Validation de la pagination
      const page = parseInt(typeof pageQuery === 'string' ? pageQuery : '1', 10);
      const limit = parseInt(typeof limitQuery === 'string' ? limitQuery : '10', 10);
      const offset = (page - 1) * limit;

      if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
        return handleError(res, 400, "Paramètres de pagination invalides (page ou limit).", { pageQuery, limitQuery });
      }

      // Utilise supabaseAnon pour les requêtes GET afin de respecter le RLS
      let query = supabaseAnon
        .from('subcategories') // Assurez-vous que 'subcategories' est le nom de votre table
        .select('id, name, slug, description, category_id, is_active, position'); // Sélectionnez les champs nécessaires

      if (categoryId) {
        query = query.eq('category_id', categoryId);
        logger.debug('Récupération des sous-catégories par ID de catégorie.', { categoryId });
      } else {
        logger.debug('Récupération de toutes les sous-catégories.');
      }

      query = query
        .order('position', { ascending: true }) // Ordonne par position par défaut
        .range(offset, offset + limit - 1); // Applique la pagination

      const { data: subcategoriesList, error } = await query;

      if (error) {
        return handleError(res, 500, "Erreur lors de la récupération des sous-catégories.", { error, categoryId });
      }

      // Pour la pagination, vous pourriez aussi vouloir le nombre total de sous-catégories
      // const { count, error: countError } = await supabaseAnon
      //   .from('subcategories')
      //   .select('*', { count: 'exact' })
      //   .eq('category_id', categoryId || categoryId); // Adaptez si vous filtrez
      // if (countError) logger.error('Error fetching subcategories count', { countError });

      return res.status(200).json({
        data: subcategoriesList,
        page,
        limit,
        // total: count // Incluez le total si vous faites la requête de comptage
      });

    } else if (req.method === 'POST') {
      // --- Authentification et Autorisation pour POST ---
      const currentUserForPost = await getCurrentUser(req);
      if (!currentUserForPost) {
        return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
      }
      const adminCheckForPost = await isAdmin(currentUserForPost);
      if (!adminCheckForPost) {
        return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis pour créer une sous-catégorie.");
      }

      // --- Validation du corps de la requête ---
      const result = insertSubcategorySchema.safeParse(req.body);
      if (!result.success) {
        return handleError(res, 400, "Données de création invalides.", { errors: result.error.issues, body: req.body });
      }
      const newSubcategoryData = result.data;

      // --- Vérification de l'unicité du SLUG ---
      if (newSubcategoryData.slug) {
        const { data: existingSubcategory, error: slugCheckError } = await supabaseAnon
          .from('subcategories')
          .select('id')
          .eq('slug', newSubcategoryData.slug)
          .single();

        if (slugCheckError && slugCheckError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
          return handleError(res, 500, "Erreur lors de la vérification de l'unicité du slug.", { slugCheckError, slug: newSubcategoryData.slug });
        }
        if (existingSubcategory) {
          return handleError(res, 409, "Conflit: Le slug est déjà utilisé par une autre sous-catégorie.", { slug: newSubcategoryData.slug });
        }
      }

      // --- Vérification de l'existence de la catégorie parente (si category_id est fourni) ---
      if (newSubcategoryData.category_id !== null && newSubcategoryData.category_id !== undefined) {
        const { data: parentCategory, error: parentCategoryError } = await supabaseAnon
          .from('categories') // Assurez-vous que 'categories' est le nom de votre table
          .select('id')
          .eq('id', newSubcategoryData.category_id)
          .single();

        if (parentCategoryError || !parentCategory) {
          if (parentCategoryError?.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
            return handleError(res, 400, "L'ID de la catégorie parente spécifiée n'existe pas.", { parentId: newSubcategoryData.category_id });
          }
          return handleError(res, 500, "Erreur lors de la vérification de la catégorie parente.", { parentCategoryError });
        }
      }

      // --- Insertion de la nouvelle sous-catégorie ---
      // Utilise supabaseServiceRole pour l'insertion
      const { data: newSubcategory, error: createError } = await supabaseServiceRole
        .from('subcategories') // Assurez-vous que 'subcategories' est le nom de votre table
        .insert([newSubcategoryData])
        .select('*')
        .single();

      if (createError) {
        // Gérer les erreurs PostgreSQL spécifiques, comme la violation de clé étrangère
        if (createError.code === SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
          return handleError(res, 400, "ID de catégorie parente invalide: La catégorie parente spécifiée n'existe pas.", { createError, data: newSubcategoryData });
        }
        return handleError(res, 500, "Erreur lors de la création de la sous-catégorie.", { createError, data: newSubcategoryData });
      }

      return res.status(201).json(newSubcategory); // 201 Created

    } else {
      // --- Gérer les méthodes HTTP non autorisées ---
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, url: req.url });
    }

  } catch (error) {
    // --- Gérer les erreurs inattendues ---
    return handleError(res, 500, "Erreur interne du serveur.", { error });
  }
}

