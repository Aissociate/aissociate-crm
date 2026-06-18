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
    // Pagination : PostgREST plafonne une requête (Supabase : 1000 lignes par
    // défaut). On boucle par pages pour charger l'intégralité de la table —
    // sinon, au-delà du plafond, les lignes les plus anciennes (ex. prospects
    // importés avant un gros lot) ne sont jamais récupérées.
    // Robustesse : on avance du nombre réellement reçu et on s'arrête quand une
    // page revient vide, ce qui reste correct même si le plafond serveur est
    // inférieur à PAGE.
    const PAGE = 1000;
    const MAX_ROWS = 100000; // garde-fou anti-boucle
    const all: T[] = [];
    let from = 0;
    for (;;) {
      let query = supabase.from(table).select(select);
      for (const f of filters ?? []) query = query.eq(f.column, f.value);
      if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      const { data: rows, error: err } = await query.range(from, from + PAGE - 1);
      if (err) { setError(err.message); break; }
      const batch = (rows as T[]) ?? [];
      all.push(...batch);
      if (batch.length === 0 || all.length >= MAX_ROWS) break;
      from += batch.length;
    }
    setData(all);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, orderBy?.column, orderBy?.ascending, filterKey]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData, setData };
}
