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

// Client pour les opérations d'écriture (POST) ou celles nécessitant des privilèges de service
// Ce client contourne le RLS et doit être utilisé avec prudence pour les opérations critiques.
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Schéma Zod pour la création d'un tag ---
const insertTagSchema = z.object({
  name: z.string().min(1, "Le nom du tag est requis.").max(100, "Le nom ne doit pas dépasser 100 caractères."),
  slug: z.string()
    .min(1, "Le slug est requis.")
    .max(100, "Le slug ne doit pas dépasser 100 caractères.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Le slug doit être en minuscules, sans espaces et utiliser des tirets pour séparer les mots."),
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
      const { data: tagsList, error, count } = await supabaseAnon
        .from('tags') // Assurez-vous que 'tags' est le nom de votre table
        .select('id, name, slug', { count: 'exact' }) // Sélectionnez les champs nécessaires et demandez le total
        .order('name', { ascending: true }) // Ordonne par nom par défaut
        .range(offset, offset + limit - 1); // Applique la pagination

      if (error) {
        return handleError(res, 500, "Erreur lors de la récupération des tags.", { error });
      }

      return res.status(200).json({
        data: tagsList,
        page,
        limit,
        total: count, // Incluez le nombre total de tags pour la pagination côté client
      });

    } else if (req.method === 'POST') {
      // --- Authentification et Autorisation pour POST ---
      const currentUserForPost = await getCurrentUser(req);
      if (!currentUserForPost) {
        return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
      }
      const adminCheckForPost = await isAdmin(currentUserForPost);
      if (!adminCheckForPost) {
        return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis pour créer un tag.");
      }

      // --- Validation du corps de la requête ---
      const result = insertTagSchema.safeParse(req.body);
      if (!result.success) {
        return handleError(res, 400, "Données de création invalides.", { errors: result.error.issues, body: req.body });
      }
      const newTagData = result.data;

      // --- Vérification de l'unicité du SLUG ---
      // Utilise supabaseAnon pour vérifier le slug existant, respectant le RLS.
      const { data: existingTag, error: slugCheckError } = await supabaseAnon
        .from('tags')
        .select('id')
        .eq('slug', newTagData.slug)
        .single();

      if (slugCheckError && slugCheckError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
        return handleError(res, 500, "Erreur lors de la vérification de l'unicité du slug.", { slugCheckError, slug: newTagData.slug });
      }
      if (existingTag) {
        return handleError(res, 409, "Conflit: Le slug est déjà utilisé par un autre tag.", { slug: newTagData.slug });
      }

      // --- Insertion du nouveau tag ---
      // Utilise supabaseServiceRole pour l'insertion
      const { data: newTag, error: createError } = await supabaseServiceRole
        .from('tags') // Assurez-vous que 'tags' est le nom de votre table
        .insert([newTagData])
        .select('*')
        .single();

      if (createError) {
        // Gérer les erreurs PostgreSQL spécifiques, comme la violation d'unicité (slug)
        if (createError.code === SUPABASE_ERROR_CODES.UNIQUE_VIOLATION) {
          return handleError(res, 409, "Conflit: Un tag avec ce slug existe déjà.", { createError, data: newTagData });
        }
        return handleError(res, 500, "Erreur lors de la création du tag.", { createError, data: newTagData });
      }

      return res.status(201).json(newTag); // 201 Created

    } else {
      // --- Gérer les méthodes HTTP non autorisées ---
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, url: req.url });
    }

  } catch (error) {
    // --- Gérer les erreurs inattendues ---
    return handleError(res, 500, "Erreur interne du serveur.", { error });
  }
}
