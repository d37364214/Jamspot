import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertVideoSchema, insertCategorySchema } from "@shared/schema";
import { setupVite } from "./vite";

// Middleware pour vérifier si l'utilisateur est connecté
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Non authentifié" });
}

// Middleware pour vérifier si l'utilisateur est administrateur
function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user.isAdmin) {
    return next();
  }
  res.status(403).json({ error: "Accès non autorisé" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  setupAuth(app);
  
  // ---------------------------- Routes API ----------------------------
  
  // Routes pour les vidéos
  app.get("/api/videos", async (_req, res) => {
    try {
      const videos = await storage.getVideos();
      res.json(videos);
    } catch (error) {
      console.error("Erreur lors de la récupération des vidéos:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des vidéos" });
    }
  });
  
  app.get("/api/videos/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }
      
      const video = await storage.getVideo(id);
      if (!video) {
        return res.status(404).json({ error: "Vidéo non trouvée" });
      }
      
      res.json(video);
    } catch (error) {
      console.error("Erreur lors de la récupération de la vidéo:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de la vidéo" });
    }
  });
  
  app.post("/api/videos", isAdmin, async (req, res) => {
    try {
      const data = insertVideoSchema.parse(req.body);
      const video = await storage.createVideo(data);
      
      // Créer un log d'activité
      await storage.createActivityLog({
        action: "CREATE",
        entityType: "video",
        entityId: video.id,
        userId: req.user.id,
        details: `Vidéo créée: ${video.title}`,
        timestamp: new Date().toISOString(),
      });
      
      res.status(201).json(video);
    } catch (error) {
      console.error("Erreur lors de la création de la vidéo:", error);
      res.status(500).json({ error: "Erreur lors de la création de la vidéo" });
    }
  });
  
  app.patch("/api/videos/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }
      
      // Vérifier que la vidéo existe
      const existingVideo = await storage.getVideo(id);
      if (!existingVideo) {
        return res.status(404).json({ error: "Vidéo non trouvée" });
      }
      
      // Validation partielle des données
      const data = insertVideoSchema.partial().parse(req.body);
      const updatedVideo = await storage.updateVideo(id, data);
      
      // Créer un log d'activité
      await storage.createActivityLog({
        action: "UPDATE",
        entityType: "video",
        entityId: id,
        userId: req.user.id,
        details: `Vidéo mise à jour: ${updatedVideo?.title}`,
        timestamp: new Date().toISOString(),
      });
      
      res.json(updatedVideo);
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la vidéo:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour de la vidéo" });
    }
  });
  
  app.delete("/api/videos/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }
      
      // Vérifier que la vidéo existe
      const existingVideo = await storage.getVideo(id);
      if (!existingVideo) {
        return res.status(404).json({ error: "Vidéo non trouvée" });
      }
      
      const deleted = await storage.deleteVideo(id);
      
      if (deleted) {
        // Créer un log d'activité
        await storage.createActivityLog({
          action: "DELETE",
          entityType: "video",
          entityId: id,
          userId: req.user.id,
          details: `Vidéo supprimée: ${existingVideo.title}`,
          timestamp: new Date().toISOString(),
        });
        
        res.status(200).json({ success: true });
      } else {
        res.status(500).json({ error: "Échec de la suppression de la vidéo" });
      }
    } catch (error) {
      console.error("Erreur lors de la suppression de la vidéo:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de la vidéo" });
    }
  });
  
  // Routes pour les catégories
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Erreur lors de la récupération des catégories:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des catégories" });
    }
  });
  
  app.get("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }
      
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ error: "Catégorie non trouvée" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Erreur lors de la récupération de la catégorie:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de la catégorie" });
    }
  });
  
  app.post("/api/categories", isAdmin, async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(data);
      
      // Créer un log d'activité
      await storage.createActivityLog({
        action: "CREATE",
        entityType: "category",
        entityId: category.id,
        userId: req.user.id,
        details: `Catégorie créée: ${category.name}`,
        timestamp: new Date().toISOString(),
      });
      
      res.status(201).json(category);
    } catch (error) {
      console.error("Erreur lors de la création de la catégorie:", error);
      res.status(500).json({ error: "Erreur lors de la création de la catégorie" });
    }
  });
  
  app.patch("/api/categories/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }
      
      // Vérifier que la catégorie existe
      const existingCategory = await storage.getCategory(id);
      if (!existingCategory) {
        return res.status(404).json({ error: "Catégorie non trouvée" });
      }
      
      // Validation partielle des données
      const data = insertCategorySchema.partial().parse(req.body);
      const updatedCategory = await storage.updateCategory(id, data);
      
      // Créer un log d'activité
      await storage.createActivityLog({
        action: "UPDATE",
        entityType: "category",
        entityId: id,
        userId: req.user.id,
        details: `Catégorie mise à jour: ${updatedCategory?.name}`,
        timestamp: new Date().toISOString(),
      });
      
      res.json(updatedCategory);
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la catégorie:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour de la catégorie" });
    }
  });
  
  app.delete("/api/categories/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }
      
      // Vérifier que la catégorie existe
      const existingCategory = await storage.getCategory(id);
      if (!existingCategory) {
        return res.status(404).json({ error: "Catégorie non trouvée" });
      }
      
      const deleted = await storage.deleteCategory(id);
      
      if (deleted) {
        // Créer un log d'activité
        await storage.createActivityLog({
          action: "DELETE",
          entityType: "category",
          entityId: id,
          userId: req.user.id,
          details: `Catégorie supprimée: ${existingCategory.name}`,
          timestamp: new Date().toISOString(),
        });
        
        res.status(200).json({ success: true });
      } else {
        res.status(400).json({ 
          error: "Impossible de supprimer la catégorie", 
          message: "Assurez-vous qu'elle ne contient pas de vidéos ou de sous-catégories." 
        });
      }
    } catch (error) {
      console.error("Erreur lors de la suppression de la catégorie:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de la catégorie" });
    }
  });
  
  // Routes pour les statistiques de l'admin
  app.get("/api/stats", isAdmin, async (req, res) => {
    try {
      const videoCount = await storage.getVideoCount();
      const categoryCount = await storage.getCategoryCount();
      const tagCount = await storage.getTagCount();
      const userCount = await storage.getUserCount();
      
      res.json({
        videoCount,
        categoryCount,
        tagCount,
        userCount
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des statistiques:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des statistiques" });
    }
  });
  
  // Routes pour les logs d'activité
  app.get("/api/activity", isAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getActivityLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Erreur lors de la récupération des logs d'activité:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des logs d'activité" });
    }
  });
  
  // Create an HTTP server
  const httpServer = createServer(app);
  
  // Setup Vite for the frontend
  await setupVite(app, httpServer);
  
  return httpServer;
}
