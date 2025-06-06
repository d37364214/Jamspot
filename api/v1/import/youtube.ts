import type { NextApiRequest, NextApiResponse } from 'next'; // Used for typings only
import { google } from 'googleapis';
import { createClient } => '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Adjust path as necessary

// --- Constants for Supabase/PostgreSQL error codes ---
const SUPABASE_ERROR_CODES = {
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  NO_ROWS_FOUND_POSTGREST: 'PGRST116', // Specific to PostgREST/Supabase
};

// --- YouTube API Client ---
// Initialize YouTube client with your API Key
const youtube = google.youtube({ version: 'v3', auth: process.env.API_KEY });

// --- Supabase Clients ---
// Client for read operations (GET) that should respect Row Level Security (RLS)
// Uses a public key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client for write operations (POST, PUT, DELETE) or operations requiring service role privileges
// This client bypasses RLS and should be used with caution for critical operations.
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Zod Schema for validating video data from YouTube API ---
const videoSchema = z.object({
  youtube_id: z.string().min(1, "L'ID YouTube est requis.").max(20, "L'ID YouTube est trop long."), // YouTube video IDs are typically 11 chars
  title: z.string().min(1, "Le titre est requis.").max(255, "Le titre est trop long."),
  description: z.string().max(5000, "La description est trop longue.").nullable().optional(), // Description can be very long, handle null/undefined
  // Add other fields you might extract and want to validate (e.g., publishedAt, channelTitle)
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
    logger.debug('Missing Authorization header for getCurrentUser.');
    return null;
  }

  const token = authHeader.split(' ')[1]; // Extract Bearer token
  if (!token) {
    logger.debug('Missing Bearer token for getCurrentUser.');
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseServiceRole.auth.getUser(token);
    if (error || !user) {
      logger.warn('Error fetching user or user not found during getCurrentUser.', { error });
      return null;
    }
    return user;
  } catch (error) {
    logger.error('Unexpected error while fetching user in getCurrentUser.', { error });
    return null;
  }
}

/**
 * Checks if the given user has an 'admin' role.
 * Relies on the user object's app_metadata.
 * @param user The Supabase user object.
 * @returns True if the user is an admin, false otherwise.
 */
async function isAdmin(user: any): Promise<boolean> {
  // Ensure 'admin' role is correctly set in your Supabase user's app_metadata.
  const userRole = user?.app_metadata?.role;
  const isCurrentUserAdmin = userRole === 'admin';

  if (!isCurrentUserAdmin) {
    logger.debug('isAdmin check: User is not an administrator.', { userId: user?.id, userRole });
  }
  return isCurrentUserAdmin;
}

// --- Main API Handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return handleError(res, 405, "Méthode non autorisée.", { method: req.method });
  }

  // --- 1. Authentication and Authorization ---
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return handleError(res, 401, "Non authentifié: Jeton d'authentification manquant ou invalide.");
  }

  const adminCheck = await isAdmin(currentUser);
  if (!adminCheck) {
    return handleError(res, 403, "Accès non autorisé: Les privilèges d'administrateur sont requis pour importer des playlists.");
  }

  try {
    const { playlistUrl } = req.body;
    if (!playlistUrl) {
      return handleError(res, 400, "URL de playlist manquante dans le corps de la requête.");
    }

    const playlistIdMatch = playlistUrl.match(/[?&]list=([^&]+)/);
    const playlistId = playlistIdMatch ? playlistIdMatch[1] : null;

    if (!playlistId) {
      return handleError(res, 400, "Format d'URL de playlist YouTube invalide.", { playlistUrl });
    }

    let allVideos: z.infer<typeof videoSchema>[] = [];
    let nextPageToken: string | undefined | null = null;

    // --- 2. YouTube API Call with Pagination ---
    do {
      const playlistItems = await youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: playlistId,
        maxResults: 50, // YouTube API max results per request
        pageToken: nextPageToken || undefined,
      });

      const items = playlistItems.data.items || [];
      for (const item of items) {
        const videoData = {
          youtube_id: item.snippet?.resourceId?.videoId || '',
          title: item.snippet?.title || '',
          description: item.snippet?.description || null,
          // Add other fields from snippet if needed
        };

        // --- 3. Validate video data from YouTube API ---
        const validationResult = videoSchema.safeParse(videoData);
        if (validationResult.success) {
          allVideos.push(validationResult.data);
        } else {
          logger.warn('Invalid video data from YouTube API, skipping video.', { errors: validationResult.error.issues, videoData });
        }
      }

      nextPageToken = playlistItems.data.nextPageToken;
    } while (nextPageToken);

    const importedCount = { success: 0, failed: 0 };
    const importedVideoIds: string[] = [];

    // --- 4. Supabase Upsert Operation ---
    for (const videoData of allVideos) {
      // Use upsert to handle potential duplicates (videos already imported)
      const { error: upsertError } = await supabaseServiceRole
        .from('videos') // Ensure 'videos' is your table name
        .upsert(
          {
            youtube_id: videoData.youtube_id,
            title: videoData.title,
            description: videoData.description,
            // Add other fields that might be null or have default values in your DB schema
            category_id: null, // TODO: Adapt this based on your category assignment logic
            subcategory_id: null, // TODO: Adapt this based on your subcategory assignment logic
          },
          { onConflict: 'youtube_id' } // Specify the unique column to resolve conflicts
        );

      if (upsertError) {
        logger.error('Error upserting video during import.', { error: upsertError, videoData });
        importedCount.failed++;
      } else {
        importedCount.success++;
        importedVideoIds.push(videoData.youtube_id);
      }
    }

    // --- 5. Activity Log ---
    const userIdForLog = currentUser.id || 'SYSTEM_IMPORT'; // Use actual user ID or a system placeholder
    const { error: activityLogError } = await supabaseServiceRole
      .from('activity_logs') // Ensure 'activity_logs' is your table name
      .insert([
        {
          action: "IMPORT_YOUTUBE_PLAYLIST",
          entity_type: "playlist",
          entity_id: playlistId, // Log the playlist ID
          user_id: userIdForLog,
          details: `Importation de playlist YouTube: ${playlistUrl}. Vidéos importées: ${importedCount.success}, Échecs: ${importedCount.failed}.`,
          timestamp: new Date().toISOString(),
        },
      ]);

    if (activityLogError) {
      logger.error('Error creating activity log for YouTube import.', { error: activityLogError, playlistUrl, userId: userIdForLog });
      // Do not block the main response if activity log fails.
    }

    return res.status(200).json({
      message: "Importation de playlist YouTube terminée.",
      playlistId,
      totalVideosFetched: allVideos.length,
      importedCount: importedCount.success,
      failedCount: importedCount.failed,
      importedVideoIds,
    });

  } catch (error: any) {
    return handleError(res, 500, "Erreur interne du serveur lors de l'importation de la playlist YouTube.", { error: error.message, stack: error.stack });
  }
}

