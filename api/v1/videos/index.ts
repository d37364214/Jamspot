
import type { Request, Response } from 'express';
import { storage } from '@shared/storage';
import { insertVideoSchema } from '@shared/schema';

export default async function handler(req: Request, res: Response) {
  switch (req.method) {
    case 'GET':
      try {
        const videos = await storage.getVideos();
        return res.json(videos);
      } catch (error) {
        console.error("Erreur lors de la récupération des vidéos:", error);
        return res.status(500).json({ error: "Erreur lors de la récupération des vidéos" });
      }
      
    case 'POST':
      try {
        const data = insertVideoSchema.parse(req.body);
        const video = await storage.createVideo(data);
        
        await storage.createActivityLog({
          action: "CREATE",
          entityType: "video",
          entityId: video.id,
          userId: req.user?.id,
          details: `Vidéo créée: ${video.title}`,
          timestamp: new Date().toISOString(),
        });
        
        return res.status(201).json(video);
      } catch (error) {
        console.error("Erreur lors de la création de la vidéo:", error);
        return res.status(500).json({ error: "Erreur lors de la création de la vidéo" });
      }
      
    default:
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
