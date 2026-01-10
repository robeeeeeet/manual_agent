"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import NotificationPermissionModal from "./NotificationPermissionModal";

const SESSION_STORAGE_KEY = "showNotificationOnboarding";

/**
 * Component that shows notification permission modal after signup.
 * Reads the flag from sessionStorage and displays the modal once.
 * Should be placed in the root layout.
 */
export default function NotificationOnboarding() {
  const [showModal, setShowModal] = useState(false);
  const pathname = usePathname();

  // Check sessionStorage on mount and pathname change
  useEffect(() => {
    // Skip on auth pages
    if (pathname?.startsWith("/login") || pathname?.startsWith("/signup")) {
      return;
    }

    // Check if we should show the modal
    const shouldShow = sessionStorage.getItem(SESSION_STORAGE_KEY) === "true";
    if (shouldShow) {
      setShowModal(true);
    }
  }, [pathname]);

  const handleComplete = useCallback(() => {
    // Remove the flag and close modal
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setShowModal(false);
  }, []);

  return (
    <NotificationPermissionModal isOpen={showModal} onComplete={handleComplete} />
  );
}
