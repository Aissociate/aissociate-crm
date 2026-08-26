import { useState } from 'react';
import { DoorOpen, Copy, Check, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { EspaceAcces } from '@/lib/database.types';

/**
 * Bouton « Espace client » de la fiche contact : crée (ou retrouve) le lien
 * tokenisé /espace/:token du contact et le copie dans le presse-papiers.
 * Le client y consulte sessions, devis, factures, documents, questionnaires
 * et signatures — chaque consultation est tracée (Qualiopi).
 */
export default function EspaceClientButton({ contactId }: { contactId: string }) {
  const { session } = useAuth();
  const [state, setState] = useState<'idle' | 'busy' | 'copied' | 'error'>('idle');

  const ouvrir = async () => {
    setState('busy');
    try {
      let { data: acces } = await supabase.from('espace_acces')
        .select('*').eq('contact_id', contactId).maybeSingle();
      if (acces && !acces.actif) {
        await supabase.from('espace_acces').update({ actif: true }).eq('id', acces.id);
      }
      if (!acces) {
        const { data: ins, error } = await supabase.from('espace_acces')
          .insert({ contact_id: contactId, created_by: session?.user.id ?? null })
          .select('*').single();
        if (error) throw error;
        acces = ins as EspaceAcces;
      }
      const url = `${window.location.origin}/espace/${acces.token}`;
      await navigator.clipboard.writeText(url).catch(() => { prompt('Lien de l\'espace client :', url); });
      setState('copied');
      setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2500);
    }
  };

  return (
    <button
      onClick={ouvrir}
      disabled={state === 'busy'}
      className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-brand-600"
      title="Espace client : copier le lien d'accès (sessions, devis, factures, documents, questionnaires)"
    >
      {state === 'copied' ? <Check className="h-4 w-4 text-emerald-500" />
        : state === 'error' ? <Ban className="h-4 w-4 text-red-500" />
        : state === 'busy' ? <Copy className="h-4 w-4 animate-pulse" />
        : <DoorOpen className="h-4 w-4" />}
    </button>
  );
}
