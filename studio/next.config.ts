import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O studio vive dentro do repo vitrine-ia, que tem outro package-lock na raiz.
  // Sem isto o Next adota a raiz do vitrine-ia e carrega o src/proxy.ts de lá.
  turbopack: { root: __dirname },
};

export default nextConfig;
