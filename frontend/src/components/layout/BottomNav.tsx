"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  href: string;
  label: string;
  icon: (isActive: boolean) => React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "ホーム",
    icon: (isActive) => (
      <svg
        className="w-6 h-6"
        fill={isActive ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={isActive ? 0 : 1.5}
      >
        {isActive ? (
          <path d="M12 2.1L1 12h3v9h6v-6h4v6h6v-9h3L12 2.1z" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        )}
      </svg>
    ),
  },
  {
    href: "/appliances",
    label: "家電",
    icon: (isActive) => (
      <svg
        className="w-6 h-6"
        fill={isActive ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={isActive ? 0 : 1.5}
      >
        {isActive ? (
          <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm8 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
          />
        )}
      </svg>
    ),
  },
  {
    href: "/maintenance",
    label: "メンテナンス",
    icon: (isActive) => (
      <svg
        className="w-6 h-6"
        fill={isActive ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={isActive ? 0 : 1.5}
      >
        {isActive ? (
          <path d="M9 2a1 1 0 000 2h6a1 1 0 100-2H9zM4 6a2 2 0 012-2h1a1 1 0 010 2H6v14h12V6h-1a1 1 0 110-2h1a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm5 5a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1z" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        )}
      </svg>
    ),
  },
  {
    href: "/mypage",
    label: "マイページ",
    icon: (isActive) => (
      <svg
        className="w-6 h-6"
        fill={isActive ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={isActive ? 0 : 1.5}
      >
        {isActive ? (
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
          />
        )}
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // 認証関連ページではボトムナビを表示しない
  const authPages = ["/login", "/signup", "/reset-password"];
  if (authPages.some((page) => pathname.startsWith(page))) {
    return null;
  }

  // 認証状態読み込み中、または未ログインの場合は表示しない
  if (loading || !user) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active ? "text-[#007AFF]" : "text-gray-400"
              }`}
            >
              {item.icon(active)}
              <span
                className={`text-[10px] mt-1 ${
                  active ? "font-medium" : "font-normal"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
