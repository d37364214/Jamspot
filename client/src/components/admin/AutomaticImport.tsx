
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const playlistSchema = z.object({
  playlistUrl: z.string().min(1, "L'URL de la playlist est requise"),
});

const channelSchema = z.object({
  channelUrl: z.string().min(1, "L'URL de la chaîne est requise"),
  frequency: z.enum(["daily", "weekly"], {
    required_error: "Veuillez sélectionner une fréquence",
  }),
});

type PlaylistFormValues = z.infer<typeof playlistSchema>;
type ChannelFormValues = z.infer<typeof channelSchema>;

export function AutomaticImport() {
  const [activeTab, setActiveTab] = useState("playlist");
  const [isImporting, setIsImporting] = useState(false);

  const playlistForm = useForm<PlaylistFormValues>({
    resolver: zodResolver(playlistSchema),
    defaultValues: {
      playlistUrl: "",
    },
  });

  const channelForm = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      channelUrl: "",
      frequency: "daily",
    },
  });

  const onPlaylistSubmit = async (data: PlaylistFormValues) => {
    setIsImporting(true);
    try {
      const response = await fetch("/api/import/playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'import");
      }

      const result = await response.json();
      toast({
        title: "Import en cours",
        description: `L'import de la playlist ${result.playlistId} a démarré`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'import de la playlist",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const onChannelSubmit = async (data: ChannelFormValues) => {
    setIsImporting(true);
    try {
      const response = await fetch("/api/import/channel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la configuration");
      }

      const result = await response.json();
      toast({
        title: "Configuration enregistrée",
        description: `La surveillance de la chaîne ${result.channelId} est configurée (${result.frequency})`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la configuration",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import automatique</CardTitle>
        <CardDescription>
          Importez des vidéos depuis une playlist ou configurez une surveillance de chaîne
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="playlist">Playlist YouTube</TabsTrigger>
            <TabsTrigger value="channel">Chaîne YouTube</TabsTrigger>
          </TabsList>

          <TabsContent value="playlist">
            <Form {...playlistForm}>
              <form onSubmit={playlistForm.handleSubmit(onPlaylistSubmit)} className="space-y-4">
                <FormField
                  control={playlistForm.control}
                  name="playlistUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de la playlist</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://www.youtube.com/playlist?list=..." />
                      </FormControl>
                      <FormDescription>
                        Collez l'URL complète de la playlist YouTube
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isImporting}>
                  {isImporting ? "Import en cours..." : "Importer la playlist"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="channel">
            <Form {...channelForm}>
              <form onSubmit={channelForm.handleSubmit(onChannelSubmit)} className="space-y-4">
                <FormField
                  control={channelForm.control}
                  name="channelUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de la chaîne</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://www.youtube.com/channel/..." />
                      </FormControl>
                      <FormDescription>
                        Collez l'URL de la chaîne YouTube à surveiller
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={channelForm.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fréquence de vérification</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez une fréquence" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Quotidienne</SelectItem>
                          <SelectItem value="weekly">Hebdomadaire</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        À quelle fréquence vérifier les nouvelles vidéos
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isImporting}>
                  {isImporting ? "Configuration en cours..." : "Configurer la surveillance"}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
