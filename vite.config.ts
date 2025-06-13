import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import { visualizer } from "rollup-plugin-visualizer"; // Importez le plugin ici

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function () {
  const plugins = [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
  ];

  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    plugins.push(cartographer());
  }

  // Ajoutez rollup-plugin-visualizer uniquement en mode production
  if (process.env.NODE_ENV === "production") {
    plugins.push(
      visualizer({
        open: true, // Ouvre automatiquement le rapport dans votre navigateur
        brotliSize: true, // Affiche la taille Gzip/Brotli pour une estimation plus réaliste
        filename: "bundle-stats.html", // Nom du fichier de sortie
      })
    );
  }

  return defineConfig({
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
  });
}
