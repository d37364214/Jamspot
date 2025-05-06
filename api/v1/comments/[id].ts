import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '../../../../utils/logger'; // Ajustez le chemin si nécessaire

const updateCommentSchema = z.object({
  content: z.string().min(1, "Le commentaire ne peut pas être vide").max(1000, "Le commentaire est trop long")
});

// Initialisation du client Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour récupérer l'utilisateur à partir de l'authentification Supabase (à implémenter)
async function getCurrentUser(req: NextApiRequest): Promise<any | null> {
  // TODO: Implémenter la logique pour récupérer l'utilisateur authentifié
  // Cela pourrait impliquer de lire des cookies d'authentification,
  // de vérifier les headers Authorization, et d'utiliser supabase.auth.getUser().
  // Pour l'instant, retourne null.
  return null;
}

// Fonction pour vérifier si l'utilisateur est administrateur (à implémenter)
async function isAdmin(user: any): Promise<boolean> {
  // TODO: Implémenter la logique pour vérifier si l'utilisateur est administrateur
  // Cela pourrait impliquer de vérifier une propriété 'isAdmin' sur l'objet utilisateur
  // ou d'interroger une table de rôles.
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const commentId = req.query.id;
  const commentIdInt = typeof commentId === 'string' ? parseInt(commentId, 10) : (Array.isArray(commentId) ? parseInt(commentId[0], 10) : undefined);

  if (commentIdInt === undefined || isNaN(commentIdInt)) {
    logger.debug('Invalid comment ID', { id: req.query.id });
    return res.status(400).json({ error: "ID de commentaire invalide" });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    logger.warn('Unauthorized attempt to access comment', { commentId: commentIdInt });
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    const { data: comment, error: fetchError } = await supabase
      .from('comments') // Assurez-vous que 'comments' est le nom de votre table
      .select('id, user_id')
      .eq('id', commentIdInt)
      .single();

    if (fetchError) {
      logger.error('Error fetching comment', { error: fetchError, commentId: commentIdInt });
      return res.status(500).json({ error: "Erreur lors de la récupération du commentaire" });
    }

    if (!comment) {
      logger.debug('Comment not found', { commentId: commentIdInt });
      return res.status(404).json({ error: "Commentaire non trouvé" });
    }

    // Vérification des permissions
    const canModify = (await isAdmin(user)) || (comment.user_id === user.id);
    if (!canModify) {
      logger.warn('Unauthorized attempt to modify comment', { userId: user.id, commentUserId: comment.user_id, commentId: commentIdInt });
      return res.status(403).json({ error: "Non autorisé" });
    }

    if (req.method === 'PUT') {
      const validation = updateCommentSchema.safeParse(req.body);

      if (!validation.success) {
        logger.debug('Invalid request body for updating comment', { errors: validation.error.flatten(), body: req.body, commentId: commentIdInt });
        return res.status(400).json({
          error: "Données invalides",
          details: validation.error.flatten()
        });
      }

      const { data: updatedComment, error: updateError } = await supabase
        .from('comments') // Assurez-vous que 'comments' est le nom de votre table
        .update({ content: validation.data.content })
        .eq('id', commentIdInt)
        .select('*')
        .single();

      if (updateError) {
        logger.error('Error updating comment', { error: updateError, commentId: commentIdInt, content: validation.data.content });
        return res.status(500).json({ error: "Erreur lors de la mise à jour du commentaire" });
      }

      return res.status(200).json(updatedComment);

    } else if (req.method === 'DELETE') {
      const { error: deleteError } = await supabase
        .from('comments') // Assurez-vous que 'comments' est le nom de votre table
        .delete()
        .eq('id', commentIdInt);

      if (deleteError) {
        logger.error('Error deleting comment', { error: deleteError, commentId: commentIdInt });
        return res.status(500).json({ error: "Erreur lors de la suppression du commentaire" });
      }

      return res.status(200).json({ message: "Commentaire supprimé" });
    }

    logger.debug('Received an unsupported method for comment by ID', { method: req.method, commentId: commentIdInt });
    return res.status(405).json({ error: "Méthode non autorisée" });

  } catch (error) {
    logger.error("Unhandled error during comment operation", { error, commentId: commentIdInt });
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}
