import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withApiAuth } from '@supabase/nextjs';
import logger from '../../../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Typage du JWT (à ajuster selon ton auth)
interface Token {
  sub: string;
  email?: string;
  [key: string]: any;
}

// Typage de l'utilisateur renvoyé depuis Supabase
interface User {
  id: string;
  email: string;
  created_at: string;
  // Ajoute d'autres champs ici si besoin
}

export default withApiAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  token: Token | null
) {
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

    const { data: user, error } = await supabaseAdmin
      .from<User>('users')
      .select('id, email, created_at') // Remplace/complète avec les bons champs
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

    logger.info(`Successfully retrieved user info for user ${user.email}`, { userId: user.id });

    res.status(200).json(user);
  } catch (error) {
    logger.error('Unhandled error in /api/me', { error });
    return res.status(500).json({ error: "Erreur interne" });
  }
});