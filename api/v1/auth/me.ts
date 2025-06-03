export default withApiAuth(async function handler(
  req: Next user: authenticatedUser }: { supabaseClient: any; user: SupabaseUser | null; session: Session | null }
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

         .from<UserFiltered>('users')
      .select('id, email, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching user info from Supabase', {
        errorMessage: error.message,
        userId,
        stack: error.stack, // Ajout de la trace de l'erreur pour le log côté serveur
      });
      return res.status(500).json({ error: "Une erreur interne est survenue lors de la récupération des informations utilisateur" });
    }

    if (!user) {
      logger.warn('User not found in Sup(404).json({ error: "Profil utilisateur non trouvé" });
    }

    logger.info(`Successfully retrieved user info for user ${user.email}`, { userId: user.id });

    res.status(200).json(user);
  } catch (error) {
    logger.error('Unhandled error in /api/me', {
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined, // Ajout de la trace pour les erreurs inattendues
    });
    return res.status(500).json({ error: "Erreur interne. Veuillez réessayer plus tard." });
  }
});