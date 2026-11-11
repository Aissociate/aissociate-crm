// Connecteurs : relier les outils de l'entreprise à ses agents, le plus simplement possible.
// Le client saisit le minimum et donne son accord ; Aissociate finalise les connexions
// qui demandent une validation des plateformes (Google, Microsoft, Meta, LinkedIn, TikTok).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, Mail, Plug, Server, Trash2, X, AlertTriangle } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { appel } from '../api';
import { Bouton, Chargement, Titre, cx } from '../composants';

type Statut = 'demande' | 'en_cours' | 'connecte' | 'erreur' | 'desactive';
type Connecteur = { id: string; type: string; statut: Statut; infos: Record<string, string>; secret_renseigne: boolean; notes_admin: string; updated_at: string };
type Champ = { nom: string; label: string; aide?: string; type?: 'texte' | 'choix' | 'secret' | 'cases'; options?: string[]; requis?: boolean };
type Def = {
  type: string; nom: string; logo: string; couleur: string; accroche: string; agents: string;
  champs: Champ[]; mode: 'assiste' | 'direct';
};

// Préréglages SMTP des hébergeurs courants : le client choisit, on remplit.
const SMTP_PRESETS: Record<string, { hote: string; port: string; securite: string; imap_hote: string }> = {
  'OVHcloud': { hote: 'ssl0.ovh.net', port: '465', securite: 'SSL/TLS', imap_hote: 'ssl0.ovh.net' },
  'Gandi': { hote: 'mail.gandi.net', port: '465', securite: 'SSL/TLS', imap_hote: 'mail.gandi.net' },
  'IONOS': { hote: 'smtp.ionos.fr', port: '465', securite: 'SSL/TLS', imap_hote: 'imap.ionos.fr' },
  'o2switch': { hote: 'mail.votre-domaine.fr', port: '465', securite: 'SSL/TLS', imap_hote: 'mail.votre-domaine.fr' },
  'Infomaniak': { hote: 'mail.infomaniak.com', port: '465', securite: 'SSL/TLS', imap_hote: 'mail.infomaniak.com' },
  'Orange / SFR / autre': { hote: '', port: '587', securite: 'STARTTLS', imap_hote: '' },
};

