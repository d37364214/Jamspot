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
      console.error("Erreur d'authentification Supabase:", authError.message);
      return res.status(401).json({ error: "Identifiants invalides ou utilisateur inexistant" });
    }

    // Récupérer les tokens et les détails utilisateur
    const session = authData.session;
    const user = authData.user;

    if (!session || !user) {
      return res.status(500).json({ error: "Échec de la récupération des informations utilisateur" });
    }

    console.log("Utilisateur connecté avec succès:", user.email);

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
    console.error("Erreur imprévue lors de la connexion:", error);
    return res.status(500).json({ error: "Erreur imprévue lors de la connexion" });
  }
}