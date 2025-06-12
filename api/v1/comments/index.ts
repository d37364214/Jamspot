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

const COMMENT_COOLDOWN = 30000; // 30 seconds cooldown between comments

// --- Clients Supabase ---
// Client pour les opérations en lecture (GET) qui doivent respecter la sécurité au niveau des lignes (RLS)
// Utilisez process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY qui est accessible publiquement
const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client pour les opérations d'écriture (POST) ou opérations nécessitant des privilèges de service
// Ce client contourne le RLS et doit être utilisé avec prudence pour les opérations critiques.
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Schéma Zod pour la création d'un commentaire ---
const createCommentSchema = z.object({
  videoId: z.number().int("L'ID de la vidéo doit être un entier.").positive("L'ID de la vidéo est invalide."),
  content: z.string()
    .min(1, "Le commentaire ne peut pas être vide.")
    .max(1000, "Le commentaire est trop long (max 1000 caractères).")
    .trim() // Supprime les espaces blancs en début et fin
});

// --- Fonctions utilitaires ---

/**
 * Utilitaire centralisé de gestion des erreurs.
 * Simplifie le retour d'erreurs et la journalisation.
 * @param res L'objet CustomApiResponse.
 * @param statusCode Le code d'état HTTP à renvoyer.
 * @param message Le message d'erreur convivial.
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

// --- Gestionnaire d'API ---
export default async function handler(req: CustomApiRequest, res: CustomApiResponse) { // Types mis à jour ici
  try {
    if (req.method === 'GET') {
      const videoIdQuery = req.query.videoId;
      const videoId = typeof videoIdQuery === 'string' ? parseInt(videoIdQuery, 10) : (Array.isArray(videoIdQuery) ? parseInt(videoIdQuery[0], 10) : undefined);

      if (videoId === undefined || isNaN(videoId) || videoId <= 0) {
        return handleError(res, 400, "ID de vidéo invalide.", { videoId: videoIdQuery });
      }

      // Utilise supabaseAnon pour les requêtes GET afin de respecter le RLS
      const { data: comments, error } = await supabaseAnon
        .from('comments') // Assurez-vous que 'comments' est le nom de votre table
        .select('id, content, user_id, created_at') // Sélectionne seulement les champs nécessaires pour la performance
        .eq('video_id', videoId)
        .order('created_at', { ascending: true }); // Classe les commentaires par date de création

      if (error) {
        return handleError(res, 500, "Erreur lors de la récupération des commentaires.", { error, videoId });
      }

      return res.status(200).json(comments);

    } else if (req.method === 'POST') {
      // --- 1. Vérification de l'authentification ---
      const user = await getCurrentUser(req);
      if (!user) {
        return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
      }

      // --- 2. Validation Zod ---
      const validation = createCommentSchema.safeParse(req.body);
      if (!validation.success) {
        return handleError(res, 400, "Données de commentaire invalides.", { errors: validation.error.issues, body: req.body });
      }
      const { videoId, content } = validation.data;

      // --- 3. Vérification préliminaire de l'existence de la vidéo et de la permission ---
      // Utilise supabaseAnon pour cette vérification afin de respecter le RLS (par exemple, si la vidéo est privée)
      const { data: video, error: videoFetchError } = await supabaseAnon
        .from('videos') // En supposant que 'videos' est le nom de votre table de vidéos
        .select('id') // N'a besoin de vérifier que l'existence
        .eq('id', videoId)
        .single();

      if (videoFetchError) {
        if (videoFetchError.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
          return handleError(res, 404, "Vidéo non trouvée: Impossible de commenter une vidéo inexistante.", { videoId });
        }
        return handleError(res, 500, "Erreur lors de la vérification de la vidéo.", { videoFetchError, videoId });
      }

      if (!video) { // Redondant si PGRST116 est géré, mais bon pour une vérification explicite
        return handleError(res, 404, "Vidéo non trouvée ou inaccessible.", { videoId });
      }

      // TODO: Ajouter ici une vérification de permission plus spécifique si certains utilisateurs ne peuvent pas commenter certaines vidéos (par exemple, la vidéo est privée)
      // Exemple: const { data: permission, error: permError } = await supabaseAnon.from('video_access').select('*').eq('video_id', videoId).eq('user_id', user.id).single();
      // if (!permission) { return handleError(res, 403, "Vous n'êtes pas autorisé à commenter cette vidéo."); }


      // --- 4. Vérification du délai d'attente (cooldown) ---
      // Utilise supabaseAnon pour récupérer le dernier commentaire de l'utilisateur actuel
      const { data: lastComment, error: lastCommentError } = await supabaseAnon
        .from('comments')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastCommentError && lastCommentError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
        // Journalise l'erreur mais renvoie une réponse d'erreur à l'utilisateur si la vérification du délai échoue.
        // Cela empêche l'abus si la vérification du délai elle-même est boguée.
        return handleError(res, 500, "Impossible de vérifier le délai entre les commentaires.", { error: lastCommentError, userId: user.id });
      } else if (lastComment) {
        const timeSinceLastComment = Date.now() - new Date(lastComment.created_at).getTime();
        if (timeSinceLastComment < COMMENT_COOLDOWN) {
          const waitTimeSeconds = Math.ceil((COMMENT_COOLDOWN - timeSinceLastComment) / 1000);
          return handleError(res,
            429,
            `Veuillez attendre ${waitTimeSeconds} secondes avant de poster un nouveau commentaire.`,
            { waitTime: waitTimeSeconds }
          );
        }
      }

      // --- 5. Insertion du nouveau commentaire ---
      // Utilise supabaseServiceRole pour l'insertion car c'est une opération d'écriture
      const { data: newComment, error: createError } = await supabaseServiceRole
        .from('comments') // Assurez-vous que 'comments' est le nom de votre table
        .insert([
          {
            video_id: videoId,
            content: content,
            user_id: user.id // Assurez-vous que votre table a une colonne user_id
          }
        ])
        .select('*')
        .single();

      if (createError) {
        return handleError(res, 500, "Erreur lors de la création du commentaire.", { error: createError, videoId, content, userId: user.id });
      }

      return res.status(201).json(newComment); // 201 Created pour une création de ressource réussie

    } else {
      // --- 6. Gérer les méthodes HTTP non prises en charge ---
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, url: req.url });
    }

  } catch (err) {
    // Intercepte toutes les erreurs inattendues et non gérées
    return handleError(res, 500, "Erreur interne du serveur.", { error: err });
  }
}
