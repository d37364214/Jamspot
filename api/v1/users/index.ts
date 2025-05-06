import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire
import { users } from '../../../shared/schema'; // Importez votre schéma Drizzle pour les types

// Schéma de validation pour la création d'un utilisateur
const createUserSchema = z.object({
  username: z.string().min(3, "Le nom d'utilisateur doit faire au moins 3 caractères"),
  password: z.string().min(6, "Le mot de passe doit faire au moins 6 caractères"),
  is_admin: z.boolean().optional().default(false)
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentAdmin = await isAdmin(req);
  if (!currentAdmin) {
    logger.warn('Unauthorized attempt to manage users');
    return res.status(403).json({ error: "Accès non autorisé" });
  }

  try {
    if (req.method === 'GET') {
      const { data: usersList, error } = await supabase
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .select('id, username, is_admin, created_at'); // Ne sélectionnez pas le mot de passe

      if (error) {
        logger.error('Error fetching all users', { error });
        return res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
      }

      return res.status(200).json(usersList);

    } else if (req.method === 'POST') {
      const result = createUserSchema.safeParse(req.body);
      if (!result.success) {
        logger.debug('Invalid request body for creating user', { errors: result.error.issues, body: req.body });
        return res.status(400).json({ error: "Données de création invalides", details: result.error.issues });
      }

      const { username, password, is_admin = false } = result.data;

      // Vérifier si l'utilisateur existe déjà (via Supabase)
      const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUserError) {
        logger.error('Error checking for existing user', { error: existingUserError, username });
        return res.status(500).json({ error: "Erreur lors de la vérification de l'utilisateur" });
      }

      if (existingUser) {
        return res.status(409).json({ error: "Ce nom d'utilisateur existe déjà" });
      }

      // Créer l'utilisateur dans Supabase
      const hashedPassword = await bcrypt.hash(password, 10);
      const { data: newUser, error: createUserError } = await supabase
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .insert([{ username, password: hashedPassword, is_admin }])
        .select('id, username, is_admin, created_at') // Ne retournez pas le mot de passe
        .single();

      if (createUserError) {
        logger.error('Error creating user', { error: createUserError, username });
        return res.status(500).json({ error: "Erreur lors de la création de l'utilisateur" });
      }

      return res.status(201).json(newUser);
    }

    logger.debug('Received an unsupported method for users index', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });

  } catch (error) {
    logger.error('Unhandled error during users management', { error });
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}
