// Dossiers de l'espace, partagés par Ressources, Livrables et Créations.
// Le client et ses agents y rangent notes, fichiers, compétences, livrables et visuels.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Folder, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { appel } from './api';
import { cx } from './composants';
import Confirmation from './composants/Confirmation';

export type Dossier = { id: string; parent_id: string | null; nom: string };
/** 'tous' = sans filtre ; null = racine (non classés) ; sinon id du dossier. */
export type Filtre = 'tous' | string | null;
export type QuoiRange = 'ressource' | 'livrable' | 'media';

export function cheminDe(dossiers: Dossier[], id: string | null): string {
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const noms: string[] = [];
  for (let d = id ? parId.get(id) : undefined, n = 0; d && n < 20; d = d.parent_id ? parId.get(d.parent_id) : undefined, n++) noms.unshift(d.nom);
  return noms.join(' / ');
}

export function useDossiers(gerer: (e: unknown) => string) {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [erreur, setErreur] = useState('');
  const charger = useCallback(async () => {
    try { setDossiers((await appel<{ dossiers: Dossier[] }>('dossiers')).dossiers); }
    catch (e) { setErreur(gerer(e)); }
  }, [gerer]);
  useEffect(() => { void charger(); }, [charger]);
  const options = useMemo(() => dossiers.map((d) => ({ id: d.id, chemin: cheminDe(dossiers, d.id) }))
    .sort((a, b) => a.chemin.localeCompare(b.chemin, 'fr')), [dossiers]);
  return { dossiers, options, charger, erreur, setErreur };
}

/** Navigation : fil d'Ariane, sous-dossiers, création, renommage, suppression. */
export function BarreDossiers({ dossiers, filtre, onFiltre, onChange, gerer }: {
  dossiers: Dossier[]; filtre: Filtre; onFiltre: (f: Filtre) => void; onChange: () => void; gerer: (e: unknown) => string;
}) {
  const [nouveau, setNouveau] = useState<string | null>(null);
  const [renomme, setRenomme] = useState<string | null>(null);
  const [suppr, setSuppr] = useState(false);
  const [erreur, setErreur] = useState('');
  const courant = filtre !== 'tous' && filtre !== null ? dossiers.find((d) => d.id === filtre) ?? null : null;
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const fil: Dossier[] = [];
  for (let d = courant; d; d = d.parent_id ? parId.get(d.parent_id) ?? null : null) fil.unshift(d);
  const enfants = dossiers.filter((d) => d.parent_id === (courant?.id ?? null)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  const faire = async (action: string, body: Record<string, unknown>) => {
    setErreur('');
    try { const r = await appel<{ id?: string }>(action, body); onChange(); return r; }
    catch (e) { setErreur(gerer(e)); return null; }
  };
  const creer = async () => {
    if (!nouveau?.trim()) return;
    const r = await faire('dossier_creer', { nom: nouveau, parent_id: courant?.id ?? null });
    if (r) { setNouveau(null); if (r.id) onFiltre(r.id); }
  };
  const renommer = async () => {
    if (!courant || !renomme?.trim()) return;
    if (await faire('dossier_renommer', { id: courant.id, nom: renomme })) setRenomme(null);
  };

  const puce = (actif: boolean) => cx('rounded-full border px-3 py-1 text-xs', actif ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400');
  const champ = 'rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs outline-none focus:border-neutral-900';
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <button onClick={() => onFiltre('tous')} className={puce(filtre === 'tous')}>Tout</button>
        <button onClick={() => onFiltre(null)} className={puce(filtre === null)}>Non classés</button>
        <span className="mx-1 h-4 w-px bg-neutral-200" />
        <Folder className="h-4 w-4 text-neutral-400" />
        {fil.map((d) => (
          <span key={d.id} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
            {renomme !== null && d.id === courant?.id ? (
              <input autoFocus value={renomme} maxLength={80} onChange={(e) => setRenomme(e.target.value)} className={champ}
                onKeyDown={(e) => { if (e.key === 'Enter') void renommer(); if (e.key === 'Escape') setRenomme(null); }} onBlur={() => setRenomme(null)} />
            ) : (
              <button onClick={() => onFiltre(d.id)} className={cx('text-xs', d.id === courant?.id ? 'font-semibold text-neutral-900' : 'text-neutral-500 hover:text-neutral-900')}>{d.nom}</button>
            )}
          </span>
        ))}
        {courant && renomme === null && (
          <>
            <button onClick={() => setRenomme(courant.nom)} aria-label="Renommer le dossier" className="p-1 text-neutral-400 hover:text-neutral-900"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={() => setSuppr(true)} aria-label="Supprimer le dossier" className="p-1 text-neutral-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {enfants.map((d) => (
          <button key={d.id} onClick={() => onFiltre(d.id)} className={cx(puce(false), 'flex items-center gap-1.5')}>
            <Folder className="h-3.5 w-3.5 text-amber-500" />{d.nom}
          </button>
        ))}
        {nouveau !== null ? (
          <input autoFocus value={nouveau} maxLength={80} placeholder={courant ? `Sous-dossier de ${courant.nom}` : 'Nom du dossier'} className={champ}
            onChange={(e) => setNouveau(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void creer(); if (e.key === 'Escape') setNouveau(null); }} onBlur={() => !nouveau.trim() && setNouveau(null)} />
        ) : (
          <button onClick={() => setNouveau('')} className="flex items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:border-neutral-900 hover:text-neutral-900">
            <FolderPlus className="h-3.5 w-3.5" />{courant ? 'Sous-dossier' : 'Nouveau dossier'}
          </button>
        )}
      </div>
      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{erreur}</p>}
      <Confirmation
        ouvert={suppr}
        titre={`Supprimer le dossier « ${courant?.nom ?? ''} » ?`}
        message="Rien n'est supprimé d'autre : son contenu et ses sous-dossiers remontent d'un niveau."
        confirmer={{ label: 'Supprimer le dossier', danger: true, onClick: async () => {
          if (!courant) return;
          const parent = courant.parent_id;
          if (await faire('dossier_supprimer', { id: courant.id })) onFiltre(parent ?? 'tous');
          setSuppr(false);
        } }}
        annuler={{ onClick: () => setSuppr(false) }}
        enCours={false}
      />
    </div>
  );
}

