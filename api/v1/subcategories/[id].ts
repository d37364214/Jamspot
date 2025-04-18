
import type { Request, Response } from 'express';
import { storage } from '@shared/storage';
import { insertSubcategorySchema } from '@shared/schema';

export default async function handler(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID invalide" });
  }

  switch (req.method) {
    case 'GET':
      try {
        const subcategory = await storage.getSubcategory(id);
        if (!subcategory) {
          return res.status(404).json({ error: "Sous-catégorie non trouvée" });
        }
        return res.json(subcategory);
      } catch (error) {
        console.error("Erreur lors de la récupération de la sous-catégorie:", error);
        return res.status(500).json({ error: "Erreur lors de la récupération de la sous-catégorie" });
      }

    case 'PUT':
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const data = insertSubcategorySchema.parse(req.body);
        const updatedSubcategory = await storage.updateSubcategory(id, data);
        if (!updatedSubcategory) {
          return res.status(404).json({ error: "Sous-catégorie non trouvée" });
        }
        return res.json(updatedSubcategory);
      } catch (error) {
        console.error("Erreur lors de la mise à jour de la sous-catégorie:", error);
        return res.status(500).json({ error: "Erreur lors de la mise à jour de la sous-catégorie" });
      }

    case 'DELETE':
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const success = await storage.deleteSubcategory(id);
        if (!success) {
          return res.status(400).json({ error: "Impossible de supprimer une sous-catégorie contenant des vidéos" });
        }
        return res.status(204).send();
      } catch (error) {
        console.error("Erreur lors de la suppression de la sous-catégorie:", error);
        return res.status(500).json({ error: "Erreur lors de la suppression de la sous-catégorie" });
      }

    default:
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
