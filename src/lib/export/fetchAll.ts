// Supabase returns at most 1 000 rows per request, so exports fetch page by page.

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>, size = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}
