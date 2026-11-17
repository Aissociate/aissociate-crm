// « Contacts » : les abonnés de l'espace (import CSV, saisie, listes,
// désinscriptions) et l'avancement des mailings validés. Les mailings partent
// du Gmail connecté, un message par contact, avec lien de désinscription.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, Search, Trash2, Upload, UserMinus, UserPlus } from 'lucide-react';
import { appel } from '../api';
import { Bouton, Carte, Chargement, Titre, cx } from '../composants';
import EtatVide from '../composants/EtatVide';
import { lireCsvContacts, type LigneContact } from '../csvContacts';
import { useStudio } from '../StudioApp';

type Contact = { id: string; email: string; prenom: string | null; nom: string | null; listes: string[]; source: string | null; desinscrit_le: string | null; created_at: string };
type Campagne = { id: string; objet: string; liste: string | null; statut: string; date: string; total: number; envoyes: number; echecs: number; en_attente: number };
type Etat = {
  contacts: Contact[]; abonnes: number; desinscrits: number; listes: { nom: string; nombre: number }[];
  campagnes: Campagne[]; plafond_jour: number; import?: { ajoutes: number; deja_presents: number; rejets: number };
};

const champ = 'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm';

export default function Contacts() {
  const { me, gerer } = useStudio();
  const proprio = me.user.role === 'proprietaire';
  const [e, setE] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [recherche, setRecherche] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [mode, setMode] = useState<'import' | 'ajout' | null>(null);
  const [lignes, setLignes] = useState<LigneContact[]>([]);
  const [listes, setListes] = useState('');
  const [consent, setConsent] = useState(false);
  const [unique, setUnique] = useState({ email: '', prenom: '', nom: '' });

  const agir = useCallback(async (action: string, donnees: Record<string, unknown> = {}) => {
    setOccupe(true); setErreur('');
    try { const r = await appel<Etat>(action, { recherche, ...donnees }); setE(r); return r; }
    catch (x) { setErreur(gerer(x)); return null; }
    finally { setOccupe(false); }
  }, [gerer, recherche]);
  useEffect(() => { agir('contacts'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fermer = () => { setMode(null); setLignes([]); setListes(''); setConsent(false); setUnique({ email: '', prenom: '', nom: '' }); };

  const importer = async () => {
    const r = await agir(mode === 'ajout' ? 'contact_ajouter' : 'contacts_importer',
      mode === 'ajout' ? { ...unique, listes, consentement: consent } : { lignes, listes, consentement: consent });
    if (r) {
      if (r.import) setInfo(`${r.import.ajoutes} contact(s) ajouté(s)${r.import.deja_presents ? `, ${r.import.deja_presents} déjà présent(s)` : ''}${r.import.rejets ? `, ${r.import.rejets} ligne(s) ignorée(s) (adresse invalide ou en double)` : ''}.`);
      fermer();
    }
  };

  if (!e) return erreur ? <p className="text-sm text-red-700">{erreur}</p> : <Chargement />;

  return (
    <div className="space-y-6">
      <Titre sous={<>Vos abonnés pour les newsletters et mailings. Vos agents préparent les envois ; rien ne part sans votre validation, depuis votre Gmail connecté (<Link to="/studio/connecteurs" className="underline">Connecteurs</Link>), {e.plafond_jour} e-mails par jour au plus.</>}>
        Contacts
      </Titre>
      {erreur && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{erreur}</p>}
      {info && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{info}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Carte><p className="text-sm text-neutral-500">Abonnés</p><p className="text-2xl font-semibold">{e.abonnes}</p></Carte>
        <Carte><p className="text-sm text-neutral-500">Désinscrits</p><p className="text-2xl font-semibold">{e.desinscrits}</p></Carte>
        <Carte>
          <p className="text-sm text-neutral-500">Listes</p>
          <p className="mt-1 text-sm">{e.listes.length ? e.listes.map((l) => `${l.nom} (${l.nombre})`).join(' · ') : <span className="text-neutral-400">aucune</span>}</p>
        </Carte>
      </div>

      {proprio && (mode ? (
        <Carte>
          <p className="mb-3 font-semibold">{mode === 'import' ? 'Importer un fichier CSV' : 'Ajouter un contact'}</p>
          {mode === 'import' ? (
            <>
              <input type="file" accept=".csv,text/csv,text/plain" className="text-sm"
                onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) setLignes(lireCsvContacts(await f.text())); }} />
              <p className="mt-1 text-xs text-neutral-500">Une colonne « email » (et si possible « prénom », « nom »). Export Excel ou Google Sheets en CSV.</p>
              {lignes.length > 0 && <p className="mt-2 text-sm">{lignes.length} ligne(s) lue(s), par exemple : {lignes.slice(0, 3).map((l) => l.email).join(', ')}</p>}
            </>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <input className={champ} placeholder="E-mail" value={unique.email} onChange={(ev) => setUnique({ ...unique, email: ev.target.value })} />
              <input className={champ} placeholder="Prénom" value={unique.prenom} onChange={(ev) => setUnique({ ...unique, prenom: ev.target.value })} />
              <input className={champ} placeholder="Nom" value={unique.nom} onChange={(ev) => setUnique({ ...unique, nom: ev.target.value })} />
            </div>
          )}
          <input className={cx(champ, 'mt-3')} placeholder="Listes (facultatif, séparées par des virgules) : clients, prospects…" value={listes} onChange={(ev) => setListes(ev.target.value)} />
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} />
            <span>Ces personnes ont accepté de recevoir mes e-mails (clients ou inscrits). Je n'importe pas de fichier acheté ou collecté sans accord.</span>
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Bouton variante="fantome" onClick={fermer}>Annuler</Bouton>
            <Bouton disabled={occupe || !consent || (mode === 'import' ? !lignes.length : !unique.email.trim())} onClick={importer}>
              {occupe && <Loader2 className="h-4 w-4 animate-spin" />} {mode === 'import' ? `Importer ${lignes.length || ''}` : 'Ajouter'}
            </Bouton>
          </div>
        </Carte>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Bouton onClick={() => { setInfo(''); setMode('import'); }}><Upload className="h-4 w-4" /> Importer un CSV</Bouton>
          <Bouton variante="clair" onClick={() => { setInfo(''); setMode('ajout'); }}><UserPlus className="h-4 w-4" /> Ajouter un contact</Bouton>
        </div>
      ))}

      {e.campagnes.length > 0 && (
        <Carte>
          <p className="mb-3 font-semibold">Mailings</p>
          <ul className="divide-y divide-neutral-100">
            {e.campagnes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{c.objet}</span>
                <span className="text-neutral-500">{c.liste ? `liste ${c.liste}` : 'tous'}</span>
                <span className={cx('rounded-full px-2 py-0.5 text-xs', c.statut === 'a_valider' ? 'bg-amber-50 text-amber-800' : c.statut === 'refuse' ? 'bg-red-50 text-red-700' : 'bg-neutral-100 text-neutral-700')}>
                  {c.statut === 'a_valider' ? 'À valider' : c.statut === 'refuse' ? 'Refusé' : c.total ? `${c.envoyes}/${c.total} envoyés${c.en_attente ? `, ${c.en_attente} en attente` : ''}${c.echecs ? `, ${c.echecs} échecs` : ''}` : 'Validé'}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/studio/livrables" className="mt-2 inline-block text-xs font-medium text-orange-600 hover:underline">Valider les mailings en attente</Link>
        </Carte>
      )}

      <div>
        <form className="mb-3 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); agir('contacts'); }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input value={recherche} onChange={(ev) => setRecherche(ev.target.value)} placeholder="Rechercher un contact" className={cx(champ, 'pl-9')} />
          </div>
          <Bouton variante="clair" type="submit">Rechercher</Bouton>
        </form>
        {!e.contacts.length ? (
          <EtatVide icone={<Mail className="h-10 w-10" />} titre="Aucun contact"
            description="Importez vos clients et inscrits (CSV) : vos agents pourront ensuite préparer newsletters et mailings, à valider avant envoi." />
        ) : (
          <Carte className="p-0">
            <ul className="divide-y divide-neutral-100">
              {e.contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className={cx('truncate', c.desinscrit_le && 'text-neutral-400 line-through')}>{[c.prenom, c.nom].filter(Boolean).join(' ') || c.email}</p>
                    <p className="truncate text-xs text-neutral-500">{c.email}{c.listes.length ? ` · ${c.listes.join(', ')}` : ''}{c.desinscrit_le ? ' · désinscrit' : ''}</p>
                  </div>
                  {proprio && !c.desinscrit_le && (
                    <button title="Désinscrire" disabled={occupe} onClick={() => agir('contact_desinscrire', { id: c.id })}
                      className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><UserMinus className="h-4 w-4" /></button>
                  )}
                  {proprio && (
                    <button title="Supprimer (droit à l'effacement)" disabled={occupe}
                      onClick={() => { if (confirm(`Supprimer définitivement ${c.email} ?`)) agir('contact_supprimer', { id: c.id }); }}
                      className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                  )}
                </li>
              ))}
            </ul>
          </Carte>
        )}
        {e.contacts.length >= 300 && <p className="mt-2 text-xs text-neutral-500">300 contacts affichés : utilisez la recherche pour trouver les autres.</p>}
      </div>
    </div>
  );
}
