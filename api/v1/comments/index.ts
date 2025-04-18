
import type { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../../server/storage';
import { success, error, handleZodError, handleError } from '../../../shared/services/response';
import { requireAuth, rateLimit } from '../../../shared/services/middleware';

const COMMENT_COOLDOWN = 30000; // 30 secondes entre les commentaires

const createCommentSchema = z.object({
  videoId: z.number().positive("ID de vidéo invalide"),
  content: z.string()
    .min(1, "Le commentaire ne peut pas être vide")
    .max(1000, "Le commentaire est trop long")
});

export default async function handler(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json(error("Vous devez être connecté pour commenter"));
  }

  try {
    if (req.method === 'GET') {
      const videoId = parseInt(req.query.videoId as string);
      if (isNaN(videoId)) {
        return res.status(400).json(error("ID de vidéo invalide"));
      }

      const comments = await storage.getVideoComments(videoId);
      return res.status(200).json(success(comments));

    } else if (req.method === 'POST') {
      const validation = createCommentSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json(handleZodError(validation.error));
      }

      // Vérification anti-spam
      const lastComment = await storage.getLastUserComment(req.user.id);
      if (lastComment) {
        const timeSinceLastComment = Date.now() - new Date(lastComment.createdAt).getTime();
        if (timeSinceLastComment < COMMENT_COOLDOWN) {
          return res.status(429).json(error(
            "Veuillez attendre avant de poster un nouveau commentaire",
            { waitTime: Math.ceil((COMMENT_COOLDOWN - timeSinceLastComment) / 1000) }
          ));
        }
      }

      const comment = await storage.createComment({
        ...validation.data,
        userId: req.user.id
      });

      return res.status(201).json(success(comment));
    }

    return res.status(405).json(error("Méthode non autorisée"));
  } catch (err) {
    return res.status(500).json(handleError(err));
  }
}
