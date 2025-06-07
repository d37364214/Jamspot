import type { NextApiRequest, NextApiResponse } from 'next'; // Utilisé uniquement pour les typages
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire

// --- Constantes pour les codes d'erreur Supabase/PostgreSQL ---
const SUPABASE_ERROR_CODES = {
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  NO_ROWS_FOUND_POSTGREST: 'PGRST116', // Spécifique à PostgREST/Supabase
};

// --- Clients Supabase ---
// Client pour les opérations en lecture (GET) qui doivent respecter la sécurité au niveau des lignes (RLS)
// Utilise une clé publique (NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client pour les opérations d'écriture (POST) ou celles nécessitant des privilèges de service
// Ce client contourne le RLS et doit être utilisé avec prudence pour les opérations critiques.
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Schéma de validation pour la création d'un utilisateur ---
const createUserSchema = z.object({
  username: z.string()
    .min(3, "Le nom d'utilisateur doit faire au moins 3 caractères.")
    .max(50, "Le nom d'utilisateur ne doit pas dépasser 50 caractères."),
  password: z.string()
    .min(6, "Le mot de passe doit faire au moins 6 caractères.")
    .max(100, "Le mot de passe ne doit pas dépasser 100 caractères."),
  is_admin: z.boolean().optional().default(false)
});

// --- Fonctions utilitaires ---

/**
 * Utilitaire centralisé de gestion des erreurs.
 * Simplifie l'envoi des réponses d'erreur et la journalisation.
 * @param res L'objet NextApiResponse.
 * @param statusCode Le code d'état HTTP à envoyer.
 * @param message Le message d'erreur convivial à l'utilisateur.
 * @param details Les détails de l'erreur interne pour la journalisation.
 */
function handleError(
  res: NextApiResponse,
  statusCode: number,
  message: string,
  details?: any
) {
  logger.error(message, details);
  return res.status(statusCode).json({ error: message });
}

/**
 * Récupère l'utilisateur authentifié à partir du jeton JWT fourni dans les en-têtes de la requête.
 * Utilise le client `supabaseServiceRole` pour vérifier le jeton.
 * @param req L'objet NextApiRequest.
 * @returns L'objet utilisateur Supabase ou null si non authentifié/invalide.
 */
async function getCurrentUser(req: NextApiRequest): Promise<any | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.debug('En-tête d\'autorisation manquant.');
    return null;
  }

  const token = authHeader.split(' ')[1]; // Extrait le jeton Bearer
  if (!token) {
    logger.debug('Jeton Bearer manquant.');
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseServiceRole.auth.getUser(token);
    if (error || !user) {
      logger.warn('Erreur lors de la récupération de l\'utilisateur ou utilisateur non trouvé.', { error });
      return null;
    }
    return user;
  } catch (error) {
    logger.error('Erreur inattendue lors de la récupération de l\'utilisateur.', { error });
    return null;
  }
}

/**
 * Vérifie si l'utilisateur donné a un rôle d'administrateur.
 * Se base sur les `app_metadata` de l'utilisateur Supabase.
 * @param user L'objet utilisateur Supabase.
 * @returns Vrai si l'utilisateur est admin, faux sinon.
 */
async function isAdmin(user: any): Promise<boolean> {
  // Assurez-vous que le rôle 'admin' est correctement défini dans les app_metadata de vos utilisateurs Supabase.
  const userRole = user?.app_metadata?.role;
  const isCurrentUserAdmin = userRole === 'admin';

  if (!isCurrentUserAdmin) {
    logger.debug('Vérification isAdmin: L\'utilisateur n\'est pas administrateur.', { userId: user?.id, userRole });
  }
  return isCurrentUserAdmin;
}

// --- Gestionnaire d'API ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Les opérations sur cette route nécessitent une autorisation d'administrateur.
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
  }
  const currentAdmin = await isAdmin(currentUser);
  if (!currentAdmin) {
    return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis pour gérer les utilisateurs.");
  }

  try {
    if (req.method === 'GET') {
      const pageQuery = req.query.page;
      const limitQuery = req.query.limit;

      // Validation et application de la pagination
      const page = parseInt(typeof pageQuery === 'string' ? pageQuery : '1', 10);
      const limit = parseInt(typeof limitQuery === 'string' ? limitQuery : '10', 10);
      const offset = (page - 1) * limit;

      if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
        return handleError(res, 400, "Paramètres de pagination invalides (page ou limit).", { pageQuery, limitQuery });
      }

      // Utilise supabaseAnon pour les requêtes GET afin de respecter le RLS
      const { data: usersList, error, count } = await supabaseAnon
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .select('id, username, is_admin, created_at', { count: 'exact' }) // Ne sélectionnez JAMAIS le mot de passe, demandez le total
        .order('username', { ascending: true }) // Ordonne par nom d'utilisateur par défaut
        .range(offset, offset + limit - 1); // Applique la pagination

      if (error) {
        return handleError(res, 500, "Erreur lors de la récupération des utilisateurs.", { error });
      }

      return res.status(200).json({
        data: usersList,
        page,
        limit,
        total: count, // Incluez le nombre total d'utilisateurs pour la pagination côté client
      });

    } else if (req.method === 'POST') {
      // 1. Validation du corps de la requête avec Zod
      const result = createUserSchema.safeParse(req.body);
      if (!result.success) {
        return handleError(res, 400, "Données de création invalides.", { errors: result.error.issues, body: req.body });
      }

      const { username, password, is_admin } = result.data;

      // 2. Vérification de l'unicité du NOM D'UTILISATEUR (via Supabase)
      // Utilise supabaseAnon pour vérifier l'existence, respectant le RLS.
      const { data: existingUser, error: existingUserError } = await supabaseAnon
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUserError && existingUserError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
        return handleError(res, 500, "Erreur lors de la vérification de l'utilisateur existant.", { existingUserError, username });
      }

      if (existingUser) {
        return handleError(res, 409, "Conflit: Ce nom d'utilisateur existe déjà.", { username });
      }

      // 3. Hashage du mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);

      // 4. Créer l'utilisateur dans Supabase
      // Utilise supabaseServiceRole pour l'insertion
      const { data: newUser, error: createUserError } = await supabaseServiceRole
        .from('users') // Assurez-vous que 'users' est le nom de votre table
        .insert([{ username, password: hashedPassword, is_admin }])
        .select('id, username, is_admin, created_at') // Ne retournez JAMAIS le mot de passe
        .single();

      if (createUserError) {
        // Gérer les erreurs PostgreSQL spécifiques, comme la violation d'unicité (username)
        if (createUserError.code === SUPABASE_ERROR_CODES.UNIQUE_VIOLATION) {
          return handleError(res, 409, "Conflit: Un utilisateur avec ce nom existe déjà.", { createUserError, username });
        }
        return handleError(res, 500, "Erreur lors de la création de l'utilisateur.", { createUserError, username });
      }

      return res.status(201).json(newUser); // 201 Created

    } else {
      // --- Gérer les méthodes HTTP non autorisées ---
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, url: req.url });
    }

  } catch (error) {
    // --- Gérer les erreurs inattendues ---
    return handleError(res, 500, "Erreur interne du serveur lors de la gestion des utilisateurs.", { error });
  }
}

