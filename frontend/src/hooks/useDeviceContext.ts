"use client";

export type DeviceType = "desktop" | "mobile";
export type AppMode = "browser" | "pwa";

interface DeviceContext {
  deviceType: DeviceType;
  appMode: AppMode;
}

/**
 * Detect device type from User-Agent
 */
function detectDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipad|ipod|android|webos|blackberry|windows phone/.test(userAgent);
  return isMobile ? "mobile" : "desktop";
}

/**
 * Detect PWA mode from display-mode media query and iOS standalone
 */
function detectAppMode(): AppMode {
  if (typeof window === "undefined") return "browser";
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIOSStandalone = "standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true;
  return isStandalone || isIOSStandalone ? "pwa" : "browser";
}

/**
 * Hook to detect device type and app mode (browser vs PWA)
 * Uses synchronous detection to avoid cascading renders
 */
export function useDeviceContext(): DeviceContext {
  // Compute values synchronously - these don't change during session
  const deviceType = detectDeviceType();
  const appMode = detectAppMode();

  return { deviceType, appMode };
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
