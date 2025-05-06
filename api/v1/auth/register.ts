import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../utils/logger'; // Importe votre logger configuré

// Initialisation du client Supabase (avec la clé SERVICE_ROLE pour les opérations serveur sécurisées)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    logger.debug('Received a non-POST request for registration', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { email, password, username, ...rest } = req.body;

  if (!email || !password || !username) {
    logger.debug('Email, password, and username are required for registration', { email, username });
    return res.status(400).json({ error: "L'email, le mot de passe et le nom d'utilisateur sont requis" });
  }

  try {
    // 1. Vérifier si l'utilisateur existe déjà (par email ou nom d'utilisateur)
    const { data: existingUserByEmail, error: emailCheckError } = await supabase
      .from('users') // Assurez-vous que 'users' est le nom de votre table utilisateur
      .select('id')
      .eq('email', email)
      .single();

    if (emailCheckError) {
      logger.error('Error checking existing user by email', { error: emailCheckError, email });
      return res.status(500).json({ error: "Erreur lors de la vérification de l'email" });
    }

    if (existingUserByEmail) {
      logger.debug('Email already exists', { email });
      return res.status(400).json({ error: "Cet email est déjà utilisé" });
    }

    const { data: existingUserByUsername, error: usernameCheckError } = await supabase
      .from('users') // Assurez-vous que 'users' est le nom de votre table utilisateur
      .select('id')
      .eq('username', username)
      .single();

    if (usernameCheckError) {
      logger.error('Error checking existing user by username', { error: usernameCheckError, username });
      return res.status(500).json({ error: "Erreur lors de la vérification du nom d'utilisateur" });
    }

    if (existingUserByUsername) {
      logger.debug('Username already exists', { username });
      return res.status(400).json({ error: "Ce nom d'utilisateur existe déjà" });
    }

    // 2. Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          ...rest, // Permet d'ajouter d'autres informations utilisateur si nécessaire
        },
      },
    });

    if (authError) {
      logger.error('Supabase Auth Error during signup', { error: authError, email, username });
      return res.status(400).json({ error: "Erreur lors de la création de l'utilisateur" });
    }

    const newUser = authData.user;

    if (!newUser) {
      logger.error('Supabase Auth Error: User data missing after signup', { authData });
      return res.status(500).json({ error: "Échec de la récupération des informations du nouvel utilisateur" });
    }

    // 3. (Optionnel mais recommandé) Persister les informations utilisateur supplémentaires dans votre table 'users'
    // Note: Supabase Auth gère déjà l'email et un identifiant unique (uid).
    // Vous pourriez vouloir stocker le nom d'utilisateur et d'autres détails ici.
    const { error: userTableError } = await supabase
      .from('users') // Assurez-vous que 'users' est le nom de votre table utilisateur
      .insert([
        {
          id: newUser.id, // L'ID de l'utilisateur créé par Supabase Auth
          email: newUser.email!,
          username,
          ...rest,
        },
      ]);

    if (userTableError) {
      logger.error('Error inserting user data into the users table', { error: userTableError, userId: newUser.id, username });
      // Vous pourriez choisir de révoquer l'utilisateur Auth ici en cas d'échec de l'insertion dans la table.
      // await supabase.auth.admin.deleteUser(newUser.id);
      return res.status(500).json({ error: "Erreur lors de la sauvegarde des informations de l'utilisateur" });
    }

    logger.info(`User ${newUser.email} registered successfully`, { userId: newUser.id, username });

    return res.status(201).json({ message: "Inscription réussie", user: newUser });

  } catch (error) {
    logger.error('Unhandled Error during registration', { error, email, username });
    return res.status(500).json({ error: "Erreur imprévue lors de l'inscription" });
  }
}

// ATTENTION: SUPABASE_SERVICE_ROLE_KEY est utilisé ici car cette route est côté serveur.
// NE JAMAIS l'utiliser côté client. Pour les opérations nécessitant des privilèges,
// utiliser Row Level Security (RLS) ou des fonctions cloud Supabase.

// Schéma de la table 'users' (exemple):
// id (UUID - clé primaire, correspond à l'uid Supabase Auth)
// email (TEXT - unique)
// username (TEXT - unique)
// ... autres colonnes
