import type { NextApiResponse } from 'next';
import { ZodError } from 'zod';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export function sendSuccess<T>(res: NextApiResponse, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data
  });
}

export function sendError(res: NextApiResponse, message: string, details?: any, status = 400) {
  return res.status(status).json({
    success: false,
    error: message,
    details
  });
}

export function handleZodError(res: NextApiResponse, err: ZodError) {
  console.error("Erreur de validation:", err.flatten());
  return sendError(res, "Données invalides", err.flatten(), 400);
}

export function handleServerError(res: NextApiResponse, err: any) {
  console.error("Erreur serveur:", err);
  return sendError(res, "Erreur interne du serveur", undefined, 500);
}
