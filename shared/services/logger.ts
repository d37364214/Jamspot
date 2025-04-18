
import { Request, Response, NextFunction } from 'express';

export interface RequestLog {
  method: string;
  path: string;
  status: number;
  duration: number;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Capture le status et la durée une fois la réponse envoyée
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
}
