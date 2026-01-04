import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFアップロード用にボディサイズ制限を緩和（50MB - Supabase Storageの上限に合わせる）
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Proxy/Middleware経由のリクエストボディサイズ制限
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
