import type { NextApiRequest, NextApiResponse } from 'next'; // Vercel
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire

const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });

// Initialisation du client Supabase (avec la clé SERVICE_ROLE pour les opérations serveur sécurisées)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour vérifier si l'utilisateur est administrateur (à implémenter)
async function isAdmin(req: NextApiRequest): Promise<boolean> {
  // TODO: Implémenter la logique pour vérifier si l'utilisateur est administrateur
  return false;
}

// Fonction pour récupérer l'utilisateur à partir de l'authentification Supabase (à implémenter si nécessaire pour le log d'activité)
async function getCurrentUser(req: NextApiRequest): Promise<any | null> {
  // TODO: Implémenter la logique pour récupérer l'utilisateur authentifié si vous souhaitez loguer l'action par un utilisateur spécifique
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) { // Vercel
  if (req.method !== 'POST') {
    logger.debug('Received a non-POST request for YouTube import', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const adminCheck = await isAdmin(req);
  if (!adminCheck) {
    logger.warn('Unauthorized attempt to import YouTube playlist');
    return res.status(403).json({ error: "Accès non autorisé" });
  }

  try {
    const { playlistUrl } = req.body;
    if (!playlistUrl) {
      logger.debug('Missing playlist URL in request body');
      return res.status(400).json({ error: "URL de playlist manquante" });
    }

    const playlistId = playlistUrl.split("list=")[1]?.split("&")[0];
    if (!playlistId) {
      logger.debug('Invalid playlist URL format', { playlistUrl });
      return res.status(400).json({ error: "URL de playlist invalide" });
    }

    const playlistItems = await youtube.playlistItems.list({
      part: ['snippet'],
      playlistId: playlistId,
      maxResults: 50 // Limite de l'API YouTube, vous pourriez vouloir gérer la pagination pour plus de vidéos
    });

    const videos = playlistItems.data.items?.map(item => ({
      youtube_id: item.snippet?.resourceId?.videoId, // Utilisation de snake_case pour correspondre aux conventions Supabase
      title: item.snippet?.title,
      description: item.snippet?.description,
      // ... autres données que vous souhaitez extraire
    })) || [];

    const importedVideoIds: string[] = [];
    for (const videoData of videos) {
      const { error: createVideoError } = await supabase
        .from('videos') // Assurez-vous que 'videos' est le nom de votre table
        .insert([
          {
            ...videoData,
            category_id: null, // TODO: À adapter selon votre logique d'assignation des catégories
            subcategory_id: null, // TODO: À adapter selon votre logique d'assignation des sous-catégories
          }
        ]);

      if (createVideoError) {
        logger.error('Error creating video during import', { error: createVideoError, videoData });
        // Vous pourriez choisir de ne pas interrompre l'import en cas d'erreur sur une vidéo
      } else {
        importedVideoIds.push(videoData.youtube_id!);
      }
    }

    const currentUser = await getCurrentUser(req);
    const userId = currentUser?.id || 'SYSTEM'; // Adaptez la récupération de l'ID utilisateur

    const { error: activityLogError } = await supabase
      .from('activity_logs') // Assurez-vous que 'activity_logs' est le nom de votre table
      .insert([
        {
          action: "IMPORT",
          entity_type: "playlist",
          user_id: userId,
          details: `Import playlist: ${playlistUrl}`,
          timestamp: new Date().toISOString(),
        },
      ]);

    if (activityLogError) {
      logger.error('Error creating activity log for YouTube import', { error: activityLogError, playlistUrl, userId });
    }

    return res.status(200).json({ // Vercel - Utilise res.status(200)
      message: "Import de playlist terminé",
      playlistId,
      importedCount: importedVideoIds.length,
      importedVideoIds
    });

  } catch (error: any) {
    logger.error("Error during YouTube playlist import", { error: error.message, stack: error.stack });
    return res.status(500).json({ error: "Erreur lors de l'import de la playlist", message: error.message }); // Vercel - Utilise res.status(500)
  }
}
