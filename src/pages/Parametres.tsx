import { useEffect, useState } from 'react';
import { Save, Building2, Mail, Inbox, ShieldAlert, CircleCheck as CheckCircle2, Circle as XCircle, Sparkles, Bot, Newspaper, Linkedin, Megaphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Spinner, Button, Field } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';

type Organisme = {
  nom?: string; qualiopi?: string; email?: string; telephone?: string; adresse?: string;
  code_postal?: string; ville?: string; siret?: string; nda?: string; tva_intra?: string;
  forme_juridique?: string; capital?: string; logo_url?: string; naf?: string; pays?: string;
};
type Smtp = { host?: string; port?: number; secure?: boolean; user?: string; from?: string; password?: string };
type Imap = { host?: string; port?: number; user?: string; password?: string };
type Ai = { provider?: string; model?: string; openrouter_key?: string; plan_prompt?: string };
type Droits = {
  documents?: boolean; contacts?: boolean; dossiers?: boolean; formations?: boolean;
  pipeline?: boolean; entreprises?: boolean; devis?: boolean; agenda?: boolean;
  recrutement?: boolean; leads?: boolean; finances?: boolean; scope?: string;
};
type Chatbot = { prompt_direction?: string; prompt_conseiller?: string; droits?: { conseiller?: Droits; direction?: Droits } };
type Blog = { prompt?: string; themes?: string[]; auto_publish?: boolean; use_web?: boolean; rss_feeds?: string[]; seo_keywords?: string[]; image_model?: string };
type LinkedinCfg = { enabled?: boolean; client_id?: string; client_secret?: string; access_token?: string; org_urn?: string };
type MetaAds = { enabled?: boolean; ad_account_id?: string; access_token?: string; api_version?: string };

// Domaines de contexte de l'assistant IA. `defaut` = accès si la case n'a
// jamais été touchée (aligné sur l'Edge Function chatbot) ; recrutement et
// leads sont réservés à la direction quoi qu'il arrive.
const DROIT_LABELS: { key: keyof Droits; label: string; directionOnly?: boolean; defautConseiller?: boolean }[] = [
  { key: 'documents', label: 'Base documentaire', defautConseiller: true },
  { key: 'contacts', label: 'Contacts', defautConseiller: true },
  { key: 'entreprises', label: 'Entreprises', defautConseiller: true },
  { key: 'pipeline', label: 'Pipeline (opportunités)', defautConseiller: true },
  { key: 'dossiers', label: 'Dossiers', defautConseiller: true },
  { key: 'devis', label: 'Devis', defautConseiller: true },
  { key: 'formations', label: 'Catalogue formations', defautConseiller: true },
  { key: 'agenda', label: 'Sessions & formateurs', defautConseiller: true },
  { key: 'recrutement', label: 'Recrutement', directionOnly: true },
  { key: 'leads', label: 'Leads du site', directionOnly: true },
  { key: 'finances', label: 'Informations financières', defautConseiller: false },
];

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {ok
        ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
      <div>
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}

