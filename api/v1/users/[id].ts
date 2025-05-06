import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire
import { users } from '../../../shared/schema'; // Importez votre schéma Drizzle pour les types

// Schéma de validation pour la mise à jour d'un utilisateur
const updateUserSchema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  is_admin: z.boolean().optional(),
});

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour vérifier si l'utilisateur actuel est administrateur (à implémenter)
async function isAdmin(req: NextApiRequest): Promise<boolean> {
  // TODO: Implémenter la logique pour vérifier si l'utilisateur actuel est administrateur
  return false;
}

// Fonction pour récupérer l'utilisateur actuel à partir de l'authentification Supabase (à implémenter)
async function getCurrentUser(req: NextApiRequest): Promise<any | null> {
  // TODO: Implémenter la logique pour récupérer l'utilisateur authentifié
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  const userId = typeof id === 'string' ? parseInt(id, 10) : (Array.isArray(id) ? parseInt(id[0], 10) : undefined);

  if (userId === undefined || isNaN(userId) || userId <= 0) {
    logger.debug('Invalid user ID', { id: req.query.id });
    return res.status(400).json({ error: "ID utilisateur invalide" });
  }

  const currentAdmin = await isAdmin(req);
  if (!currentAdmin) {
    logger.warn('Unauthorized attempt to manage a user', { userId });
    return res.status(403).json({ error: "Accès non autorisé" });
  }

  const currentUser = await getCurrentUser(req);

  try {
    if (req.method === 'GET') {
      const { data: user, error } = await supabase
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .select('id, username, is_admin, created_at') // Ne sélectionnez pas le mot de passe
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Error fetching user', { error, userId });
        return res.status(500).json({ error: "Erreur lors de la récupération de l'utilisateur" });
      }

      if (!user) {
        logger.debug('User not found', { userId });
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      return res.status(200).json(user);

    } else if (req.method === 'PUT') {
      const result = updateUserSchema.safeParse(req.body);
      if (!result.success) {
        logger.debug('Invalid request body for updating user', { errors: result.error.issues, body: req.body, userId });
        return res.status(400).json({ error: "Données de mise à jour invalides", details: result.error.issues });
      }

      const updateData = { ...result.data };

      if (updateData.password) {
        const hashedPassword = await bcrypt.hash(updateData.password, 10); // Utiliser bcrypt pour le hashage
        updateData.password = hashedPassword;
      }

      const { data: updatedUser, error } = await supabase
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .update(updateData)
        .eq('id', userId)
        .select('id, username, is_admin, created_at') // Ne retournez pas le mot de passe
        .single();

      if (error) {
        logger.error('Error updating user', { error, userId, data: updateData });
        return res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur" });
      }

      if (!updatedUser) {
        logger.debug('User not found for update', { userId });
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      return res.status(200).json(updatedUser);

    } else if (req.method === 'DELETE') {
      if (currentUser?.id === userId) {
        return res.status(400).json({ error: "Impossible de supprimer votre propre compte" });
      }

      const { error: deleteError } = await supabase
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .delete()
        .eq('id', userId);

      if (deleteError) {
        logger.error('Error deleting user', { error: deleteError, userId });
        return res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" });
      }

      const { data: deletedUserCheck, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (checkError) {
        logger.error('Error checking if user exists after deletion', { error: checkError, userId });
        // Potentiellement ne pas bloquer la réponse ici
      }

      if (deletedUserCheck === null) {
        return res.status(200).json({ message: "Utilisateur supprimé avec succès" });
      } else {
        return res.status(404).json({ error: "Utilisateur non trouvé" }); // Si la suppression a échoué côté base de données
      }
    }

    logger.debug('Received an unsupported method for user by ID', { method: req.method, userId });
    return res.status(405).json({ error: "Méthode non autorisée" });

  } catch (error) {
    logger.error('Unhandled error during user management by ID', { error, userId });
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}
