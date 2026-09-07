import { useCallback, useEffect, useRef, useState } from "react";

type Page<T> = { items: T[]; meta: { total: number; totalPages: number } | null };

// Query the server before pagination so older records can also be found.
export function useWalletRecordSearch<T extends { id: string }>(
  fetchPage: (params: Record<string, unknown>) => Promise<Page<T>>,
) {
  const [query, setQueryState] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const queryRef = useRef("");
  const version = useRef(0);
  const page = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async (nextPage: number) => {
    const requestVersion = ++version.current;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await fetchPage({ q: queryRef.current.trim(), page: nextPage, pageSize: 50 });
      if (requestVersion !== version.current) return;
      setItems((current) => nextPage === 1 ? result.items : [
        ...current, ...result.items.filter((row) => !current.some((old) => old.id === row.id)),
      ]);
      page.current = nextPage;
      setTotal(result.meta?.total ?? result.items.length);
      setHasMore(nextPage < (result.meta?.totalPages ?? 1));
    } catch (cause: any) {
      if (requestVersion === version.current) {
        setError(cause?.message || "Chưa tải được kết quả. Vui lòng thử lại.");
      }
      throw cause;
    } finally {
      if (requestVersion === version.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [fetchPage]);

  const refresh = useCallback(() => load(1), [load]);
  const setQuery = useCallback((value: string) => {
    if (value === queryRef.current) return;
    queryRef.current = value;
    version.current += 1;
    busy.current = false;
    page.current = 0;
    setItems([]);
    setTotal(0);
    setHasMore(false);
    setError("");
    setLoading(true);
    setQueryState(value);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh().catch(() => {}); }, 350);
    return () => { clearTimeout(timer); version.current += 1; };
  }, [query, refresh]);

  const loadMore = useCallback(() => {
    if (!busy.current && hasMore) void load(page.current + 1).catch(() => {});
  }, [hasMore, load]);

  return { query, setQuery, items, setItems, loading, error, total, hasMore, refresh, loadMore };
}
