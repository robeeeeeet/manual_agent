"use client";

import { useState, useEffect } from "react";

export type DeviceType = "desktop" | "mobile";
export type AppMode = "browser" | "pwa";

interface DeviceContext {
  deviceType: DeviceType;
  appMode: AppMode;
  isLoading: boolean;
}

/**
 * Hook to detect device type and app mode (browser vs PWA)
 */
export function useDeviceContext(): DeviceContext {
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");
  const [appMode, setAppMode] = useState<AppMode>("browser");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect device type from User-Agent
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|webos|blackberry|windows phone/.test(userAgent);
    setDeviceType(isMobile ? "mobile" : "desktop");

    // Detect PWA mode
    // 1. Check display-mode media query (works for most browsers)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    // 2. Check iOS Safari standalone mode
    const isIOSStandalone = "standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true;

    setAppMode(isStandalone || isIOSStandalone ? "pwa" : "browser");
    setIsLoading(false);
  }, []);

  return { deviceType, appMode, isLoading };
}

/**
 * Get appropriate settings instruction text based on device context
 */
export function getNotificationSettingsText(deviceType: DeviceType, appMode: AppMode): string {
  if (appMode === "pwa") {
    // PWA mode - refer to device settings
    if (deviceType === "mobile") {
      return "端末の設定アプリから通知を許可してください";
    }
    return "端末の設定から通知を許可してください";
  }

  // Browser mode
  if (deviceType === "mobile") {
    return "ブラウザの設定から通知を許可してください";
  }
  return "ブラウザの設定から通知を許可してください";
}
