
import type { Request, Response } from 'express';
import { storage } from '@shared/storage';
import { insertCategorySchema } from '@shared/schema';

export default async function handler(req: Request, res: Response) {
  switch (req.method) {
    case 'GET':
      try {
        const categories = await storage.getCategories();
        return res.json(categories);
      } catch (error) {
        console.error("Erreur lors de la récupération des catégories:", error);
        return res.status(500).json({ error: "Erreur lors de la récupération des catégories" });
      }

    case 'POST':
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const data = insertCategorySchema.parse(req.body);
        const category = await storage.createCategory(data);
        
        await storage.createActivityLog({
          action: "CREATE",
          entityType: "category",
          entityId: category.id,
          userId: req.user.id,
          details: `Catégorie créée: ${category.name}`,
          timestamp: new Date().toISOString(),
        });
        
        return res.status(201).json(category);
      } catch (error) {
        console.error("Erreur lors de la création de la catégorie:", error);
        return res.status(500).json({ error: "Erreur lors de la création de la catégorie" });
      }

    default:
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
