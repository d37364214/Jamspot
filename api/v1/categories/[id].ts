
import type { Request, Response } from 'express';
import { storage } from '@shared/storage';
import { insertCategorySchema } from '@shared/schema';

export default async function handler(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID invalide" });
  }

  switch (req.method) {
    case 'GET':
      try {
        const category = await storage.getCategory(id);
        if (!category) {
          return res.status(404).json({ error: "Catégorie non trouvée" });
        }
        return res.json(category);
      } catch (error) {
        console.error("Erreur lors de la récupération de la catégorie:", error);
        return res.status(500).json({ error: "Erreur lors de la récupération de la catégorie" });
      }

    case 'PUT':
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const data = insertCategorySchema.parse(req.body);
        const updatedCategory = await storage.updateCategory(id, data);
        if (!updatedCategory) {
          return res.status(404).json({ error: "Catégorie non trouvée" });
        }
        return res.json(updatedCategory);
      } catch (error) {
        console.error("Erreur lors de la mise à jour de la catégorie:", error);
        return res.status(500).json({ error: "Erreur lors de la mise à jour de la catégorie" });
      }

    case 'DELETE':
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const success = await storage.deleteCategory(id);
        if (!success) {
          return res.status(400).json({ error: "Impossible de supprimer une catégorie contenant des vidéos ou des sous-catégories" });
        }
        return res.status(204).send();
      } catch (error) {
        console.error("Erreur lors de la suppression de la catégorie:", error);
        return res.status(500).json({ error: "Erreur lors de la suppression de la catégorie" });
      }

    default:
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
