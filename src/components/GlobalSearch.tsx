import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Building2, FolderKanban, GraduationCap, FolderArchive, Mail, ReceiptText, FileText, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, fullName } from '@/lib/utils';

/**
 * Recherche globale (Ctrl+K / ⌘K) : contacts, entreprises, dossiers,
 * formations, documents, e-mails, devis et factures — 5 résultats par type,
 * requêtes ilike en parallèle avec anti-rebond. La RLS s'applique : chacun ne
 * trouve que ce qu'il a le droit de voir.
 */

type Resultat = {
  type: string; id: string; label: string; sub?: string; lien: string;
};

const TYPE_META: Record<string, { label: string; icon: typeof Users }> = {
  contact: { label: 'Contacts', icon: Users },
  entreprise: { label: 'Entreprises', icon: Building2 },
  dossier: { label: 'Dossiers', icon: FolderKanban },
  formation: { label: 'Formations', icon: GraduationCap },
  document: { label: 'Documents', icon: FolderArchive },
  email: { label: 'E-mails', icon: Mail },
  devis: { label: 'Devis', icon: ReceiptText },
  facture: { label: 'Factures', icon: FileText },
};

const esc = (s: string) => s.replace(/[%_,()]/g, ' ').trim();

async function chercher(q: string): Promise<Resultat[]> {
  const t = esc(q);
  if (t.length < 2) return [];
  const like = `%${t}%`;
  const [contacts, entreprises, dossiers, formations, documents, emails, devis, factures] = await Promise.all([
    supabase.from('contacts').select('id, nom, prenom, email, telephone, ville')
      .or(`nom.ilike.${like},prenom.ilike.${like},email.ilike.${like},telephone.ilike.${like}`).limit(5),
    supabase.from('entreprises').select('id, raison_sociale, siret, ville')
      .or(`raison_sociale.ilike.${like},siret.ilike.${like}`).limit(5),
    supabase.from('dossiers').select('id, reference, intitule')
      .or(`reference.ilike.${like},intitule.ilike.${like}`).limit(5),
    supabase.from('formations').select('id, intitule, reference')
      .or(`intitule.ilike.${like},reference.ilike.${like}`).limit(5),
    supabase.from('documents').select('id, titre, categorie')
      .ilike('titre', like).limit(5),
    supabase.from('emails').select('id, sujet, expediteur, direction')
      .or(`sujet.ilike.${like},expediteur.ilike.${like}`).order('created_at', { ascending: false }).limit(5),
    supabase.from('devis').select('id, numero, objet')
      .or(`numero.ilike.${like},objet.ilike.${like}`).limit(5),
    supabase.from('factures').select('id, numero, objet')
      .or(`numero.ilike.${like},objet.ilike.${like}`).limit(5),
  ]);
  const out: Resultat[] = [];
  for (const c of contacts.data ?? []) out.push({ type: 'contact', id: c.id, label: fullName(c.prenom, c.nom), sub: c.email ?? c.telephone ?? c.ville ?? undefined, lien: `/contacts?id=${c.id}` });
  for (const e of entreprises.data ?? []) out.push({ type: 'entreprise', id: e.id, label: e.raison_sociale, sub: e.ville ?? e.siret ?? undefined, lien: '/entreprises' });
  for (const d of dossiers.data ?? []) out.push({ type: 'dossier', id: d.id, label: d.reference, sub: d.intitule, lien: `/dossiers/${d.id}` });
  for (const f of formations.data ?? []) out.push({ type: 'formation', id: f.id, label: f.intitule, sub: f.reference ?? undefined, lien: '/catalogue' });
  for (const d of documents.data ?? []) out.push({ type: 'document', id: d.id, label: d.titre, sub: d.categorie ?? undefined, lien: '/documents' });
  for (const m of emails.data ?? []) out.push({ type: 'email', id: m.id, label: m.sujet ?? '(sans sujet)', sub: m.expediteur ?? undefined, lien: '/messagerie' });
  for (const d of devis.data ?? []) out.push({ type: 'devis', id: d.id, label: d.numero, sub: d.objet ?? undefined, lien: '/devis' });
  for (const f of factures.data ?? []) out.push({ type: 'facture', id: f.id, label: f.numero, sub: f.objet ?? undefined, lien: '/factures' });
  return out;
}

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Resultat[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = ++seq.current;
    if (esc(query).length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await chercher(query);
      if (seq.current === id) { setResults(r); setActive(0); setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  if (!open) return null;

  const aller = (r: Resultat) => { onClose(); navigate(r.lien); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && results[active]) aller(results[active]);
  };

  // Regroupe par type dans l'ordre de TYPE_META, en conservant l'index global
  // (navigation clavier).
  const groupes = Object.keys(TYPE_META)
    .map((type) => ({ type, items: results.map((r, i) => ({ r, i })).filter(({ r }) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Rechercher un contact, une entreprise, un dossier, un devis…"
            className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
          />
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-fg"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto py-1">
          {loading && <p className="px-4 py-3 text-sm text-muted">Recherche…</p>}
          {!loading && esc(query).length >= 2 && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted">Aucun résultat pour « {query} »</p>
          )}
          {!loading && esc(query).length < 2 && (
            <p className="px-4 py-6 text-center text-sm text-muted">Tapez au moins 2 caractères — <kbd className="rounded border border-line px-1">↑↓</kbd> pour naviguer, <kbd className="rounded border border-line px-1">Entrée</kbd> pour ouvrir</p>
          )}
          {groupes.map((g) => {
            const Meta = TYPE_META[g.type];
            return (
              <div key={g.type}>
                <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted/70">{Meta.label}</p>
                {g.items.map(({ r, i }) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => aller(r)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left',
                      i === active ? 'bg-brand-500/10' : 'hover:bg-surface-2',
                    )}
                  >
                    <Meta.icon className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{r.label}</span>
                      {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
