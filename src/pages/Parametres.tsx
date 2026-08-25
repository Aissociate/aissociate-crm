import { useEffect, useState } from 'react';
import { Save, Building2, Mail, Inbox, ShieldAlert, CircleCheck as CheckCircle2, Circle as XCircle, Sparkles, Bot, Newspaper, Linkedin, Megaphone, Send, MessageSquareText, Plus, Trash2, ListTodo, BadgeCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Card, Spinner, Button, Field } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import { buildSignatureHtml, type SignatureCfg } from '@/lib/signature';
import { TEMPLATE_PLACEHOLDERS, DEFAULT_TEMPLATES, type MessageTemplate } from '@/lib/messageTemplates';
import { functionErrorMessage } from '@/lib/invokeError';

type Organisme = {
  nom?: string; qualiopi?: string; email?: string; telephone?: string; adresse?: string;
  code_postal?: string; ville?: string; siret?: string; nda?: string; tva_intra?: string;
  forme_juridique?: string; capital?: string; logo_url?: string; naf?: string; pays?: string;
};
type Smtp = { host?: string; port?: number; secure?: boolean; user?: string; from?: string; password?: string };
type Imap = { host?: string; port?: number; user?: string; password?: string };
type Ai = { provider?: string; model?: string; model_resume?: string; model_agent?: string; openrouter_key?: string; plan_prompt?: string };
type MailActionsCfg = { enabled?: boolean; resume_ia?: boolean; max_par_passage?: number };
type AgeficeCfg = {
  demande_url?: string; prefet_region?: string;
  responsable_civilite?: string; responsable_nom?: string; responsable_prenom?: string;
  responsable_qualite?: string; responsable_tel?: string; responsable_email?: string;
};
type Droits = {
  documents?: boolean; contacts?: boolean; dossiers?: boolean; formations?: boolean;
  pipeline?: boolean; entreprises?: boolean; devis?: boolean; agenda?: boolean;
  recrutement?: boolean; leads?: boolean; finances?: boolean; scope?: string;
};
type Chatbot = { prompt_direction?: string; prompt_conseiller?: string; droits?: { conseiller?: Droits; direction?: Droits } };
type Blog = {
  prompt?: string; themes?: string[]; auto_publish?: boolean; use_web?: boolean;
  rss_feeds?: string[]; seo_keywords?: string[]; image_model?: string;
  image_provider?: 'openrouter' | 'kie'; kie_api_key?: string;
  kie_quality?: 'basic' | 'high'; kie_aspect_ratio?: string;
};

