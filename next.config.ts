import type { NextConfig } from "next";

// Publicado no GitHub Pages em https://rodrigomichelxavier.github.io/atividades/
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
