import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "L'email et le mot de passe sont requis" });
  }

  try {
    // Authentification avec Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error("Supabase Auth Error:", authError); // Utilisation de console.error pour les erreurs
      return res.status(401).json({ error: "Identifiants invalides ou utilisateur inexistant" });
    }

    // Récupérer les tokens et les détails utilisateur
    const session = authData.session;
    const user = authData.user;

    if (!session || !user) {
      console.error("Supabase Auth Error: Session or user data missing");
      return res.status(500).json({ error: "Échec de la récupération des informations utilisateur" });
    }

    // Log de succès (remplacer par un système de logging en production)
    console.log(`User ${user.email} logged in successfully`);

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
    console.error("Unhandled Error:", error);
    return res.status(500).json({ error: "Erreur imprévue lors de la connexion" });
  }
}

// ATTENTION: SUPABASE_SERVICE_ROLE_KEY est utilisé ici car cette route est côté serveur.
// NE JAMAIS l'utiliser côté client.  Pour les opérations nécessitant des privilèges,
// utiliser Row Level Security (RLS) ou des fonctions cloud Supabase.
