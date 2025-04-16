import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { useLocation } from "wouter";

export default function AdminLoginPage() {
  const { loginMutation, user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Initialiser les hooks avant toute condition
  const loginForm = useForm({
    resolver: zodResolver(insertUserSchema.pick({ username: true, password: true })),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Rediriger vers l'admin si déjà connecté en tant qu'admin
  useEffect(() => {
    if (user && user.isAdmin) {
      setLocation("/admin");
    }
  }, [user, setLocation]);
  
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="bg-zinc-800 p-8 text-white hidden md:flex flex-col justify-center">
        <h1 className="text-4xl font-bold mb-4">Administration</h1>
        <p className="text-xl">
          Interface d'administration de la plateforme de vidéos musicales.
          Accès réservé aux administrateurs.
        </p>
      </div>

      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Connectez-vous pour accéder à l'administration</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identifiant</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Admin" />
                      </FormControl>
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
                        <Input type="password" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  Se connecter
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}