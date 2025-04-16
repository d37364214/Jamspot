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
import { PencilIcon, TrashIcon, PlusIcon, ArrowLeftIcon, FolderIcon } from "lucide-react";
import { Category } from "@shared/schema";

// Schéma de validation pour le formulaire
const categoryFormSchema = z.object({
  name: z.string().min(2, {
    message: "Le nom doit contenir au moins 2 caractères",
  }),
  description: z.string().optional(),
  slug: z.string().min(2, {
    message: "Le slug doit contenir au moins 2 caractères",
  }).refine(slug => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), {
    message: "Le slug doit contenir uniquement des lettres minuscules, des chiffres et des tirets"
  }),
  parentId: z.number().optional().nullable(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export default function CategoriesPage() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Obtention des données des catégories
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Formulaire de création/édition de catégorie
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
      slug: "",
      parentId: null
    },
  });

  // Mutation pour créer une catégorie
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      const res = await apiRequest("POST", "/api/categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      form.reset();
      toast({ 
        title: "Catégorie créée", 
        description: "La catégorie a été créée avec succès" 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: `Échec de la création: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutation pour mettre à jour une catégorie
  const updateCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PATCH", `/api/categories/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setSelectedCategory(null);
      form.reset({
        name: "",
        description: "",
        slug: "",
        parentId: null
      });
      toast({ 
        title: "Catégorie mise à jour", 
        description: "La catégorie a été mise à jour avec succès" 
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

  // Mutation pour supprimer une catégorie
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/categories/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ 
        title: "Catégorie supprimée", 
        description: "La catégorie a été supprimée avec succès" 
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

  // Fonction pour éditer une catégorie
  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    form.reset({
      name: category.name,
      description: category.description || "",
      slug: category.slug,
      parentId: category.parentId
    });
  };

  // Fonction pour supprimer une catégorie
  const handleDeleteCategory = (id: number, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${name}" ?`)) {
      deleteCategoryMutation.mutate(id);
    }
  };

  // Fonction de soumission du formulaire
  function onSubmit(data: CategoryFormValues) {
    if (selectedCategory) {
      updateCategoryMutation.mutate({ ...data, id: selectedCategory.id });
    } else {
      createCategoryMutation.mutate(data);
    }
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')       // Remplacer les espaces par des tirets
      .replace(/[^\w\-]+/g, '')   // Supprimer les caractères spéciaux
      .replace(/\-\-+/g, '-')     // Remplacer plusieurs tirets par un seul
      .replace(/^-+/, '')         // Supprimer les tirets au début
      .replace(/-+$/, '');        // Supprimer les tirets à la fin
  }

  return (
    <div className="container p-6 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link href="/admin">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Gestion des catégories</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire de création/édition */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>
              {selectedCategory ? "Modifier la catégorie" : "Ajouter une catégorie"}
            </CardTitle>
            <CardDescription>
              {selectedCategory 
                ? "Mettez à jour les informations de la catégorie sélectionnée" 
                : "Créez une nouvelle catégorie pour organiser vos vidéos"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Ex: Guitare, Piano..." 
                          onChange={(e) => {
                            field.onChange(e);
                            // Générer automatiquement le slug si le champ slug est vide
                            // ou si nous créons une nouvelle catégorie
                            if (!form.getValues("slug") || !selectedCategory) {
                              form.setValue("slug", generateSlug(e.target.value));
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ex: guitare" />
                      </FormControl>
                      <FormDescription>
                        Identifiant unique utilisé dans l'URL (ex: /categorie/guitare)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Description de la catégorie..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie parente (optionnel)</FormLabel>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={field.value?.toString() || ""}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : Number(e.target.value);
                          field.onChange(value);
                        }}
                      >
                        <option value="">Aucune (catégorie principale)</option>
                        {categories
                          .filter(cat => !selectedCategory || cat.id !== selectedCategory.id)
                          .map((category) => (
                            <option key={category.id} value={category.id.toString()}>
                              {category.name}
                            </option>
                          ))
                        }
                      </select>
                      <FormDescription>
                        Si cette catégorie est une sous-catégorie, sélectionnez sa catégorie parente
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  {selectedCategory && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setSelectedCategory(null);
                        form.reset({
                          name: "",
                          description: "",
                          slug: "",
                          parentId: null
                        });
                      }}
                    >
                      Annuler
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  >
                    {selectedCategory ? "Mettre à jour" : "Ajouter"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Liste des catégories */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Liste des catégories</CardTitle>
            <CardDescription>
              Gérez vos catégories existantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8">
                <FolderIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium">Aucune catégorie</h3>
                <p className="text-gray-500 mt-2">
                  Vous n'avez pas encore créé de catégories. Utilisez le formulaire pour en ajouter.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Catégorie parente</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <FolderIcon className="h-4 w-4 text-primary" />
                        {category.name}
                      </TableCell>
                      <TableCell className="text-gray-600">{category.slug}</TableCell>
                      <TableCell>
                        {category.description 
                          ? category.description.length > 50 
                            ? `${category.description.substring(0, 50)}...` 
                            : category.description 
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {category.parentId 
                          ? categories.find(c => c.id === category.parentId)?.name || "-" 
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)}>
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id, category.name)}
                          disabled={deleteCategoryMutation.isPending}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}