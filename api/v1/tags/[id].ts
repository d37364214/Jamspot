import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../../utils/logger'; // Ajustez le chemin si nécessaire
import { tags } from '../../../../shared/schema'; // Importez votre schéma Drizzle pour les types

// Schéma de validation (correspondant à insertTagSchema - adaptez-le si nécessaire)
const updateTagSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
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
  const id = req.query.id;
  const tagId = typeof id === 'string' ? parseInt(id, 10) : (Array.isArray(id) ? parseInt(id[0], 10) : undefined);

  if (tagId === undefined || isNaN(tagId)) {
    logger.debug('Invalid tag ID', { id: req.query.id });
    return res.status(400).json({ error: "ID de tag invalide" });
  }

  switch (req.method) {
    case 'GET':
      try {
        const { data: tag, error } = await supabase
          .from('tags') // Assurez-vous que 'tags' est le nom de votre table
          .select('*')
          .eq('id', tagId)
          .single();

        if (error) {
          logger.error('Error fetching tag', { error, tagId });
          return res.status(500).json({ error: "Erreur lors de la récupération du tag" });
        }

        if (!tag) {
          logger.debug('Tag not found', { tagId });
          return res.status(404).json({ error: "Tag non trouvé" });
        }

        return res.status(200).json(tag);
      } catch (error) {
        logger.error('Unhandled error during GET tag', { error, tagId });
        return res.status(500).json({ error: "Erreur lors de la récupération du tag" });
      }

    case 'PUT':
      const adminCheck = await isAdmin(req);
      if (!adminCheck) {
        logger.warn('Unauthorized attempt to update a tag', { tagId });
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const result = updateTagSchema.safeParse(req.body);
        if (!result.success) {
          logger.debug('Invalid request body for updating tag', { errors: result.error.issues, body: req.body, tagId });
          return res.status(400).json({ error: "Données de mise à jour invalides", details: result.error.issues });
        }
        const data = result.data;

        const { data: updatedTag, error } = await supabase
          .from('tags') // Assurez-vous que 'tags' est le nom de votre table
          .update(data)
          .eq('id', tagId)
          .single();

        if (error) {
          logger.error('Error updating tag', { error, tagId, data });
          return res.status(500).json({ error: "Erreur lors de la mise à jour du tag" });
        }

        if (!updatedTag) {
          logger.debug('Tag not found for update', { tagId });
          return res.status(404).json({ error: "Tag non trouvé" });
        }

        return res.status(200).json(updatedTag);
      } catch (error) {
        logger.error('Unhandled error during PUT tag', { error, tagId, body: req.body });
        return res.status(500).json({ error: "Erreur lors de la mise à jour du tag" });
      }

    case 'DELETE':
      const adminCheckDelete = await isAdmin(req);
      if (!adminCheckDelete) {
        logger.warn('Unauthorized attempt to delete a tag', { tagId });
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const { error } = await supabase
          .from('tags') // Assurez-vous que 'tags' est le nom de votre table
          .delete()
          .eq('id', tagId);

        if (error) {
          logger.error('Error deleting tag', { error, tagId });
          return res.status(500).json({ error: "Erreur lors de la suppression du tag" });
        }

        return res.status(204).send();
      } catch (error) {
        logger.error('Unhandled error during DELETE tag', { error, tagId });
        return res.status(500).json({ error: "Erreur lors de la suppression du tag" });
      }

    default:
      logger.debug('Received an unsupported method for tag by ID', { method: req.method, tagId });
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
