
import { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../../server/storage';
import { sendSuccess, sendError, handleZodError, handleServerError } from '../../../shared/services/response';
import { requireAuth, rateLimit } from '../../../shared/services/middleware';

const COMMENT_COOLDOWN = 30000; // 30 secondes entre les commentaires

const createCommentSchema = z.object({
  videoId: z.number().positive("ID de vidéo invalide"),
  content: z.string()
    .min(1, "Le commentaire ne peut pas être vide")
    .max(1000, "Le commentaire est trop long")
    .trim()
});

export default async function handler(req: Request, res: Response) {
  try {
    if (req.method === 'GET') {
      const videoId = parseInt(req.query.videoId as string);
      if (isNaN(videoId)) {
        return sendError(res, "ID de vidéo invalide");
      }

      const comments = await storage.getVideoComments(videoId);
      return sendSuccess(res, comments);

    } else if (req.method === 'POST') {
      // Vérifie l'authentification
      if (!req.isAuthenticated()) {
        return sendError(res, "Non authentifié", undefined, 401);
      }

      // Valide les données
      const validation = createCommentSchema.safeParse(req.body);
      if (!validation.success) {
        return handleZodError(res, validation.error);
      }

      // Vérifie le cooldown
      const lastComment = await storage.getLastUserComment(req.user.id);
      if (lastComment) {
        const timeSinceLastComment = Date.now() - new Date(lastComment.createdAt).getTime();
        if (timeSinceLastComment < COMMENT_COOLDOWN) {
          return sendError(res, 
            "Veuillez attendre avant de poster un nouveau commentaire",
            { waitTime: Math.ceil((COMMENT_COOLDOWN - timeSinceLastComment) / 1000) },
            429
          );
        }
      }

      // Crée le commentaire
      const comment = await storage.createComment({
        ...validation.data,
        userId: req.user.id
      });

      return sendSuccess(res, comment, 201);
    }

    return sendError(res, "Méthode non autorisée", undefined, 405);
  } catch (err) {
    return handleServerError(res, err);
  }
}
