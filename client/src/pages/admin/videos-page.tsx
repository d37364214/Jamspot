import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PencilIcon, TrashIcon, ArrowLeftIcon, VideoIcon, EyeIcon, FilterIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoCard } from "@/components/video-card";
import { VideoPlayer } from "@/components/video-player";
import { Video, Category, Subcategory, Tag } from "@shared/schema";

// Schéma de validation pour le formulaire de vidéo
const videoFormSchema = z.object({
  title: z.string().min(2, {
    message: "Le titre doit contenir au moins 2 caractères",
  }),
  description: z.string().optional(),
  youtubeId: z.string().min(5, {
    message: "L'ID YouTube doit être valide"
  }),
  categoryId: z.number().nullable(),
  subcategoryId: z.number().nullable().optional(),
  thumbnail: z.string().optional(),
  duration: z.string().optional(),
});

type VideoFormValues = z.infer<typeof videoFormSchema>;

export default function VideosPage() {
  const { toast } = useToast();
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedVideoForPlay, setSelectedVideoForPlay] = useState<Video | null>(null);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Obtention des données
  const { data: videos = [], isLoading: isLoadingVideos } = useQuery<Video[]>({
    queryKey: ["/api/videos"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  // Formulaire d'ajout/édition de vidéo
  const form = useForm<VideoFormValues>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      title: "",
      description: "",
      youtubeId: "",
      categoryId: null,
      subcategoryId: null,
      thumbnail: "",
      duration: "",
    },
  });

  // Mutation pour créer une vidéo
  const createVideoMutation = useMutation({
    mutationFn: async (data: VideoFormValues) => {
      const res = await apiRequest("POST", "/api/videos", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      form.reset();
      toast({ 
        title: "Vidéo ajoutée", 
        description: "La vidéo a été ajoutée avec succès" 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: `Échec de l'ajout: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutation pour mettre à jour une vidéo
  const updateVideoMutation = useMutation({
    mutationFn: async (data: VideoFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PATCH", `/api/videos/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setSelectedVideo(null);
      form.reset({
        title: "",
        description: "",
        youtubeId: "",
        categoryId: null,
        subcategoryId: null,
        thumbnail: "",
        duration: "",
      });
      toast({ 
        title: "Vidéo mise à jour", 
        description: "La vidéo a été mise à jour avec succès" 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: `Échec de la mise à jour: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutation pour supprimer une vidéo
  const deleteVideoMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/videos/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({ 
        title: "Vidéo supprimée", 
        description: "La vidéo a été supprimée avec succès" 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: `Échec de la suppression: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Fonction pour éditer une vidéo
  const handleEditVideo = (video: Video) => {
    setSelectedVideo(video);
    form.reset({
      title: video.title,
      description: video.description || "",
      youtubeId: video.youtubeId,
      categoryId: video.categoryId,
      subcategoryId: video.subcategoryId || null,
      thumbnail: video.thumbnail || "",
      duration: video.duration || "",
    });
  };

  // Fonction pour supprimer une vidéo
  const handleDeleteVideo = (id: number, title: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la vidéo "${title}" ?`)) {
      deleteVideoMutation.mutate(id);
    }
  };

  // Fonction pour visualiser une vidéo
  const handleViewVideo = (video: Video) => {
    setSelectedVideoForPlay(video);
    setIsPlayerOpen(true);
  };

  // Fonction de soumission du formulaire
  function onSubmit(data: VideoFormValues) {
    // Récupérer un thumbnail YouTube si non fourni
    if (!data.thumbnail && data.youtubeId) {
      data.thumbnail = `https://img.youtube.com/vi/${data.youtubeId}/mqdefault.jpg`;
    }

    if (selectedVideo) {
      updateVideoMutation.mutate({ ...data, id: selectedVideo.id });
    } else {
      createVideoMutation.mutate(data);
    }
  }

  // Filtrer les vidéos selon la catégorie et la recherche
  const filteredVideos = videos.filter(video => {
    const matchesCategory = filterCategory === null || video.categoryId === filterCategory;
    const matchesSearch = !searchQuery || 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (video.description && video.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  // Grouper les sous-catégories par catégorie
  const subcategoriesByCategory = categories.reduce((acc, category) => {
    acc[category.id] = subcategories.filter(sub => sub.categoryId === category.id);
    return acc;
  }, {} as Record<number, Subcategory[]>);

  return (
    <div className="container p-6 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link href="/admin">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Gestion des vidéos</h1>
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Liste des vidéos</TabsTrigger>
          <TabsTrigger value="add">
            {selectedVideo ? "Modifier la vidéo" : "Ajouter une vidéo"}
          </TabsTrigger>
        </TabsList>

        {/* Liste des vidéos */}
        <TabsContent value="list">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher une vidéo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-full md:w-48">
                <Select
                  value={filterCategory?.toString() || ""}
                  onValueChange={(value) => setFilterCategory(value ? Number(value) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les catégories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Toutes les catégories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoadingVideos ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-md">
                <VideoIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium">Aucune vidéo trouvée</h3>
                <p className="text-gray-500 mt-2">
                  {searchQuery || filterCategory !== null 
                    ? "Aucune vidéo ne correspond à vos critères de filtrage."
                    : "Vous n'avez pas encore ajouté de vidéos."}
                </p>
                {searchQuery || filterCategory !== null && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterCategory(null);
                    }}
                    className="mt-4"
                  >
                    Réinitialiser les filtres
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Sous-catégorie</TableHead>
                    <TableHead>ID YouTube</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVideos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <VideoIcon className="h-4 w-4 text-primary" />
                        {video.title}
                      </TableCell>
                      <TableCell>
                        {video.categoryId 
                          ? categories.find(c => c.id === video.categoryId)?.name || "-" 
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {video.subcategoryId 
                          ? subcategories.find(s => s.id === video.subcategoryId)?.name || "-" 
                          : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{video.youtubeId}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleViewVideo(video)}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEditVideo(video)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteVideo(video.id, video.title)}
                          disabled={deleteVideoMutation.isPending}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Formulaire d'ajout/édition */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedVideo ? "Modifier la vidéo" : "Ajouter une nouvelle vidéo"}
              </CardTitle>
              <CardDescription>
                {selectedVideo 
                  ? "Mettez à jour les informations de la vidéo sélectionnée" 
                  : "Entrez les informations de la nouvelle vidéo à ajouter"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titre</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Titre de la vidéo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="youtubeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID YouTube</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ex: dQw4w9WgXcQ" />
                        </FormControl>
                        <FormDescription>
                          L'identifiant YouTube se trouve dans l'URL de la vidéo après "v="
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Catégorie</FormLabel>
                          <Select
                            value={field.value?.toString() || ""}
                            onValueChange={(value) => {
                              const newValue = value === "" ? null : Number(value);
                              field.onChange(newValue);
                              
                              // Réinitialiser la sous-catégorie si on change de catégorie
                              if (newValue !== form.getValues("categoryId")) {
                                form.setValue("subcategoryId", null);
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner une catégorie" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Aucune catégorie</SelectItem>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subcategoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sous-catégorie</FormLabel>
                          <Select
                            value={field.value?.toString() || ""}
                            onValueChange={(value) => {
                              field.onChange(value === "" ? null : Number(value));
                            }}
                            disabled={!form.getValues("categoryId")}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner une sous-catégorie" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Aucune sous-catégorie</SelectItem>
                              {form.getValues("categoryId") && 
                                subcategoriesByCategory[form.getValues("categoryId") as number]?.map((subcategory) => (
                                  <SelectItem key={subcategory.id} value={subcategory.id.toString()}>
                                    {subcategory.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Description de la vidéo..."
                            rows={5}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    {selectedVideo && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setSelectedVideo(null);
                          form.reset({
                            title: "",
                            description: "",
                            youtubeId: "",
                            categoryId: null,
                            subcategoryId: null,
                            thumbnail: "",
                            duration: "",
                          });
                        }}
                      >
                        Annuler
                      </Button>
                    )}
                    <Button 
                      type="submit" 
                      disabled={createVideoMutation.isPending || updateVideoMutation.isPending}
                    >
                      {selectedVideo ? "Mettre à jour" : "Ajouter"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lecteur vidéo pour la prévisualisation */}
      {selectedVideoForPlay && (
        <Dialog open={isPlayerOpen} onOpenChange={setIsPlayerOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedVideoForPlay.title}</DialogTitle>
              <DialogDescription>
                {selectedVideoForPlay.description}
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${selectedVideoForPlay.youtubeId}`}
                title={selectedVideoForPlay.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}