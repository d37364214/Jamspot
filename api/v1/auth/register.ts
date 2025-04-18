
import type { Request, Response } from 'express';
import { storage } from '@shared/storage';
import { hashPassword } from '@shared/services/auth';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).json({ error: "Ce nom d'utilisateur existe déjà" });
    }

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: "Erreur lors de la connexion" });
      res.status(201).json(user);
    });
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error);
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
}
