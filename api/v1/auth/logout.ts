import type { CustomApiRequest, CustomApiResponse } from '../../../api/types'; // Chemin ajusté
import { createClient } from '@supabase/supabase-js';
import logger from '../../../utils/logger'; // Importe le logger configuré

// Initialisation du client Supabase (avec la clé publique, car la déconnexion se fait côté client)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: CustomApiRequest, res: CustomApiResponse) { // Types mis à jour ici
  if (req.method !== 'POST') {
    logger.debug('Received a non-POST request for logout', { method: req.method, url: req.url });
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    // Déconnexion avec Supabase Auth
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      logger.error('Supabase Auth Error during sign out', { error: signOutError });
      return res.status(500).json({ error: "Erreur lors de la déconnexion" });
    }

    // Log de succès
    logger.info('User logged out successfully');

    // Retourner un message de succès
    return res.status(200).json({ message: "Déconnexion réussie" });

  } catch (error) {
    logger.error('Unhandled Error during logout', { error });
    return res.status(500).json({ error: "Erreur imprévue lors de la déconnexion" });
  }
}

// ATTENTION: Nous utilisons ici les clés publiques (NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY)
// car cette opération de déconnexion est généralement initiée côté client (navigateur).
// Le client Supabase dans le navigateur effectue la déconnexion.
// Cette API Route sert principalement de point d'API pour déclencher cette action côté serveur si nécessaire,
// ou pour effectuer des actions supplémentaires après la déconnexion côté client.
