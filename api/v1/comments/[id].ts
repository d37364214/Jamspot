
import type { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../../server/storage';

const updateCommentSchema = z.object({
  content: z.string().min(1, "Le commentaire ne peut pas être vide").max(1000, "Le commentaire est trop long")
});

export default async function handler(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) {
    return res.status(400).json({ error: "ID de commentaire invalide" });
  }

  try {
    const comment = await storage.getComment(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Commentaire non trouvé" });
    }

    // Vérification des permissions
    const canModify = req.user.isAdmin || comment.userId === req.user.id;
    if (!canModify) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    if (req.method === 'PUT') {
      const validation = updateCommentSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Données invalides", 
          details: validation.error.flatten() 
        });
      }

      const updatedComment = await storage.updateComment(commentId, validation.data.content);
      return res.status(200).json(updatedComment);

    } else if (req.method === 'DELETE') {
      await storage.deleteComment(commentId);
      return res.status(200).json({ message: "Commentaire supprimé" });
    }

    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (error) {
    console.error("Erreur lors de la gestion du commentaire:", error);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}
