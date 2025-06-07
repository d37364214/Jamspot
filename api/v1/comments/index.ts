import type { NextApiRequest, NextApiResponse } from 'next'; // Used for typings only
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Adjust path as necessary

// --- Constants for Supabase/PostgreSQL error codes ---
const SUPABASE_ERROR_CODES = {
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  NO_ROWS_FOUND_POSTGREST: 'PGRST116', // Specific to PostgREST/Supabase
};

const COMMENT_COOLDOWN = 30000; // 30 seconds cooldown between comments

// --- Supabase Clients ---
// Client for read operations (GET) that should respect Row Level Security (RLS)
// Uses a public key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client for write operations (POST) or operations requiring service role privileges
// This client bypasses RLS and should be used with caution for critical operations.
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Zod Schema for creating a comment ---
const createCommentSchema = z.object({
  videoId: z.number().int("L'ID de la vidéo doit être un entier.").positive("L'ID de la vidéo est invalide."),
  content: z.string()
    .min(1, "Le commentaire ne peut pas être vide.")
    .max(1000, "Le commentaire est trop long (max 1000 caractères).")
    .trim() // Remove leading/trailing whitespace
});

// --- Utility Functions ---

/**
 * Centralized error handling utility.
 * Simplifies sending error responses and logging.
 * @param res The NextApiResponse object.
 * @param statusCode The HTTP status code to send.
 * @param message The user-friendly error message.
 * @param details Optional internal error details for logging.
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
 * Retrieves the authenticated user from the JWT token provided in the request headers.
 * Uses the `supabaseServiceRole` client to verify the token.
 * @param req The NextApiRequest object.
 * @returns The Supabase user object or null if not authenticated/invalid.
 */
async function getCurrentUser(req: NextApiRequest): Promise<any | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.debug('Missing Authorization header.');
    return null;
  }

  const token = authHeader.split(' ')[1]; // Extract Bearer token
  if (!token) {
    logger.debug('Missing Bearer token.');
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseServiceRole.auth.getUser(token);
    if (error || !user) {
      logger.warn('Error fetching user or user not found.', { error });
      return null;
    }
    return user;
  } catch (error) {
    logger.error('Unexpected error while fetching user.', { error });
    return null;
  }
}

// --- API Handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const videoIdQuery = req.query.videoId;
      const videoId = typeof videoIdQuery === 'string' ? parseInt(videoIdQuery, 10) : (Array.isArray(videoIdQuery) ? parseInt(videoIdQuery[0], 10) : undefined);

      if (videoId === undefined || isNaN(videoId) || videoId <= 0) {
        return handleError(res, 400, "ID de vidéo invalide.", { videoId: videoIdQuery });
      }

      // Use supabaseAnon for GET requests to respect RLS
      const { data: comments, error } = await supabaseAnon
        .from('comments') // Ensure 'comments' is your table name
        .select('id, content, user_id, created_at') // Select only necessary fields for performance
        .eq('video_id', videoId)
        .order('created_at', { ascending: true }); // Order comments by creation time

      if (error) {
        return handleError(res, 500, "Erreur lors de la récupération des commentaires.", { error, videoId });
      }

      return res.status(200).json(comments);

    } else if (req.method === 'POST') {
      // --- 1. Authentication Check ---
      const user = await getCurrentUser(req);
      if (!user) {
        return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
      }

      // --- 2. Zod Validation ---
      const validation = createCommentSchema.safeParse(req.body);
      if (!validation.success) {
        return handleError(res, 400, "Données de commentaire invalides.", { errors: validation.error.issues, body: req.body });
      }
      const { videoId, content } = validation.data;

      // --- 3. Preliminary Video Existence & Permission Check ---
      // Use supabaseAnon for this check to respect RLS (e.g., if video is private)
      const { data: video, error: videoFetchError } = await supabaseAnon
        .from('videos') // Assuming 'videos' is your video table name
        .select('id') // Only need to check existence
        .eq('id', videoId)
        .single();

      if (videoFetchError) {
        if (videoFetchError.code === SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
          return handleError(res, 404, "Vidéo non trouvée: Impossible de commenter une vidéo inexistante.", { videoId });
        }
        return handleError(res, 500, "Erreur lors de la vérification de la vidéo.", { videoFetchError, videoId });
      }

      if (!video) { // Redundant if PGRST116 is handled, but good for explicit check
        return handleError(res, 404, "Vidéo non trouvée ou inaccessible.", { videoId });
      }

      // TODO: Add more specific permission check here if certain users can't comment on certain videos (e.g., video is private)
      // Example: const { data: permission, error: permError } = await supabaseAnon.from('video_access').select('*').eq('video_id', videoId).eq('user_id', user.id).single();
      // if (!permission) { return handleError(res, 403, "Vous n'êtes pas autorisé à commenter cette vidéo."); }


      // --- 4. Cooldown Check ---
      // Use supabaseAnon to fetch the last comment for the current user
      const { data: lastComment, error: lastCommentError } = await supabaseAnon
        .from('comments')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastCommentError && lastCommentError.code !== SUPABASE_ERROR_CODES.NO_ROWS_FOUND_POSTGREST) {
        // Log the error but return an error response to the user if the cooldown check fails.
        // This prevents abuse if the cooldown check itself is buggy.
        return handleError(res, 500, "Impossible de vérifier le délai entre les commentaires.", { error: lastCommentError, userId: user.id });
      } else if (lastComment) {
        const timeSinceLastComment = Date.now() - new Date(lastComment.created_at).getTime();
        if (timeSinceLastComment < COMMENT_COOLDOWN) {
          const waitTimeSeconds = Math.ceil((COMMENT_COOLDOWN - timeSinceLastComment) / 1000);
          return handleError(res,
            429,
            `Veuillez attendre ${waitTimeSeconds} secondes avant de poster un nouveau commentaire.`,
            { waitTime: waitTimeSeconds }
          );
        }
      }

      // --- 5. Insert New Comment ---
      // Use supabaseServiceRole for insertion as it's a write operation
      const { data: newComment, error: createError } = await supabaseServiceRole
        .from('comments') // Ensure 'comments' is your table name
        .insert([
          {
            video_id: videoId,
            content: content,
            user_id: user.id // Ensure your table has a user_id column
          }
        ])
        .select('*')
        .single();

      if (createError) {
        return handleError(res, 500, "Erreur lors de la création du commentaire.", { error: createError, videoId, content, userId: user.id });
      }

      return res.status(201).json(newComment); // 201 Created for successful resource creation

    } else {
      // --- 6. Handle Unsupported HTTP Methods ---
      return handleError(res, 405, "Méthode non autorisée.", { method: req.method, url: req.url });
    }

  } catch (err) {
    // Catch any unexpected, unhandled errors
    return handleError(res, 500, "Erreur interne du serveur.", { error: err });
  }
}

