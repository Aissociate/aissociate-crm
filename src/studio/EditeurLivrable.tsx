// Éditeur d'un livrable, sur place : le texte en zones de saisie, les tableaux en
// grille (cellules, lignes et colonnes modifiables). E-mail et rendez-vous : leurs champs.
// L'enregistrement garde la version précédente et repasse le livrable « à valider ».
import { useState, type ReactNode } from 'react';
import { Code2, Plus, Save, Table2, Trash2, X } from 'lucide-react';
import { appel } from './api';
import { decouper, serialiser, tableauVide, type Bloc, type BlocTableau } from './blocs';
import { Bouton, cx } from './composants';

export type ActionLivrable =
  | { type: 'drive_creer_document'; titre: string; contenu: string }
  | { type: 'gmail_envoyer'; a: string[]; cc?: string[]; objet: string; corps: string }
  | { type: 'agenda_creer'; titre: string; debut: string; fin: string; lieu?: string | null; description?: string | null; participants?: string[] }
  | { type: 'reseaux_publier'; texte: string; comptes: { id: string; reseau: string; nom: string }[]; medias?: string[]; programme?: string | null }
  | { type: 'reseaux_repondre_commentaire'; texte: string; compte: { nom: string }; cite?: string | null }
  | { type: 'reseaux_envoyer_message'; texte: string; compte: { nom: string }; destinataire: string };

/** Champs du formulaire à partir d'un livrable (ou d'une ancienne version). */
export function champsDepuis(titre: string, contenu: string, action: ActionLivrable | null | undefined): Record<string, string> {
  if (action?.type === 'gmail_envoyer') return { a: action.a.join(', '), cc: (action.cc ?? []).join(', '), objet: action.objet, corps: action.corps };
  if (action?.type === 'agenda_creer') {
    return {
      titre: action.titre, debut: action.debut.slice(0, 16), fin: action.fin.slice(0, 16), lieu: action.lieu ?? '',
      participants: (action.participants ?? []).join(', '), description: action.description ?? '',
    };
  }
  if (action?.type === 'reseaux_publier') return { texte: action.texte, medias: (action.medias ?? []).join('\n'), programme: action.programme ?? '' };
  if (action?.type === 'reseaux_repondre_commentaire' || action?.type === 'reseaux_envoyer_message') return { texte: action.texte };
  if (action?.type === 'drive_creer_document') return { titre: action.titre, contenu: action.contenu };
  return { titre, contenu };
}

const champ = 'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900';
const Libelle = ({ texte, children }: { texte: string; children: ReactNode }) => (
  <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">{texte}</span>{children}</label>
);

