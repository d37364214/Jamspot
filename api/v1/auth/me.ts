
import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    // On ne renvoie pas le mot de passe
    const { password, ...userWithoutPassword } = req.user;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error("Erreur lors de la récupération des infos utilisateur:", error);
    return res.status(500).json({ error: "Erreur lors de la récupération des infos utilisateur" });
  }
}
