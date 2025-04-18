
import type { Request, Response } from 'express';
import { storage } from '@shared/storage';
import { insertSubcategorySchema } from '@shared/schema';

export default async function handler(req: Request, res: Response) {
  switch (req.method) {
    case 'GET':
      try {
        const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
        const subcategories = categoryId 
          ? await storage.getSubcategoriesByCategory(categoryId)
          : await storage.getSubcategories();
        return res.json(subcategories);
      } catch (error) {
        console.error("Erreur lors de la récupération des sous-catégories:", error);
        return res.status(500).json({ error: "Erreur lors de la récupération des sous-catégories" });
      }

    case 'POST':
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const data = insertSubcategorySchema.parse(req.body);
        const subcategory = await storage.createSubcategory(data);
        return res.status(201).json(subcategory);
      } catch (error) {
        console.error("Erreur lors de la création de la sous-catégorie:", error);
        return res.status(500).json({ error: "Erreur lors de la création de la sous-catégorie" });
      }

    default:
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
