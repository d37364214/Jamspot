import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire
import { sendError, handleZodError, handleServerError } from '../../../shared/services/response'; // Ajustez les chemins si nécessaire

const ratingSchema = z.object({
  videoId: z.number().positive("ID de vidéo invalide"),
  rating: z.number().min(1, "La note doit être au moins 1").max(5, "La note doit être au plus 5")
});

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour récupérer l'utilisateur à partir de l'authentification Supabase (à implémenter)
async function getCurrentUser(req: NextApiRequest): Promise<any | null> {
  // TODO: Implémenter la logique pour récupérer l'utilisateur authentifié
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    logger.warn('Unauthorized attempt to interact with ratings');
    return res.status(401).json({ error: "Vous devez être connecté pour noter" });
  }

  try {
    if (req.method === 'GET') {
      const videoIdQuery = req.query.videoId;
      const videoId = typeof videoIdQuery === 'string' ? parseInt(videoIdQuery, 10) : (Array.isArray(videoIdQuery) ? parseInt(videoIdQuery[0], 10) : undefined);

      if (videoId === undefined || isNaN(videoId) || videoId <= 0) {
        logger.debug('Invalid video ID for fetching ratings', { videoId: videoIdQuery });
        return res.status(400).json({ error: "ID de vidéo invalide" });
      }

      // Récupérer la note de l'utilisateur et la moyenne depuis Supabase
      const { data: userRatingData, error: userRatingError } = await supabase
        .from('ratings') // Assurez-vous que 'ratings' est le nom de votre table
        .select('rating')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .single();

      if (userRatingError && userRatingError.code !== 'PGRST116') { // PGRST116 signifie "no rows returned"
        logger.error('Error fetching user rating', { error: userRatingError, videoId, userId: user.id });
        return res.status(500).json({ error: "Erreur lors de la récupération de votre note" });
      }

      const { data: averageRatingData, error: averageRatingError } = await supabase
        .rpc('get_average_rating', { video_id_param: videoId }) // Assurez-vous d'avoir une fonction SQL 'get_average_rating'
        .single();

      if (averageRatingError) {
        logger.error('Error fetching average rating', { error: averageRatingError, videoId });
        return res.status(500).json({ error: "Erreur lors de la récupération de la note moyenne" });
      }

      return res.status(200).json({
        userRating: userRatingData?.rating || null,
        averageRating: averageRatingData?.average_rating || null // Assurez-vous que la fonction retourne 'average_rating'
      });

    } else if (req.method === 'POST') {
      const validation = ratingSchema.safeParse(req.body);

      if (!validation.success) {
        return handleZodError(res, validation.error);
      }

      const { videoId, rating } = validation.data;

      // Créer ou mettre à jour la note dans Supabase
      const { data: newRating, error: upsertError } = await supabase
        .from('ratings') // Assurez-vous que 'ratings' est le nom de votre table
        .upsert(
          { video_id: videoId, user_id: user.id, rating: rating },
          { onConflict: ['video_id', 'user_id'] } // Spécifie les colonnes pour la mise à jour en cas de conflit
        )
        .select('*')
        .single();

      if (upsertError) {
        logger.error('Error creating or updating rating', { error: upsertError, videoId, rating, userId: user.id });
        return handleServerError(res, upsertError);
      }

      // Récupérer la nouvelle note moyenne
      const { data: newAverageRatingData, error: newAverageRatingError } = await supabase
        .rpc('get_average_rating', { video_id_param: videoId }) // Réutiliser la fonction SQL
        .single();

      if (newAverageRatingError) {
        logger.error('Error fetching new average rating after update', { error: newAverageRatingError, videoId });
        // Ne pas bloquer la réponse si la récupération de la moyenne échoue
      }

      return res.status(201).json({ rating: newRating, averageRating: newAverageRatingData?.average_rating || null });
    }

    return res.status(405).json({ error: "Méthode non autorisée" });

  } catch (error) {
    logger.error("Unhandled error during rating operation", { error });
    return handleServerError(res, error);
  }
}
