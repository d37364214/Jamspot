import type { NextApiRequest, NextApiResponse } from 'next'; // Garde pour le typage si vous le trouvez pratique
import { createClient } from '@supabase/supabase-js';
import logger from '../../../utils/logger'; // Importe votre logger configuré
import { z } from 'zod'; // Importe Zod pour une validation plus robuste

// Initialisation du client Supabase avec la clé SERVICE_ROLE_KEY
// Cette clé est nécessaire pour `supabase.auth.signUp` (côté serveur)
// et pour `supabase.auth.admin.deleteUser` (pour le rollback).
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// --- NOUVEAU: Schéma de validation Zod pour l'inscription ---
const registerSchema = z.object({
  email: z.string().email("L'adresse email n'est pas valide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
  username: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères.").max(30, "Le nom d'utilisateur ne peut pas dépasser 30 caractères."),
  // Ajoutez d'autres champs si 'rest' est censé contenir des données spécifiques
  // ex: firstName: z.string().optional(),
});
// -----------------------------------------------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    logger.debug('Received a non-POST request for registration', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  // --- NOUVEAU: Validation avec Zod ---
  const parseResult = registerSchema.safeParse(req.body);

  if (!parseResult.success) {
    logger.debug('Validation error during registration', { errors: parseResult.error.errors });
    const errors = parseResult.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    return res.status(400).json({ error: "Données d'inscription invalides", details: errors });
  }
  // ------------------------------------

  const { email, password, username, ...rest } = parseResult.data; // Utilise les données validées

  try {
    // --- SUPPRIMÉ: Les vérifications d'existence manuelles ---
    // Raison: Il est plus robuste de gérer l'unicité via les contraintes de base de données.
    // Cela simplifie le code et garantit l'atomicité.

    // 1. Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username, // Stocke le nom d'utilisateur dans les user_metadata de Supabase Auth
          ...rest, // Ajoute d'autres informations si `rest` contient des données à stocker dans les metadata
        },
        // Si vous voulez que l'utilisateur soit directement connecté après inscription sans confirmation d'email
        // Rappel: Cela peut nécessiter une configuration spécifique dans Supabase Auth Settings
        // emailRedirectTo: 'YOUR_FRONTEND_URL/auth/confirm' // L'URL vers laquelle rediriger après la confirmation d'email
      },
    });

    if (authError) {
      logger.error('Supabase Auth Error during signup', {
        errorMessage: authError.message,
        errorCode: authError.code,
        email,
        username,
      });
      // Expose le message d'erreur de Supabase, qui peut être plus utile pour le client
      // ou remplacez par un message générique si vous préférez masquer les détails
      return res.status(400).json({ error: authError.message || "Erreur lors de la création de l'utilisateur." });
    }

    const newUser = authData.user; // L'objet utilisateur de Supabase Auth
    const session = authData.session; // La session si l'utilisateur est auto-connecté

    if (!newUser) {
      logger.error('Supabase Auth Error: User data missing after signup', { authData });
      return res.status(500).json({ error: "Échec de la récupération des informations du nouvel utilisateur." });
    }

    // 2. Persister les informations utilisateur supplémentaires dans votre table 'users'
    // Cette opération est faite avec la SERVICE_ROLE_KEY, donc elle bypass les RLS.
    const { error: userTableError } = await supabase
      .from('users')
      .insert([
        {
          id: newUser.id, // L'ID de l'utilisateur créé par Supabase Auth (UUID)
          email: newUser.email!, // Email de l'utilisateur
          username, // Nom d'utilisateur
          // ...rest, // N'incluez 'rest' ici que si vous avez défini ces champs dans votre schéma Zod
        },
      ]);

    if (userTableError) {
      logger.error('Error inserting user data into the users table', {
        errorMessage: userTableError.message,
        errorCode: userTableError.code, // Code d'erreur de la DB, ex: "23505" pour unicité
        userId: newUser.id,
        username,
        stack: userTableError.stack,
      });

      // --- NOUVEAU: Rollback en cas d'échec de l'insertion dans la table 'users' ---
      // Supprime l'utilisateur de Supabase Auth pour éviter un état incohérent
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(newUser.id);
      if (deleteUserError) {
        logger.error('Failed to rollback user creation after DB insert error', {
          errorMessage: deleteUserError.message,
          userId: newUser.id,
          stack: deleteUserError.stack,
        });
      }
      // -----------------------------------------------------------------------------

      // Gère les erreurs de contrainte d'unicité (par exemple, si email/username est déjà pris)
      // "23505" est le code d'erreur SQLSTATE pour une violation de contrainte unique.
      if (userTableError.code === '23505') {
        let field = 'unknown';
        if (userTableError.message.includes('email')) field = 'email';
        else if (userTableError.message.includes('username')) field = 'nom d\'utilisateur';
        return res.status(400).json({ error: `Ce ${field} est déjà utilisé.` });
      }

      return res.status(500).json({ error: "Erreur lors de la sauvegarde des informations de l'utilisateur. Annulation de l'inscription." });
    }

    logger.info(`User ${newUser.email} registered successfully`, { userId: newUser.id, username });

    // Retourne un objet utilisateur filtré et la session si présente
    return res.status(201).json({
      message: "Inscription réussie",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: username, // Assure que le nom d'utilisateur est retourné
        // ... autres champs filtrés que vous souhaitez retourner
      },
      // Retourne la session si l'utilisateur est automatiquement connecté après l'inscription
      ...(session && {
        tokens: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        },
      }),
    });

  } catch (error) {
    logger.error('Unhandled Error during registration', {
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      email,
      username,
    });
    return res.status(500).json({ error: "Erreur imprévue lors de l'inscription. Veuillez réessayer plus tard." });
  }
}

// --- IMPORTANT : Actions Requises dans votre Base de Données Supabase ---
// Pour la gestion de l'unicité par la DB, vous devez ajouter des contraintes UNIQUE à votre table 'users'.
// Par exemple, dans l'éditeur SQL de Supabase ou via une migration Drizzle :
// ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
// ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);

// De plus, la colonne 'id' de votre table 'users' DOIT être la clé primaire et un UUID par défaut
// ALTER TABLE public.users ADD PRIMARY KEY (id);
// ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
// ALTER TABLE public.users ADD FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
// La dernière ligne est très importante pour lier l'ID de votre table de profil à l'ID de l'utilisateur dans auth.users
// et supprimer le profil si l'utilisateur est supprimé de l'authentification Supabase.
// -----------------------------------------------------------------------