export default function EditeurLivrable<L>({ id, titre, contenu, action, onSaved, onCancel, gerer }: {
  id: string; titre: string; contenu: string; action?: ActionLivrable | null;
  onSaved: (livrables: L[]) => void; onCancel: () => void; gerer: (e: unknown) => string;
}) {
  const [v, setV] = useState(() => champsDepuis(titre, contenu, action));
  const [blocs, setBlocs] = useState<Bloc[]>(() => decouper(v.contenu ?? ''));
  const [brut, setBrut] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const texteLibre = !action || action.type === 'drive_creer_document';

  const enregistrer = async () => {
    setEnvoi(true); setErreur('');
    try {
      const champs = texteLibre ? { ...v, contenu: brut ? v.contenu : serialiser(blocs) } : v;
      const r = await appel<{ livrables: L[] }>('livrable_modifier', { id, champs });
      onSaved(r.livrables);
    } catch (e) { setErreur(gerer(e)); } finally { setEnvoi(false); }
  };

  const basculerBrut = () => {
    if (brut) setBlocs(decouper(v.contenu ?? ''));
    else setV((x) => ({ ...x, contenu: serialiser(blocs) }));
    setBrut(!brut);
  };
  const majBloc = (k: number, b: Bloc) => setBlocs((l) => l.map((x, i) => (i === k ? b : x)));
  const ajouterTableau = () => setBlocs((l) => [...l, tableauVide(), { type: 'texte', texte: '' }]);

  return (
    <div className="space-y-3">
      {action?.type === 'gmail_envoyer' ? (
        <>
          <Libelle texte="À"><input className={champ} value={v.a} onChange={(e) => setV({ ...v, a: e.target.value })} /></Libelle>
          <Libelle texte="Cc"><input className={champ} value={v.cc} onChange={(e) => setV({ ...v, cc: e.target.value })} /></Libelle>
          <Libelle texte="Objet"><input className={champ} value={v.objet} onChange={(e) => setV({ ...v, objet: e.target.value })} /></Libelle>
          <Libelle texte="Texte de l'e-mail"><TexteAuto value={v.corps} onChange={(t) => setV({ ...v, corps: t })} lignes={12} /></Libelle>
        </>
      ) : action?.type === 'reseaux_publier' ? (
        <>
          <p className="text-xs text-neutral-500">Sur : {action.comptes.map((c) => c.nom).join(', ')}</p>
          <Libelle texte={`Texte de la publication (${(v.texte ?? '').length} caractères)`}><TexteAuto value={v.texte} onChange={(t) => setV({ ...v, texte: t })} lignes={10} /></Libelle>
          <Libelle texte="Images ou vidéos (une adresse https publique par ligne ; obligatoire pour Instagram et TikTok)"><TexteAuto value={v.medias} onChange={(t) => setV({ ...v, medias: t })} lignes={3} mono /></Libelle>
          <Libelle texte="Programmer le (heure de La Réunion ; vide = dès la validation)"><input type="datetime-local" className={champ} value={v.programme} onChange={(e) => setV({ ...v, programme: e.target.value })} /></Libelle>
        </>
      ) : action?.type === 'reseaux_repondre_commentaire' || action?.type === 'reseaux_envoyer_message' ? (
        <>
          <p className="text-xs text-neutral-500">
            {action.type === 'reseaux_envoyer_message' ? `Message privé à ${action.destinataire}, depuis ${action.compte.nom}` : `Réponse publique depuis ${action.compte.nom}${action.cite ? ` à « ${action.cite} »` : ''}`}
          </p>
          <Libelle texte="Texte"><TexteAuto value={v.texte} onChange={(t) => setV({ ...v, texte: t })} lignes={6} /></Libelle>
        </>
      ) : action?.type === 'agenda_creer' ? (
        <>
          <Libelle texte="Titre"><input className={champ} value={v.titre} onChange={(e) => setV({ ...v, titre: e.target.value })} /></Libelle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Libelle texte="Début (heure de La Réunion)"><input type="datetime-local" className={champ} value={v.debut} onChange={(e) => setV({ ...v, debut: e.target.value })} /></Libelle>
            <Libelle texte="Fin"><input type="datetime-local" className={champ} value={v.fin} onChange={(e) => setV({ ...v, fin: e.target.value })} /></Libelle>
          </div>
          <Libelle texte="Lieu"><input className={champ} value={v.lieu} onChange={(e) => setV({ ...v, lieu: e.target.value })} /></Libelle>
          <Libelle texte="Invités (e-mails séparés par des virgules)"><input className={champ} value={v.participants} onChange={(e) => setV({ ...v, participants: e.target.value })} /></Libelle>
          <Libelle texte="Description"><TexteAuto value={v.description} onChange={(t) => setV({ ...v, description: t })} lignes={4} /></Libelle>
        </>
      ) : (
        <>
          <Libelle texte="Titre"><input className={champ} value={v.titre} onChange={(e) => setV({ ...v, titre: e.target.value })} /></Libelle>
          <div className="flex flex-wrap items-center gap-2">
            {!brut && <Bouton variante="clair" className="px-2.5 py-1 text-xs" onClick={ajouterTableau}><Table2 className="h-3.5 w-3.5" /> Ajouter un tableau</Bouton>}
            <button type="button" onClick={basculerBrut} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100">
              <Code2 className="h-3.5 w-3.5" /> {brut ? 'Éditeur visuel' : 'Texte brut (Markdown)'}
            </button>
          </div>
          {brut ? <TexteAuto value={v.contenu} onChange={(t) => setV({ ...v, contenu: t })} lignes={16} mono /> : (
            <div className="space-y-3">
              {blocs.map((b, k) => b.type === 'texte'
                ? <TexteAuto key={k} value={b.texte} onChange={(t) => majBloc(k, { ...b, texte: t })} lignes={Math.min(20, Math.max(3, b.texte.split('\n').length + 1))} />
                : <GrilleTableau key={k} t={b} onChange={(t) => majBloc(k, t)} onSupprimer={() => setBlocs((l) => l.filter((_, i) => i !== k))} />)}
            </div>
          )}
        </>
      )}
      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Bouton onClick={enregistrer} disabled={envoi}><Save className="h-4 w-4" /> {envoi ? 'Enregistrement…' : 'Enregistrer cette version'}</Bouton>
        <Bouton variante="fantome" onClick={onCancel}><X className="h-4 w-4" /> Annuler</Bouton>
        <p className="text-xs text-neutral-500">La version actuelle est conservée ; le livrable repasse « à valider ».</p>
      </div>
    </div>
  );
}

