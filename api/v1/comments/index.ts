import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire
import { sendSuccess, sendError, handleZodError, handleServerError } from '../../../../shared/services/response'; // Ajustez les chemins si nécessaire

const COMMENT_COOLDOWN = 30000; // 30 secondes entre les commentaires

const createCommentSchema = z.object({
  videoId: z.number().positive("ID de vidéo invalide"),
  content: z.string()
    .min(1, "Le commentaire ne peut pas être vide")
    .max(1000, "Le commentaire est trop long")
    .trim()
});

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour récupérer l'utilisateur à partir de l'authentification Supabase (à implémenter)
async function getCurrentUser(req: NextApiRequest): Promise<any | null> {
  // TODO: Implémenter la logique pour récupérer l'utilisateur authentifié
  // Cela pourrait impliquer de lire des cookies d'authentification,
  // de vérifier les headers Authorization, et d'utiliser supabase.auth.getUser().
  // Pour l'instant, retourne null.
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const videoIdQuery = req.query.videoId;
      const videoId = typeof videoIdQuery === 'string' ? parseInt(videoIdQuery, 10) : (Array.isArray(videoIdQuery) ? parseInt(videoIdQuery[0], 10) : undefined);

      if (videoId === undefined || isNaN(videoId) || videoId <= 0) {
        logger.debug('Invalid video ID for fetching comments', { videoId: videoIdQuery });
        return sendError(res, "ID de vidéo invalide", undefined, 400);
      }

      const { data: comments, error } = await supabase
        .from('comments') // Assurez-vous que 'comments' est le nom de votre table
        .select('*')
        .eq('video_id', videoId);

      if (error) {
        logger.error('Error fetching comments for video', { error, videoId });
        return handleServerError(res, error);
      }

      return sendSuccess(res, comments);

    } else if (req.method === 'POST') {
      const user = await getCurrentUser(req);
      if (!user) {
        logger.warn('Unauthorized attempt to create a comment');
        return sendError(res, "Non authentifié", undefined, 401);
      }

      const validation = createCommentSchema.safeParse(req.body);
      if (!validation.success) {
        return handleZodError(res, validation.error);
      }

      const { videoId, content } = validation.data;

      // Vérifie le cooldown (nécessite de récupérer le dernier commentaire de l'utilisateur depuis Supabase)
      const { data: lastComment, error: lastCommentError } = await supabase
        .from('comments') // Assurez-vous que 'comments' est le nom de votre table
        .select('created_at')
        .eq('user_id', user.id)
        .orderBy('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastCommentError) {
        logger.error('Error fetching last user comment for cooldown check', { error: lastCommentError, userId: user.id });
        // Ne pas bloquer la création du commentaire en cas d'erreur de récupération du dernier commentaire (à décider)
      } else if (lastComment) {
        const timeSinceLastComment = Date.now() - new Date(lastComment.created_at).getTime();
        if (timeSinceLastComment < COMMENT_COOLDOWN) {
          return sendError(res,
            "Veuillez attendre avant de poster un nouveau commentaire",
            { waitTime: Math.ceil((COMMENT_COOLDOWN - timeSinceLastComment) / 1000) },
            429
          );
        }
      }

      const { data: newComment, error: createError } = await supabase
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
        logger.error('Error creating comment', { error: createError, videoId, content, userId: user.id });
        return handleServerError(res, createError);
      }

      return sendSuccess(res, newComment, 201);
    }

    return sendError(res, "Méthode non autorisée", undefined, 405);

  } catch (err) {
    return handleServerError(res, err);
  }
}
