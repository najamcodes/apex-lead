import { HttpStatus, type HttpStatusCode } from './http-status';
import { ErrorCode, type ErrorCodeType, DefaultErrorMessages } from './error-codes';

/**
 * Standard structured API Error class
 */
export class ApiError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly errorCode: ErrorCodeType;
  public readonly details?: unknown;
  public readonly timestamp: string;

  constructor(
    statusCode: HttpStatusCode,
    errorCode: ErrorCodeType,
    message?: string,
    details?: unknown
  ) {
    super(message || DefaultErrorMessages[errorCode] || 'An unexpected error occurred.');
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message?: string, details?: unknown): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, message, details);
  }

  static validation(message?: string, details?: unknown): ApiError {
    return new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message?: string, errorCode: ErrorCodeType = ErrorCode.UNAUTHORIZED): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, errorCode, message);
  }

  static forbidden(message?: string, errorCode: ErrorCodeType = ErrorCode.FORBIDDEN): ApiError {
    return new ApiError(HttpStatus.FORBIDDEN, errorCode, message);
  }

  static notFound(message?: string, errorCode: ErrorCodeType = ErrorCode.NOT_FOUND): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, errorCode, message);
  }

  static conflict(message?: string, errorCode: ErrorCodeType = ErrorCode.CONFLICT): ApiError {
    return new ApiError(HttpStatus.CONFLICT, errorCode, message);
  }

  static quotaExceeded(message?: string, details?: unknown): ApiError {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.QUOTA_EXCEEDED, message, details);
  }

  static rateLimitExceeded(message?: string): ApiError {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMIT_EXCEEDED, message);
  }

  static internal(message?: string, details?: unknown): ApiError {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, message, details);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        details: this.details,
      },
      statusCode: this.statusCode,
      timestamp: this.timestamp,
    };
  }
}
