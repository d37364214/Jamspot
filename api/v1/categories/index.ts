import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../utils/logger'; // Ajustez le chemin si nécessaire
import { categories } from '../../../../shared/schema'; // Importez votre schéma Drizzle pour les types

// Schéma de validation (correspondant à insertCategorySchema)
const insertCategorySchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  parent_category_id: z.number().nullable().optional(),
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
  // Cela pourrait impliquer de lire des cookies d'authentification,
  // interroger la base de données pour le rôle de l'utilisateur,
  // ou utiliser les informations d'authentification Supabase.
  // Pour l'instant, retourne toujours false pour éviter tout accès non autorisé.
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      try {
        const { data: categoriesList, error } = await supabase
          .from('categories') // Assurez-vous que 'categories' est le nom de votre table
          .select('*');

        if (error) {
          logger.error('Error fetching categories', { error });
          return res.status(500).json({ error: "Erreur lors de la récupération des catégories" });
        }

        return res.status(200).json(categoriesList);
      } catch (error) {
        logger.error('Unhandled error during GET categories', { error });
        return res.status(500).json({ error: "Erreur lors de la récupération des catégories" });
      }

    case 'POST':
      const adminCheck = await isAdmin(req);
      if (!adminCheck) {
        logger.warn('Unauthorized attempt to create a category');
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      try {
        const result = insertCategorySchema.safeParse(req.body);
        if (!result.success) {
          logger.debug('Invalid request body for creating category', { errors: result.error.issues, body: req.body });
          return res.status(400).json({ error: "Données de création invalides", details: result.error.issues });
        }
        const newCategoryData = result.data;

        const { data: newCategory, error } = await supabase
          .from('categories') // Assurez-vous que 'categories' est le nom de votre table
          .insert([newCategoryData])
          .select('*')
          .single();

        if (error) {
          logger.error('Error creating category', { error, data: newCategoryData });
          return res.status(500).json({ error: "Erreur lors de la création de la catégorie" });
        }

        // Création du log d'activité (similaire à votre storage.createActivityLog)
        // Vous devrez adapter cela pour utiliser Supabase (soit une fonction Edge, soit une insertion directe)
        // Exemple d'insertion directe (nécessite une table 'activity_logs' correspondante)
        const userId = 'TODO: Récupérer l\'ID de l\'utilisateur authentifié'; // Vous devrez récupérer l'ID de l'utilisateur authentifié
        if (userId) {
          const { error: activityLogError } = await supabase
            .from('activity_logs') // Assurez-vous que 'activity_logs' est le nom de votre table
            .insert([
              {
                action: "CREATE",
                entity_type: "category",
                entity_id: newCategory.id,
                user_id: userId,
                details: `Catégorie créée: ${newCategory.name}`,
                timestamp: new Date().toISOString(),
              },
            ]);

          if (activityLogError) {
            logger.error('Error creating activity log', { error: activityLogError, categoryId: newCategory.id, userId });
            // Décider si une erreur de log doit impacter la réponse principale
          }
        } else {
          logger.warn('Could not determine user ID for activity log');
        }

        return res.status(201).json(newCategory);
      } catch (error) {
        logger.error('Unhandled error during POST category', { error, body: req.body });
        return res.status(500).json({ error: "Erreur lors de la création de la catégorie" });
      }

    default:
      logger.debug('Received an unsupported method for categories index', { method: req.method, url: req.url });
      return res.status(405).json({ error: "Méthode non autorisée" });
  }
}
