import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type TableName = keyof import('@/lib/database.types').Database['public']['Tables'];

interface Options {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  filters?: { column: string; value: string | number | boolean }[];
}

/** Hook generique de lecture d'une table Supabase, avec rafraichissement. */
export function useCollection<T = Record<string, unknown>>(table: TableName, options: Options = {}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { select = '*', orderBy, filters } = options;
  const filterKey = JSON.stringify(filters ?? []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from(table).select(select);
    for (const f of filters ?? []) query = query.eq(f.column, f.value);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data: rows, error: err } = await query;
    if (err) setError(err.message);
    setData((rows as T[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, orderBy?.column, orderBy?.ascending, filterKey]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData, setData };
}
