/**
 * Centralized logger utility for frontend
 *
 * Provides consistent logging with:
 * - Environment-aware output (debug logs only in development)
 * - Structured context information
 * - Type-safe log levels
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogOptions {
  /** Additional data to include in the log */
  data?: unknown;
  /** Error object if applicable */
  error?: unknown;
}

const isDev = process.env.NODE_ENV === "development";

/**
 * Format error for logging
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  }
  return String(error);
}

/**
 * Create a formatted log prefix
 */
function createPrefix(level: LogLevel, context: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}:${context}]`;
}

/**
 * Logger utility with environment-aware output
 */
export const logger = {
  /**
   * Debug level log - only outputs in development
   * Use for detailed debugging information
   */
  debug: (context: string, message: string, options?: LogOptions) => {
    if (isDev) {
      const prefix = createPrefix("debug", context);
      if (options?.data !== undefined) {
        console.log(prefix, message, options.data);
      } else {
        console.log(prefix, message);
      }
    }
  },

  /**
   * Info level log - outputs in all environments
   * Use for important operational information
   */
  info: (context: string, message: string, options?: LogOptions) => {
    const prefix = createPrefix("info", context);
    if (options?.data !== undefined) {
      console.info(prefix, message, options.data);
    } else {
      console.info(prefix, message);
    }
  },

  /**
   * Warning level log - outputs in all environments
   * Use for potentially problematic situations
   */
  warn: (context: string, message: string, options?: LogOptions) => {
    const prefix = createPrefix("warn", context);
    if (options?.data !== undefined) {
      console.warn(prefix, message, options.data);
    } else {
      console.warn(prefix, message);
    }
  },

  /**
   * Error level log - outputs in all environments
   * Use for error conditions
   */
  error: (context: string, message: string, options?: LogOptions) => {
    const prefix = createPrefix("error", context);
    const errorStr = options?.error ? formatError(options.error) : "";

    if (errorStr && options?.data !== undefined) {
      console.error(prefix, message, options.data, errorStr);
    } else if (errorStr) {
      console.error(prefix, message, errorStr);
    } else if (options?.data !== undefined) {
      console.error(prefix, message, options.data);
    } else {
      console.error(prefix, message);
    }
  },

  /**
   * Log API response error with structured information
   */
  apiError: (
    context: string,
    endpoint: string,
    status: number,
    error?: unknown
  ) => {
    logger.error(context, `API error: ${endpoint} returned ${status}`, {
      error,
      data: { endpoint, status },
    });
  },

  /**
   * Log fetch/network error
   */
  networkError: (context: string, endpoint: string, error: unknown) => {
    logger.error(context, `Network error: Failed to fetch ${endpoint}`, {
      error,
    });
  },
};

export default logger;
