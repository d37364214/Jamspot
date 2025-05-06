import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire
import { tags } from '../../../../shared/schema'; // Importez votre schéma Drizzle pour les types

// Schéma de validation (correspondant à insertTagSchema - adaptez-le si nécessaire)
const insertTagSchema = z.object({
  name: z.string(),
  slug: z.string(),
});

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour vérifier si l'utilisateur est administrateur (à implémenter)
async function isAdmin(req: NextApiRequest): Promise<boolean> {
  // TODO: Implémenter la logique pour vérifier si l'utilisateur est administrateur
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      try {
        const { data: tagsList, error } = await supabase
          .from('tags') // Assurez-vous que 'tags' est le nom de votre table
          .select('*');

        if (error) {
          logger.error('Error fetching tags', { error });
          return res.status(500).json({ error: "Erreur lors de la récupération des tags" });
        }

        return res.status(200).json(tagsList);
      } catch (error) {
        logger.error('Unhandled error during GET tags', { error });
        return res.status(500).json({ error: "Erreur lors de la récupération des tags" });
      }

    case 'POST':
      const adminCheck = await isAdmin(req);
      if (!adminCheck) {
        logger.warn('Unauthorized attempt to create a tag');
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const result = insertTagSchema.safeParse(req.body);
        if (!result.success) {
          logger.debug('Invalid request body for creating tag', { errors: result.error.issues, body: req.body });
          return res.status(400).json({ error: "Données de création invalides", details: result.error.issues });
        }
        const newTagData = result.data;

        const { data: newTag, error } = await supabase
          .from('tags') // Assurez-vous que 'tags' est le nom de votre table
          .insert([newTagData])
          .select('*')
          .single();

        if (error) {
          logger.error('Error creating tag', { error, data: newTagData });
          return res.status(500).json({ error: "Erreur lors de la création du tag" });
        }

        return res.status(201).json(newTag);
      } catch (error) {
        logger.error('Unhandled error during POST tag', { error, body: req.body });
        return res.status(500).json({ error: "Erreur lors de la création du tag" });
      }

    default:
      logger.debug('Received an unsupported method for tags index', { method: req.method, url: req.url });
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
