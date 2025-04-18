
import type { Request, Response } from 'express';
import { storage } from '@shared/storage';
import { insertTagSchema } from '@shared/schema';

export default async function handler(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID invalide" });
  }

  switch (req.method) {
    case 'GET':
      try {
        const tag = await storage.getTag(id);
        if (!tag) {
          return res.status(404).json({ error: "Tag non trouvé" });
        }
        return res.json(tag);
      } catch (error) {
        console.error("Erreur lors de la récupération du tag:", error);
        return res.status(500).json({ error: "Erreur lors de la récupération du tag" });
      }

    case 'PUT':
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const data = insertTagSchema.parse(req.body);
        const updatedTag = await storage.updateTag(id, data);
        if (!updatedTag) {
          return res.status(404).json({ error: "Tag non trouvé" });
        }
        return res.json(updatedTag);
      } catch (error) {
        console.error("Erreur lors de la mise à jour du tag:", error);
        return res.status(500).json({ error: "Erreur lors de la mise à jour du tag" });
      }

    case 'DELETE':
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const success = await storage.deleteTag(id);
        if (!success) {
          return res.status(400).json({ error: "Impossible de supprimer le tag" });
        }
        return res.status(204).send();
      } catch (error) {
        console.error("Erreur lors de la suppression du tag:", error);
        return res.status(500).json({ error: "Erreur lors de la suppression du tag" });
      }

    default:
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
