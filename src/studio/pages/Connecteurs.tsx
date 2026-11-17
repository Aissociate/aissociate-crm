// Connecteurs : relier les outils de l'entreprise à ses agents, le plus simplement possible.
// 1. En un clic (Zernio) : Google, Microsoft, toute messagerie (IMAP), Facebook, Instagram,
//    LinkedIn, TikTok… le client autorise lui-même, le compte est rattaché à son espace.
// 2. Connexion directe : serveur MCP (paramètres saisis, jeton chiffré).
// 3. Sur demande : toute autre application, mise en place par Aissociate.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, Plug, RefreshCw, Server, Trash2, X, AlertTriangle } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { appel } from '../api';
import { Bouton, Chargement, Titre, cx } from '../composants';
import Confirmation from '../composants/Confirmation';
import { ComptesMessagerie, useMessageries, type Quoi } from '../Messageries';
import { ComptesReseau, NOMS_RESEAUX, useReseaux, type Reseau } from '../ReseauxSociaux';

type Statut = 'demande' | 'en_cours' | 'connecte' | 'erreur' | 'desactive';
type Connecteur = { id: string; type: string; statut: Statut; infos: Record<string, string>; secret_renseigne: boolean; notes_admin: string; updated_at: string };
type Champ = { nom: string; label: string; aide?: string; type?: 'texte' | 'choix' | 'secret' | 'cases'; options?: string[]; requis?: boolean };
type Def = {
  type: string; nom: string; logo: string; couleur: string; accroche: string; agents: string;
  champs: Champ[]; mode: 'assiste' | 'direct';
  /** Connexion en un clic via Zernio : messagerie (google, microsoft, email) ou réseau social. */
  zernio?: Quoi | Reseau;
};

const CATALOGUE: Def[] = [
  { type: 'google', nom: 'Google', logo: 'G', couleur: '#4285F4', mode: 'assiste', zernio: 'google',
    accroche: 'Gmail, Agenda et Drive', agents: 'Léa prépare vos réponses e-mail et vos rendez-vous, retrouve vos documents.',
    champs: [
      { nom: 'adresse', label: 'Votre adresse Google', aide: 'contact@votre-entreprise.fr', requis: true },
      { nom: 'services', label: 'Services à connecter', type: 'cases', options: ['Gmail', 'Agenda', 'Drive'] },
    ] },
  { type: 'outlook', nom: 'Microsoft', logo: 'O', couleur: '#0078D4', mode: 'assiste', zernio: 'microsoft',
    accroche: 'Outlook, calendrier et OneDrive', agents: 'Léa prépare vos réponses et vos invitations, retrouve vos documents.',
    champs: [{ nom: 'adresse', label: 'Votre adresse Microsoft', requis: true }] },
  { type: 'messagerie', nom: 'Autre messagerie', logo: '@', couleur: '#525252', mode: 'assiste', zernio: 'email',
    accroche: 'Votre adresse pro chez votre hébergeur', agents: 'Léa lit vos e-mails et prépare vos réponses, envoyées depuis votre adresse.',
    champs: [] },
  { type: 'facebook', nom: 'Facebook', logo: 'f', couleur: '#1877F2', mode: 'assiste', zernio: 'facebook',
    accroche: 'Votre page entreprise', agents: 'Hugo prépare et planifie vos publications.',
    champs: [{ nom: 'page', label: 'Adresse de votre page', aide: 'https://facebook.com/votre-page', requis: true }] },
  { type: 'instagram', nom: 'Instagram', logo: 'IG', couleur: '#E1306C', mode: 'assiste', zernio: 'instagram',
    accroche: 'Compte professionnel', agents: 'Hugo prépare vos posts, légendes et visuels.',
    champs: [
      { nom: 'compte', label: 'Nom du compte', aide: '@votre-compte', requis: true },
      { nom: 'page_facebook', label: 'Page Facebook reliée (si elle existe)' },
    ] },
  { type: 'linkedin', nom: 'LinkedIn', logo: 'in', couleur: '#0A66C2', mode: 'assiste', zernio: 'linkedin',
    accroche: 'Page entreprise ou profil', agents: 'Hugo publie votre ligne éditoriale, Sam prépare votre prospection.',
    champs: [
      { nom: 'page', label: 'Adresse de la page ou du profil', aide: 'https://linkedin.com/company/…', requis: true },
      { nom: 'type_compte', label: 'Type', type: 'choix', options: ['Page entreprise', 'Profil personnel'] },
    ] },
  { type: 'tiktok', nom: 'TikTok', logo: '♪', couleur: '#111111', mode: 'assiste', zernio: 'tiktok',
    accroche: 'Compte TikTok', agents: 'Hugo prépare vos vidéos courtes et leurs descriptions.',
    champs: [{ nom: 'compte', label: 'Nom du compte', aide: '@votre-compte', requis: true }] },
  { type: 'mcp', nom: 'Serveur MCP', logo: 'MCP', couleur: '#7c3aed', mode: 'direct',
    accroche: 'Pour les outils qui proposent un serveur MCP (avancé)', agents: 'Vos agents utilisent les outils exposés par ce serveur.',
    champs: [
      { nom: 'nom', label: 'Nom de l\'outil', aide: 'ex. Notion, HubSpot…', requis: true },
      { nom: 'url', label: 'Adresse du serveur MCP', aide: 'https://…', requis: true },
      { nom: 'jeton', label: 'Jeton d\'accès', type: 'secret', requis: true },
      { nom: 'description', label: 'À quoi sert-il ?' },
    ] },
];

