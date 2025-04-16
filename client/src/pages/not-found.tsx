import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <h1 className="text-9xl font-bold text-primary">404</h1>
      <h2 className="text-2xl md:text-3xl font-bold mb-8">Page non trouvée</h2>
      
      <p className="text-zinc-400 max-w-md mb-8">
        Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      
      <Button asChild>
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à l'accueil
        </Link>
      </Button>
    </div>
  );
}