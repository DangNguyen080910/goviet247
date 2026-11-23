export function tripPagination(query = {}) {
  const enabled = query.pageSize != null || query.cursor != null;
  if (!enabled) return null; // Keep released clients complete, without a silent 50/100-row cap.
  const size = Number(query.pageSize || 100);
  if (!Number.isInteger(size) || size < 1 || size > 100 || (query.cursor && (typeof query.cursor !== 'string' || query.cursor.length > 150))) throw Object.assign(new Error('Phân trang không hợp lệ.'),{status:400});
  return {size, args:{take:size+1,...(query.cursor ? {cursor:{id:query.cursor},skip:1} : {})}};
}
export function tripPage(rows, pagination) {
  const hasMore = !!pagination && rows.length > pagination.size;
  const items = hasMore ? rows.slice(0,pagination.size) : rows;
  return {items, hasMore, nextCursor:hasMore ? items.at(-1).id : null};
}
