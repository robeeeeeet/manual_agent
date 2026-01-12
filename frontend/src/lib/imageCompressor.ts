/**
 * Image compression utility
 * Compresses images client-side to reduce upload size and avoid Vercel's 4.5MB limit
 */

// heic2any is dynamically imported to avoid SSR issues (window is not defined)

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for JPEG quality
}

export interface CompressionResult {
  success: boolean;
  blob?: Blob;
  file?: File;
  originalSize: number;
  compressedSize?: number;
  error?: string;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
};

/**
 * Compress an image file by resizing and converting to JPEG
 * Works for JPEG, PNG, WebP, and GIF images (not HEIC - use convertAndCompressHeic for that)
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  try {
    // Create image element
    const img = await loadImage(file);

    // Calculate new dimensions
    const { width, height } = calculateDimensions(
      img.width,
      img.height,
      opts.maxWidth!,
      opts.maxHeight!
    );

    // Create canvas and draw resized image
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        success: false,
        originalSize,
        error: "Failed to get canvas context",
      };
    }

    ctx.drawImage(img, 0, 0, width, height);

    // Convert to JPEG blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", opts.quality);
    });

    if (!blob) {
      return {
        success: false,
        originalSize,
        error: "Failed to create compressed blob",
      };
    }

    // Create a new File object with the compressed data
    const compressedFile = new File(
      [blob],
      file.name.replace(/\.[^.]+$/, ".jpg"),
      { type: "image/jpeg" }
    );

    console.log(
      `[ImageCompressor] Compressed: ${formatBytes(originalSize)} -> ${formatBytes(blob.size)} (${Math.round((1 - blob.size / originalSize) * 100)}% reduction)`
    );

    return {
      success: true,
      blob,
      file: compressedFile,
      originalSize,
      compressedSize: blob.size,
    };
  } catch (error) {
    console.error("[ImageCompressor] Compression error:", error);
    return {
      success: false,
      originalSize,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Load image from File object
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Only resize if image is larger than max dimensions
  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;

    if (width > height) {
      width = maxWidth;
      height = Math.round(width / aspectRatio);
    } else {
      height = maxHeight;
      width = Math.round(height * aspectRatio);
    }

    // Ensure we don't exceed max dimensions
    if (width > maxWidth) {
      width = maxWidth;
      height = Math.round(width / aspectRatio);
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = Math.round(height * aspectRatio);
    }
  }

  return { width, height };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/**
 * Check if compression is needed (file larger than threshold)
 */
export function needsCompression(file: File, thresholdMB: number = 1): boolean {
  return file.size > thresholdMB * 1024 * 1024;
}

/**
 * Convert HEIC to JPEG and compress client-side using heic2any
 * This avoids sending large HEIC files to server (Vercel 4.5MB limit)
 */
export async function convertAndCompressHeic(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const originalSize = file.size;

  try {
    console.log(`[ImageCompressor] Converting HEIC: ${formatBytes(originalSize)}`);

    // Dynamically import heic2any to avoid SSR issues
    const heic2any = (await import("heic2any")).default;

    // Convert HEIC to JPEG using heic2any (client-side)
    const convertedBlob = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9, // High quality for initial conversion
    });

    // heic2any can return single blob or array
    const jpegBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    console.log(
      `[ImageCompressor] HEIC converted: ${formatBytes(originalSize)} -> ${formatBytes(jpegBlob.size)}`
    );

    // Create File object from converted blob
    const convertedFile = new File(
      [jpegBlob],
      file.name.replace(/\.[^.]+$/, ".jpg"),
      { type: "image/jpeg" }
    );

    // If converted image is small enough (under 2MB), return it directly
    if (jpegBlob.size < 2 * 1024 * 1024) {
      return {
        success: true,
        blob: jpegBlob,
        file: convertedFile,
        originalSize,
        compressedSize: jpegBlob.size,
      };
    }

    // Otherwise, further compress the converted JPEG
    console.log("[ImageCompressor] Further compressing converted JPEG...");
    return await compressImage(convertedFile, options);
  } catch (error) {
    console.error("[ImageCompressor] HEIC conversion/compression error:", error);
    return {
      success: false,
      originalSize,
      error: error instanceof Error ? error.message : "HEIC conversion failed",
    };
  }
}

/**
 * Check if file is HEIC/HEIF format
 */
export function isHeicFile(file: File): boolean {
  const extension = file.name.toLowerCase();
  return extension.endsWith(".heic") || extension.endsWith(".heif");
}

/**
 * Compress image file - handles both regular images and HEIC
 * Returns compressed File ready for upload
 */
export async function compressImageForUpload(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  // Check if HEIC
  if (isHeicFile(file)) {
    return await convertAndCompressHeic(file, options);
  }

  // For regular images, check if compression needed
  if (needsCompression(file, 2)) {
    return await compressImage(file, options);
  }

  // Small enough, return as-is
  return {
    success: true,
    blob: file,
    file: file,
    originalSize: file.size,
    compressedSize: file.size,
  };
}
