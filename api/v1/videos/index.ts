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

// --- Schéma Zod pour la création d'une vidéo ---
const insertVideoSchema = z.object({
  title: z.string().min(1, "Le titre est requis.").max(255, "Le titre est trop long."),
  description: z.string().max(5000, "La description est trop longue.").optional(),
  youtube_id: z.string().length(11, "L'ID YouTube doit avoir 11 caractères.").optional(), // Les IDs YouTube sont généralement de 11 caractères
  url: z.string().url("L'URL est invalide.").optional(), // Valide que c'est une URL si présente
  duration: z.number().int("La durée doit être un entier.").positive("La durée doit être positive.").optional(),
  category_id: z.number().int("L'ID de la catégorie doit être un entier.").positive("L'ID de la catégorie est invalide.").nullable().optional(),
  subcategory_id: z.number().int("L'ID de la sous-catégorie doit être un entier.").positive("L'ID de la sous-catégorie est invalide.").nullable().optional(),
  // Ajoutez d'autres champs selon votre schéma de base de données (ex: created_at, updated_at gérés par DB)
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
    logger.debug('En-tête d\'autorisation manquant pour getCurrentUser.');
    return null;
  }

  const token = authHeader.split(' ')[1]; // Extrait le jeton Bearer
  if (!token) {
    logger.debug('Jeton Bearer manquant pour getCurrentUser.');
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseServiceRole.auth.getUser(token);
    if (error || !user) {
      logger.warn('Erreur lors de la récupération de l\'utilisateur ou utilisateur non trouvé dans getCurrentUser.', { error });
      return null;
    }
    return user;
  } catch (error) {
    logger.error('Erreur inattendue lors de la récupération de l\'utilisateur dans getCurrentUser.', { error });
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
  try {
    if (req.method === 'GET') {
      const pageQuery = req.query.page;
      const limitQuery = req.query.limit;

      // Validation et application de la pagination
      const page = parseInt(typeof pageQuery === 'string' ? pageQuery : '1', 10);
      const limit = parseInt(typeof limitQuery === 'string' ? limitQuery : '10', 10);
      const offset = (page - 1) * limit;

      if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
        return handleError(res, 400, "Paramètres de pagination invalides (page ou limit).", { pageQuery, limitQuery });
      }

      // Utilise supabaseAnon pour les requêtes GET afin de respecter le RLS
      const { data: videosList, error, count } = await supabaseAnon
        .from('videos') // Assurez-vous que 'videos' est le nom de votre table
        .select('id, title, description, youtube_id, url, duration, category_id, subcategory_id, created_at', { count: 'exact' }) // Sélectionnez les champs nécessaires et demandez le total
        .order('created_at', { ascending: false }) // Ordonne par date de création (du plus récent au plus ancien)
        .range(offset, offset + limit - 1); // Applique la pagination

      if (error) {
        return handleError(res, 500, "Erreur lors de la récupération des vidéos.", { error });
      }

      return res.status(200).json({
        data: videosList,
        page,
        limit,
        total: count, // Incluez le nombre total de vidéos pour la pagination côté client
      });

    } else if (req.method === 'POST') {
      // --- Authentification et Autorisation pour POST ---
      const currentUserForPost = await getCurrentUser(req);
      if (!currentUserForPost) {
        return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
      }
      const adminCheckForPost = await isAdmin(currentUserForPost);
      if (!adminCheckForPost) {
        return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis pour créer une vidéo.");
      }

      // --- Validation du corps de la requête ---
      const result = insertVideoSchema.safeParse(req.body);
      if (!result.success) {
        return handleError(res, 400, "Données de création invalides.", { errors: result.error.issues, body: req.body });
      }
      const newVideoData = result.data;

      // --- Vérification de l'unicité de youtube_id si fourni ---
      if (newVideoData.youtube_id) {
        const { data: existingVideo, error: videoCheckError } = await supabaseAnon
          .from('videos')
          .select('id')
          .eq('youtube_id', newVideoData.youtube_id)
          .single();

        if (videoCheckError && videoCheckError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
          return handleError(res, 500, "Erreur lors de la vérification de l'unicité de l'ID YouTube.", { videoCheckError, youtube_id: newVideoData.youtube_id });
        }
        if (existingVideo) {
          return handleError(res, 409, "Conflit: Une vidéo avec cet ID YouTube existe déjà.", { youtube_id: newVideoData.youtube_id });
        }
      }

      // --- Vérification de l'existence de category_id si fourni ---
      if (newVideoData.category_id !== null && newVideoData.category_id !== undefined) {
        const { data: categoryExists, error: categoryError } = await supabaseAnon
          .from('categories') // Assurez-vous que 'categories' est le nom de votre table
          .select('id')
          .eq('id', newVideoData.category_id)
          .single();

        if (categoryError || !categoryExists) {
          if (categoryError?.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
            return handleError(res, 400, "ID de catégorie invalide: La catégorie spécifiée n'existe pas.", { categoryId: newVideoData.category_id });
          }
          return handleError(res, 500, "Erreur lors de la vérification de la catégorie.", { categoryError, categoryId: newVideoData.category_id });
        }
      }

      // --- Vérification de l'existence de subcategory_id si fourni ---
      if (newVideoData.subcategory_id !== null && newVideoData.subcategory_id !== undefined) {
        const { data: subcategoryExists, error: subcategoryError } = await supabaseAnon
          .from('subcategories') // Assurez-vous que 'subcategories' est le nom de votre table
          .select('id')
          .eq('id', newVideoData.subcategory_id)
          .single();

        if (subcategoryError || !subcategoryExists) {
          if (subcategoryError?.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
            return handleError(res, 400, "ID de sous-catégorie invalide: La sous-catégorie spécifiée n'existe pas.", { subcategoryId: newVideoData.subcategory_id });
          }
          return handleError(res, 500, "Erreur lors de la vérification de la sous-catégorie.", { subcategoryError, subcategoryId: newVideoData.subcategory_id });
        }
      }

      // --- Insertion de la nouvelle vidéo ---
      // Utilise supabaseServiceRole pour l'insertion
      const { data: video, error: createVideoError } = await supabaseServiceRole
        .from('videos') // Assurez-vous que 'videos' est le nom de votre table
        .insert([newVideoData])
        .select('id, title') // Sélectionnez les colonnes nécessaires pour le log d'activité
        .single();

      if (createVideoError) {
        // Gérer les erreurs PostgreSQL spécifiques, comme la violation d'unicité (youtube_id)
        if (createVideoError.code === SUPABASE_ERROR_CODES.UNIQUE_VIOLATION) {
            return handleError(res, 409, "Conflit: Une vidéo avec cet ID existe déjà.", { createVideoError, data: newVideoData });
        }
        // Gérer les violations de clé étrangère (si les vérifications préalables n'ont pas suffi)
        if (createVideoError.code === SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
          return handleError(res, 400, "Données liées invalides: Catégorie ou sous-catégorie spécifiée inexistante.", { createVideoError, data: newVideoData });
        }
        return handleError(res, 500, "Erreur lors de la création de la vidéo.", { error: createVideoError, data: newVideoData });
      }

      // --- Création du log d'activité ---
      // Cette opération est facultative et ne doit pas bloquer la réponse principale.
      const userIdForLog = currentUserForPost.id || null; // Utilise l'ID de l'utilisateur authentifié
      if (userIdForLog && video) {
        const { error: activityLogError } = await supabaseServiceRole
          .from('activity_logs') // Assurez-vous que 'activity_logs' est le nom de votre table
          .insert([
            {
              action: "CREATE",
              entity_type: "video",
              entity_id: video.id,
              user_id: userIdForLog,
              details: `Vidéo créée: ${video.title}`,
              timestamp: new Date().toISOString(),
            },
          ]);

        if (activityLogError) {
          logger.error('Erreur lors de la création du log d\'activité pour la création de vidéo.', { error: activityLogError, videoId: video.id, userId: userIdForLog });
          // L'erreur est logguée mais l'opération principale continue.
        }
      } else {
        logger.warn('Impossible de déterminer l\'ID utilisateur ou la vidéo créée pour le log d\'activité.');
      }

      return res.status(201).json(video); // 201 Created pour une création de ressource réussie

    } else {
      // --- Gérer les méthodes HTTP non autorisées ---
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, url: req.url });
    }

  } catch (error) {
    // --- Gérer les erreurs inattendues ---
    return handleError(res, 500, "Erreur interne du serveur lors de la gestion des vidéos.", { error });
  }
}
