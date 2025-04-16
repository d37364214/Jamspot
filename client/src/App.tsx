import { Switch, Route, Link } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import AdminLoginPage from "@/pages/admin-login-page";
import DashboardPage from "@/pages/admin/dashboard-page";
import CategoriesPage from "@/pages/admin/categories-page";
import VideosPage from "@/pages/admin/videos-page";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { AdminRoute } from "@/lib/admin-middleware";
import { AdminLayout } from "@/components/admin/admin-layout";

// Layout pour la partie publique
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <nav className="bg-zinc-800 text-zinc-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Music Videos
          </Link>
          <div className="flex gap-4">
            <Link href="/admin/login" className="hover:text-zinc-300">
              Admin
            </Link>
            <Link href="/auth" className="hover:text-zinc-300">
              Login
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Routes publiques avec le layout public */}
      <Route path="/">
        <PublicLayout>
          <HomePage />
        </PublicLayout>
      </Route>
      <Route path="/auth">
        <PublicLayout>
          <AuthPage />
        </PublicLayout>
      </Route>
      
      {/* Route de connexion admin (accessible sans être connecté) */}
      <Route path="/admin-login" component={AdminLoginPage} />
      
      {/* Routes d'administration protégées */}
      <Route path="/admin">
        <AdminRoute>
          <AdminLayout>
            <DashboardPage />
          </AdminLayout>
        </AdminRoute>
      </Route>
      
      <Route path="/admin/videos">
        <AdminRoute>
          <AdminLayout>
            <VideosPage />
          </AdminLayout>
        </AdminRoute>
      </Route>
      
      <Route path="/admin/categories">
        <AdminRoute>
          <AdminLayout>
            <CategoriesPage />
          </AdminLayout>
        </AdminRoute>
      </Route>
      
      {/* Autres routes admin à ajouter ici */}
      
      {/* Page d'erreur 404 */}
      <Route>
        <PublicLayout>
          <NotFound />
        </PublicLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
