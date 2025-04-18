
import type { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../../server/storage';
import { hashPassword } from '../../../shared/services/auth';

// Schéma de validation pour la création d'un utilisateur
const createUserSchema = z.object({
  username: z.string().min(3, "Le nom d'utilisateur doit faire au moins 3 caractères"),
  password: z.string().min(6, "Le mot de passe doit faire au moins 6 caractères"),
  isAdmin: z.boolean().optional().default(false)
});

export default async function handler(req: Request, res: Response) {
  // Vérification des droits admin
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    console.error("Tentative d'accès non autorisé à la gestion des utilisateurs");
    return res.status(403).json({ error: "Accès non autorisé" });
  }

  try {
    if (req.method === 'GET') {
      const users = await storage.getAllUsers();
      // Filtrer les données sensibles
      const safeUsers = users.map(({ password, ...user }) => user);
      return res.status(200).json(safeUsers);

    } else if (req.method === 'POST') {
      const validation = createUserSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Données invalides", 
          details: validation.error.flatten() 
        });
      }

      const { username, password, isAdmin } = validation.data;
      
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: "Ce nom d'utilisateur existe déjà" });
      }

      // Créer l'utilisateur
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        isAdmin: isAdmin || false
      });

      // Retourner l'utilisateur sans le mot de passe
      const { password: _, ...safeUser } = user;
      return res.status(201).json(safeUser);
    }

    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (error) {
    console.error("Erreur lors de la gestion des utilisateurs:", error);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}
