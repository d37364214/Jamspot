import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withApiAuth, getSession } from '@supabase/nextjs';
import logger from '../../../utils/logger'; // Importe votre logger configuré (si vous en avez un)

// Initialisation du client Supabase (nécessaire pour certaines opérations)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Utilisez la clé service_role côté serveur
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Utilisation de withApiAuth pour protéger l'API Route et récupérer la session Supabase
export default withApiAuth(async function handler(req: NextApiRequest, res: NextApiResponse, token) {
  if (req.method !== 'GET') {
    logger.debug('Received a non-GET request for /api/me', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    if (!token?.sub) {
      logger.debug('User not authenticated for /api/me');
      return res.status(401).json({ error: "Non authentifié" });
    }

    const userId = token.sub;

    // Récupérer l'utilisateur depuis la base de données Supabase en utilisant l'UID
    const { data: user, error } = await supabaseAdmin
      .from('users') // Remplacez 'users' par le nom de votre table utilisateur
      .select('id, email, created_at, ...') // Sélectionnez les champs que vous souhaitez retourner (sans le mot de passe !)
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching user info from Supabase', { error, userId });
      return res.status(500).json({ error: "Erreur lors de la récupération des infos utilisateur" });
    }

    if (!user) {
      logger.warn('User not found in Supabase', { userId });
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Log de succès
    logger.info(`Successfully retrieved user info for user ${user.email}`, { userId: user.id });

    res.status(200).json(user);
  } catch (error) {
    logger.error('Unhandled error in /api/me', { error });
    return res.status(500).json({ error: "Erreur lors de la récupération des infos utilisateur" });
  }
});

// ATTENTION: SUPABASE_SERVICE_ROLE_KEY est utilisé ici car cette route est côté serveur.
// NE JAMAIS l'utiliser côté client.  Pour les opérations nécessitant des privilèges,
// utiliser Row Level Security (RLS) ou des fonctions cloud Supabase.

// Note: 'users' dans supabaseAdmin.from('users') doit correspondre au nom de votre table utilisateur.
// Adaptez la sélection des colonnes dans .select() selon vos besoins.
