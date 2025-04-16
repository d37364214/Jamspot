import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 768) {
  // Détecter si le navigateur est disponible
  const isBrowser = typeof window !== "undefined";
  
  // État initial basé sur la largeur de l'écran
  const [isMobile, setIsMobile] = useState(
    isBrowser ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    if (!isBrowser) return;

    // Fonction pour mettre à jour l'état lors du redimensionnement de la fenêtre
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }

    // Ajouter un écouteur d'événement pour le redimensionnement
    window.addEventListener("resize", handleResize);
    
    // Nettoyer l'écouteur lors du démontage du composant
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [breakpoint, isBrowser]);

  return isMobile;
}