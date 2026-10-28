/**
 * Machine-readable Error Codes for structured API error responses
 */
export const ErrorCode = {
  // Client errors (400)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  MALFORMED_REQUEST: 'MALFORMED_REQUEST',

  // Authentication & Authorization (401, 403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  TENANT_ACCESS_DENIED: 'TENANT_ACCESS_DENIED',

  // Resource errors (404, 409)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  LEAD_NOT_FOUND: 'LEAD_NOT_FOUND',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  PIPELINE_NOT_FOUND: 'PIPELINE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',

  // Limits & Quotas (422, 429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  SCRAPE_LIMIT_EXCEEDED: 'SCRAPE_LIMIT_EXCEEDED',
  STORAGE_LIMIT_EXCEEDED: 'STORAGE_LIMIT_EXCEEDED',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',

  // Server errors (500, 502, 503)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

export const DefaultErrorMessages: Record<ErrorCodeType, string> = {
  [ErrorCode.BAD_REQUEST]: 'The request could not be understood or was missing required parameters.',
  [ErrorCode.VALIDATION_ERROR]: 'Validation failed for the supplied input.',
  [ErrorCode.INVALID_JSON]: 'Invalid JSON payload received.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'A required request field was omitted.',
  [ErrorCode.MALFORMED_REQUEST]: 'The request structure is malformed.',

  [ErrorCode.UNAUTHORIZED]: 'Authentication is required to access this resource.',
  [ErrorCode.INVALID_TOKEN]: 'The authentication token provided is invalid.',
  [ErrorCode.TOKEN_EXPIRED]: 'The authentication token has expired. Please log in again.',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'Your role does not grant sufficient privileges for this operation.',
  [ErrorCode.TENANT_ACCESS_DENIED]: 'You cannot access or modify resources belonging to another organization.',

  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'The specified resource does not exist.',
  [ErrorCode.USER_NOT_FOUND]: 'User account was not found.',
  [ErrorCode.LEAD_NOT_FOUND]: 'Lead entity was not found.',
  [ErrorCode.RECORD_NOT_FOUND]: 'Record entity was not found.',
  [ErrorCode.ORGANIZATION_NOT_FOUND]: 'Organization was not found.',
  [ErrorCode.PIPELINE_NOT_FOUND]: 'Pipeline definition was not found.',
  [ErrorCode.CONFLICT]: 'The request could not be completed due to a conflict with current state.',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'A resource with the specified identifier already exists.',
  [ErrorCode.DUPLICATE_EMAIL]: 'An account with this email address is already registered.',

  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please slow down.',
  [ErrorCode.QUOTA_EXCEEDED]: 'Organization quota limit reached for your current subscription plan.',
  [ErrorCode.SCRAPE_LIMIT_EXCEEDED]: 'Daily scraping limit exceeded for this organization.',
  [ErrorCode.STORAGE_LIMIT_EXCEEDED]: 'Organization record capacity limit reached.',
  [ErrorCode.UNPROCESSABLE_ENTITY]: 'The request was well-formed but could not be processed.',

  [ErrorCode.INTERNAL_ERROR]: 'An unexpected internal error occurred on the server.',
  [ErrorCode.DATABASE_ERROR]: 'A database operation failed unexpectedly.',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'An external upstream service failed to respond.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'The server is temporarily unavailable.',
};
