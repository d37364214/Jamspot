 import { useState } from "react";
 import { useMutation, useQuery } from "@tanstack/react-query";
 import { useToast } from "@/hooks/use-toast";
 import { apiRequest, queryClient } from "@/lib/queryClient";
 import { ImportModeSwitcher } from "@/components/admin/ImportModeSwitcher";
 import { ManualImport } from "@/components/admin/ManualImport";
 import { AutomaticImport } from "@/components/admin/AutomaticImport";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 

 export default function ImportVideosPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [importing, setImporting] = useState(false);
 

  const { data: categories = [] } = useQuery({
  queryKey: ["/api/categories"],
  });
 

  const { data: subcategories = [] } = useQuery({
  queryKey: ["/api/subcategories"],
  });
 

  const importMutation = useMutation({
  mutationFn: async (data: any) => {
  const urls = data.urls.split('\n').filter((url: string) => url.trim());
  setImporting(true);
 

  const results = [];
  for (const url of urls) {
  try {
  const res = await apiRequest("POST", "/api/v1/import/youtube", {
  youtubeId: extractYouTubeId(url.trim()),
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
 

  function extractYouTubeId(url: string) {
  const regExp = /^.*(http:\/\/googleusercontent.com\/youtube.com\/0\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : url;
  }
 

  const handleImport = (data: any) => {
  importMutation.mutate(data);
  };
 

  return (
  <div className="container p-6 mx-auto">
  <ImportModeSwitcher mode={mode} onChange={setMode} />
 

  {mode === 'manual' && (
  <ManualImport
  categories={categories}
  subcategories={subcategories}
  onImport={handleImport}
  isImporting={importing}
  />
  )}
 

  {mode === 'auto' && <AutomaticImport />}
  </div>
  );
 }
