import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderIcon,
  VideoIcon,
  TagIcon,
  UsersIcon,
  Settings,
  LogOut,
  HistoryIcon,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  // Fonction pour gérer la déconnexion
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Déterminer si un lien est actif
  const isLinkActive = (path: string) => {
    if (path === "/admin" && location === "/admin") {
      return true;
    }
    
    if (path !== "/admin" && location.startsWith(path)) {
      return true;
    }
    
    return false;
  };

  const menuItems = [
    { path: "/admin", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    { path: "/admin/videos", icon: <VideoIcon size={18} />, label: "Vidéos" },
    { path: "/admin/import-videos", icon: <VideoIcon size={18} />, label: "Import de vidéos" },
    { path: "/admin/categories", icon: <FolderIcon size={18} />, label: "Catégories" },
    { path: "/admin/tags", icon: <TagIcon size={18} />, label: "Tags" },
    { path: "/admin/users", icon: <UsersIcon size={18} />, label: "Utilisateurs" },
    { path: "/admin/activity", icon: <HistoryIcon size={18} />, label: "Activité" },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-4">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </Button>
          )}
          <Link href="/admin">
            <div className="flex items-center gap-2 font-bold text-lg">
              <span className="text-primary">Admin</span>
              <span>Panel</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-2 hidden sm:inline-block">
            Connecté en tant que <span className="font-medium">{user?.username}</span>
          </span>
          <Link href="/">
            <Button variant="outline" size="sm">
              Voir le site
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut size={16} className="mr-2" />
            Déconnexion
          </Button>
        </div>
      </header>

      <div className="flex flex-grow overflow-hidden">
        {/* Sidebar - seulement visible sur desktop ou lorsque ouverte sur mobile */}
        <aside
          className={cn(
            "bg-white border-r transition-all duration-300 z-20",
            isMobile
              ? mobileMenuOpen 
                ? "fixed inset-y-0 left-0 w-64 shadow-lg" 
                : "hidden"
              : sidebarCollapsed
              ? "w-16"
              : "w-64"
          )}
        >
          <div className="p-4 flex flex-col h-full">
            <div className="flex-grow">
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <Link key={item.path} href={item.path}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start mb-1",
                        isLinkActive(item.path) && "bg-primary/10 text-primary hover:bg-primary/20"
                      )}
                    >
                      {item.icon}
                      {(!sidebarCollapsed || isMobile) && (
                        <span className="ml-2">{item.label}</span>
                      )}
                    </Button>
                  </Link>
                ))}
              </nav>
            </div>

            {!isMobile && (
              <Button
                variant="ghost"
                size="sm"
                className="self-end"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </Button>
            )}
          </div>
        </aside>

        {/* Contenu principal */}
        <main className="flex-grow overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}