export default function Parametres() {
  const [organisme, setOrganisme] = useState<Organisme>({});
  const [smtp, setSmtp] = useState<Smtp>({});
  const [imap, setImap] = useState<Imap>({});
  const [ai, setAi] = useState<Ai>({ model: 'anthropic/claude-opus-4.8' });
  const [chatbot, setChatbot] = useState<Chatbot>({});
  const [blog, setBlog] = useState<Blog>({});
  const [linkedin, setLinkedin] = useState<LinkedinCfg>({ enabled: true, client_id: '77bf2p5s6yamdv' });
  const [metaAds, setMetaAds] = useState<MetaAds>({ api_version: 'v21.0' });
  const [blogThemes, setBlogThemes] = useState('');
  const [blogRss, setBlogRss] = useState('');
  const [blogSeo, setBlogSeo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('parametres').select('*').in('cle', ['organisme', 'smtp', 'imap', 'ai', 'chatbot', 'blog', 'linkedin', 'meta_ads']);
      for (const row of data ?? []) {
        if (row.cle === 'organisme') setOrganisme((row.valeur as Organisme) ?? {});
        if (row.cle === 'smtp') setSmtp((row.valeur as Smtp) ?? {});
        if (row.cle === 'imap') setImap({ port: 993, ...((row.valeur as Imap) ?? {}) });
        if (row.cle === 'ai') setAi((row.valeur as Ai) ?? {});
        if (row.cle === 'chatbot') setChatbot((row.valeur as Chatbot) ?? {});
        if (row.cle === 'blog') { const b = (row.valeur as Blog) ?? {}; setBlog(b); setBlogThemes((b.themes ?? []).join('\n')); setBlogRss((b.rss_feeds ?? []).join('\n')); setBlogSeo((b.seo_keywords ?? []).join('\n')); }
        if (row.cle === 'linkedin') setLinkedin({ enabled: true, client_id: '77bf2p5s6yamdv', ...((row.valeur as LinkedinCfg) ?? {}) });
        if (row.cle === 'meta_ads') setMetaAds({ api_version: 'v21.0', ...((row.valeur as MetaAds) ?? {}) });
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (cle: string, valeur: Record<string, unknown>) => {
    setSaving(cle);
    const { error } = await supabase.from('parametres').upsert({ cle, valeur }, { onConflict: 'cle' });
    setSaving(null);
    if (error) { alert(error.message); return; }
    setSavedMsg(cle);
    setTimeout(() => setSavedMsg(null), 2000);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  const smtpOk = !!(smtp.host && smtp.user && smtp.password && smtp.from);
  const imapOk = !!(imap.host && imap.user && imap.password);
  const aiOk = !!ai.openrouter_key;
  const linkedinOk = !!(linkedin.access_token && linkedin.org_urn);
  const metaOk = !!(metaAds.access_token && metaAds.ad_account_id);

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Organisme, messagerie et secrets d'intégration (4.7 / 4.9)" />

      {/* Statut des intégrations / secrets requis */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-brand-600" />
          <h2 className="font-semibold text-fg">Intégrations & secrets requis</h2>
        </div>
        <div className="divide-y divide-line">
          <StatusRow ok={smtpOk} label="SMTP (envoi d'e-mails)"
            detail={smtpOk ? 'Configuré ci-dessous.' : 'Hôte, utilisateur, mot de passe et adresse d\'expédition requis.'} />
          <StatusRow ok={imapOk} label="IMAP (réception d'e-mails)"
            detail={imapOk ? 'Configuré ci-dessous.' : 'Hôte, utilisateur et mot de passe requis.'} />
          <StatusRow ok={aiOk} label="IA — génération de plans (OpenRouter)"
            detail={aiOk ? 'Clé configurée (lue uniquement côté serveur).' : 'Clé OpenRouter requise (secret OPENROUTER_API_KEY ou ci-dessous).'} />
          <StatusRow ok={linkedinOk} label="LinkedIn — partage auto des articles"
            detail={linkedinOk ? 'Access token + URN configurés. Les articles publiés sont postés sur la page entreprise.' : 'Access token OAuth (w_organization_social) + URN de la page requis (ci-dessous).'} />
          <StatusRow ok={metaOk} label="Publicité Meta (Marketing API)"
            detail={metaOk ? 'Compte + token configurés. Performances Ads visibles sur le tableau de bord.' : 'Compte publicitaire (act_…) + access token Meta requis (ci-dessous).'} />
          <StatusRow ok={false} label="Import auto & cron (Supabase Vault)"
            detail="À définir dans Supabase → Vault : secrets project_url et service_role_key (pour pg_cron). Non vérifiable depuis l'app." />
        </div>
        <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">
          Les Edge Functions lisent d'abord les <strong>secrets Supabase</strong> ; à défaut, elles
          utilisent la configuration SMTP/IMAP enregistrée ici. Pour une sécurité maximale, préférez
          les secrets Supabase pour les mots de passe.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LinkedIn — partage auto des articles */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">LinkedIn — partage auto des articles</h2>
          </div>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
              <input type="checkbox" checked={linkedin.enabled ?? true} onChange={(e) => setLinkedin({ ...linkedin, enabled: e.target.checked })} />
              Publier automatiquement chaque article mis en ligne (texte + image)
            </label>
            <Field label="Client ID" hint="Application LinkedIn (public)">
              <input className="input" value={linkedin.client_id ?? ''} onChange={(e) => setLinkedin({ ...linkedin, client_id: e.target.value })} />
            </Field>
            <Field label="Client Secret" hint="Confidentiel — utilisé pour le renouvellement du token">
              <input className="input" type="password" value={linkedin.client_secret ?? ''} onChange={(e) => setLinkedin({ ...linkedin, client_secret: e.target.value })} placeholder="••••••••" />
            </Field>
            <Field label="Access token" required hint="OAuth, scope w_organization_social (produit « Community Management API »)">
              <input className="input" type="password" value={linkedin.access_token ?? ''} onChange={(e) => setLinkedin({ ...linkedin, access_token: e.target.value })} placeholder="Bearer token LinkedIn" />
            </Field>
            <Field label="URN de la page entreprise" required hint="ex. urn:li:organization:123456 (ou juste l'id 123456)">
              <input className="input" value={linkedin.org_urn ?? ''} onChange={(e) => setLinkedin({ ...linkedin, org_urn: e.target.value })} placeholder="urn:li:organization:…" />
            </Field>
            <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
              Le <strong>client_id / secret</strong> seuls ne suffisent pas : il faut un <strong>access token</strong> obtenu via OAuth
              (scope <code>w_organization_social</code>). Pour une sécurité maximale, vous pouvez aussi définir les secrets Supabase
              <code> LINKEDIN_ACCESS_TOKEN</code> et <code>LINKEDIN_ORG_URN</code> (prioritaires sur ce formulaire).
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={() => persist('linkedin', linkedin)} disabled={saving === 'linkedin'}>
                <Save className="h-4 w-4" /> {saving === 'linkedin' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {savedMsg === 'linkedin' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            </div>
          </div>
        </Card>

        {/* Publicité Meta — performances Ads (lecture seule) */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Publicité Meta (Ads)</h2>
          </div>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
              <input type="checkbox" checked={metaAds.enabled ?? false} onChange={(e) => setMetaAds({ ...metaAds, enabled: e.target.checked })} />
              Afficher les performances Meta sur le tableau de bord
            </label>
            <Field label="Compte publicitaire" required hint="ID du compte, ex. act_1234567890 (ou juste 1234567890)">
              <input className="input" value={metaAds.ad_account_id ?? ''} onChange={(e) => setMetaAds({ ...metaAds, ad_account_id: e.target.value })} placeholder="act_…" />
            </Field>
            <Field label="Access token" required hint="Token Meta avec la permission ads_read (System User recommandé)">
              <input className="input" type="password" value={metaAds.access_token ?? ''} onChange={(e) => setMetaAds({ ...metaAds, access_token: e.target.value })} placeholder="••••••••" />
            </Field>
            <Field label="Version de l'API" hint="ex. v21.0">
              <input className="input" value={metaAds.api_version ?? ''} onChange={(e) => setMetaAds({ ...metaAds, api_version: e.target.value })} placeholder="v21.0" />
            </Field>
            <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
              Lecture seule des performances (dépense, impressions, leads…). Le token est lu uniquement
              côté serveur par l'Edge Function <code>meta-ads</code> et n'est jamais exposé au navigateur.
              Pour une sécurité maximale, définissez plutôt le secret Supabase
              <code> META_ACCESS_TOKEN</code> (prioritaire sur ce formulaire).
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={() => persist('meta_ads', metaAds)} disabled={saving === 'meta_ads'}>
                <Save className="h-4 w-4" /> {saving === 'meta_ads' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {savedMsg === 'meta_ads' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            </div>
          </div>
        </Card>

        {/* Organisme */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Organisme de formation</h2>
          </div>
          <div className="space-y-4">
            <Field label="Nom"><input className="input" value={organisme.nom ?? ''} onChange={(e) => setOrganisme({ ...organisme, nom: e.target.value })} /></Field>
            <Field label="N° Qualiopi"><input className="input" value={organisme.qualiopi ?? ''} onChange={(e) => setOrganisme({ ...organisme, qualiopi: e.target.value })} /></Field>
            <Field label="E-mail de contact"><input className="input" value={organisme.email ?? ''} onChange={(e) => setOrganisme({ ...organisme, email: e.target.value })} /></Field>
            <Field label="Téléphone"><input className="input" value={organisme.telephone ?? ''} onChange={(e) => setOrganisme({ ...organisme, telephone: e.target.value })} /></Field>
            <Field label="Adresse"><input className="input" value={organisme.adresse ?? ''} onChange={(e) => setOrganisme({ ...organisme, adresse: e.target.value })} /></Field>
            <Field label="Code postal"><input className="input" value={organisme.code_postal ?? ''} onChange={(e) => setOrganisme({ ...organisme, code_postal: e.target.value })} /></Field>
            <Field label="Ville"><input className="input" value={organisme.ville ?? ''} onChange={(e) => setOrganisme({ ...organisme, ville: e.target.value })} /></Field>
            <Field label="SIRET" hint="Figure sur les devis"><input className="input" value={organisme.siret ?? ''} onChange={(e) => setOrganisme({ ...organisme, siret: e.target.value })} /></Field>
            <Field label="N° déclaration d'activité" hint="Organisme de formation"><input className="input" value={organisme.nda ?? ''} onChange={(e) => setOrganisme({ ...organisme, nda: e.target.value })} /></Field>
            <Field label="Code NAF / APE"><input className="input" value={organisme.naf ?? ''} onChange={(e) => setOrganisme({ ...organisme, naf: e.target.value })} /></Field>
            <Field label="Pays"><input className="input" value={organisme.pays ?? ''} onChange={(e) => setOrganisme({ ...organisme, pays: e.target.value })} placeholder="FRANCE" /></Field>
            <Field label="TVA intracommunautaire" hint="Laisser vide si exonéré"><input className="input" value={organisme.tva_intra ?? ''} onChange={(e) => setOrganisme({ ...organisme, tva_intra: e.target.value })} /></Field>
            <Field label="Forme juridique" hint="ex. SARL, SAS"><input className="input" value={organisme.forme_juridique ?? ''} onChange={(e) => setOrganisme({ ...organisme, forme_juridique: e.target.value })} /></Field>
            <Field label="Capital social"><input className="input" value={organisme.capital ?? ''} onChange={(e) => setOrganisme({ ...organisme, capital: e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Logo" hint="Affiché en en-tête des devis (PNG/JPG)">
                <div className="flex items-center gap-3">
                  <FileUpload bucket="documents" onUploaded={(v) => setOrganisme({ ...organisme, logo_url: v })} label="Téléverser un logo" />
                  {organisme.logo_url && <FileLink bucket="documents" value={organisme.logo_url} onClear={() => setOrganisme({ ...organisme, logo_url: '' })} />}
                </div>
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => persist('organisme', organisme)} disabled={saving === 'organisme'}>
                <Save className="h-4 w-4" /> {saving === 'organisme' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {savedMsg === 'organisme' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            </div>
          </div>
        </Card>

        {/* SMTP */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Serveur SMTP sortant</h2>
          </div>
          <div className="space-y-4">
            <Field label="Hôte SMTP" hint="ex. smtp.gmail.com"><input className="input" value={smtp.host ?? ''} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Port"><input className="input" type="number" value={smtp.port ?? 587} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} /></Field>
              <Field label="Adresse d'expédition"><input className="input" value={smtp.from ?? ''} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} /></Field>
            </div>
            <Field label="Utilisateur"><input className="input" value={smtp.user ?? ''} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} /></Field>
            <Field label="Mot de passe" hint="Stocké chiffré côté Supabase (table protégée admin)"><input className="input" type="password" value={smtp.password ?? ''} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} autoComplete="new-password" /></Field>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={!!smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} /> Connexion sécurisée (TLS/SSL, port 465)
            </label>
            <div className="flex items-center gap-3">
              <Button onClick={() => persist('smtp', smtp)} disabled={saving === 'smtp'}>
                <Save className="h-4 w-4" /> {saving === 'smtp' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {savedMsg === 'smtp' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            </div>
          </div>
        </Card>

        {/* IMAP */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Serveur IMAP (réception)</h2>
          </div>
          <div className="space-y-4">
            <Field label="Hôte IMAP" hint="ex. imap.gmail.com"><input className="input" value={imap.host ?? ''} onChange={(e) => setImap({ ...imap, host: e.target.value })} /></Field>
            <Field label="Port" hint="993 (SSL)"><input className="input" type="number" value={imap.port ?? 993} onChange={(e) => setImap({ ...imap, port: Number(e.target.value) })} /></Field>
            <Field label="Utilisateur"><input className="input" value={imap.user ?? ''} onChange={(e) => setImap({ ...imap, user: e.target.value })} /></Field>
            <Field label="Mot de passe"><input className="input" type="password" value={imap.password ?? ''} onChange={(e) => setImap({ ...imap, password: e.target.value })} autoComplete="new-password" /></Field>
            <div className="flex items-center gap-3">
              <Button onClick={() => persist('imap', imap)} disabled={saving === 'imap'}>
                <Save className="h-4 w-4" /> {saving === 'imap' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {savedMsg === 'imap' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            </div>
          </div>
        </Card>

        {/* IA — génération de plans */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">IA — génération de plans (OpenRouter)</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Modèle" hint="ex. anthropic/claude-opus-4.8">
              <input className="input" value={ai.model ?? ''} onChange={(e) => setAi({ ...ai, model: e.target.value })} />
            </Field>
            <Field label="Clé API OpenRouter" hint="Lue uniquement côté serveur (jamais envoyée au navigateur)">
              <input className="input" type="password" value={ai.openrouter_key ?? ''} onChange={(e) => setAi({ ...ai, openrouter_key: e.target.value })} autoComplete="new-password" placeholder="sk-or-…" />
            </Field>
            <div className="lg:col-span-2">
              <Field label="Prompt de génération (configurable)" hint="Doit demander une réponse JSON {titre, sections:[{titre,contenu}]}">
                <textarea className="input" rows={6} value={ai.plan_prompt ?? ''} onChange={(e) => setAi({ ...ai, plan_prompt: e.target.value })} />
              </Field>
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">
            <strong>Sécurité :</strong> la clé est stockée dans une table à lecture <strong>réservée aux admins</strong> et
            n'est utilisée que par l'Edge Function <code>generate-plan</code> (jamais exposée au navigateur).
            Pour une sécurité maximale, définissez plutôt le secret Supabase <code>OPENROUTER_API_KEY</code> (prioritaire).
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => persist('ai', { provider: 'openrouter', ...ai })} disabled={saving === 'ai'}>
              <Save className="h-4 w-4" /> {saving === 'ai' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {savedMsg === 'ai' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
          </div>
        </Card>

        {/* Chatbot interne — prompts maîtres + droits de contexte */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Assistant IA interne (chatbot)</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Prompt maître — Direction" hint="Périmètre complet (toutes les données)">
              <textarea className="input" rows={6} value={chatbot.prompt_direction ?? ''} onChange={(e) => setChatbot({ ...chatbot, prompt_direction: e.target.value })} />
            </Field>
            <Field label="Prompt maître — Conseiller" hint="Périmètre restreint selon les droits ci-dessous">
              <textarea className="input" rows={6} value={chatbot.prompt_conseiller ?? ''} onChange={(e) => setChatbot({ ...chatbot, prompt_conseiller: e.target.value })} />
            </Field>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-fg">Droits de contexte — Direction</p>
            <p className="mb-3 text-xs text-muted">
              Tout le périmètre est accessible par défaut (portée complète, montants inclus). Décochez un domaine pour l'exclure du contexte de l'assistant.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DROIT_LABELS.map(({ key, label }) => {
                const dir = chatbot.droits?.direction ?? {};
                const checked = dir[key] !== false;
                return (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-fg">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setChatbot({ ...chatbot, droits: { ...chatbot.droits, direction: { ...dir, [key]: e.target.checked } } })}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-fg">Droits de contexte — Conseillers</p>
            <p className="mb-3 text-xs text-muted">
              Données que l'assistant peut consulter pour répondre à un conseiller (recrutement et leads du site restent réservés à la direction).
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DROIT_LABELS.filter((l) => !l.directionOnly).map(({ key, label, defautConseiller }) => {
                const cons = chatbot.droits?.conseiller ?? {};
                const checked = (cons[key] ?? defautConseiller) === true;
                return (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-fg">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setChatbot({ ...chatbot, droits: { ...chatbot.droits, conseiller: { ...cons, [key]: e.target.checked } } })}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={(chatbot.droits?.conseiller?.scope ?? 'assigned') === 'all'}
                onChange={(e) => setChatbot({ ...chatbot, droits: { ...chatbot.droits, conseiller: { ...(chatbot.droits?.conseiller ?? {}), scope: e.target.checked ? 'all' : 'assigned' } } })}
              />
              Accès à <strong>tous</strong> les contacts / dossiers / pipeline / devis (sinon uniquement ceux qui lui sont affectés)
            </label>
          </div>

          <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">
            L'assistant utilise la clé OpenRouter ci-dessus. Les réponses citent les documents sources.
            Déployez l'Edge Function <code>chatbot</code> pour activer l'assistant.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => persist('chatbot', { ...chatbot })} disabled={saving === 'chatbot'}>
              <Save className="h-4 w-4" /> {saving === 'chatbot' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {savedMsg === 'chatbot' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
          </div>
        </Card>

        {/* Blog IA — génération automatique / veille */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Blog IA — génération & veille</h2>
          </div>
          <Field label="Prompt maître" hint="Doit demander une réponse JSON {title, excerpt, content (HTML), category, seo_keywords}">
            <textarea className="input" rows={5} value={blog.prompt ?? ''} onChange={(e) => setBlog({ ...blog, prompt: e.target.value })} />
          </Field>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Thèmes de veille (un par ligne)" hint="Utilisé si aucun flux RSS n'a fourni d'actualité">
              <textarea className="input" rows={6} value={blogThemes} onChange={(e) => setBlogThemes(e.target.value)} />
            </Field>
            <Field label="Flux RSS de veille IA (une URL par ligne)" hint="L'actualité récente sert de base aux articles">
              <textarea className="input font-mono text-xs" rows={6} value={blogRss} onChange={(e) => setBlogRss(e.target.value)} placeholder="https://news.google.com/rss/search?q=intelligence+artificielle&hl=fr" />
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Mots-clés SEO (un par ligne)" hint="Intégrés naturellement dans les articles générés">
              <textarea className="input" rows={3} value={blogSeo} onChange={(e) => setBlogSeo(e.target.value)} />
            </Field>
            <Field label="Modèle d'image (OpenRouter)" hint="Génération auto de l'illustration. Gratuit par défaut ; repli Unsplash si indisponible">
              <input className="input" value={blog.image_model ?? ''} onChange={(e) => setBlog({ ...blog, image_model: e.target.value })} placeholder="google/gemini-2.5-flash-image-preview:free" />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={!!blog.auto_publish} onChange={(e) => setBlog({ ...blog, auto_publish: e.target.checked })} /> Publier automatiquement (sinon brouillon)</label>
            <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={blog.use_web !== false} onChange={(e) => setBlog({ ...blog, use_web: e.target.checked })} /> Recherche web (veille temps réel via modèle « :online »)</label>
          </div>
          <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">Un <strong>cron hebdomadaire</strong> appelle l'Edge Function <code>generate-article</code> (lundi 8h). Génération manuelle possible depuis <strong>Blog › Générer par IA</strong>. Clé IA dans la section ci-dessus.</p>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => persist('blog', { ...blog, themes: blogThemes.split('\n').map((t) => t.trim()).filter(Boolean), rss_feeds: blogRss.split('\n').map((t) => t.trim()).filter(Boolean), seo_keywords: blogSeo.split('\n').map((t) => t.trim()).filter(Boolean) })} disabled={saving === 'blog'}>
              <Save className="h-4 w-4" /> {saving === 'blog' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {savedMsg === 'blog' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}
