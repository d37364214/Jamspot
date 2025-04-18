
import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    req.logout((err) => {
      if (err) {
        console.error("Erreur lors de la déconnexion:", err);
        return res.status(500).json({ error: "Erreur lors de la déconnexion" });
      }
      res.status(200).json({ message: "Déconnexion réussie" });
    });
  } catch (error) {
    console.error("Erreur inattendue lors de la déconnexion:", error);
    return res.status(500).json({ error: "Erreur inattendue lors de la déconnexion" });
  }
}
