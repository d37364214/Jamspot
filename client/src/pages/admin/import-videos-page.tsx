
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

const importSchema = z.object({
  urls: z.string().min(1, "Veuillez entrer au moins une URL"),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
});

type ImportFormValues = z.infer<typeof importSchema>;

function extractYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : url;
}

export default function ImportVideosPage() {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);

  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      urls: "",
      categoryId: undefined,
      subcategoryId: undefined,
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ["/api/subcategories"],
  });

  const importMutation = useMutation({
    mutationFn: async (data: ImportFormValues) => {
      const urls = data.urls.split('\n').filter(url => url.trim());
      setImporting(true);

      const results = [];
      for (const url of urls) {
        const youtubeId = extractYouTubeId(url.trim());
        try {
          const res = await apiRequest("POST", "/api/videos", {
            youtubeId,
            categoryId: data.categoryId ? parseInt(data.categoryId) : null,
            subcategoryId: data.subcategoryId ? parseInt(data.subcategoryId) : null,
          });
          results.push(await res.json());
        } catch (error) {
          console.error(`Erreur lors de l'import de ${url}:`, error);
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({
        title: "Import terminé",
        description: `${results.length} vidéos ont été importées avec succès`,
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: `Une erreur est survenue lors de l'import: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setImporting(false);
    },
  });

  function onSubmit(data: ImportFormValues) {
    importMutation.mutate(data);
  }

  return (
    <div className="container p-6 mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Importer des vidéos YouTube</CardTitle>
          <CardDescription>
            Collez une liste d'URLs YouTube (une par ligne) pour les importer en masse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="urls"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URLs YouTube</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="https://www.youtube.com/watch?v=..."
                        rows={10}
                      />
                    </FormControl>
                    <FormDescription>
                      Vous pouvez coller plusieurs URLs YouTube, une par ligne
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
                        value={field.value}
                        onValueChange={field.onChange}
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
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!form.watch("categoryId")}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une sous-catégorie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Aucune sous-catégorie</SelectItem>
                          {form.watch("categoryId") &&
                            subcategories
                              .filter(sub => sub.categoryId === parseInt(form.watch("categoryId")))
                              .map((subcategory) => (
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

              <div className="flex justify-end">
                <Button type="submit" disabled={importing}>
                  {importing ? "Import en cours..." : "Importer les vidéos"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
