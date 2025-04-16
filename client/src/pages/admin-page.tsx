import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { 
  PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { Button } from "@/components/ui/button";
import { PlusIcon, UsersIcon, VideoIcon, TagIcon, FolderIcon, HelpCircleIcon, HistoryIcon } from "lucide-react";
import { Link } from "wouter";

// Données factices pour les graphiques - à remplacer par des données réelles
const videosByCategory = [
  { name: "Guitare", count: 15 },
  { name: "Piano", count: 12 },
  { name: "Batterie", count: 8 },
  { name: "Production", count: 10 },
  { name: "DJ", count: 5 },
];

const videosByMonth = [
  { name: "Jan", count: 4 },
  { name: "Fév", count: 3 },
  { name: "Mar", count: 5 },
  { name: "Avr", count: 7 },
  { name: "Mai", count: 2 },
  { name: "Juin", count: 6 },
  { name: "Juil", count: 8 },
  { name: "Août", count: 4 },
  { name: "Sep", count: 3 },
  { name: "Oct", count: 7 },
  { name: "Nov", count: 5 },
  { name: "Déc", count: 9 },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    videoCount: 0,
    categoryCount: 0,
    tagCount: 0,
    userCount: 0
  });

  // Requêtes pour obtenir les données
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["/api/videos"],
  });

  // Mettre à jour les statistiques
  useEffect(() => {
    setStats({
      videoCount: videos.length,
      categoryCount: categories.length,
      tagCount: 0, // À remplacer par des données réelles
      userCount: 0 // À remplacer par des données réelles
    });
  }, [videos, categories]);

  const recentActivities = [
    { id: 1, action: "Ajout vidéo", entity: "Tutoriel Guitare #12", timestamp: "Il y a 1 heure", user: "Admin" },
    { id: 2, action: "Modification catégorie", entity: "Batterie", timestamp: "Il y a 3 heures", user: "Admin" },
    { id: 3, action: "Suppression tag", entity: "Débutant", timestamp: "Hier", user: "Admin" },
    { id: 4, action: "Ajout vidéo", entity: "Cours de Piano #5", timestamp: "Il y a 2 jours", user: "Admin" },
  ];

  return (
    <div className="container p-6 mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Admin</h1>
          <p className="text-gray-500">
            Bienvenue, {user?.username}. Gérez facilement votre contenu vidéo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/videos/add">
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter une vidéo
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Vidéos</p>
              <h3 className="text-2xl font-bold">{stats.videoCount}</h3>
            </div>
            <VideoIcon className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Catégories</p>
              <h3 className="text-2xl font-bold">{stats.categoryCount}</h3>
            </div>
            <FolderIcon className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Tags</p>
              <h3 className="text-2xl font-bold">{stats.tagCount}</h3>
            </div>
            <TagIcon className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Utilisateurs</p>
              <h3 className="text-2xl font-bold">{stats.userCount}</h3>
            </div>
            <UsersIcon className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
      </div>

      {/* Contenu principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Graphiques */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Statistiques</CardTitle>
            <CardDescription>Vue d'ensemble des performances</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="categories">
              <TabsList className="mb-4">
                <TabsTrigger value="categories">Vidéos par catégorie</TabsTrigger>
                <TabsTrigger value="monthly">Tendance mensuelle</TabsTrigger>
              </TabsList>
              <TabsContent value="categories">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={videosByCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="Nombre de vidéos" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              <TabsContent value="monthly">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={videosByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" name="Vidéos ajoutées" stroke="#8884d8" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Activités récentes */}
        <Card>
          <CardHeader>
            <CardTitle>Activités récentes</CardTitle>
            <CardDescription>Dernières actions effectuées</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-2 rounded-lg hover:bg-accent hover:bg-opacity-50">
                  <div className="bg-primary bg-opacity-10 p-2 rounded-full">
                    <HistoryIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-gray-500">{activity.entity}</p>
                    <p className="text-xs text-gray-400">{activity.timestamp} • {activity.user}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" asChild>
              <Link href="/admin/activity">Voir toutes les activités</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Accès rapides */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Link href="/admin/videos" className="block w-full">
              <VideoIcon className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Gérer les vidéos</h3>
              <p className="text-gray-500 text-sm mt-2">Ajouter, modifier ou supprimer des vidéos</p>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Link href="/admin/categories" className="block w-full">
              <FolderIcon className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Gérer les catégories</h3>
              <p className="text-gray-500 text-sm mt-2">Créer des catégories et sous-catégories</p>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Link href="/admin/tags" className="block w-full">
              <TagIcon className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Gérer les tags</h3>
              <p className="text-gray-500 text-sm mt-2">Organiser les vidéos avec des tags</p>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Link href="/admin/users" className="block w-full">
              <UsersIcon className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Gérer les utilisateurs</h3>
              <p className="text-gray-500 text-sm mt-2">Administrer les comptes utilisateurs</p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
