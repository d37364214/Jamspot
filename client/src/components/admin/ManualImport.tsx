
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Category, Subcategory } from "@shared/schema";

const importSchema = z.object({
  urls: z.string().min(1, "Veuillez entrer au moins une URL"),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
});

type ImportFormValues = z.infer<typeof importSchema>;

interface ManualImportProps {
  categories: Category[];
  subcategories: Subcategory[];
  onImport: (data: ImportFormValues) => void;
  isImporting: boolean;
}

export function ManualImport({ categories, subcategories, onImport, isImporting }: ManualImportProps) {
  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      urls: "",
      categoryId: undefined,
      subcategoryId: undefined,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import manuel de vidéos</CardTitle>
        <CardDescription>
          Collez une liste d'URLs YouTube (une par ligne) pour les importer en masse
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onImport)} className="space-y-4">
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
              <Button type="submit" disabled={isImporting}>
                {isImporting ? "Import en cours..." : "Importer les vidéos"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
