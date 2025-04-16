import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus } from "lucide-react";

// Schéma de validation pour le formulaire de connexion
const loginFormSchema = z.object({
  username: z.string().min(1, {
    message: "Le nom d'utilisateur est requis",
  }),
  password: z.string().min(1, {
    message: "Le mot de passe est requis",
  }),
});

// Schéma de validation pour le formulaire d'inscription
const registerFormSchema = z.object({
  username: z.string().min(3, {
    message: "Le nom d'utilisateur doit contenir au moins 3 caractères",
  }),
  password: z.string().min(6, {
    message: "Le mot de passe doit contenir au moins 6 caractères",
  }),
  confirmPassword: z.string().min(1, {
    message: "Veuillez confirmer votre mot de passe",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginFormSchema>;
type RegisterFormValues = z.infer<typeof registerFormSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("login");

  // Rediriger si l'utilisateur est déjà connecté
  if (user) {
    return <Redirect to="/" />;
  }

  // Formulaire de connexion
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Formulaire d'inscription
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Soumission du formulaire de connexion
  function onLoginSubmit(data: LoginFormValues) {
    loginMutation.mutate(data, {
      onError: (error: any) => {
        toast({
          title: "Échec de la connexion",
          description: "Identifiants incorrects. Veuillez réessayer.",
          variant: "destructive",
        });
      },
    });
  }

  // Soumission du formulaire d'inscription
  function onRegisterSubmit(data: RegisterFormValues) {
    // Supprimer la confirmation du mot de passe avant d'envoyer
    const { confirmPassword, ...registerData } = data;
    
    registerMutation.mutate(registerData, {
      onSuccess: () => {
        toast({
          title: "Inscription réussie",
          description: "Votre compte a été créé avec succès. Vous êtes maintenant connecté.",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Échec de l'inscription",
          description: "Ce nom d'utilisateur existe déjà ou une erreur s'est produite.",
          variant: "destructive",
        });
      },
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl p-4">
        {/* Formulaires */}
        <Card className="w-full bg-zinc-800 text-zinc-100 border-zinc-700 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Bienvenue</CardTitle>
            <CardDescription className="text-zinc-400">
              Connectez-vous ou créez un compte pour accéder à notre bibliothèque de vidéos musicales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs 
              defaultValue="login" 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="space-y-4"
            >
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="register">Inscription</TabsTrigger>
              </TabsList>
              
              {/* Formulaire de connexion */}
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom d'utilisateur</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Votre nom d'utilisateur" 
                              className="bg-zinc-700 border-zinc-600"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="password" 
                              placeholder="••••••••" 
                              className="bg-zinc-700 border-zinc-600"
                            />
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
                          <LogIn className="mr-2 h-4 w-4" />
                          Se connecter
                        </div>
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              
              {/* Formulaire d'inscription */}
              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom d'utilisateur</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Choisissez un nom d'utilisateur" 
                              className="bg-zinc-700 border-zinc-600"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="password" 
                              placeholder="Choisissez un mot de passe" 
                              className="bg-zinc-700 border-zinc-600"
                            />
                          </FormControl>
                          <FormDescription className="text-zinc-400">
                            Au moins 6 caractères
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmation du mot de passe</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="password" 
                              placeholder="Confirmez votre mot de passe" 
                              className="bg-zinc-700 border-zinc-600"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                          Inscription en cours...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <UserPlus className="mr-2 h-4 w-4" />
                          S'inscrire
                        </div>
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Présentation de la plateforme */}
        <div className="hidden md:flex flex-col justify-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-zinc-100">
              Explorez le monde de la musique
            </h2>
            <p className="text-zinc-300">
              Accédez à notre vaste bibliothèque de vidéos musicales éducatives couvrant
              divers instruments et styles.
            </p>
            <ul className="space-y-2 text-zinc-300">
              <li className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-primary mr-2"></div>
                Tutoriels de guitare, piano, batterie et plus
              </li>
              <li className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-primary mr-2"></div>
                Leçons de théorie musicale et techniques avancées
              </li>
              <li className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-primary mr-2"></div>
                Vidéos sur la production musicale et le mixage
              </li>
              <li className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-primary mr-2"></div>
                Contenus adaptés à tous les niveaux, du débutant à l'expert
              </li>
            </ul>
            <p className="text-zinc-400 text-sm">
              En vous inscrivant, vous pourrez également participer à notre communauté,
              sauvegarder vos vidéos préférées et suivre votre progression.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}