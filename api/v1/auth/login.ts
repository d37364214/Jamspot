import type { CustomApiRequest, CustomApiResponse } from '../../../api/types'; [span_0](start_span)[span_1](start_span)// Chemin ajusté[span_0](end_span)[span_1](end_span)
import { createClient } from '@supabase/supabase-js';
import logger from '../../../utils/logger'; // Importe le logger configuré
import { z } from 'zod'; // Importe Zod

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
// Utilisation de la clé publique (Anon Key) pour l'authentification utilisateur
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Définition du schéma de validation Zod pour la connexion
const loginSchema = z.object({
  email: z.string().email("L'adresse email n'est pas valide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
});

[span_2](start_span)[span_3](start_span)export default async function handler(req: CustomApiRequest, res: CustomApiResponse) { // Types mis à jour ici[span_2](end_span)[span_3](end_span)
  if (req.method !== 'POST') {
    logger.debug('Received a non-POST request', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  // Validation avec Zod
  const parseResult = loginSchema.safeParse(req.body);

  if (!parseResult.success) {
    logger.debug('Validation error during login', { errors: parseResult.error.errors });
    const errors = parseResult.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    return res.status(400).json({ error: "Données de connexion invalides", details: errors });
  }

  // Les données sont maintenant validées par Zod et typées
  const { email, password } = parseResult.data;

  try {
    // Authentification avec Supabase
    // Cette opération utilise la clé publique (Anon Key) et respecte les RLS.
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      logger.error('Supabase Auth Error', { error: authError, email });
      // Le message reste générique pour des raisons de sécurité.
      return res.status(401).json({ error: "Identifiants invalides ou utilisateur inexistant" });
    }

    // Récupérer les tokens et les détails utilisateur
    const session = authData.session;
    const user = authData.user; // Cet objet 'user' est l'objet complet de Supabase

    if (!session || !user) {
      logger.error('Supabase Auth Error: Session or user data missing', { session, user });
      return res.status(500).json({ error: "Échec de la récupération des informations utilisateur" });
    }

    // Log de succès
    logger.info(`User ${user.email} logged in successfully`, { userId: user.id });

    // Retourner les informations utilisateur et les tokens
    return res.status(200).json({
      message: "Connexion réussie",
      // FILTRAGE DE L'OBJET 'user' ICI :
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        // Ajoutez d'autres champs si nécessaire et non sensibles, par exemple :
        // app_metadata: user.app_metadata,
        // user_metadata: user.user_metadata,
      },
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

// NOTE IMPORTANTE : Cette route utilise la clé publique (Anon Key) de Supabase pour l'authentification des utilisateurs.
// La clé de rôle de service (SUPABASE_SERVICE_ROLE_KEY) ne doit JAMAIS être utilisée pour des opérations côté client
// ou pour des flux d'authentification utilisateur standard.
// Elle est réservée aux opérations de backend nécessitant des privilèges élevés (ex: administration, migrations).
