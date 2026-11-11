// Base de connaissances d'un agent (commune à tous les clients du Studio).
// L'agent s'y appuie et cite « titre (référence) » ; le contenu n'est jamais montré au client.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BookOpen, FileUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { extractPdfTextFromFile, isPdf } from '@/lib/pdfText';
import { Badge, Button } from '@/components/ui';

const db = supabase as unknown as SupabaseClient;
type Savoir = { id: string; titre: string; source: string | null; contenu: string; actif: boolean; updated_at: string };
type Brouillon = { id?: string; titre: string; source: string; contenu: string };
const MAX = 60_000;

export default function SavoirsAgent({ agentId, prenom }: { agentId: string; prenom: string }) {
  const [liste, setListe] = useState<Savoir[] | null>(null);
  const [edite, setEdite] = useState<Brouillon | null>(null);
  const [erreur, setErreur] = useState('');
  const [lecture, setLecture] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);

  const charger = useCallback(async () => {
    const { data, error } = await db.from('studio_agent_savoirs').select('*').eq('agent_id', agentId).order('updated_at', { ascending: false });
    if (error) { setErreur(error.message.includes('studio_agent_savoirs') ? 'Migration « studio_savoirs » non appliquée.' : error.message); setListe([]); return; }
    setListe((data ?? []) as Savoir[]);
  }, [agentId]);
  useEffect(() => { charger(); }, [charger]);

  const importer = async (f: File) => {
    setErreur(''); setLecture(true);
    try {
      const texte = isPdf(f.name, f.type) ? await extractPdfTextFromFile(f) : await f.text();
      if (!texte.trim()) throw new Error('Aucun texte lisible (PDF scanné ?).');
      setEdite({ titre: f.name.replace(/\.[^.]+$/, ''), source: f.name, contenu: texte.slice(0, MAX) });
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setLecture(false); if (fichier.current) fichier.current.value = ''; }
  };

  const enregistrer = async () => {
    if (!edite) return;
    setErreur('');
    const ligne = { agent_id: agentId, titre: edite.titre.trim(), source: edite.source.trim() || null, contenu: edite.contenu.slice(0, MAX) };
    if (!ligne.titre || !ligne.contenu.trim()) { setErreur('Titre et contenu requis.'); return; }
    const { error } = edite.id
      ? await db.from('studio_agent_savoirs').update(ligne).eq('id', edite.id)
      : await db.from('studio_agent_savoirs').insert(ligne);
    if (error) { setErreur(error.message); return; }
    setEdite(null); await charger();
  };

  const basculer = async (s: Savoir) => {
    setListe((l) => l?.map((x) => (x.id === s.id ? { ...x, actif: !s.actif } : x)) ?? null);
    const { error } = await db.from('studio_agent_savoirs').update({ actif: !s.actif }).eq('id', s.id);
    if (error) setErreur(error.message);
  };

  const supprimer = async (s: Savoir) => {
    if (!confirm(`Supprimer « ${s.titre} » de la base de ${prenom} ?`)) return;
    const { error } = await db.from('studio_agent_savoirs').delete().eq('id', s.id);
    if (error) setErreur(error.message); else await charger();
  };

  return (
    <div className="space-y-3 rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <BookOpen className="h-4 w-4 text-brand-500" />
        <p className="font-semibold text-fg">Base de connaissances de {prenom}</p>
        <span className="text-xs text-muted">· commune à tous les clients, citée par l'agent</span>
        <div className="ml-auto flex gap-2">
          <input ref={fichier} type="file" accept=".pdf,.txt,.md,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && importer(e.target.files[0])} />
          <Button variant="secondary" onClick={() => fichier.current?.click()} disabled={lecture}>
            <FileUp className="mr-1 inline h-3.5 w-3.5" />{lecture ? 'Lecture…' : 'Importer un fichier'}
          </Button>
          <Button variant="secondary" onClick={() => setEdite({ titre: '', source: '', contenu: '' })}><Plus className="mr-1 inline h-3.5 w-3.5" />Ajouter</Button>
        </div>
      </div>
      <p className="text-xs text-muted">
        L'agent reçoit les passages pertinents pour chaque demande (recherche plein texte, puis les plus récents) et termine sa réponse
        par « Sources : titre (référence) ». Renseignez une référence vérifiable : URL, article de loi, guide officiel, version et date.
      </p>
      {erreur && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}

      {edite && (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3">
          <input className="input" placeholder="Titre (cité par l'agent)" value={edite.titre} onChange={(e) => setEdite({ ...edite, titre: e.target.value })} />
          <input className="input" placeholder="Référence (URL, texte officiel, « Guide AGEFICE 2026 »…)" value={edite.source} onChange={(e) => setEdite({ ...edite, source: e.target.value })} />
          <textarea className="input min-h-[160px] text-xs" placeholder="Contenu de référence" value={edite.contenu} onChange={(e) => setEdite({ ...edite, contenu: e.target.value })} />
          <div className="flex items-center gap-2">
            <Button onClick={enregistrer}>Enregistrer</Button>
            <Button variant="ghost" onClick={() => setEdite(null)}>Annuler</Button>
            <span className="ml-auto text-xs text-muted">{edite.contenu.length.toLocaleString('fr-FR')} / {MAX.toLocaleString('fr-FR')} caractères</span>
          </div>
        </div>
      )}

      {liste === null ? <p className="text-sm text-muted">Chargement…</p> : liste.length === 0 ? (
        <p className="text-sm text-muted">Aucun document : {prenom} s'appuie seulement sur ses consignes et les données de chaque client.</p>
      ) : (
        <ul className="space-y-1.5">
          {liste.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{s.titre}</p>
                <p className="truncate text-xs text-muted">{s.source || 'sans référence'} · {s.contenu.length.toLocaleString('fr-FR')} car. · maj {new Date(s.updated_at).toLocaleDateString('fr-FR')}</p>
              </div>
              {!s.actif && <Badge tone="neutral">désactivé</Badge>}
              <button className="btn-ghost text-xs" onClick={() => basculer(s)}>{s.actif ? 'Désactiver' : 'Activer'}</button>
              <button className="p-1 text-muted hover:text-fg" aria-label="Modifier" onClick={() => setEdite({ id: s.id, titre: s.titre, source: s.source ?? '', contenu: s.contenu })}><Pencil className="h-3.5 w-3.5" /></button>
              <button className="p-1 text-muted hover:text-red-600" aria-label="Supprimer" onClick={() => supprimer(s)}><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