const STATUTS: Record<Statut, { label: string; classe: string; Icone: typeof Clock }> = {
  demande: { label: 'Demande envoyée', classe: 'bg-amber-50 text-amber-700', Icone: Clock },
  en_cours: { label: 'Mise en place', classe: 'bg-sky-50 text-sky-700', Icone: Clock },
  connecte: { label: 'Connecté', classe: 'bg-emerald-50 text-emerald-700', Icone: CheckCircle2 },
  erreur: { label: 'À corriger', classe: 'bg-red-50 text-red-700', Icone: AlertTriangle },
  desactive: { label: 'Désactivé', classe: 'bg-neutral-100 text-neutral-500', Icone: X },
};

const estReseau = (x: string): x is Reseau => x in NOMS_RESEAUX;

export default function Connecteurs() {
  const { me, gerer } = useStudio();
  const proprietaire = me.user.role === 'proprietaire';
  const messageries = useMessageries();
  const reseaux = useReseaux();
  const [liste, setListe] = useState<Connecteur[] | null>(null);
  const [ouvert, setOuvert] = useState<Def | null>(null);
  const [demande, setDemande] = useState(false);
  const [erreur, setErreur] = useState('');
  const [suppression, setSuppression] = useState<{ type: string; nom: string } | null>(null);
  const [envoiSuppr, setEnvoiSuppr] = useState(false);

  const charger = useCallback(async () => {
    try { setListe((await appel<{ connecteurs: Connecteur[] }>('connecteurs')).connecteurs); }
    catch (e) { setErreur(gerer(e)); setListe([]); }
  }, [gerer]);
  useEffect(() => { charger(); }, [charger]);

  const nomDe = (type: string) => CATALOGUE.find((d) => d.type === type)?.nom ?? (type.startsWith('app:') ? liste?.find((c) => c.type === type)?.infos.libelle : null) ?? type;
  const confirmerSuppression = async () => {
    if (!suppression) return;
    setEnvoiSuppr(true);
    try { setListe((await appel<{ connecteurs: Connecteur[] }>('connecteur_supprimer', { type: suppression.type })).connecteurs); }
    catch (e) { setErreur(gerer(e)); }
    finally { setEnvoiSuppr(false); setSuppression(null); }
  };

  const enLigne = Boolean(messageries.etat?.configure);
  // Sans Zernio, les cartes en un clic retombent sur la demande assistée (sauf « Autre messagerie »).
  const cartesUnClic = CATALOGUE.filter((d) => d.zernio && (enLigne || d.type !== 'messagerie'));
  const directes = CATALOGUE.filter((d) => !d.zernio);
  const demandesApps = (liste ?? []).filter((c) => c.type.startsWith('app:'));
  const retour = messageries.retour ?? reseaux.retour;

  const carte = (d: Def) => {
    const c = liste?.find((x) => x.type === d.type);
    const st = c ? STATUTS[c.statut] : null;
    const enUnClic = enLigne && d.zernio;
    return (
      <div key={d.type} className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: d.couleur }}>{d.logo}</span>
          <div className="min-w-0">
            <p className="font-medium">{d.nom}</p>
            <p className="truncate text-xs text-neutral-500">{d.accroche}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-neutral-600">{d.agents}</p>
        {enUnClic ? (
          estReseau(d.zernio!) ? <ComptesReseau reseaux={reseaux} reseau={d.zernio} /> : <ComptesMessagerie m={messageries} quoi={d.zernio as Quoi} />
        ) : (
          <>
            {c?.notes_admin && <p className="mt-2 rounded-lg bg-neutral-50 px-2 py-1.5 text-xs text-neutral-600">Aissociate : {c.notes_admin}</p>}
            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
              {st ? (
                <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', st.classe)}><st.Icone className="h-3.5 w-3.5" />{st.label}</span>
              ) : <span className="text-xs text-neutral-400">{d.mode === 'direct' ? 'Connexion directe' : 'Mise en place par Aissociate'}</span>}
              {proprietaire && (
                <div className="flex items-center gap-1">
                  {c && <button onClick={() => setSuppression({ type: d.type, nom: d.nom })} aria-label="Retirer" className="p-1.5 text-neutral-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  <Bouton variante={c && c.statut !== 'erreur' ? 'clair' : 'noir'} className="px-3 py-1.5" onClick={() => setOuvert(d)}>
                    {c?.statut === 'erreur' ? 'Ressaisir' : c ? 'Modifier' : d.mode === 'direct' ? 'Connecter' : 'Demander'}
                  </Bouton>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Titre sous="Reliez vos outils : vos agents préparent, vous validez, l'action part depuis vos comptes.">Connecteurs</Titre>
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        <Plug className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
        <p>
          Cliquez sur « Connecter » et autorisez l'accès depuis votre compte : la connexion est sécurisée et réservée à votre espace.
          Une application absente de la liste ? Demandez-la plus bas, l'équipe Aissociate la met en place avec vous.
          Aucune action n'est jamais lancée sans votre validation.
        </p>
      </div>
      {(erreur || messageries.erreur || reseaux.erreur) && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur || messageries.erreur || reseaux.erreur}</p>}
      {retour && (
        <p className={cx('mb-4 rounded-xl px-3 py-2 text-sm', retour.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')} role="status">{retour.texte}</p>
      )}

      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Connexion en un clic</h2>
        {enLigne && (
          <button onClick={() => { messageries.charger(); reseaux.charger(); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100" aria-label="Actualiser">
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
        )}
      </div>
      {liste === null || messageries.etat === null || reseaux.etat === null ? <Chargement /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cartesUnClic.map(carte)}</div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold">Connexion directe</h2>
      {liste === null ? <Chargement /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{directes.map(carte)}</div>}
      {!proprietaire && <p className="mt-4 text-sm text-neutral-500">Seul le propriétaire de l'espace peut ajouter ou modifier un connecteur.</p>}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Une autre application ?</h2>
        <p className="mb-3 text-sm text-neutral-500">CRM, comptabilité, caisse, prise de rendez-vous… Dites-nous laquelle : l'équipe Aissociate étudie la connexion avec vous.</p>
        {demandesApps.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {demandesApps.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs">
                {c.infos.libelle ?? c.type.slice(4)} <span className={cx('rounded-full px-1.5', STATUTS[c.statut].classe)}>{STATUTS[c.statut].label}</span>
                {proprietaire && <button onClick={() => setSuppression({ type: c.type, nom: nomDe(c.type) })} aria-label="Retirer la demande" className="text-neutral-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>}
              </span>
            ))}
          </div>
        )}
        {proprietaire && <Bouton variante="clair" onClick={() => setDemande(true)}>Demander une application</Bouton>}
      </section>

      {demande && <DemandeApp onClose={() => setDemande(false)} onSaved={(l) => { setListe(l); setDemande(false); }} />}
      {ouvert && (
        <Formulaire def={ouvert} existant={liste?.find((x) => x.type === ouvert.type) ?? null}
          onClose={() => setOuvert(null)} onSaved={(l) => { setListe(l); setOuvert(null); }} />
      )}

      <Confirmation
        ouvert={suppression !== null}
        titre={`Retirer ${suppression?.nom ?? 'ce connecteur'} ?`}
        message="Vos agents ne pourront plus l'utiliser. La reconnexion est possible à tout moment."
        confirmer={{ label: 'Retirer', danger: true, onClick: confirmerSuppression }}
        annuler={{ onClick: () => setSuppression(null) }}
        enCours={envoiSuppr}
      />
    </>
  );
}

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function DemandeApp({ onClose, onSaved }: { onClose: () => void; onSaved: (l: Connecteur[]) => void }) {
  const { gerer } = useStudio();
  const [nom, setNom] = useState('');
  const [besoin, setBesoin] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!slug(nom)) { setErreur('Indiquez le nom de l\'application.'); return; }
    setEnvoi(true); setErreur('');
    try {
      const r = await appel<{ connecteurs: Connecteur[] }>('connecteur_enregistrer', {
        type: `app:${slug(nom)}`, infos: { libelle: nom.trim(), besoin }, accord: true,
      });
      onSaved(r.connecteurs);
    } catch (err) { setErreur(gerer(err)); } finally { setEnvoi(false); }
  };
  const classe = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:bg-white';
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-10" onClick={onClose}>
      <form onSubmit={envoyer} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Demander une application</p>
          <button type="button" onClick={onClose} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-neutral-700">Application<span className="text-orange-600"> *</span></span>
          <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} required placeholder="ex. HubSpot, Pennylane, Planity…" className={classe} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-neutral-700">Que voulez-vous que vos agents en fassent ? (facultatif)</span>
          <textarea rows={3} value={besoin} onChange={(e) => setBesoin(e.target.value)} maxLength={1000}
            placeholder="ex. retrouver les fiches clients, préparer les relances…" className={classe} />
        </label>
        {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
        <Bouton type="submit" disabled={envoi} className="w-full py-2.5">{envoi ? 'Envoi…' : 'Envoyer la demande'}</Bouton>
      </form>
    </div>
  );
}

function Formulaire({ def, existant, onClose, onSaved }: {
  def: Def; existant: Connecteur | null; onClose: () => void; onSaved: (l: Connecteur[]) => void;
}) {
  const { gerer } = useStudio();
  // Valeurs initiales : saisie précédente, sinon cases toutes cochées.
  const [v, setV] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(def.champs.filter((c) => c.type === 'cases').map((c) => [c.nom, (c.options ?? []).join(', ')])),
    ...(existant?.infos ?? {}),
  }));
  const [secret, setSecret] = useState('');
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const champSecret = def.champs.find((c) => c.type === 'secret');

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(''); setEnvoi(true);
    try {
      const r = await appel<{ connecteurs: Connecteur[] }>('connecteur_enregistrer', {
        type: def.type, infos: v, secret: secret || undefined, accord,
      });
      onSaved(r.connecteurs);
    } catch (err) { setErreur(gerer(err)); } finally { setEnvoi(false); }
  };

  const classe = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:bg-white';
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-10" onClick={onClose}>
      <form onSubmit={soumettre} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-lg font-semibold">
            {def.type === 'mcp' ? <Server className="h-5 w-5" /> : <Plug className="h-5 w-5" />}
            Connecter {def.nom}
          </p>
          <button type="button" onClick={onClose} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        {def.champs.map((c) => (
          <label key={c.nom} className="block">
            <span className="mb-1 block text-sm text-neutral-700">{c.label}{c.requis && <span className="text-orange-600"> *</span>}</span>
            {c.type === 'choix' ? (
              <select className={classe} value={v[c.nom] ?? ''} onChange={(e) => setV({ ...v, [c.nom]: e.target.value })}>
                <option value="">—</option>
                {c.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : c.type === 'cases' ? (
              <div className="flex flex-wrap gap-3 pt-1">
                {c.options?.map((o) => {
                  const sel = (v[c.nom] ?? '').split(', ').filter(Boolean);
                  const coche = sel.includes(o);
                  return (
                    <label key={o} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={coche} onChange={() => setV({ ...v, [c.nom]: (coche ? sel.filter((x) => x !== o) : [...sel, o]).join(', ') })} /> {o}
                    </label>
                  );
                })}
              </div>
            ) : c.type === 'secret' ? (
              <input type="password" className={classe} value={secret} autoComplete="new-password" onChange={(e) => setSecret(e.target.value)}
                placeholder={existant?.secret_renseigne ? '•••••••• (inchangé si vide)' : ''} required={c.requis && !existant?.secret_renseigne} />
            ) : (
              <input className={classe} value={v[c.nom] ?? ''} placeholder={c.aide} required={c.requis} onChange={(e) => setV({ ...v, [c.nom]: e.target.value })} />
            )}
          </label>
        ))}
        {champSecret && <p className="text-xs text-neutral-500">Le {champSecret.label.toLowerCase()} est chiffré dès réception et n'est plus jamais affiché.</p>}
        <label className="flex items-start gap-2 rounded-xl bg-neutral-50 p-3 text-sm">
          <input type="checkbox" className="mt-0.5" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
          <span>J'autorise Aissociate à mettre en place cette connexion pour que mes agents préparent des actions que je valide avant tout envoi ou publication.</span>
        </label>
        {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
        <Bouton type="submit" disabled={!accord || envoi} className="w-full py-2.5">
          {envoi ? 'Enregistrement…' : def.mode === 'direct' ? 'Enregistrer la connexion' : 'Demander la connexion'}
        </Bouton>
      </form>
    </div>
  );
}
