
import type { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../../server/storage';

const ratingSchema = z.object({
  videoId: z.number(),
  rating: z.number().min(1).max(5)
});

export default async function handler(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Vous devez être connecté pour noter" });
  }

  try {
    if (req.method === 'GET') {
      const videoId = parseInt(req.query.videoId as string);
      if (isNaN(videoId)) {
        return res.status(400).json({ error: "ID de vidéo invalide" });
      }

      // Récupérer la note de l'utilisateur et la moyenne
      const [userRating, averageRating] = await Promise.all([
        storage.getVideoRating(videoId, req.user.id),
        storage.getVideoAverageRating(videoId)
      ]);

      return res.status(200).json({
        userRating: userRating?.rating || null,
        averageRating
      });

    } else if (req.method === 'POST') {
      const validation = ratingSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Données invalides", 
          details: validation.error.flatten() 
        });
      }

      const rating = await storage.createOrUpdateRating({
        ...validation.data,
        userId: req.user.id
      });

      const averageRating = await storage.getVideoAverageRating(validation.data.videoId);
      return res.status(201).json({ rating, averageRating });
    }

    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (error) {
    console.error("Erreur lors de la gestion des notations:", error);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}
