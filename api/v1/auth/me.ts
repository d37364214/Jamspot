import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiAuth, User as SupabaseUser, Session } from '@supabase/nextjs';
import logger from '../../../utils/logger';

// Typage de l'utilisateur renvoyé depuis Supabase
interface UserFiltered {
  id: string;
  email: string;
  created_at: string;
}

export default withApiAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  { supabaseClient, user: authenticatedUser }: { supabaseClient: any; user: SupabaseUser | null; session: Session | null }
) {
  if (req.method !== 'GET') {
    logger.debug('Received a non-GET request for /api/me', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    if (!authenticatedUser?.id) {
      logger.debug('User not authenticated for /api/me');
      return res.status(401).json({ error: "Non authentifié" });
    }

    const userId = authenticatedUser.id;

    // Utilisation du client fourni par withApiAuth
    const { data: user, error } = await supabaseClient
      .from<UserFiltered>('users')
      .select('id, email, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching user info from Supabase', { error, userId });
      return res.status(500).json({ error: "Erreur lors de la récupération des infos utilisateur" });
    }

    if (!user) {
      logger.warn('User not found in Supabase', { userId });
      return res.status(404).json({ error: "Profil utilisateur non trouvé" });
    }

    logger.info(`Successfully retrieved user info for user ${user.email}`, { userId: user.id });

    res.status(200).json(user);
  } catch (error) {
    logger.error('Unhandled error in /api/me', { error });
    return res.status(500).json({ error: "Erreur interne" });
  }
});