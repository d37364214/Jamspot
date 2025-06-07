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

// --- Schéma Zod pour la notation ---
const ratingSchema = z.object({
  videoId: z.number().int("L'ID de la vidéo doit être un entier.").positive("L'ID de la vidéo est invalide."),
  rating: z.number().min(1, "La note doit être au moins 1.").max(5, "La note doit être au plus 5.")
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

// --- Gestionnaire d'API ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- 1. Authentification globale pour toutes les opérations ---
  const user = await getCurrentUser(req);
  if (!user) {
    return handleError(res, 401, "Vous devez être connecté pour interagir avec les notes.");
  }

  try {
    if (req.method === 'GET') {
      const videoIdQuery = req.query.videoId;
      const videoId = typeof videoIdQuery === 'string' ? parseInt(videoIdQuery, 10) : (Array.isArray(videoIdQuery) ? parseInt(videoIdQuery[0], 10) : undefined);

      if (videoId === undefined || isNaN(videoId) || videoId <= 0) {
        return handleError(res, 400, "ID de vidéo invalide.", { videoId: videoIdQuery });
      }

      // --- Vérification de l'existence de la vidéo ---
      // Utilisez supabaseAnon pour respecter le RLS si la visibilité des vidéos est contrôlée.
      const { data: videoExists, error: videoExistsError } = await supabaseAnon
        .from('videos') // Assurez-vous que 'videos' est le nom de votre table
        .select('id')
        .eq('id', videoId)
        .single();

      if (videoExistsError) {
        if (videoExistsError.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
          return handleError(res, 404, "Vidéo non trouvée: impossible de récupérer les notes pour une vidéo inexistante.", { videoId });
        }
        return handleError(res, 500, "Erreur lors de la vérification de la vidéo.", { videoExistsError, videoId });
      }
      if (!videoExists) { // Redondant si PGRST116 est géré, mais pour plus de clarté
        return handleError(res, 404, "Vidéo non trouvée ou inaccessible.", { videoId });
      }


      // --- Récupérer la note de l'utilisateur ---
      // Utilisez supabaseAnon pour respecter le RLS.
      const { data: userRatingData, error: userRatingError } = await supabaseAnon
        .from('ratings') // Assurez-vous que 'ratings' est le nom de votre table
        .select('rating')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .single();

      if (userRatingError && userRatingError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
        return handleError(res, 500, "Erreur lors de la récupération de votre note.", { error: userRatingError, videoId, userId: user.id });
      }

      // --- Récupérer la note moyenne via RPC ---
      // Utilisation de supabaseAnon pour l'appel RPC si la fonction est accessible publiquement
      const { data: averageRatingData, error: averageRatingError } = await supabaseAnon
        .rpc('get_average_rating', { video_id_param: videoId }) // Assurez-vous d'avoir une fonction SQL 'get_average_rating'
        .single();

      if (averageRatingError) {
        // Log l'erreur mais ne bloque pas la réponse si la note moyenne n'est pas critique
        logger.error('Erreur lors de la récupération de la note moyenne.', { error: averageRatingError, videoId });
        // Vous pourriez décider de retourner un 500 ici si la note moyenne est essentielle
      }

      return res.status(200).json({
        userRating: userRatingData?.rating || null,
        averageRating: averageRatingData?.average_rating || null // Assurez-vous que la fonction SQL retourne 'average_rating'
      });

    } else if (req.method === 'POST') {
      // --- 2. Validation du corps de la requête ---
      const validation = ratingSchema.safeParse(req.body);

      if (!validation.success) {
        return handleError(res, 400, "Données de notation invalides.", { errors: validation.error.issues, body: req.body });
      }

      const { videoId, rating } = validation.data;

      // --- Vérification de l'existence de la vidéo avant d'insérer/upsert ---
      // Utilisez supabaseAnon pour respecter le RLS.
      const { data: videoExists, error: videoExistsError } = await supabaseAnon
        .from('videos') // Assurez-vous que 'videos' est le nom de votre table
        .select('id')
        .eq('id', videoId)
        .single();

      if (videoExistsError) {
        if (videoExistsError.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
          return handleError(res, 404, "Vidéo non trouvée: impossible de noter une vidéo inexistante.", { videoId });
        }
        return handleError(res, 500, "Erreur lors de la vérification de la vidéo.", { videoExistsError, videoId });
      }
      if (!videoExists) { // Redondant si PGRST116 est géré, mais pour plus de clarté
        return handleError(res, 404, "Vidéo non trouvée ou inaccessible.", { videoId });
      }

      // --- 3. Créer ou mettre à jour la note (Upsert) ---
      // Utilisez supabaseServiceRole pour l'opération d'écriture (upsert) car elle nécessite des privilèges.
      const { data: newRating, error: upsertError } = await supabaseServiceRole
        .from('ratings') // Assurez-vous que 'ratings' est le nom de votre table
        .upsert(
          { video_id: videoId, user_id: user.id, rating: rating },
          { onConflict: ['video_id', 'user_id'] } // Spécifie les colonnes pour la mise à jour en cas de conflit
        )
        .select('*') // Retourne la note insérée/mise à jour
        .single();

      if (upsertError) {
        return handleError(res, 500, "Erreur lors de la création ou de la mise à jour de la note.", { error: upsertError, videoId, rating, userId: user.id });
      }

      // --- 4. Récupérer la nouvelle note moyenne après l'update ---
      // Utilisation de supabaseAnon pour l'appel RPC si la fonction est accessible publiquement
      const { data: newAverageRatingData, error: newAverageRatingError } = await supabaseAnon
        .rpc('get_average_rating', { video_id_param: videoId }) // Réutiliser la fonction SQL
        .single();

      if (newAverageRatingError) {
        logger.error('Erreur lors de la récupération de la nouvelle note moyenne après mise à jour.', { error: newAverageRatingError, videoId });
        // Ne bloque pas la réponse si la récupération de la moyenne échoue, juste loggue.
      }

      return res.status(201).json({ rating: newRating, averageRating: newAverageRatingData?.average_rating || null });
    }

    // --- 5. Gérer les méthodes HTTP non autorisées ---
    return handleError(res, 405, "Méthode non autorisée.", { method: req.method, url: req.url });

  } catch (error) {
    // --- 6. Gérer les erreurs inattendues ---
    return handleError(res, 500, "Erreur interne du serveur lors de l'opération de notation.", { error });
  }
}