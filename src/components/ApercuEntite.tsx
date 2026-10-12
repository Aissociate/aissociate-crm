// Aperçu d'une fiche (contact, dossier, opportunité) dans le panneau latéral du
// mode avancé : l'essentiel pour vérifier une proposition de l'IA sans quitter
// la conversation, et un lien pour ouvrir la fiche complète.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, User, FolderKanban, TrendingUp, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner, Badge } from '@/components/ui';

export type EntiteRef = { type: 'contact' | 'dossier' | 'opportunite'; id: string };

type Ligne = { label: string; valeur: string | null | undefined };
type Apercu = { titre: string; sousTitre?: string | null; statut?: string | null; lignes: Ligne[]; lien: string; actions?: string[] };

const euros = (n: number | null | undefined) =>
  n == null ? null : n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('fr-FR') : null);

async function charger(ref: EntiteRef): Promise<Apercu | null> {
  if (ref.type === 'contact') {
    const [{ data: c }, { data: acts }] = await Promise.all([
      supabase.from('contacts')
        .select('nom, prenom, email, telephone, ville, statut_prospect, formation_envisagee, financement_envisage, besoin_resume')
        .eq('id', ref.id).maybeSingle(),
      supabase.from('contact_actions').select('date_action, type, description')
        .eq('contact_id', ref.id).eq('faite', false).order('date_action', { ascending: true }).limit(3),
    ]);
    if (!c) return null;
    return {
      titre: `${c.prenom ?? ''} ${c.nom}`.trim(),
      sousTitre: c.email ?? c.telephone,
      statut: c.statut_prospect,
      lignes: [
        { label: 'Téléphone', valeur: c.telephone },
        { label: 'Ville', valeur: c.ville },
        { label: 'Formation envisagée', valeur: c.formation_envisagee },
        { label: 'Financement', valeur: c.financement_envisage },
        { label: 'Besoin', valeur: c.besoin_resume },
      ],
      actions: (acts ?? []).map((a) => `${date(a.date_action)} · ${a.type} — ${a.description ?? ''}`),
      lien: `/contacts?id=${ref.id}`,
    };
  }
  if (ref.type === 'dossier') {
    const { data: d } = await supabase.from('dossiers')
      .select('reference, intitule, statut, montant_demande, montant_accorde, date_debut, date_fin')
      .eq('id', ref.id).maybeSingle();
    if (!d) return null;
    return {
      titre: d.reference, sousTitre: d.intitule, statut: d.statut,
      lignes: [
        { label: 'Montant demandé', valeur: euros(d.montant_demande) },
        { label: 'Montant accordé', valeur: euros(d.montant_accorde) },
        { label: 'Début', valeur: date(d.date_debut) },
        { label: 'Fin', valeur: date(d.date_fin) },
      ],
      lien: `/dossiers/${ref.id}`,
    };
  }
  const { data: o } = await supabase.from('opportunites')
    .select('titre, stage, montant, probabilite, date_cloture_prev, contact_id')
    .eq('id', ref.id).maybeSingle();
  if (!o) return null;
  return {
    titre: o.titre, statut: o.stage,
    lignes: [
      { label: 'Montant', valeur: euros(o.montant) },
      { label: 'Probabilité', valeur: o.probabilite != null ? `${o.probabilite} %` : null },
      { label: 'Clôture prévue', valeur: date(o.date_cloture_prev) },
    ],
    lien: o.contact_id ? `/contacts?id=${o.contact_id}` : '/pipeline',
  };
}

const ICONES = { contact: User, dossier: FolderKanban, opportunite: TrendingUp } as const;
const LIBELLES = { contact: 'Contact', dossier: 'Dossier', opportunite: 'Opportunité' } as const;

export default function ApercuEntite({ entite, onFermer }: { entite: EntiteRef; onFermer?: () => void }) {
  const [apercu, setApercu] = useState<Apercu | null | undefined>(undefined);

  useEffect(() => {
    let actif = true;
    setApercu(undefined);
    void charger(entite).then((a) => { if (actif) setApercu(a); });
    return () => { actif = false; };
  }, [entite]);

  const Icone = ICONES[entite.type];
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
          <Icone className="h-3.5 w-3.5" /> {LIBELLES[entite.type]}
        </p>
        {onFermer && (
          <button onClick={onFermer} title="Fermer l'aperçu" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {apercu === undefined && <div className="flex justify-center py-6"><Spinner className="h-5 w-5" /></div>}
      {apercu === null && <p className="text-sm text-muted">Fiche introuvable ou hors de votre périmètre.</p>}
      {apercu && (
        <>
          <p className="font-semibold text-fg">{apercu.titre}</p>
          {apercu.sousTitre && <p className="text-sm text-muted">{apercu.sousTitre}</p>}
          {apercu.statut && <div className="mt-2"><Badge tone="brand">{apercu.statut}</Badge></div>}
          <dl className="mt-3 space-y-1.5 text-sm">
            {apercu.lignes.filter((l) => l.valeur).map((l) => (
              <div key={l.label}>
                <dt className="text-xs text-muted">{l.label}</dt>
                <dd className="break-words text-fg">{l.valeur}</dd>
              </div>
            ))}
          </dl>
          {apercu.actions && apercu.actions.length > 0 && (
            <div className="mt-3 border-t border-line pt-2">
              <p className="mb-1 text-xs text-muted">Prochaines actions</p>
              <ul className="space-y-1 text-sm text-fg">
                {apercu.actions.map((a, i) => <li key={i} className="line-clamp-2">{a}</li>)}
              </ul>
            </div>
          )}
          <Link to={apercu.lien} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
            Ouvrir la fiche <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </div>
  );
}
