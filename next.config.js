import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  // Configuration pour servir les fichiers statiques de dist/public
  outputFileTracing: false,
  async rewrites() {
    return [
      {
        source: '/public/:path*',
        destination: path.resolve(process.cwd(), 'dist/public/:path*'),
      },
    ];
  },
};

export default nextConfig;
