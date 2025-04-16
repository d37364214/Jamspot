import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";
import { useLocation } from "wouter";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { logoutMutation, user } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/admin/login");
      }
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header d'administration */}
      <header className="bg-zinc-800 text-white">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Administration</h1>
            <nav className="hidden md:flex gap-4">
              <a href="/admin" className="hover:text-gray-300">Dashboard</a>
              <a href="/admin/categories" className="hover:text-gray-300">Catégories</a>
              <a href="/admin/videos" className="hover:text-gray-300">Vidéos</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm mr-2">
                Connecté en tant que <strong>{user.username}</strong>
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-grow container mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer d'administration */}
      <footer className="bg-zinc-800 text-white py-4">
        <div className="container mx-auto px-4 text-center text-sm">
          Administration - Plateforme de vidéos musicales © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}