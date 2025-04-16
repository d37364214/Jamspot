import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryList } from "@/components/category-list";
import { VideoCard } from "@/components/video-card";
import { VideoPlayer } from "@/components/video-player";
import { useAuth } from "@/hooks/use-auth";
import { Video, Category } from "@shared/schema";
import { LogIn, VideoIcon } from "lucide-react";
import { Link } from "wouter";

export default function HomePage() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  // Obtenir les données des catégories
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
  
  // Obtenir les données des vidéos
  const { data: videos = [], isLoading: isLoadingVideos } = useQuery<Video[]>({
    queryKey: ["/api/videos"],
  });
  
  // Filtrer les vidéos par catégorie
  const filteredVideos = selectedCategory 
    ? videos.filter(video => video.categoryId === selectedCategory)
    : videos;
  
  // Fermer le lecteur de vidéo
  const handleClosePlayer = () => {
    setSelectedVideo(null);
  };
  
  // Ouvrir le lecteur de vidéo
  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
  };

  // Si aucune catégorie n'est sélectionnée et qu'il y a des catégories disponibles, 
  // sélectionner la première par défaut
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Bannière de bienvenue */}
      {!user && (
        <Card className="mb-8 bg-zinc-800 border-zinc-700">
          <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h2 className="text-2xl font-bold mb-2">Bienvenue sur Music Videos</h2>
              <p className="text-zinc-300">
                Explorez notre collection de vidéos musicales éducatives. Connectez-vous pour débloquer 
                toutes les fonctionnalités et suivre votre progression.
              </p>
            </div>
            <Button asChild size="lg" className="whitespace-nowrap">
              <Link href="/auth">
                <LogIn className="mr-2 h-5 w-5" />
                Se connecter
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation des catégories */}
        <div className="md:col-span-1">
          <Card className="bg-zinc-800 border-zinc-700 sticky top-4">
            <CardHeader>
              <CardTitle>Catégories</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCategories ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-10 bg-zinc-700 rounded-md"></div>
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <p className="text-zinc-400">Aucune catégorie disponible</p>
              ) : (
                <CategoryList 
                  categories={categories} 
                  selectedId={selectedCategory} 
                  onSelect={setSelectedCategory} 
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Grille de vidéos */}
        <div className="md:col-span-3">
          <h2 className="text-2xl font-bold mb-4">
            {selectedCategory 
              ? `Vidéos: ${categories.find(cat => cat.id === selectedCategory)?.name || 'Catégorie'}`
              : 'Toutes les vidéos'
            }
          </h2>

          {isLoadingVideos ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-zinc-800 aspect-video rounded-md mb-2"></div>
                  <div className="h-5 bg-zinc-800 rounded-md w-3/4 mb-2"></div>
                  <div className="h-4 bg-zinc-800 rounded-md w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="bg-zinc-800 rounded-lg p-8 text-center">
              <VideoIcon className="mx-auto h-12 w-12 text-zinc-600 mb-4" />
              <h3 className="text-xl font-medium mb-2">Aucune vidéo disponible</h3>
              <p className="text-zinc-400 mb-4">
                {selectedCategory 
                  ? "Il n'y a pas encore de vidéos dans cette catégorie."
                  : "Aucune vidéo n'a été ajoutée pour le moment."
                }
              </p>
              {user?.isAdmin && (
                <Button asChild variant="outline">
                  <Link href="/admin/videos">
                    Ajouter des vidéos
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((video) => (
                <VideoCard 
                  key={video.id} 
                  video={video} 
                  onClick={() => handleVideoClick(video)} 
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lecteur vidéo modal */}
      {selectedVideo && (
        <VideoPlayer video={selectedVideo} onClose={handleClosePlayer} />
      )}
    </div>
  );
}