function TexteAuto({ value, onChange, lignes, mono }: { value: string; onChange: (t: string) => void; lignes: number; mono?: boolean }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={lignes}
    className={cx(champ, 'resize-y leading-relaxed', mono && 'font-mono text-xs')} />;
}

/** Tableau éditable : en-têtes, cellules, ajout et suppression de lignes et de colonnes. */
function GrilleTableau({ t, onChange, onSupprimer }: { t: BlocTableau; onChange: (t: BlocTableau) => void; onSupprimer: () => void }) {
  const n = t.entetes.length;
  const cellule = 'w-full min-w-[7rem] bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-orange-50';
  const majCellule = (r: number, c: number, val: string) => onChange({ ...t, lignes: t.lignes.map((l, i) => (i === r ? l.map((x, j) => (j === c ? val : x)) : l)) });
  const ajouterColonne = () => onChange({ ...t, entetes: [...t.entetes, `Colonne ${n + 1}`], alignements: [...t.alignements, ''], lignes: t.lignes.map((l) => [...l, '']) });
  const retirerColonne = (c: number) => n > 1 && onChange({
    ...t, entetes: t.entetes.filter((_, j) => j !== c), alignements: t.alignements.filter((_, j) => j !== c), lignes: t.lignes.map((l) => l.filter((_, j) => j !== c)),
  });
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              {t.entetes.map((h, c) => (
                <th key={c} className="border-b border-r border-neutral-200 p-0 text-left font-semibold">
                  <div className="flex items-center">
                    <input className={cx(cellule, 'font-semibold')} value={h} aria-label={`En-tête de la colonne ${c + 1}`}
                      onChange={(e) => onChange({ ...t, entetes: t.entetes.map((x, j) => (j === c ? e.target.value : x)) })} />
                    {n > 1 && <button type="button" onClick={() => retirerColonne(c)} className="px-1 text-neutral-300 hover:text-red-600" aria-label={`Supprimer la colonne ${c + 1}`}><X className="h-3.5 w-3.5" /></button>}
                  </div>
                </th>
              ))}
              <th className="w-8 border-b border-neutral-200" />
            </tr>
          </thead>
          <tbody>
            {t.lignes.map((l, r) => (
              <tr key={r}>
                {l.map((x, c) => (
                  <td key={c} className="border-b border-r border-neutral-100 p-0">
                    <input className={cellule} value={x} aria-label={`Ligne ${r + 1}, colonne ${c + 1}`} onChange={(e) => majCellule(r, c, e.target.value)} />
                  </td>
                ))}
                <td className="border-b border-neutral-100 text-center">
                  <button type="button" onClick={() => onChange({ ...t, lignes: t.lignes.filter((_, i) => i !== r) })} className="p-1 text-neutral-300 hover:text-red-600" aria-label={`Supprimer la ligne ${r + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-1 p-1.5 text-xs">
        <button type="button" onClick={() => onChange({ ...t, lignes: [...t.lignes, Array(n).fill('')] })} className="flex items-center gap-1 rounded-lg px-2 py-1 text-neutral-600 hover:bg-neutral-100"><Plus className="h-3.5 w-3.5" /> Ligne</button>
        <button type="button" onClick={ajouterColonne} className="flex items-center gap-1 rounded-lg px-2 py-1 text-neutral-600 hover:bg-neutral-100"><Plus className="h-3.5 w-3.5" /> Colonne</button>
        <button type="button" onClick={onSupprimer} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-neutral-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /> Supprimer le tableau</button>
      </div>
    </div>
  );
}
