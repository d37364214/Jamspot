import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire

// Schéma de validation (correspondant à insertCategorySchema)
const updateCategorySchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  parent_category_id: z.number().nullable().optional(),
  is_active: z.boolean().optional(),
  position: z.number().optional(),
});

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  const categoryId = typeof id === 'string' ? parseInt(id, 10) : (Array.isArray(id) ? parseInt(id[0], 10) : undefined);

  if (categoryId === undefined || isNaN(categoryId)) {
    logger.debug('Invalid category ID', { id: req.query.id });
    return res.status(400).json({ error: "ID de catégorie invalide" });
  }

  switch (req.method) {
    case 'GET':
      try {
        const { data: category, error } = await supabase
          .from('categories') // Assurez-vous que 'categories' est le nom de votre table
          .select('*')
          .eq('id', categoryId)
          .single();

        if (error) {
          logger.error('Error fetching category', { error, categoryId });
          return res.status(500).json({ error: "Erreur lors de la récupération de la catégorie" });
        }

        if (!category) {
          logger.debug('Category not found', { categoryId });
          return res.status(404).json({ error: "Catégorie non trouvée" });
        }

        return res.status(200).json(category);
      } catch (error) {
        logger.error('Unhandled error during GET category', { error, categoryId });
        return res.status(500).json({ error: "Erreur lors de la récupération de la catégorie" });
      }

    case 'PUT':
      // TODO: Implémenter l'authentification et l'autorisation Supabase ici
      // Vérifier si l'utilisateur est un administrateur
      // Exemple (nécessite une fonction pour vérifier le rôle de l'utilisateur) :
      // const isAdmin = await checkAdminRole(req);
      // if (!isAdmin) {
      //   return res.status(403).json({ error: "Accès non autorisé" });
      // }

      try {
        const result = updateCategorySchema.safeParse(req.body);
        if (!result.success) {
          logger.debug('Invalid request body for updating category', { errors: result.error.issues, body: req.body, categoryId });
          return res.status(400).json({ error: "Données de mise à jour invalides", details: result.error.issues });
        }
        const data = result.data;

        const { data: updatedCategory, error } = await supabase
          .from('categories') // Assurez-vous que 'categories' est le nom de votre table
          .update(data)
          .eq('id', categoryId)
          .single();

        if (error) {
          logger.error('Error updating category', { error, categoryId, data });
          return res.status(500).json({ error: "Erreur lors de la mise à jour de la catégorie" });
        }

        if (!updatedCategory) {
          logger.debug('Category not found for update', { categoryId });
          return res.status(404).json({ error: "Catégorie non trouvée" });
        }

        return res.status(200).json(updatedCategory);
      } catch (error) {
        logger.error('Unhandled error during PUT category', { error, categoryId, body: req.body });
        return res.status(500).json({ error: "Erreur lors de la mise à jour de la catégorie" });
      }

    case 'DELETE':
      // TODO: Implémenter l'authentification et l'autorisation Supabase ici
      // Vérifier si l'utilisateur est un administrateur
      // Exemple (nécessite une fonction pour vérifier le rôle de l'utilisateur) :
      // const isAdmin = await checkAdminRole(req);
      // if (!isAdmin) {
      //   return res.status(403).json({ error: "Accès non autorisé" });
      // }

      try {
        const { error } = await supabase
          .from('categories') // Assurez-vous que 'categories' est le nom de votre table
          .delete()
          .eq('id', categoryId);

        if (error) {
          // Améliorer la gestion des erreurs pour le cas de contraintes de clés étrangères
          if (error.code === '23503') { // Code d'erreur PostgreSQL pour "foreign_key_violation"
            logger.warn('Cannot delete category with existing videos or subcategories', { error, categoryId });
            return res.status(400).json({ error: "Impossible de supprimer une catégorie contenant des vidéos ou des sous-catégories" });
          }
          logger.error('Error deleting category', { error, categoryId });
          return res.status(500).json({ error: "Erreur lors de la suppression de la catégorie" });
        }

        return res.status(204).send();
      } catch (error) {
        logger.error('Unhandled error during DELETE category', { error, categoryId });
        return res.status(500).json({ error: "Erreur lors de la suppression de la catégorie" });
      }

    default:
      logger.debug('Received an unsupported method for category by ID', { method: req.method, categoryId });
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
