import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire
import { subcategories } from '../../../shared/schema'; // Importez votre schéma Drizzle pour les types

// Schéma de validation (correspondant à insertSubcategorySchema - adaptez-le si nécessaire)
const insertSubcategorySchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  category_id: z.number().nullable(),
  is_active: z.boolean().optional().default(true),
  position: z.number().optional().default(0),
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
        const categoryIdQuery = req.query.categoryId;
        const categoryId = typeof categoryIdQuery === 'string' ? parseInt(categoryIdQuery, 10) : (Array.isArray(categoryIdQuery) ? parseInt(categoryIdQuery[0], 10) : undefined);

        let query = supabase.from('subcategories').select('*');

        if (categoryId) {
          query = query.eq('category_id', categoryId);
          logger.debug('Fetching subcategories by category ID', { categoryId });
        } else {
          logger.debug('Fetching all subcategories');
        }

        const { data: subcategoriesList, error } = await query;

        if (error) {
          logger.error('Error fetching subcategories', { error, categoryId });
          return res.status(500).json({ error: "Erreur lors de la récupération des sous-catégories" });
        }

        return res.status(200).json(subcategoriesList);
      } catch (error) {
        logger.error('Unhandled error during GET subcategories', { error });
        return res.status(500).json({ error: "Erreur lors de la récupération des sous-catégories" });
      }

    case 'POST':
      const adminCheck = await isAdmin(req);
      if (!adminCheck) {
        logger.warn('Unauthorized attempt to create a subcategory');
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const result = insertSubcategorySchema.safeParse(req.body);
        if (!result.success) {
          logger.debug('Invalid request body for creating subcategory', { errors: result.error.issues, body: req.body });
          return res.status(400).json({ error: "Données de création invalides", details: result.error.issues });
        }
        const newSubcategoryData = result.data;

        const { data: newSubcategory, error } = await supabase
          .from('subcategories') // Assurez-vous que 'subcategories' est le nom de votre table
          .insert([newSubcategoryData])
          .select('*')
          .single();

        if (error) {
          logger.error('Error creating subcategory', { error, data: newSubcategoryData });
          return res.status(500).json({ error: "Erreur lors de la création de la sous-catégorie" });
        }

        return res.status(201).json(newSubcategory);
      } catch (error) {
        logger.error('Unhandled error during POST subcategory', { error, body: req.body });
        return res.status(500).json({ error: "Erreur lors de la création de la sous-catégorie" });
      }

    default:
      logger.debug('Received an unsupported method for subcategories index', { method: req.method, url: req.url });
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
