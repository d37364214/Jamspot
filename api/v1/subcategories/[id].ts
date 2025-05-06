import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire
import { subcategories } from '../../../shared/schema'; // Importez votre schéma Drizzle pour les types

// Schéma de validation (correspondant à insertSubcategorySchema - adaptez-le si nécessaire)
const updateSubcategorySchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  category_id: z.number().nullable().optional(),
  is_active: z.boolean().optional(),
  position: z.number().optional(),
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
  const subcategoryId = typeof id === 'string' ? parseInt(id, 10) : (Array.isArray(id) ? parseInt(id[0], 10) : undefined);

  if (subcategoryId === undefined || isNaN(subcategoryId)) {
    logger.debug('Invalid subcategory ID', { id: req.query.id });
    return res.status(400).json({ error: "ID de sous-catégorie invalide" });
  }

  switch (req.method) {
    case 'GET':
      try {
        const { data: subcategory, error } = await supabase
          .from('subcategories') // Assurez-vous que 'subcategories' est le nom de votre table
          .select('*')
          .eq('id', subcategoryId)
          .single();

        if (error) {
          logger.error('Error fetching subcategory', { error, subcategoryId });
          return res.status(500).json({ error: "Erreur lors de la récupération de la sous-catégorie" });
        }

        if (!subcategory) {
          logger.debug('Subcategory not found', { subcategoryId });
          return res.status(404).json({ error: "Sous-catégorie non trouvée" });
        }

        return res.status(200).json(subcategory);
      } catch (error) {
        logger.error('Unhandled error during GET subcategory', { error, subcategoryId });
        return res.status(500).json({ error: "Erreur lors de la récupération de la sous-catégorie" });
      }

    case 'PUT':
      const adminCheck = await isAdmin(req);
      if (!adminCheck) {
        logger.warn('Unauthorized attempt to update a subcategory', { subcategoryId });
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const result = updateSubcategorySchema.safeParse(req.body);
        if (!result.success) {
          logger.debug('Invalid request body for updating subcategory', { errors: result.error.issues, body: req.body, subcategoryId });
          return res.status(400).json({ error: "Données de mise à jour invalides", details: result.error.issues });
        }
        const data = result.data;

        const { data: updatedSubcategory, error } = await supabase
          .from('subcategories') // Assurez-vous que 'subcategories' est le nom de votre table
          .update(data)
          .eq('id', subcategoryId)
          .single();

        if (error) {
          logger.error('Error updating subcategory', { error, subcategoryId, data });
          return res.status(500).json({ error: "Erreur lors de la mise à jour de la sous-catégorie" });
        }

        if (!updatedSubcategory) {
          logger.debug('Subcategory not found for update', { subcategoryId });
          return res.status(404).json({ error: "Sous-catégorie non trouvée" });
        }

        return res.status(200).json(updatedSubcategory);
      } catch (error) {
        logger.error('Unhandled error during PUT subcategory', { error, subcategoryId, body: req.body });
        return res.status(500).json({ error: "Erreur lors de la mise à jour de la sous-catégorie" });
      }

    case 'DELETE':
      const adminCheckDelete = await isAdmin(req);
      if (!adminCheckDelete) {
        logger.warn('Unauthorized attempt to delete a subcategory', { subcategoryId });
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const { error } = await supabase
          .from('subcategories') // Assurez-vous que 'subcategories' est le nom de votre table
          .delete()
          .eq('id', subcategoryId);

        if (error) {
          // Améliorer la gestion des erreurs pour le cas de contraintes de clés étrangères
          if (error.code === '23503') { // Code d'erreur PostgreSQL pour "foreign_key_violation"
            logger.warn('Cannot delete subcategory with existing videos', { error, subcategoryId });
            return res.status(400).json({ error: "Impossible de supprimer une sous-catégorie contenant des vidéos" });
          }
          logger.error('Error deleting subcategory', { error, subcategoryId });
          return res.status(500).json({ error: "Erreur lors de la suppression de la sous-catégorie" });
        }

        return res.status(204).send();
      } catch (error) {
        logger.error('Unhandled error during DELETE subcategory', { error, subcategoryId });
        return res.status(500).json({ error: "Erreur lors de la suppression de la sous-catégorie" });
      }

    default:
      logger.debug('Received an unsupported method for subcategory by ID', { method: req.method, subcategoryId });
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
