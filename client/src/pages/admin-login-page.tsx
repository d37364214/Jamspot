import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Lock, UserCheck } from "lucide-react";

// Schéma de validation pour le formulaire de connexion
const loginFormSchema = z.object({
  username: z.string().min(1, {
    message: "Le nom d'utilisateur est requis",
  }),
  password: z.string().min(1, {
    message: "Le mot de passe est requis",
  }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function AdminLoginPage() {
  const { loginMutation, user } = useAuth();
  const { toast } = useToast();

  // Formulaire de connexion
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Si l'utilisateur est déjà connecté et est admin, le rediriger vers le dashboard
  if (user && user.isAdmin) {
    return <Redirect to="/admin" />;
  }

  // Fonction de soumission du formulaire
  function onSubmit(data: LoginFormValues) {
    loginMutation.mutate(data, {
      onSuccess: (loggedInUser) => {
        if (!loggedInUser.isAdmin) {
          toast({
            title: "Accès refusé",
            description: "Vous n'avez pas les droits d'administration nécessaires",
            variant: "destructive",
          });
        }
      },
      onError: (error: any) => {
        toast({
          title: "Échec de la connexion",
          description: "Identifiants incorrects. Veuillez réessayer.",
          variant: "destructive",
        });
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-6">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <Lock className="h-6 w-6 text-primary" />
              Connexion Administrateur
            </CardTitle>
            <CardDescription>
              Connectez-vous pour accéder au panneau d'administration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom d'utilisateur</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="admin" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Connexion en cours...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <UserCheck className="mr-2 h-4 w-4" />
                      Se connecter
                    </div>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col">
            <div className="text-center text-xs text-gray-500 mt-2">
              Réservé aux administrateurs du site uniquement
            </div>
            <Button variant="link" className="mt-2 p-0" asChild>
              <a href="/">Retour au site</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}