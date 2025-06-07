import pino from 'pino';

// S'assurer que NODE_ENV a toujours une valeur par défaut
// Cela évite les comportements indéfinis si la variable n'est pas configurée.
const env = process.env.NODE_ENV || 'development';

/**
 * Configuration du Logger (Pino)
 *
 * Ce logger est configuré en utilisant Pino, une bibliothèque de journalisation
 * réputée pour sa rapidité et son efficacité. Il est particulièrement adapté
 * aux environnements serverless grâce à sa très faible surcharge.
 *
 * ---
 *
 * En **développement** (quand 'env' n'est PAS 'production') :
 * - Utilise 'pino-pretty' pour une sortie de logs lisible par un humain et colorisée
 * directement dans la console de développement.
 * - Aucune gestion d'erreur spécifique pour 'pino-pretty' n'est nécessaire ici.
 * En développement, il est attendu que cette dépendance soit installée.
 *
 * En **production** (quand 'env' est 'production') :
 * - Produit des logs au format **JSON structuré** vers la sortie standard (stdout).
 * C'est le format idéal pour l'intégration avec des systèmes centralisés de gestion de logs
 * comme les logs Supabase, AWS CloudWatch, Datadog, ElasticSearch, ou Loki.
 * - Le transport n'est pas défini (`undefined`), car c'est le comportement par défaut de Pino
 * pour générer du JSON en production.
 *
 * ---
 *
 * **Métadonnées Globales** :
 * Des champs 'service' et 'environment' sont automatiquement ajoutés à chaque entrée de log.
 * Cela permet de filtrer, rechercher et analyser plus facilement vos logs
 * dans des outils d'agrégation, surtout dans un environnement multi-services.
 */
const logger = pino({
  // Définir le niveau de log en fonction de l'environnement :
  // 'info' en production pour les données essentielles, 'debug' en développement pour des détails approfondis.
  level: env === 'production' ? 'info' : 'debug',

  // Ajouter des métadonnées globales à tous les logs.
  // C'est crucial pour l'observabilité et l'analyse future.
  base: {
    service: 'jamspot-backend', // Nom explicite du service pour faciliter l'identification
    environment: env,           // Environnement actuel (production, development, etc.)
  },

  // Configurer le transport (méthode de sortie des logs) :
  transport: env === 'production'
    ? undefined // En production, pas de transport spécifique = sortie JSON
    : {
        target: 'pino-pretty', // En développement, utiliser pino-pretty pour une sortie lisible
        options: {
          colorize: true,      // Activer les couleurs pour une meilleure lisibilité
          // Ici, vous pouvez ajouter d'autres options pour pino-pretty, par exemple :
          // translateTime: 'SYS:HH:MM:ss', // Pour un format d'heure plus lisible
        },
      },
});

export default logger;
