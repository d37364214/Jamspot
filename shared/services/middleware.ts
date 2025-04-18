
import { Request, Response, NextFunction } from 'express';
import { sendError } from './response';
import { storage } from '../../server/storage';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return sendError(res, "Non authentifié", undefined, 401);
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return sendError(res, "Non authentifié", undefined, 401);
  }

  const user = await storage.getUser(req.user.id);
  if (!user?.isAdmin) {
    return sendError(res, "Accès non autorisé", undefined, 403);
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
    return sendError(res, "Trop de requêtes", undefined, 429);
  }
  
  userLastAction.set(req.user.id, now);
  next();
}