const KIE_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '21:9'];
type LinkedinCfg = { enabled?: boolean; client_id?: string; client_secret?: string; access_token?: string; org_urn?: string };
type MetaAds = { enabled?: boolean; ad_account_id?: string; access_token?: string; api_version?: string };
type NewsletterCfg = { auto_send?: boolean; rgpd_only?: boolean; sender_name?: string; intro?: string };
type BrevoCfg = { api_key?: string; sender_email?: string; sender_name?: string; daily_limit?: number };
// SignatureCfg importé depuis @/lib/signature

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
  // Actions créées automatiquement à la réception d'un mail (ticket Benjamin).
  const [mailActions, setMailActions] = useState<MailActionsCfg>({ enabled: true, resume_ia: true, max_par_passage: 10 });
  // Informations reprises dans les documents AGEFICE générés depuis un plan.
  const [agefice, setAgefice] = useState<AgeficeCfg>({});
  const [chatbot, setChatbot] = useState<Chatbot>({});
  const [blog, setBlog] = useState<Blog>({});
  const [linkedin, setLinkedin] = useState<LinkedinCfg>({ enabled: true, client_id: '77bf2p5s6yamdv' });
  const [metaAds, setMetaAds] = useState<MetaAds>({ api_version: 'v21.0' });
  const [newsletter, setNewsletter] = useState<NewsletterCfg>({ rgpd_only: true, sender_name: 'Aissociate' });
  const [brevo, setBrevo] = useState<BrevoCfg>({ sender_name: 'Aissociate' });
  const [brevoTest, setBrevoTest] = useState<{ loading: boolean; ok?: boolean; text?: string }>({ loading: false });
  const [signature, setSignature] = useState<SignatureCfg>({ mode: 'auto', include_sender: true });
  const [templates, setTemplates] = useState<MessageTemplate[]>(DEFAULT_TEMPLATES);
  const { profile } = useAuth();
  const [blogThemes, setBlogThemes] = useState('');
  const [blogRss, setBlogRss] = useState('');
  const [blogSeo, setBlogSeo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('parametres').select('*').in('cle', ['organisme', 'smtp', 'imap', 'ai', 'mail_actions', 'agefice', 'chatbot', 'blog', 'linkedin', 'meta_ads', 'newsletter', 'email_signature', 'brevo', 'message_templates']);
      for (const row of data ?? []) {
        if (row.cle === 'organisme') setOrganisme((row.valeur as Organisme) ?? {});
        if (row.cle === 'smtp') setSmtp((row.valeur as Smtp) ?? {});
        if (row.cle === 'imap') setImap({ port: 993, ...((row.valeur as Imap) ?? {}) });
        if (row.cle === 'ai') setAi((row.valeur as Ai) ?? {});
        if (row.cle === 'mail_actions') setMailActions({ enabled: true, resume_ia: true, max_par_passage: 10, ...((row.valeur as MailActionsCfg) ?? {}) });
        if (row.cle === 'agefice') setAgefice((row.valeur as AgeficeCfg) ?? {});
        if (row.cle === 'chatbot') setChatbot((row.valeur as Chatbot) ?? {});
        if (row.cle === 'blog') { const b = (row.valeur as Blog) ?? {}; setBlog(b); setBlogThemes((b.themes ?? []).join('\n')); setBlogRss((b.rss_feeds ?? []).join('\n')); setBlogSeo((b.seo_keywords ?? []).join('\n')); }
        if (row.cle === 'linkedin') setLinkedin({ enabled: true, client_id: '77bf2p5s6yamdv', ...((row.valeur as LinkedinCfg) ?? {}) });
        if (row.cle === 'meta_ads') setMetaAds({ api_version: 'v21.0', ...((row.valeur as MetaAds) ?? {}) });
        if (row.cle === 'newsletter') setNewsletter({ rgpd_only: true, sender_name: 'Aissociate', ...((row.valeur as NewsletterCfg) ?? {}) });
        if (row.cle === 'brevo') setBrevo({ sender_name: 'Aissociate', ...((row.valeur as BrevoCfg) ?? {}) });
        if (row.cle === 'email_signature') setSignature({ mode: 'auto', include_sender: true, ...((row.valeur as SignatureCfg) ?? {}) });
        if (row.cle === 'message_templates') { const items = ((row.valeur as { items?: MessageTemplate[] }) ?? {}).items ?? []; if (items.length) setTemplates(items); }
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

  // ── Modèles de messages (réponses rapides) ──
  const addTemplate = () => setTemplates((t) => [...t, { id: crypto.randomUUID(), nom: '', canal: 'email', sujet: '', corps: '' }]);
  const updateTemplate = (id: string, patch: Partial<MessageTemplate>) => setTemplates((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeTemplate = (id: string) => setTemplates((t) => t.filter((x) => x.id !== id));
  const saveTemplates = () => persist('message_templates', {
    items: templates
      .filter((t) => t.nom.trim() && t.corps.trim())
      .map((t) => ({ ...t, nom: t.nom.trim(), sujet: t.canal === 'whatsapp' ? undefined : (t.sujet?.trim() || undefined) })),
  });

  // Teste la connexion Brevo (clé valide + expéditeur vérifié), côté serveur.
  const testBrevo = async () => {
    setBrevoTest({ loading: true });
    try {
      const { data, error } = await supabase.functions.invoke('generate-newsletter', {
        body: { action: 'test', api_key: brevo.api_key, sender_email: brevo.sender_email },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      const r = data as { ok?: boolean; account?: string; senderEmail?: string; senderOk?: boolean | null; error?: string };
      if (r?.error) throw new Error(r.error);
      const sOk = r.senderOk; // true = vérifié · false = absent/inactif · null = non vérifiable
      const sender = r.senderEmail
        ? (sOk === true ? ` · expéditeur « ${r.senderEmail} » vérifié ✓`
          : sOk === false ? ` · ⚠ expéditeur « ${r.senderEmail} » NON vérifié dans Brevo (l'envoi échouera)`
          : ` · expéditeur « ${r.senderEmail} » : vérification indisponible`)
        : '';
      setBrevoTest({ loading: false, ok: sOk !== false, text: `Connexion OK${r.account ? ` (compte ${r.account})` : ''}${sender}` });
    } catch (err) {
      setBrevoTest({ loading: false, ok: false, text: err instanceof Error ? err.message : String(err) });
    }
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

        {/* Signature e-mail */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Signature des e-mails</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted">Ajoutée automatiquement au bas des e-mails envoyés depuis la Messagerie.</p>
            <Field label="Mode">
              <select className="input" value={signature.mode ?? 'auto'} onChange={(e) => setSignature({ ...signature, mode: e.target.value as SignatureCfg['mode'] })}>
                <option value="auto">Automatique (coordonnées + logo de l'organisme)</option>
                <option value="custom">Personnalisée (HTML libre)</option>
              </select>
            </Field>
            {signature.mode === 'custom' ? (
              <Field label="Signature HTML" hint="Code HTML inséré tel quel">
                <textarea className="input min-h-[120px] font-mono text-xs" value={signature.html ?? ''} onChange={(e) => setSignature({ ...signature, html: e.target.value })} placeholder="<div>…</div>" />
              </Field>
            ) : (
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={signature.include_sender !== false} onChange={(e) => setSignature({ ...signature, include_sender: e.target.checked })} />
                Préfixer avec le nom et les coordonnées de l'expéditeur
              </label>
            )}
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Aperçu</p>
              <div className="rounded-lg border border-line bg-white p-3 text-slate-800"
                dangerouslySetInnerHTML={{ __html: buildSignatureHtml(signature, organisme, profile) || '<span style="color:#94a3b8">Aucune signature (renseignez l\'organisme).</span>' }} />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => persist('email_signature', signature)} disabled={saving === 'email_signature'}>
                <Save className="h-4 w-4" /> {saving === 'email_signature' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {savedMsg === 'email_signature' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            </div>
          </div>
        </Card>

        {/* Signatures propres à chaque utilisateur */}
        <UserSignaturesCard />

        {/* Modèles de messages — réponses rapides (e-mail / WhatsApp) */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Modèles de messages (réponses rapides)</h2>
          </div>
          <p className="text-sm text-muted">
            Messages prédéfinis proposés à l'envoi depuis la <strong>Messagerie</strong> et la <strong>fiche contact</strong>.
            Insérez des variables qui seront remplacées automatiquement :
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TEMPLATE_PLACEHOLDERS.map((p) => (
              <span key={p.token} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted" title={p.label}>
                <code className="text-brand-600 dark:text-brand-400">{p.token}</code> {p.label}
              </span>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {templates.length === 0 && (
              <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">
                Aucun modèle. Cliquez sur « Ajouter un modèle » pour créer votre première réponse rapide.
              </p>
            )}
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border border-line bg-surface-2/40 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                  <Field label="Nom du modèle">
                    <input className="input" value={t.nom} onChange={(e) => updateTemplate(t.id, { nom: e.target.value })} placeholder="ex. Relance devis" />
                  </Field>
                  <Field label="Canal">
                    <select className="input" value={t.canal} onChange={(e) => updateTemplate(t.id, { canal: e.target.value as MessageTemplate['canal'] })}>
                      <option value="email">E-mail</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="both">E-mail &amp; WhatsApp</option>
                    </select>
                  </Field>
                  <button onClick={() => removeTemplate(t.id)} title="Supprimer ce modèle"
                    className="mb-1 inline-flex h-9 w-9 items-center justify-center self-end rounded-lg border border-line text-muted transition hover:border-red-300 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {t.canal !== 'whatsapp' && (
                  <div className="mt-3">
                    <Field label="Objet (e-mail)">
                      <input className="input" value={t.sujet ?? ''} onChange={(e) => updateTemplate(t.id, { sujet: e.target.value })} placeholder="ex. Votre devis de formation" />
                    </Field>
                  </div>
                )}
                <div className="mt-3">
                  <Field label="Message">
                    <textarea className="input" rows={4} value={t.corps} onChange={(e) => updateTemplate(t.id, { corps: e.target.value })}
                      placeholder={"Bonjour {{prenom}},\n\n…\n\nCordialement,\n{{conseiller}}"} />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={addTemplate}><Plus className="h-4 w-4" /> Ajouter un modèle</Button>
            <Button onClick={saveTemplates} disabled={saving === 'message_templates'}>
              <Save className="h-4 w-4" /> {saving === 'message_templates' ? 'Enregistrement…' : 'Enregistrer les modèles'}
            </Button>
            {savedMsg === 'message_templates' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
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
            <Field label="Modèle de l'assistant (agent)" hint="Doit gérer le tool calling de façon fiable — défaut : anthropic/claude-sonnet-4.5">
              <input className="input" value={ai.model_agent ?? ''} onChange={(e) => setAi({ ...ai, model_agent: e.target.value })} placeholder="anthropic/claude-sonnet-4.5" />
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

        {/* AGEFICE — données reprises dans les documents officiels */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">AGEFICE — documents de financement</h2>
          </div>
          <p className="mb-4 text-sm text-muted">
            Renseignées une fois, ces informations alimentent automatiquement la demande préalable de
            financement, la convention, la feuille d'émargement et l'attestation d'assiduité, générées
            depuis un plan de formation. Le reste provient du contact, de l'entreprise, du plan et du devis.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Field label="Civilité du représentant légal">
              <select className="input" value={agefice.responsable_civilite ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_civilite: e.target.value })}>
                <option value="">—</option><option value="M.">M.</option><option value="Mme">Mme</option>
              </select>
            </Field>
            <Field label="Prénom du représentant légal">
              <input className="input" value={agefice.responsable_prenom ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_prenom: e.target.value })} />
            </Field>
            <Field label="Nom du représentant légal">
              <input className="input" value={agefice.responsable_nom ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_nom: e.target.value })} />
            </Field>
            <Field label="Qualité" hint="ex. Gérant, Président — figure sur l'attestation d'assiduité">
              <input className="input" value={agefice.responsable_qualite ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_qualite: e.target.value })} placeholder="ex. Gérant" />
            </Field>
            <Field label="Téléphone du représentant">
              <input className="input" value={agefice.responsable_tel ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_tel: e.target.value })} placeholder="défaut : téléphone de l'organisme" />
            </Field>
            <Field label="E-mail du représentant">
              <input className="input" value={agefice.responsable_email ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_email: e.target.value })} placeholder="défaut : e-mail de l'organisme" />
            </Field>
            <Field label="DREETS / préfet de région" hint="Autorité auprès de laquelle le NDA est enregistré">
              <input className="input" value={agefice.prefet_region ?? ''} onChange={(e) => setAgefice({ ...agefice, prefet_region: e.target.value })} placeholder="ex. DEETS La Réunion" />
            </Field>
            <div className="lg:col-span-2">
              <Field label="Adresse du formulaire officiel" hint="AGEFICE republie le formulaire chaque campagne : collez ici la nouvelle adresse le moment venu">
                <input className="input" value={agefice.demande_url ?? ''} onChange={(e) => setAgefice({ ...agefice, demande_url: e.target.value })} placeholder="https://communication-agefice.fr/…-Editable.pdf" />
              </Field>
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Le formulaire officiel est téléchargé une fois puis conservé dans l'espace de stockage :
            les générations suivantes ne dépendent plus du site de l'AGEFICE. Changer l'adresse
            ci-dessus déclenche automatiquement un nouveau téléchargement.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => persist('agefice', { ...agefice })} disabled={saving === 'agefice'}>
              <Save className="h-4 w-4" /> {saving === 'agefice' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {savedMsg === 'agefice' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
          </div>
        </Card>

        {/* Actions automatiques créées à partir des messages */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Actions automatiques depuis la messagerie</h2>
          </div>
          <p className="mb-4 text-sm text-muted">
            À chaque e-mail <strong>entrant</strong> rattaché à un contact, deux actions sont créées dans son suivi :
            l'e-mail reçu (marqué réalisé, horodaté, avec un résumé du message) et une <strong>relance ASAP</strong>
            {' '}planifiée à la première heure ouvrable. Les e-mails et WhatsApp <strong>sortants</strong> suivent la même règle,
            sans appel à l'IA (vous venez d'écrire le message).
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-3 text-sm">
              <input type="checkbox" className="mt-0.5" checked={mailActions.enabled !== false}
                onChange={(e) => setMailActions({ ...mailActions, enabled: e.target.checked })} />
              <span>
                <span className="font-medium text-fg">Créer les actions automatiquement</span>
                <span className="mt-0.5 block text-xs text-muted">Décoché : aucune action n'est créée à la réception.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-3 text-sm">
              <input type="checkbox" className="mt-0.5" checked={mailActions.resume_ia !== false}
                onChange={(e) => setMailActions({ ...mailActions, resume_ia: e.target.checked })} />
              <span>
                <span className="font-medium text-fg">Résumer le message par l'IA</span>
                <span className="mt-0.5 block text-xs text-muted">Décoché : un extrait du corps du message est utilisé, sans coût IA.</span>
              </span>
            </label>
            <Field label="Résumés IA par synchronisation" hint="Garde-fou de coût : au-delà, un simple extrait est utilisé">
              <input className="input" type="number" min={0} max={50} value={mailActions.max_par_passage ?? 10}
                onChange={(e) => setMailActions({ ...mailActions, max_par_passage: Number(e.target.value) })} />
            </Field>
            <Field label="Modèle de résumé" hint="Vide = le modèle ci-dessus. Un petit modèle suffit et coûte moins cher.">
              <input className="input" value={ai.model_resume ?? ''} onChange={(e) => setAi({ ...ai, model_resume: e.target.value })} placeholder="ex. anthropic/claude-haiku-4.5" />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => persist('mail_actions', { ...mailActions })} disabled={saving === 'mail_actions'}>
              <Save className="h-4 w-4" /> {saving === 'mail_actions' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {savedMsg === 'mail_actions' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            <span className="text-xs text-muted">Le modèle de résumé se règle avec le bloc IA ci-dessus.</span>
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
          <div className="mt-4">
            <Field label="Mots-clés SEO (un par ligne)" hint="Intégrés naturellement dans les articles générés">
              <textarea className="input" rows={3} value={blogSeo} onChange={(e) => setBlogSeo(e.target.value)} />
            </Field>
          </div>

          {/* Génération des illustrations d'articles */}
          <div className="mt-4 rounded-lg border border-line bg-surface-2 p-4">
            <p className="mb-3 text-sm font-medium text-fg">Génération des illustrations</p>
            <Field label="Générateur d'images">
              <select className="input max-w-xs" value={blog.image_provider ?? 'openrouter'} onChange={(e) => setBlog({ ...blog, image_provider: e.target.value as 'openrouter' | 'kie' })}>
                <option value="openrouter">OpenRouter (modèle image)</option>
                <option value="kie">Kie.ai — Seedream 5.0 Lite</option>
              </select>
            </Field>

            {(blog.image_provider ?? 'openrouter') === 'kie' ? (
              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Field label="Clé API Kie.ai" hint="Lue côté serveur uniquement (jamais exposée au navigateur)">
                  <input className="input" type="password" value={blog.kie_api_key ?? ''} onChange={(e) => setBlog({ ...blog, kie_api_key: e.target.value })} autoComplete="new-password" placeholder="Bearer token Kie.ai" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Qualité">
                    <select className="input" value={blog.kie_quality ?? 'basic'} onChange={(e) => setBlog({ ...blog, kie_quality: e.target.value as 'basic' | 'high' })}>
                      <option value="basic">Basic (2K)</option>
                      <option value="high">High (4K)</option>
                    </select>
                  </Field>
                  <Field label="Format">
                    <select className="input" value={blog.kie_aspect_ratio ?? '16:9'} onChange={(e) => setBlog({ ...blog, kie_aspect_ratio: e.target.value })}>
                      {KIE_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                </div>
                <p className="text-xs text-muted lg:col-span-2">Modèle <code>seedream/5-lite-text-to-image</code>. Génération asynchrone : l'image est récupérée puis ré-hébergée dans le bucket du blog. Repli Unsplash si indisponible.</p>
              </div>
            ) : (
              <Field label="Modèle d'image (OpenRouter)" hint="Génération auto de l'illustration. Gratuit par défaut ; repli Unsplash si indisponible">
                <input className="input" value={blog.image_model ?? ''} onChange={(e) => setBlog({ ...blog, image_model: e.target.value })} placeholder="google/gemini-2.5-flash-image-preview:free" />
              </Field>
            )}
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

        {/* Brevo — envoi des newsletters par API */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Brevo (envoi des newsletters)</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted">Les newsletters sont envoyées via l'<strong>API transactionnelle Brevo</strong>. Créez une clé dans Brevo → <em>SMTP &amp; API → API Keys</em>.</p>
            <Field label="Clé API Brevo" hint="Stockée côté serveur (table protégée admin)"><input className="input" type="password" value={brevo.api_key ?? ''} onChange={(e) => setBrevo({ ...brevo, api_key: e.target.value })} autoComplete="new-password" placeholder="xkeysib-…" /></Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="E-mail expéditeur" hint="Doit être un expéditeur vérifié dans Brevo"><input className="input" value={brevo.sender_email ?? ''} onChange={(e) => setBrevo({ ...brevo, sender_email: e.target.value })} placeholder="contact@aissociate.re" /></Field>
              <Field label="Nom de l'expéditeur"><input className="input" value={brevo.sender_name ?? ''} onChange={(e) => setBrevo({ ...brevo, sender_name: e.target.value })} placeholder="Aissociate" /></Field>
            </div>
            <Field label="Limite d'envoi par jour" hint="Plan gratuit Brevo = 300/jour. Au-delà, l'envoi est mis en file et étalé (max 7 jours).">
              <input className="input max-w-[160px]" type="number" min={1} max={5000} value={brevo.daily_limit ?? 300} onChange={(e) => setBrevo({ ...brevo, daily_limit: Math.min(5000, Math.max(1, Number(e.target.value) || 300)) })} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => persist('brevo', { ...brevo })} disabled={saving === 'brevo'}>
                <Save className="h-4 w-4" /> {saving === 'brevo' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              <Button variant="secondary" onClick={testBrevo} disabled={brevoTest.loading || !brevo.api_key}>
                {brevoTest.loading ? 'Test…' : 'Tester la connexion'}
              </Button>
              {savedMsg === 'brevo' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            </div>
            {brevoTest.text && (
              <p className={`text-sm ${brevoTest.ok ? 'text-emerald-600' : 'text-amber-600 dark:text-amber-400'}`}>{brevoTest.text}</p>
            )}
          </div>
        </Card>

        {/* Newsletter hebdomadaire */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Newsletter hebdomadaire</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Nom de l'expéditeur" hint="Affiché dans l'e-mail (en-tête et pied de page)">
              <input className="input" value={newsletter.sender_name ?? ''} onChange={(e) => setNewsletter({ ...newsletter, sender_name: e.target.value })} placeholder="Aissociate" />
            </Field>
            <Field label="Consigne éditoriale (intro IA)" hint="Guide la courte introduction générée">
              <textarea className="input" rows={3} value={newsletter.intro ?? ''} onChange={(e) => setNewsletter({ ...newsletter, intro: e.target.value })} placeholder="Ton chaleureux et professionnel, 2-3 phrases…" />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={newsletter.auto_send === true} onChange={(e) => setNewsletter({ ...newsletter, auto_send: e.target.checked })} /> Envoi automatique (sinon brouillon à valider)</label>
            <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={newsletter.rgpd_only !== false} onChange={(e) => setNewsletter({ ...newsletter, rgpd_only: e.target.checked })} /> Uniquement les contacts ayant consenti (RGPD)</label>
          </div>
          <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">Un <strong>cron hebdomadaire</strong> (lundi 9h) compile les articles du blog des 7 derniers jours dans un e-mail unique envoyé à toute la base (BCC). Génération/envoi manuels depuis la page <strong>Newsletter</strong>. Image d'en-tête : config <strong>Kie.ai</strong> de la section Blog. Envoi via <strong>Brevo</strong> (section ci-dessus).</p>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => persist('newsletter', { ...newsletter })} disabled={saving === 'newsletter'}>
              <Save className="h-4 w-4" /> {saving === 'newsletter' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {savedMsg === 'newsletter' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Éditeur des signatures propres à chaque utilisateur (ajoutées à leurs e-mails).
type ProfSig = { id: string; prenom: string; nom: string; email: string; signature: string | null };
function UserSignaturesCard() {
  const [profs, setProfs] = useState<ProfSig[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('profiles').select('id, prenom, nom, email, signature').order('nom')
      .then(({ data }) => { setProfs((data ?? []) as ProfSig[]); setLoading(false); });
  }, []);

  const saveOne = async (p: ProfSig) => {
    setSavingId(p.id);
    const val = (drafts[p.id] ?? p.signature ?? '').trim();
    const { error } = await supabase.from('profiles').update({ signature: val || null }).eq('id', p.id);
    setSavingId(null);
    if (error) { alert(error.message); return; }
    setProfs((prev) => prev.map((x) => (x.id === p.id ? { ...x, signature: val || null } : x)));
    setSavedId(p.id); setTimeout(() => setSavedId((s) => (s === p.id ? null : s)), 1500);
  };

  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <Send className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">Signatures par utilisateur</h2>
      </div>
      <p className="mb-4 text-sm text-muted">
        Signature propre à chaque utilisateur, insérée dans ses e-mails à la place du préfixe générique
        (nom + coordonnées). Une ligne par utilisateur ; laissez vide pour utiliser le préfixe automatique.
      </p>
      {loading ? (
        <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
      ) : (
        <div className="space-y-4">
          {profs.map((p) => (
            <div key={p.id} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-fg">{p.prenom} {p.nom} <span className="text-xs font-normal text-muted">· {p.email}</span></p>
                <div className="flex items-center gap-2">
                  {savedId === p.id && <span className="text-xs text-emerald-600">Enregistré ✓</span>}
                  <Button variant="secondary" onClick={() => saveOne(p)} disabled={savingId === p.id} className="py-1 text-sm">
                    <Save className="h-3.5 w-3.5" /> {savingId === p.id ? '…' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
              <textarea
                className="input min-h-[90px] text-sm"
                placeholder={`ex.\n${p.prenom} ${p.nom}\nAIssociate\nChargé(e) de formation\nTél : 06 …\nwww.aissociate.re`}
                value={drafts[p.id] ?? p.signature ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
