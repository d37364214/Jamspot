
import type { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../../server/storage';
import { hashPassword } from '../../../shared/services/auth';

// Schéma de validation pour la mise à jour d'un utilisateur
const updateUserSchema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  isAdmin: z.boolean().optional()
});

export default async function handler(req: Request, res: Response) {
  // Vérification des droits admin
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    console.error("Tentative d'accès non autorisé à la gestion d'un utilisateur");
    return res.status(403).json({ error: "Accès non autorisé" });
  }

  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "ID utilisateur invalide" });
  }

  try {
    if (req.method === 'GET') {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      // Retourner l'utilisateur sans le mot de passe
      const { password, ...safeUser } = user;
      return res.status(200).json(safeUser);

    } else if (req.method === 'PUT') {
      const validation = updateUserSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Données invalides", 
          details: validation.error.flatten() 
        });
      }

      const updateData = validation.data;
      
      // Hasher le nouveau mot de passe si fourni
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      // Retourner l'utilisateur mis à jour sans le mot de passe
      const { password, ...safeUser } = updatedUser;
      return res.status(200).json(safeUser);

    } else if (req.method === 'DELETE') {
      // Empêcher la suppression de son propre compte
      if (userId === req.user.id) {
        return res.status(400).json({ error: "Impossible de supprimer votre propre compte" });
      }

      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      return res.status(200).json({ message: "Utilisateur supprimé avec succès" });
    }

    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (error) {
    console.error("Erreur lors de la gestion d'un utilisateur:", error);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}
