// Old API responses without a cursor still work. Never return a silent partial list.
export async function readTripPages(readPage) {
  const items = new Map(), seen = new Set();
  let cursor = null;
  do {
    const page = await readPage(cursor);
    if (page?.success !== true || !Array.isArray(page.items)) throw new Error(page?.message || 'Chưa tải được danh sách chuyến. Vui lòng thử lại.');
    for (const item of page.items) items.set(item.id,item);
    cursor = page.nextCursor || null;
    if (cursor && (seen.has(cursor) || seen.size >= 1000)) throw new Error('Danh sách chuyến đã thay đổi. Vui lòng tải lại.');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return [...items.values()];
}
