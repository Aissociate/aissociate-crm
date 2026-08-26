import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/database.types';

/**
 * Cloche de notifications (sidebar) : liste les notifications de l'utilisateur,
 * badge non-lues, temps réel via Supabase Realtime (repli : rechargement à
 * l'ouverture du menu). Générées chaque matin par l'Edge Function
 * `notifications-cron` (relances échues, devis sans réponse, factures échues…).
 */
export default function NotificationBell({ className }: { className?: string }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(30);
    setItems((data as Notification[]) ?? []);
  }, [userId]);

  useEffect(() => {
    void load();
    if (!userId) return;
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const nonLues = items.filter((n) => !n.lu).length;

  const ouvrir = async (n: Notification) => {
    if (!n.lu) {
      setItems((xs) => xs.map((x) => x.id === n.id ? { ...x, lu: true } : x));
      await supabase.from('notifications').update({ lu: true }).eq('id', n.id);
    }
    setOpen(false);
    if (n.lien) navigate(n.lien);
  };

  const toutLire = async () => {
    if (!userId) return;
    setItems((xs) => xs.map((x) => ({ ...x, lu: true })));
    await supabase.from('notifications').update({ lu: true }).eq('user_id', userId).eq('lu', false);
  };

  const TYPE_DOT: Record<string, string> = {
    relance: 'bg-amber-500', devis: 'bg-sky-500', facture: 'bg-red-500', ia: 'bg-brand-500',
  };

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
      >
        <Bell className="h-4 w-4" />
        {nonLues > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-xl border border-line bg-surface shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-semibold text-fg">Notifications</p>
            {nonLues > 0 && (
              <button onClick={toutLire} className="flex items-center gap-1 text-xs text-muted hover:text-brand-600">
                <CheckCheck className="h-3.5 w-3.5" /> Tout marquer lu
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto py-1">
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted">Aucune notification</li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => ouvrir(n)}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-2',
                    !n.lu && 'bg-brand-500/5',
                  )}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TYPE_DOT[n.type] ?? 'bg-muted', n.lu && 'opacity-30')} />
                  <span className="min-w-0">
                    <span className={cn('block truncate text-sm', n.lu ? 'text-muted' : 'font-medium text-fg')}>{n.titre}</span>
                    {n.corps && <span className="block text-xs text-muted line-clamp-2">{n.corps}</span>}
                    <span className="block text-[11px] text-muted/70">{new Date(n.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
