
import type { Request, Response } from 'express';
import { storage } from '@shared/storage';
import { insertTagSchema } from '@shared/schema';

export default async function handler(req: Request, res: Response) {
  switch (req.method) {
    case 'GET':
      try {
        const tags = await storage.getTags();
        return res.json(tags);
      } catch (error) {
        console.error("Erreur lors de la récupération des tags:", error);
        return res.status(500).json({ error: "Erreur lors de la récupération des tags" });
      }

    case 'POST':
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const data = insertTagSchema.parse(req.body);
        const tag = await storage.createTag(data);
        return res.status(201).json(tag);
      } catch (error) {
        console.error("Erreur lors de la création du tag:", error);
        return res.status(500).json({ error: "Erreur lors de la création du tag" });
      }

    default:
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
