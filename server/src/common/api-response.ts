/**
 * Standard ApiResponse envelope for all REST JSON outputs
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Standard Pagination Metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Standard Paginated Response envelope
 */
export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  timestamp: string;
}

/**
 * Standard query parameters for paginated list requests
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  offset?: number;
  search?: string;
}

/**
 * Standard query parameters for sorted requests
 */
export interface SortingQuery {
  sortBy?: string;
  order?: 'ASC' | 'DESC' | 'asc' | 'desc';
}

/**
 * Standard query parameters for filtered requests
 */
export interface FilterQuery extends PaginationQuery, SortingQuery {
  status?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}
