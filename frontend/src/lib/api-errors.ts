/**
 * Unified API Error handling utilities
 *
 * Provides standardized error response structures and helpers
 * for consistent error handling across the frontend.
 */

import { logger } from "./logger";

/**
 * Standard error codes for API responses
 */
export const ErrorCodes = {
  // Authentication errors
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",

  // Network errors
  NETWORK_ERROR: "NETWORK_ERROR",
  FETCH_FAILED: "FETCH_FAILED",

  // Unknown
  UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Standardized error response structure
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  originalError?: unknown;
}

/**
 * User-friendly error messages in Japanese
 */
const errorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.UNAUTHORIZED]: "ログインが必要です",
  [ErrorCodes.FORBIDDEN]: "アクセス権限がありません",
  [ErrorCodes.SESSION_EXPIRED]: "セッションが期限切れです。再ログインしてください",
  [ErrorCodes.VALIDATION_ERROR]: "入力内容に誤りがあります",
  [ErrorCodes.INVALID_INPUT]: "入力内容が正しくありません",
  [ErrorCodes.NOT_FOUND]: "データが見つかりませんでした",
  [ErrorCodes.CONFLICT]: "競合が発生しました",
  [ErrorCodes.ALREADY_EXISTS]: "既に存在しています",
  [ErrorCodes.RATE_LIMITED]: "リクエストが多すぎます。しばらくお待ちください",
  [ErrorCodes.QUOTA_EXCEEDED]: "利用上限に達しました",
  [ErrorCodes.INTERNAL_ERROR]: "サーバーエラーが発生しました",
  [ErrorCodes.SERVICE_UNAVAILABLE]: "サービスが一時的に利用できません",
  [ErrorCodes.TIMEOUT]: "リクエストがタイムアウトしました",
  [ErrorCodes.NETWORK_ERROR]: "ネットワークエラーが発生しました",
  [ErrorCodes.FETCH_FAILED]: "通信に失敗しました",
  [ErrorCodes.UNKNOWN]: "予期しないエラーが発生しました",
};

/**
 * Get user-friendly error message for an error code
 */
export function getErrorMessage(code: ErrorCode): string {
  return errorMessages[code] || errorMessages[ErrorCodes.UNKNOWN];
}

/**
 * Map HTTP status code to error code
 */
export function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCodes.VALIDATION_ERROR;
    case 401:
      return ErrorCodes.UNAUTHORIZED;
    case 403:
      return ErrorCodes.FORBIDDEN;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 429:
      return ErrorCodes.RATE_LIMITED;
    case 500:
      return ErrorCodes.INTERNAL_ERROR;
    case 502:
    case 503:
      return ErrorCodes.SERVICE_UNAVAILABLE;
    case 504:
      return ErrorCodes.TIMEOUT;
    default:
      if (status >= 400 && status < 500) {
        return ErrorCodes.VALIDATION_ERROR;
      }
      if (status >= 500) {
        return ErrorCodes.INTERNAL_ERROR;
      }
      return ErrorCodes.UNKNOWN;
  }
}

/**
 * Create a standardized ApiError from various error sources
 */
export function createApiError(
  error: unknown,
  context: string = "API"
): ApiError {
  // Already an ApiError
  if (isApiError(error)) {
    return error;
  }

  // Fetch Response object
  if (error instanceof Response) {
    const code = httpStatusToErrorCode(error.status);
    logger.apiError(context, error.url, error.status);
    return {
      code,
      message: getErrorMessage(code),
      details: { status: error.status, url: error.url },
      originalError: error,
    };
  }

  // Network/fetch errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    logger.networkError(context, "unknown", error);
    return {
      code: ErrorCodes.NETWORK_ERROR,
      message: getErrorMessage(ErrorCodes.NETWORK_ERROR),
      originalError: error,
    };
  }

  // Generic Error object
  if (error instanceof Error) {
    logger.error(context, error.message, { error });

    // Check for timeout
    if (
      error.name === "AbortError" ||
      error.message.toLowerCase().includes("timeout")
    ) {
      return {
        code: ErrorCodes.TIMEOUT,
        message: getErrorMessage(ErrorCodes.TIMEOUT),
        originalError: error,
      };
    }

    return {
      code: ErrorCodes.UNKNOWN,
      message: error.message || getErrorMessage(ErrorCodes.UNKNOWN),
      originalError: error,
    };
  }

  // Unknown error type
  logger.error(context, "Unknown error type", { error });
  return {
    code: ErrorCodes.UNKNOWN,
    message: getErrorMessage(ErrorCodes.UNKNOWN),
    originalError: error,
  };
}

/**
 * Type guard to check if an object is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as ApiError).code === "string" &&
    typeof (error as ApiError).message === "string"
  );
}

/**
 * Handle API response and throw ApiError if not ok
 */
export async function handleApiResponse<T>(
  response: Response,
  context: string = "API"
): Promise<T> {
  if (!response.ok) {
    const code = httpStatusToErrorCode(response.status);

    // Try to get error details from response body
    let details: Record<string, unknown> = {};
    try {
      const body = await response.json();
      details = body;
      // Use server-provided message if available
      if (body.message || body.error) {
        logger.apiError(context, response.url, response.status, body);
        throw {
          code,
          message: body.message || body.error || getErrorMessage(code),
          details,
          originalError: response,
        } as ApiError;
      }
    } catch {
      // Ignore JSON parse errors, use default message
    }

    logger.apiError(context, response.url, response.status);
    throw {
      code,
      message: getErrorMessage(code),
      details: { status: response.status, url: response.url, ...details },
      originalError: response,
    } as ApiError;
  }

  return response.json();
}

/**
 * Wrap an async function with standardized error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string = "API"
): Promise<{ data: T; error: null } | { data: null; error: ApiError }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: createApiError(error, context) };
  }
}