const CATALOGUE: Def[] = [
  { type: 'google', nom: 'Google Workspace', logo: 'G', couleur: '#4285F4', mode: 'assiste',
    accroche: 'Gmail, Agenda et Drive', agents: 'Léa prépare vos réponses e-mail et vos rendez-vous, retrouve vos documents.',
    champs: [
      { nom: 'adresse', label: 'Votre adresse Google', aide: 'contact@votre-entreprise.fr', requis: true },
      { nom: 'services', label: 'Services à connecter', type: 'cases', options: ['Gmail', 'Agenda', 'Drive'] },
    ] },
  { type: 'outlook', nom: 'Outlook / Microsoft 365', logo: 'O', couleur: '#0078D4', mode: 'assiste',
    accroche: 'Messagerie et calendrier Microsoft', agents: 'Léa prépare vos réponses et vos invitations.',
    champs: [{ nom: 'adresse', label: 'Votre adresse Microsoft', requis: true }] },
  { type: 'smtp', nom: 'Messagerie sur mesure', logo: '@', couleur: '#525252', mode: 'direct',
    accroche: 'Votre adresse pro chez votre hébergeur (SMTP)', agents: 'Envoi des e-mails préparés par vos agents, depuis votre propre adresse.',
    champs: [
      { nom: 'fournisseur', label: 'Votre hébergeur', type: 'choix', options: Object.keys(SMTP_PRESETS) },
      { nom: 'expediteur', label: 'Adresse d\'envoi', aide: 'contact@votre-entreprise.fr', requis: true },
      { nom: 'nom_affiche', label: 'Nom affiché', aide: 'Boulangerie Martin' },
      { nom: 'utilisateur', label: 'Identifiant de connexion', aide: 'souvent identique à l\'adresse', requis: true },
      { nom: 'mot_de_passe', label: 'Mot de passe de la boîte', type: 'secret', requis: true },
      { nom: 'hote', label: 'Serveur SMTP', requis: true },
      { nom: 'port', label: 'Port', requis: true },
      { nom: 'securite', label: 'Sécurité', type: 'choix', options: ['SSL/TLS', 'STARTTLS'] },
      { nom: 'imap_hote', label: 'Serveur IMAP (lecture, facultatif)' },
    ] },
  { type: 'facebook', nom: 'Facebook', logo: 'f', couleur: '#1877F2', mode: 'assiste',
    accroche: 'Votre page entreprise', agents: 'Hugo prépare et planifie vos publications.',
    champs: [{ nom: 'page', label: 'Adresse de votre page', aide: 'https://facebook.com/votre-page', requis: true }] },
  { type: 'instagram', nom: 'Instagram', logo: 'IG', couleur: '#E1306C', mode: 'assiste',
    accroche: 'Compte professionnel', agents: 'Hugo prépare vos posts, légendes et visuels.',
    champs: [
      { nom: 'compte', label: 'Nom du compte', aide: '@votre-compte', requis: true },
      { nom: 'page_facebook', label: 'Page Facebook reliée (si elle existe)' },
    ] },
  { type: 'linkedin', nom: 'LinkedIn', logo: 'in', couleur: '#0A66C2', mode: 'assiste',
    accroche: 'Page entreprise ou profil', agents: 'Hugo publie votre ligne éditoriale, Sam prépare votre prospection.',
    champs: [
      { nom: 'page', label: 'Adresse de la page ou du profil', aide: 'https://linkedin.com/company/…', requis: true },
      { nom: 'type_compte', label: 'Type', type: 'choix', options: ['Page entreprise', 'Profil personnel'] },
    ] },
  { type: 'tiktok', nom: 'TikTok', logo: '♪', couleur: '#111111', mode: 'assiste',
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

export default function Connecteurs() {
  const { me, gerer } = useStudio();
  const proprietaire = me.user.role === 'proprietaire';
  const [liste, setListe] = useState<Connecteur[] | null>(null);
  const [ouvert, setOuvert] = useState<Def | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try { setListe((await appel<{ connecteurs: Connecteur[] }>('connecteurs')).connecteurs); }
    catch (e) { setErreur(gerer(e)); setListe([]); }
  }, [gerer]);
  useEffect(() => { charger(); }, [charger]);

  const supprimer = async (type: string) => {
    if (!confirm('Retirer ce connecteur ? Vos agents ne pourront plus l\'utiliser.')) return;
    try { setListe((await appel<{ connecteurs: Connecteur[] }>('connecteur_supprimer', { type })).connecteurs); }
    catch (e) { setErreur(gerer(e)); }
  };

  return (
    <>
      <Titre sous="Reliez vos outils : vos agents préparent, vous validez, l'action part depuis vos comptes.">Connecteurs</Titre>
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        <Plug className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
        <p>
          Deux minutes suffisent : indiquez votre compte et donnez votre accord. Pour Google, Microsoft, Facebook, Instagram, LinkedIn
          et TikTok, l'équipe Aissociate finalise la connexion avec vous sous 48 h ouvrées. Aucune action n'est jamais lancée sans votre validation.
        </p>
      </div>
      {erreur && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
      {liste === null ? <Chargement /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOGUE.map((d) => {
            const c = liste.find((x) => x.type === d.type);
            const st = c ? STATUTS[c.statut] : null;
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
                {c?.notes_admin && <p className="mt-2 rounded-lg bg-neutral-50 px-2 py-1.5 text-xs text-neutral-600">Aissociate : {c.notes_admin}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  {st ? (
                    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', st.classe)}><st.Icone className="h-3.5 w-3.5" />{st.label}</span>
                  ) : <span className="text-xs text-neutral-400">{d.mode === 'direct' ? 'Connexion directe' : 'Connexion assistée'}</span>}
                  {proprietaire && (
                    <div className="flex items-center gap-1">
                      {c && <button onClick={() => supprimer(d.type)} aria-label="Retirer" className="p-1.5 text-neutral-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                      <Bouton variante={c ? 'clair' : 'noir'} className="px-3 py-1.5" onClick={() => setOuvert(d)}>{c ? 'Modifier' : 'Connecter'}</Bouton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!proprietaire && <p className="mt-4 text-sm text-neutral-500">Seul le propriétaire de l'espace peut ajouter ou modifier un connecteur.</p>}
      {ouvert && (
        <Formulaire def={ouvert} existant={liste?.find((x) => x.type === ouvert.type) ?? null}
          onClose={() => setOuvert(null)} onSaved={(l) => { setListe(l); setOuvert(null); }} />
      )}
    </>
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

  const choisirPreset = (f: string) => {
    const p = SMTP_PRESETS[f];
    setV((x) => ({ ...x, fournisseur: f, ...(p ? { hote: p.hote, port: p.port, securite: p.securite, imap_hote: p.imap_hote } : {}) }));
  };

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
            {def.type === 'smtp' ? <Mail className="h-5 w-5" /> : def.type === 'mcp' ? <Server className="h-5 w-5" /> : <Plug className="h-5 w-5" />}
            Connecter {def.nom}
          </p>
          <button type="button" onClick={onClose} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        {def.champs.map((c) => (
          <label key={c.nom} className="block">
            <span className="mb-1 block text-sm text-neutral-700">{c.label}{c.requis && <span className="text-orange-600"> *</span>}</span>
            {c.type === 'choix' ? (
              <select className={classe} value={v[c.nom] ?? ''} onChange={(e) => (c.nom === 'fournisseur' ? choisirPreset(e.target.value) : setV({ ...v, [c.nom]: e.target.value }))}>
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
