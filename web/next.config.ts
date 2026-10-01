import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // URLs de la versión anterior, para no romper links compartidos
  async redirects() {
    return [
      { source: "/grupos", destination: "/comunidades", permanent: true },
      { source: "/grupos/unirse/:code", destination: "/comunidades/unirse/:code", permanent: true },
      { source: "/mis-eventos", destination: "/planes", permanent: true },
      { source: "/ir/:id", destination: "/e/:id", permanent: true },
    ];
  },
};

export default nextConfig;
