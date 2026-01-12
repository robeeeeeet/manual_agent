import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { AuthProvider } from "@/contexts/AuthContext";
import NotificationOnboarding from "@/components/notification/NotificationOnboarding";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "トリセツコンシェルジュ - AIが取説検索・メンテ管理・疑問解決",
  description: "AIが「取説検索」「メンテ管理」「疑問解決」を全自動で。",
  manifest: "/manifest.json",
  themeColor: "#007AFF",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "トリセツコンシェルジュ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" style={{ colorScheme: "light" }}>
      <body
        className={`${notoSansJP.variable} font-sans antialiased bg-[#F2F2F7] min-h-screen`}
      >
        <AuthProvider>
          <Header />
          <main className="pb-20">{children}</main>
          <BottomNav />
          <NotificationOnboarding />
        </AuthProvider>
      </body>
    </html>
  );
}
