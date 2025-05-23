import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, useLocation } from "wouter";
import { ReactNode } from "react";

/**
 * AdminRoute - Un composant qui vérifie si l'utilisateur est authentifié et est admin
 * Si l'utilisateur n'est pas authentifié ou n'est pas admin, il est redirigé vers la page d'authentification admin
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Vérifier si l'utilisateur est authentifié et est administrateur
  if (!user || !user.isAdmin) {
    return <Redirect to="/admin-login" />;
  }

  return <>{children}</>;
}