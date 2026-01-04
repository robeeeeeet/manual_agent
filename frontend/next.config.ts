import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  // PDFアップロード用にボディサイズ制限を緩和（50MB - Supabase Storageの上限に合わせる）
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Proxy/Middleware経由のリクエストボディサイズ制限
    proxyClientMaxBodySize: "50mb",
  },
  // Turbopack設定（空のオブジェクトで警告を抑制）
  turbopack: {},
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  // 開発環境ではPWAを無効化
  disable: process.env.NODE_ENV === "development",
  // カスタムService Workerを使用
  sw: "custom-sw.js",
})(nextConfig);