/** Sélecteur « Ranger dans… » d'un élément. */
export function ChoixDossier({ options, valeur, quoi, id, onRange, gerer }: {
  options: { id: string; chemin: string }[]; valeur: string | null; quoi: QuoiRange; id: string;
  onRange: (dossierId: string | null) => void; gerer: (e: unknown) => string;
}) {
  const [envoi, setEnvoi] = useState(false);
  const changer = async (v: string) => {
    const dossierId = v || null;
    setEnvoi(true);
    try { await appel('ranger', { quoi, id, dossier_id: dossierId }); onRange(dossierId); }
    catch (e) { alert(gerer(e)); }
    finally { setEnvoi(false); }
  };
  return (
    <select value={valeur ?? ''} disabled={envoi} onChange={(e) => changer(e.target.value)} onClick={(e) => e.stopPropagation()}
      aria-label="Ranger dans un dossier" title="Ranger dans un dossier"
      className="max-w-[11rem] truncate rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-600 outline-none focus:border-neutral-900">
      <option value="">Non classé</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.chemin}</option>)}
    </select>
  );
}

/** Filtre un élément : 'tous', non classés (null) ou dans le dossier (sous-dossiers compris). */
export function dansFiltre(dossiers: Dossier[], filtre: Filtre, dossierId: string | null | undefined): boolean {
  if (filtre === 'tous') return true;
  if (filtre === null) return !dossierId;
  for (let d = dossierId ? dossiers.find((x) => x.id === dossierId) : undefined, n = 0; d && n < 20; d = d.parent_id ? dossiers.find((x) => x.id === d!.parent_id) : undefined, n++) {
    if (d.id === filtre) return true;
  }
  return false;
}
