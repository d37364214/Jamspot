
import { ZodError } from 'zod';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export function success<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data
  };
}

export function error(message: string, details?: any): ApiResponse {
  return {
    success: false,
    error: message,
    details
  };
}

export function handleZodError(err: ZodError): ApiResponse {
  return error("Données invalides", err.flatten());
}

export function handleError(err: any): ApiResponse {
  console.error("Erreur API:", err);
  return error("Erreur interne du serveur");
}
