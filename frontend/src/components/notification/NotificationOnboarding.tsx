"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import NotificationPermissionModal from "./NotificationPermissionModal";

const SESSION_STORAGE_KEY = "showNotificationOnboarding";

/**
 * Check sessionStorage for onboarding flag
 */
function checkShouldShowOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_STORAGE_KEY) === "true";
}

/**
 * Component that shows notification permission modal after signup.
 * Reads the flag from sessionStorage and displays the modal once.
 * Should be placed in the root layout.
 */
export default function NotificationOnboarding() {
  const pathname = usePathname();

  // Use lazy initializer to check sessionStorage synchronously
  const [shouldShowFromStorage, setShouldShowFromStorage] = useState(checkShouldShowOnboarding);

  // Compute final showModal value: check storage flag AND not on auth pages
  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/signup");
  const showModal = shouldShowFromStorage && !isAuthPage;

  const handleComplete = useCallback(() => {
    // Remove the flag and close modal
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setShouldShowFromStorage(false);
  }, []);

  return (
    <NotificationPermissionModal isOpen={showModal} onComplete={handleComplete} />
  );
}
