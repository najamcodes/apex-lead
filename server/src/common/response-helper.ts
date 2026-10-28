import type { RequestContext } from 'katal';
import { HttpStatus, type HttpStatusCode } from './http-status';
import { ErrorCode, type ErrorCodeType, DefaultErrorMessages } from './error-codes';
import { ApiError } from './api-error';
import type { ApiResponse, PaginatedResponse, PaginationMeta } from './api-response';

/**
 * Creates standard PaginationMeta from page, pageSize, and total
 */
export function createPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  const safePage = Math.max(1, page || 1);
  const safePageSize = Math.max(1, pageSize || 10);
  const totalPages = Math.ceil(total / safePageSize) || 1;

  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

/**
 * Sends a standard success JSON response
 */
export function sendSuccess<T>(
  c: RequestContext,
  data?: T,
  message?: string,
  statusCode: HttpStatusCode = HttpStatus.OK,
  meta?: Record<string, unknown>
): Response {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    message,
    meta,
    timestamp: new Date().toISOString(),
  };

  return c.json(payload, statusCode);
}

/**
 * Sends a standard paginated JSON response
 */
export function sendPaginated<T>(
  c: RequestContext,
  items: T[],
  pagination: PaginationMeta,
  statusCode: HttpStatusCode = HttpStatus.OK
): Response {
  const payload: PaginatedResponse<T> = {
    success: true,
    data: items,
    pagination,
    timestamp: new Date().toISOString(),
  };

  return c.json(payload, statusCode);
}

/**
 * Sends a standard error JSON response from an ApiError or Error instance
 */
export function sendError(
  c: RequestContext,
  error: unknown,
  overrideStatus?: HttpStatusCode
): Response {
  if (error instanceof ApiError) {
    return c.json(error.toJSON(), overrideStatus ?? error.statusCode);
  }

  const message = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error || ''));
  const status = overrideStatus ?? HttpStatus.INTERNAL_SERVER_ERROR;
  const code: ErrorCodeType = status === 400
    ? ErrorCode.BAD_REQUEST
    : status === 401
    ? ErrorCode.UNAUTHORIZED
    : status === 403
    ? ErrorCode.FORBIDDEN
    : status === 404
    ? ErrorCode.NOT_FOUND
    : status === 409
    ? ErrorCode.CONFLICT
    : status === 429
    ? ErrorCode.RATE_LIMIT_EXCEEDED
    : ErrorCode.INTERNAL_ERROR;

  const payload: ApiResponse = {
    success: false,
    error: {
      code,
      message: message || DefaultErrorMessages[code],
    },
    timestamp: new Date().toISOString(),
  };

  return c.json(payload, status);
}

/**
 * Sends a 204 No Content response
 */
export function sendNoContent(c: RequestContext): Response {
  return new Response(null, { status: HttpStatus.NO_CONTENT });
}
