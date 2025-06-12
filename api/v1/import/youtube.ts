import type { CustomApiRequest, CustomApiResponse } from '../../../api/types'; // Chemin ajusté
import { google, youtube_v3 } from 'googleapis'; // Correction: Ajout de youtube_v3 pour le typage
import { createClient } from '@supabase/supabase-js'; // Correction: Syntaxe d'importation
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire

// --- Constantes pour les codes d'erreur Supabase/PostgreSQL ---
const SUPABASE_ERROR_CODES = {
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  NO_ROWS_FOUND_POSTGREST: 'PGRST116', // Spécifique à PostgREST/Supabase
};

// --- Client API YouTube ---
// Initialise le client YouTube avec votre clé API
const youtube = google.youtube({ version: 'v3', auth: process.env.API_KEY });

// --- Clients Supabase ---
// Client pour les opérations en lecture (GET) qui doivent respecter la sécurité au niveau des lignes (RLS)
// Utilise une clé publique (NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client pour les opérations d'écriture (POST, PUT, DELETE) ou les opérations nécessitant des privilèges de rôle de service
// Ce client contourne le RLS et doit être utilisé avec prudence pour les opérations critiques.
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Schéma Zod pour la validation des données vidéo de l'API YouTube ---
const videoSchema = z.object({
  youtube_id: z.string().min(1, "L'ID YouTube est requis.").max(20, "L'ID YouTube est trop long."), // Les ID de vidéo YouTube font typiquement 11 caractères
  title: z.string().min(1, "Le titre est requis.").max(255, "Le titre est trop long."),
  description: z.string().max(5000, "La description est trop longue.").nullable().optional(), // La description peut être très longue, gère null/undefined
  // Ajoutez d'autres champs que vous pourriez extraire et vouloir valider (par exemple, publishedAt, channelTitle)
});

// --- Fonctions utilitaires ---

/**
 * Utilitaire centralisé de gestion des erreurs.
 * Simplifie l'envoi de réponses d'erreur et la journalisation.
 * @param res L'objet CustomApiResponse.
 * @param statusCode Le code d'état HTTP à envoyer.
 * @param message Le message d'erreur convivial pour l'utilisateur.
 * @param details Détails facultatifs de l'erreur interne pour la journalisation.
 */
