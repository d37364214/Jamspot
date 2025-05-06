import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire
import { videos } from '../../../shared/schema'; // Importez votre schéma Drizzle pour les types

// Schéma de validation (correspondant à insertVideoSchema - adaptez-le si nécessaire)
const insertVideoSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  youtube_id: z.string().optional(),
  url: z.string().optional(),
  duration: z.number().optional(),
  category_id: z.number().nullable().optional(),
  subcategory_id: z.number().nullable().optional(),
  // ... ajoutez d'autres champs selon votre schéma
});

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour récupérer l'utilisateur actuel à partir de l'authentification Supabase (à implémenter)
async function getCurrentUser(req: NextApiRequest): Promise<any | null> {
  // TODO: Implémenter la logique pour récupérer l'utilisateur authentifié
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { data: videosList, error } = await supabase
        .from('videos') // Assurez-vous que 'videos' est le nom de votre table
        .select('*');

      if (error) {
        logger.error('Error fetching all videos', { error });
        return res.status(500).json({ error: "Erreur lors de la récupération des vidéos" });
      }

      return res.status(200).json(videosList);

    } else if (req.method === 'POST') {
      const result = insertVideoSchema.safeParse(req.body);
      if (!result.success) {
        logger.debug('Invalid request body for creating video', { errors: result.error.issues, body: req.body });
        return res.status(400).json({ error: "Données de création invalides", details: result.error.issues });
      }
      const newVideoData = result.data;

      const { data: video, error: createVideoError } = await supabase
        .from('videos') // Assurez-vous que 'videos' est le nom de votre table
        .insert([newVideoData])
        .select('id, title') // Sélectionnez les colonnes nécessaires pour le log d'activité
        .single();

      if (createVideoError) {
        logger.error('Error creating video', { error: createVideoError, data: newVideoData });
        return res.status(500).json({ error: "Erreur lors de la création de la vidéo" });
      }

      const currentUser = await getCurrentUser(req);
      const userId = currentUser?.id || null; // Récupérez l'ID de l'utilisateur authentifié

      const { error: activityLogError } = await supabase
        .from('activity_logs') // Assurez-vous que 'activity_logs' est le nom de votre table
        .insert([
          {
            action: "CREATE",
            entity_type: "video",
            entity_id: video.id,
            user_id: userId,
            details: `Vidéo créée: ${video.title}`,
            timestamp: new Date().toISOString(),
          },
        ]);

      if (activityLogError) {
        logger.error('Error creating activity log for video creation', { error: activityLogError, videoId: video.id, userId });
        // Vous pourriez choisir de ne pas bloquer la réponse si le log d'activité échoue
      }

      return res.status(201).json(video);
    }

    logger.debug('Received an unsupported method for videos index', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });

  } catch (error) {
    logger.error('Unhandled error during videos management', { error });
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}
