// src/utils/pagination.ts
//
// getAllAppointments/getAllServices/getAllStaff/getAllImages all return
// every row with no way to page through them (H7 in the audit) — fine
// today, but there was no backend contract at all for a frontend page-size
// control to attach to later without a breaking change.
//
// This is intentionally opt-in: a caller that doesn't send `page`/`limit`
// gets back exactly what it always got (the full array), so every existing
// route and test keeps working unchanged. Pass `?page=&limit=` and you get
// a paginated `{ items, total, page, limit }` shape instead.
export interface PageParams {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Returns null when the caller didn't ask for pagination at all (neither
 * `page` nor `limit` present) — the signal to the service method to return
 * its old, unpaginated full-array shape.
 */
export function parsePagination(query: { page?: unknown; limit?: unknown }): PageParams | null {
  if (query.page === undefined && query.limit === undefined) return null;

  const rawPage = parseInt(String(query.page ?? "1"), 10);
  const rawLimit = parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  return { skip: (page - 1) * limit, take: limit, page, limit };
}