function handleError(
  res: CustomApiResponse, // Type mis à jour ici
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
 * @param req L'objet CustomApiRequest.
 * @returns L'objet utilisateur Supabase ou null si non authentifié/invalide.
 */
async function getCurrentUser(req: CustomApiRequest): Promise<any | null> { // Type mis à jour ici
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.debug('En-tête d\'autorisation manquant pour getCurrentUser.');
    return null;
  }

  const token = authHeader.split(' ')[1]; // Extrait le jeton Bearer
  if (!token) {
    logger.debug('Jeton Bearer manquant pour getCurrentUser.');
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseServiceRole.auth.getUser(token);
    if (error || !user) {
      logger.warn('Erreur lors de la récupération de l\'utilisateur ou utilisateur non trouvé pendant getCurrentUser.', { error });
      return null;
    }
    return user;
  } catch (error) {
      logger.error('Erreur inattendue lors de la récupération de l\'utilisateur dans getCurrentUser.', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Vérifie si l'utilisateur donné a un rôle 'admin'.
 * S'appuie sur les `app_metadata` de l'objet utilisateur.
 * @param user L'objet utilisateur Supabase.
 * @returns Vrai si l'utilisateur est un administrateur, faux sinon.
 */
async function isAdmin(user: any): Promise<boolean> {
  // Assurez-vous que le rôle 'admin' est correctement défini dans les app_metadata de vos utilisateurs Supabase.
  const userRole = user?.app_metadata?.role;
  const isCurrentUserAdmin = userRole === 'admin';

  if (!isCurrentUserAdmin) {
    logger.debug('Vérification isAdmin: L\'utilisateur n\'est pas un administrateur.', { userId: user?.id, userRole });
  }
  return isCurrentUserAdmin;
}

// --- Gestionnaire d'API principal ---
export default async function handler(req: CustomApiRequest, res: CustomApiResponse) { // Types mis à jour ici
  if (req.method !== 'POST') {
    return handleError(res, 405, "Méthode non autorisée.", { method: req.method });
  }

  // --- 1. Authentification et Autorisation ---
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

    // --- 2. Appel à l'API YouTube avec pagination ---
    do {
      // Correction: Ajout du typage explicite pour playlistItems
      const playlistItems: youtube_v3.Schema$PlaylistItemListResponse = await youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: playlistId,
        maxResults: 50, // Max results de l'API YouTube par requête
        pageToken: nextPageToken || undefined,
      });

      const items = playlistItems.data.items || [];
      for (const item of items) {
        const videoData = {
          youtube_id: item.snippet?.resourceId?.videoId || '',
          title: item.snippet?.title || '',
          description: item.snippet?.description || null,
          // Ajoutez d'autres champs du snippet si nécessaire
        };

        // --- 3. Valider les données vidéo de l'API YouTube ---
        const validationResult = videoSchema.safeParse(videoData);
        if (validationResult.success) {
          allVideos.push(validationResult.data);
        } else {
          logger.warn('Données vidéo invalides de l\'API YouTube, vidéo ignorée.', { errors: validationResult.error.issues, videoData });
        }
      }

      nextPageToken = playlistItems.data.nextPageToken;
    } while (nextPageToken);

    const importedCount = { success: 0, failed: 0 };
    const importedVideoIds: string[] = [];

    // --- 4. Opération Upsert Supabase ---
    for (const videoData of allVideos) {
      // Utilise upsert pour gérer les doublons potentiels (vidéos déjà importées)
      const { error: upsertError } = await supabaseServiceRole
        .from('videos') // Assurez-vous que 'videos' est le nom de votre table
        .upsert(
          {
            youtube_id: videoData.youtube_id,
            title: videoData.title,
            description: videoData.description,
            // Ajoutez d'autres champs qui pourraient être nuls ou avoir des valeurs par défaut dans votre schéma de base de données
            category_id: null, // TODO: Adapter ceci en fonction de votre logique d'attribution de catégorie
            subcategory_id: null, // TODO: Adapter ceci en fonction de votre logique d'attribution de sous-catégorie
          },
          { onConflict: 'youtube_id' } // Spécifie la colonne unique pour résoudre les conflits
        );

      if (upsertError) {
        logger.error('Erreur lors de l\'upsert d\'une vidéo pendant l\'importation.', { error: upsertError, videoData });
        importedCount.failed++;
      } else {
        importedCount.success++;
        importedVideoIds.push(videoData.youtube_id);
      }
    }

    // --- 5. Journal d'activité ---
    const userIdForLog = currentUser.id || 'SYSTEM_IMPORT'; // Utilise l'ID utilisateur réel ou un substitut système
    const { error: activityLogError } = await supabaseServiceRole
      .from('activity_logs') // Assurez-vous que 'activity_logs' est le nom de votre table
      .insert([
        {
          action: "IMPORT_YOUTUBE_PLAYLIST",
          entity_type: "playlist",
          entity_id: playlistId, // Journalise l'ID de la playlist
          user_id: userIdForLog,
          details: `Importation de playlist YouTube: ${playlistUrl}. Vidéos importées: ${importedCount.success}, Échecs: ${importedCount.failed}.`,
          timestamp: new Date().toISOString(),
        },
      ]);

    if (activityLogError) {
      logger.error('Erreur lors de la création du journal d\'activité pour l\'importation YouTube.', { error: activityLogError, playlistUrl, userId: userIdForLog });
      // Ne pas bloquer la réponse principale si le journal d'activité échoue.
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
