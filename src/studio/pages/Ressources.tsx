import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Plus, Search, ShieldAlert, StickyNote, Trash2, Upload, X } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { appel, type Ressource } from '../api';
import { Bouton, Chargement, Interrupteur, Titre, cx } from '../composants';
import Confirmation from '../composants/Confirmation';
import { FORMATS_DOCUMENTS, extension, extraireTexte } from '../extraction';
import { BarreDossiers, ChoixDossier, dansFiltre, useDossiers, type Filtre } from '../Dossiers';

type Ajout = { id: string; sensible: { type: string; message: string } | null };
const NATURES: Record<NonNullable<Ressource['sensible']>, string> = {
  rib: 'des coordonnées bancaires (RIB / IBAN)', identite: "une pièce d'identité",
  paie: 'un bulletin de paie', securite_sociale: 'un numéro de sécurité sociale',
};

const taille = (o: number | null) => (o == null ? '' : o > 1e6 ? `${(o / 1e6).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1e3))} Ko`);

export default function Ressources() {
  const { gerer, rafraichir } = useStudio();
  const [onglet, setOnglet] = useState<'fichier' | 'note'>('fichier');
  const [liste, setListe] = useState<Ressource[] | null>(null);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState('');
  const [import_, setImport] = useState(false);
  const [note, setNote] = useState<{ titre: string; contenu: string } | null>(null);
  const [suppression, setSuppression] = useState<Ressource | null>(null);
  const [envoiSuppr, setEnvoiSuppr] = useState(false);
  /** Ressources reconnues sensibles au dernier ajout : rangées désactivées, on dit pourquoi. */
  const [avis, setAvis] = useState<string[]>([]);
  const [activation, setActivation] = useState<Ressource | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const dossiers = useDossiers(gerer);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  /** Dossier où ranger ce qu'on ajoute : celui qu'on regarde. */
  const dossierAjout = filtre === 'tous' ? null : filtre;

  const charger = useCallback(async () => {
    try { setListe((await appel<{ ressources: Ressource[] }>('ressources')).ressources); }
    catch (e) { setErreur(gerer(e)); }
  }, [gerer]);
  useEffect(() => { charger(); }, [charger]);

  const visibles = useMemo(() => (liste ?? []).filter((r) => r.type === onglet
    && dansFiltre(dossiers.dossiers, filtre, r.dossier_id)
    && r.titre.toLowerCase().includes(recherche.toLowerCase())), [liste, onglet, recherche, filtre, dossiers.dossiers]);

  const importer = async (fichiers: File[]) => {
    setErreur(''); setAvis([]); setImport(true);
    const echecs: string[] = [], sensibles: string[] = [];
    for (const f of fichiers) {
      try {
        const contenu = await extraireTexte(f);
        const r = await appel<Ajout>('ressource_add', { titre: f.name, contenu, type: 'fichier', format: extension(f.name), taille: f.size, dossier_id: dossierAjout });
        if (r.sensible) sensibles.push(`${f.name} — ${r.sensible.message}`);
      } catch (e) { echecs.push(gerer(e)); }
    }
    if (echecs.length) setErreur(echecs.join(' · '));
    setAvis(sensibles);
    await charger(); rafraichir();
    setImport(false); if (fichier.current) fichier.current.value = '';
  };

  const enregistrerNote = async () => {
    if (!note) return;
    try {
      const r = await appel<Ajout>('ressource_add', { titre: note.titre, contenu: note.contenu, type: 'note', dossier_id: dossierAjout });
      setAvis(r.sensible ? [`${note.titre} — ${r.sensible.message}`] : []);
      setNote(null); await charger(); rafraichir();
    } catch (e) { setErreur(gerer(e)); }
  };

  const basculer = async (r: Ressource, actif: boolean, confirmer = false) => {
    // Une ressource sensible ne s'active qu'après confirmation (le serveur l'exige aussi).
    if (actif && r.sensible && !confirmer) { setActivation(r); return; }
    setListe((l) => l?.map((x) => (x.id === r.id ? { ...x, actif } : x)) ?? null);
    try { await appel('ressource_toggle', { id: r.id, actif, confirmer }); rafraichir(); }
    catch (e) { setErreur(gerer(e)); charger(); }
  };

  const supprimer = (r: Ressource) => setSuppression(r);
  const confirmerSuppression = async () => {
    if (!suppression) return;
    setEnvoiSuppr(true);
    try { await appel('ressource_delete', { id: suppression.id }); await charger(); rafraichir(); }
    catch (e) { setErreur(gerer(e)); }
    finally { setEnvoiSuppr(false); setSuppression(null); }
  };

  return (
    <>
      <Titre sous="Vos agents s'appuient sur les ressources activées pour répondre avec vos vraies informations.">Mes ressources</Titre>

      <div className="mb-5 flex gap-6 border-b border-neutral-200">
        {(['fichier', 'note'] as const).map((o) => (
          <button key={o} onClick={() => setOnglet(o)}
            className={cx('-mb-px border-b-2 pb-2 text-sm', onglet === o ? 'border-neutral-900 font-medium' : 'border-transparent text-neutral-400 hover:text-neutral-700')}>
            {o === 'fichier' ? 'Fichiers' : 'Notes'}
          </button>
        ))}
      </div>

      <BarreDossiers dossiers={dossiers.dossiers} filtre={filtre} onFiltre={setFiltre} gerer={gerer}
        onChange={() => { dossiers.charger(); charger(); }} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-neutral-400" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher dans mes ressources…"
            className="w-full bg-transparent text-sm outline-none" />
        </label>
        {onglet === 'fichier' ? (
          <>
            <input ref={fichier} type="file" multiple accept={FORMATS_DOCUMENTS} className="hidden" onChange={(e) => e.target.files?.length && importer([...e.target.files])} />
            <Bouton onClick={() => fichier.current?.click()} disabled={import_}><Upload className="h-4 w-4" /> {import_ ? 'Lecture…' : 'Importer'}</Bouton>
          </>
        ) : (
          <Bouton onClick={() => setNote({ titre: '', contenu: '' })}><Plus className="h-4 w-4" /> Nouvelle note</Bouton>
        )}
      </div>
      {onglet === 'fichier' && <p className="mb-4 text-xs text-neutral-500">Formats acceptés : PDF, Word, Excel, PowerPoint, OpenDocument, CSV, texte, archive ZIP (15 Mo max). Le texte est extrait dans votre navigateur.</p>}
      {erreur && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
      {avis.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <ul className="min-w-0 flex-1 space-y-1">{avis.map((a) => <li key={a}>{a}</li>)}</ul>
          <button onClick={() => setAvis([])} aria-label="Fermer le message"><X className="h-4 w-4" /></button>
        </div>
      )}

      {note && (
        <div className="mb-4 space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">Nouvelle note</p>
            <button onClick={() => setNote(null)} aria-label="Fermer"><X className="h-4 w-4" /></button>
          </div>
          <input value={note.titre} onChange={(e) => setNote({ ...note, titre: e.target.value })} placeholder="Titre (ex. : Nos tarifs 2026)"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
          <textarea value={note.contenu} onChange={(e) => setNote({ ...note, contenu: e.target.value })} rows={8}
            placeholder="Informations que vos agents doivent connaître…"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
          <Bouton onClick={enregistrerNote} disabled={!note.titre.trim() || !note.contenu.trim()}>Enregistrer</Bouton>
        </div>
      )}

      {liste === null ? <Chargement /> : visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 py-14 text-center text-sm text-neutral-500">
          {filtre !== 'tous' ? "Rien dans ce dossier pour l'instant." : onglet === 'fichier' ? 'Importez votre plaquette, vos offres, votre charte… vos agents les utiliseront.' : 'Ajoutez des notes : tarifs, process, FAQ clients…'}
        </div>
      ) : (
        <div className="space-y-2">
          {visibles.map((r) => (
            <div key={r.id} className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-100 text-[9px] font-semibold uppercase text-neutral-500">
                {r.type === 'note' ? <StickyNote className="h-4 w-4" /> : <><FileText className="h-4 w-4" />{r.format}</>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.titre}</p>
                <p className="text-xs text-neutral-500">
                  {[taille(r.taille), r.format?.toUpperCase()].filter(Boolean).join(' | ') || 'Note'}
                  {r.sensible && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                      <ShieldAlert className="h-3 w-3" /> Sensible{r.actif ? '' : ' · non lue par vos agents'}
                    </span>
                  )}
                </p>
              </div>
              <span className="hidden text-sm text-neutral-500 md:block">{[r.studio_users?.prenom, r.studio_users?.nom].filter(Boolean).join(' ')}</span>
              <span className="hidden w-28 text-right text-sm text-neutral-500 sm:block">{new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <ChoixDossier options={dossiers.options} valeur={r.dossier_id ?? null} quoi="ressource" id={r.id} gerer={gerer}
                onRange={(d) => { setListe((l) => l?.map((x) => (x.id === r.id ? { ...x, dossier_id: d } : x)) ?? null); dossiers.charger(); }} />
              <Interrupteur actif={r.actif} onChange={(v) => basculer(r, v)} label={`Utilisée par les agents : ${r.titre}`} />
              <button onClick={() => supprimer(r)} aria-label="Supprimer" className="p-1 text-neutral-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <Confirmation
        ouvert={suppression !== null}
        titre={`Supprimer « ${suppression?.titre ?? ''} » ?`}
        message="Cette ressource ne sera plus disponible pour vos agents. L'action est immédiate et sans corbeille."
        confirmer={{ label: 'Supprimer', danger: true, onClick: confirmerSuppression }}
        annuler={{ onClick: () => setSuppression(null) }}
        enCours={envoiSuppr}
      />
      <Confirmation
        ouvert={activation !== null}
        titre={`Rendre « ${activation?.titre ?? ''} » lisible par vos agents ?`}
        message={`Ce document semble contenir ${activation?.sensible ? NATURES[activation.sensible] : 'des données sensibles'}. Une fois activé, vos agents peuvent le lire et s'en servir dans ce qu'ils préparent. Vous pourrez le désactiver à tout moment.`}
        confirmer={{ label: 'Activer quand même', danger: true, onClick: async () => { const r = activation; setActivation(null); if (r) await basculer(r, true, true); } }}
        annuler={{ onClick: () => setActivation(null) }}
      />
    </>
  );
}
