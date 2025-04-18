
import type { Request, Response } from 'express';
import { storage } from '@shared/storage';
import passport from 'passport';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    passport.authenticate('local', (err: any, user: Express.User | false) => {
      if (err) {
        console.error("Erreur d'authentification:", err);
        return res.status(500).json({ message: "Erreur interne du serveur" });
      }
      
      if (!user) {
        console.error("Échec d'authentification pour l'utilisateur:", req.body.username);
        return res.status(401).json({ message: "Identifiants invalides" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Erreur lors de la connexion:", loginErr);
          return res.status(500).json({ message: "Erreur lors de la connexion" });
        }
        console.log("Utilisateur connecté avec succès:", user.username);
        return res.status(200).json(user);
      });
    })(req, res, () => {});
  } catch (error) {
    console.error("Erreur inattendue lors de la connexion:", error);
    return res.status(500).json({ message: "Erreur inattendue lors de la connexion" });
  }
}
