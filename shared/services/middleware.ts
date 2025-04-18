
import { Request, Response, NextFunction } from 'express';
import { error } from './response';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json(error("Non authentifié"));
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    return res.status(403).json(error("Accès non autorisé"));
  }
  next();
}

// Anti-spam : limite les requêtes à 1 par seconde par utilisateur
const userLastAction = new Map<number, number>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();
  
  const now = Date.now();
  const lastAction = userLastAction.get(req.user.id) || 0;
  
  if (now - lastAction < 1000) {
    return res.status(429).json(error("Trop de requêtes"));
  }
  
  userLastAction.set(req.user.id, now);
  next();
}
