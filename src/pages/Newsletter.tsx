import { useState } from 'react';
import { Mail, Sparkles, Eye, Send, Trash2, Loader as Loader2, Users } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { PageHeader, Card, Button, Modal, Table, Spinner, EmptyState, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Newsletter as NL } from '@/lib/database.types';

export default function Newsletter() {
  const { data, loading, refresh } = useCollection<NL>('newsletters', { orderBy: { column: 'created_at', ascending: false } });
  const [generating, setGenerating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<NL | null>(null);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('generate-newsletter', { body: { action: 'generate' } });
      if (error) throw new Error(await functionErrorMessage(error));
      const r = res as { ok?: boolean; skipped?: boolean; reason?: string; articles?: number; statut?: string; sent?: number; total?: number; warning?: string; error?: string };
      if (r?.error) throw new Error(r.error);
      if (r?.skipped) { alert(r.reason ?? 'Aucune actualité à compiler cette semaine.'); return; }
      refresh();
      alert(r?.statut === 'envoye'
        ? `Newsletter générée et envoyée à ${r.sent ?? 0}${r?.total ? ` / ${r.total}` : ''} destinataire(s).${r?.warning ? `\n⚠ Envoi partiel : ${r.warning}` : ''}`
        : `Brouillon de newsletter généré (${r?.articles ?? 0} article(s)). Relisez-le puis envoyez-le.${r?.warning ? `\n⚠ ${r.warning}` : ''}`);
    } catch (err) {
      alert(`Génération indisponible : déployez l'Edge Function « generate-newsletter ». ${err instanceof Error ? err.message : ''}`);
    } finally {
      setGenerating(false);
    }
  };

  const send = async (n: NL) => {
    if (!confirm(`Envoyer « ${n.sujet} » à toute la base de contacts ?`)) return;
    setSendingId(n.id);
    try {
      const { data: res, error } = await supabase.functions.invoke('generate-newsletter', { body: { action: 'send', newsletterId: n.id } });
      if (error) throw new Error(await functionErrorMessage(error));
      const r = res as { ok?: boolean; sent?: number; total?: number; warning?: string; error?: string };
      if (r?.error) throw new Error(r.error);
      refresh();
      alert(`Newsletter envoyée à ${r?.sent ?? 0}${r?.total ? ` / ${r.total}` : ''} destinataire(s).${r?.warning ? `\n⚠ Envoi partiel : ${r.warning}` : ''}`);
    } catch (err) {
      alert(`Envoi impossible : vérifiez la configuration Brevo (Paramètres → Brevo). ${err instanceof Error ? err.message : ''}`);
    } finally {
      setSendingId(null);
    }
  };

  const remove = async (n: NL) => {
    if (!confirm(`Supprimer l'édition « ${n.sujet} » ?`)) return;
    const { error } = await supabase.from('newsletters').delete().eq('id', n.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Newsletter"
        subtitle="Compile l'actualité du blog de la semaine en un e-mail unique envoyé à toute la base"
        actions={<Button onClick={generate} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {generating ? 'Génération…' : 'Générer la newsletter'}</Button>}
      />

      <p className="mb-4 rounded-lg bg-surface-2 p-3 text-xs text-muted">
        Un <strong>cron hebdomadaire</strong> (lundi 9h) génère l'édition. Brouillon par défaut : relisez puis cliquez <strong>Envoyer</strong>.
        Passez en <strong>envoi automatique</strong> dans <strong>Paramètres › Newsletter</strong>. Image d'en-tête générée via Kie.ai (config dans Paramètres › Blog).
      </p>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="Aucune newsletter" message="Cliquez sur « Générer la newsletter » pour créer la première édition à partir des articles récents." />
      ) : (
        <Table head={
          <tr>
            <th className="px-4 py-3">Édition</th>
            <th className="px-4 py-3">Période</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Destinataires</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        }>
          {data.map((n) => (
            <tr key={n.id} className="hover:bg-surface-2">
              <td className="px-4 py-3">
                <span className="flex items-center gap-2 font-medium text-fg"><Mail className="h-4 w-4 text-brand-500" />{n.sujet}</span>
                <span className="text-xs text-muted">Créée le {formatDate(n.created_at)}</span>
              </td>
              <td className="px-4 py-3 text-muted">{n.periode_debut && n.periode_fin ? `${formatDate(n.periode_debut)} → ${formatDate(n.periode_fin)}` : '—'}</td>
              <td className="px-4 py-3">
                {n.statut === 'envoye'
                  ? <Badge tone="success">Envoyée{n.sent_at ? ` · ${formatDate(n.sent_at)}` : ''}</Badge>
                  : <Badge tone="warning">Brouillon</Badge>}
              </td>
              <td className="px-4 py-3 text-muted">{n.statut === 'envoye' ? <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{n.recipients_count}</span> : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button onClick={() => setPreview(n)} className="rounded p-1.5 text-muted hover:text-brand-600" title="Aperçu"><Eye className="h-4 w-4" /></button>
                  {n.statut === 'brouillon' && (
                    <button onClick={() => send(n)} disabled={sendingId === n.id} className="rounded p-1.5 text-muted hover:text-emerald-600" title="Envoyer à toute la base">
                      {sendingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  )}
                  <button onClick={() => remove(n)} className="rounded p-1.5 text-muted hover:text-red-600" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} wide title={preview?.sujet ?? 'Aperçu'}
        footer={<>
          <Button variant="secondary" onClick={() => setPreview(null)}>Fermer</Button>
          {preview?.statut === 'brouillon' && <Button onClick={() => { const p = preview; setPreview(null); if (p) send(p); }}><Send className="h-4 w-4" /> Envoyer à toute la base</Button>}
        </>}>
        {preview && (
          <iframe title="Aperçu newsletter" srcDoc={preview.contenu_html} className="h-[60vh] w-full rounded-lg border border-line bg-white" />
        )}
      </Modal>
    </div>
  );
}
