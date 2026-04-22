export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export function resolvePagination(query: PaginationQuery) {
  const page = Math.max(query.page ?? 1, 1);
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}
