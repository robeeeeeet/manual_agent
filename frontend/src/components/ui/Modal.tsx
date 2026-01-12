"use client";

import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: "lightbox" | "dialog" | "fullscreen";
}

export default function Modal({
  isOpen,
  onClose,
  children,
  variant = "lightbox",
}: ModalProps) {
  // ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 ${
        variant === "fullscreen"
          ? ""
          : "flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      }`}
      onClick={variant === "fullscreen" ? undefined : onClose}
    >
      <div
        className={`relative ${
          variant === "dialog"
            ? "bg-white rounded-xl shadow-2xl max-w-md w-full"
            : variant === "fullscreen"
              ? "w-full h-full bg-white"
              : "max-w-7xl max-h-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - only for lightbox variant */}
        {variant === "lightbox" && (
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
