/**
 * Standard API response helpers.
 * Error format:  { success: false, error: "message", code: "ERROR_CODE" }
 * Success format: { success: true, data: {}, meta?: { page, limit, total } }
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export function success<T>(data: T, meta?: PaginationMeta) {
  return { success: true as const, data, ...(meta ? { meta } : {}) };
}

export function error(message: string, code: string) {
  return { success: false as const, error: message, code };
}

export function paginated<T>(data: T[], meta: PaginationMeta) {
  return { success: true as const, data, meta };
}
