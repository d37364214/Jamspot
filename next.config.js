const path = require('path');

      module.exports = {
        experimental: {
          appDir: true,
        },
        // Configuration pour servir les fichiers statiques de dist/public
        outputFileTracing: false,
        async rewrites() {
          return [
            {
              source: '/public/:path*',
              destination: path.resolve(__dirname, 'dist/public/:path*'),
            },
          ];
        },
      };