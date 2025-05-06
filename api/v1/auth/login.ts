import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../utils/logger'; // Importe le logger configuré

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    logger.debug('Received a non-POST request', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    logger.debug('Email and password are required', { email, password });
    return res.status(400).json({ error: "L'email et le mot de passe sont requis" });
  }

  try {
    // Authentification avec Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      logger.error('Supabase Auth Error', { error: authError, email });
      return res.status(401).json({ error: "Identifiants invalides ou utilisateur inexistant" });
    }

    // Récupérer les tokens et les détails utilisateur
    const session = authData.session;
    const user = authData.user;

    if (!session || !user) {
      logger.error('Supabase Auth Error: Session or user data missing', { session, user });
      return res.status(500).json({ error: "Échec de la récupération des informations utilisateur" });
    }

    // Log de succès
    logger.info(`User ${user.email} logged in successfully`, { userId: user.id });

    // Retourner les informations utilisateur et les tokens
    return res.status(200).json({
      message: "Connexion réussie",
      user,
      tokens: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      },
    });
  } catch (error) {
    logger.error('Unhandled Error during login', { error, email });
    return res.status(500).json({ error: "Erreur imprévue lors de la connexion" });
  }
}

// ATTENTION: SUPABASE_SERVICE_ROLE_KEY est utilisé ici car cette route est côté serveur.
// NE JAMAIS l'utiliser côté client.  Pour les opérations nécessitant des privilèges,
// utiliser Row Level Security (RLS) ou des fonctions cloud Supabase.
