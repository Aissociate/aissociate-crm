import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Recharge des données quand une table change (Supabase Realtime).
 * La table doit figurer dans la publication `supabase_realtime`
 * (migration notifications) ; la RLS s'applique aux événements reçus.
 * Anti-rafale : plusieurs événements rapprochés = un seul rechargement.
 */
export function useRealtimeRefresh(table: string, refresh: () => void) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`rt-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => refreshRef.current(), 400);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [table]);
}
