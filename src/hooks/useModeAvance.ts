import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Mode avancé (« Jarvis ») : interface épurée centrée sur l'assistant IA.
 *
 * Préférence propre à chaque utilisateur (clé suffixée par son id), gardée dans
 * le navigateur : c'est un confort d'affichage, pas une donnée métier. Les
 * composants montés en même temps restent synchronisés via un événement.
 */
const EVENT = 'mode-avance-change';

function cle(userId: string | undefined): string {
  return `mode-avance:${userId ?? 'anonyme'}`;
}

function lire(userId: string | undefined): boolean {
  try { return localStorage.getItem(cle(userId)) === '1'; } catch { return false; }
}

export function useModeAvance(): [boolean, (actif: boolean) => void] {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [actif, setActif] = useState(() => lire(userId));

  useEffect(() => {
    setActif(lire(userId));
    const sync = () => setActif(lire(userId));
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [userId]);

  const changer = useCallback((v: boolean) => {
    try { localStorage.setItem(cle(userId), v ? '1' : '0'); } catch { /* stockage indisponible */ }
    setActif(v);
    window.dispatchEvent(new Event(EVENT));
  }, [userId]);

  return [actif, changer];
}
