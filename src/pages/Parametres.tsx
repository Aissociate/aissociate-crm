import { useEffect, useState } from 'react';
import { Save, Building2, Mail, Inbox, ShieldAlert, CircleCheck as CheckCircle2, Circle as XCircle, Sparkles, Bot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Spinner, Button, Field } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';

type Organisme = {
  nom?: string; qualiopi?: string; email?: string; telephone?: string; adresse?: string;
  code_postal?: string; ville?: string; siret?: string; nda?: string; tva_intra?: string;
  forme_juridique?: string; capital?: string; logo_url?: string;
};
type Smtp = { host?: string; port?: number; secure?: boolean; user?: string; from?: string; password?: string };
type Imap = { host?: string; port?: number; user?: string; password?: string };
type Ai = { provider?: string; model?: string; openrouter_key?: string; plan_prompt?: string };
type Droits = { documents?: boolean; contacts?: boolean; dossiers?: boolean; formations?: boolean; recrutement?: boolean; finances?: boolean; scope?: string };
type Chatbot = { prompt_direction?: string; prompt_conseiller?: string; droits?: { conseiller?: Droits; direction?: Droits } };

const DROIT_LABELS: { key: keyof Droits; label: string }[] = [
  { key: 'documents', label: 'Base documentaire' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'dossiers', label: 'Dossiers' },
  { key: 'formations', label: 'Catalogue formations' },
  { key: 'recrutement', label: 'Recrutement' },
  { key: 'finances', label: 'Informations financières' },
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('parametres').select('*').in('cle', ['organisme', 'smtp', 'imap', 'ai', 'chatbot']);
      for (const row of data ?? []) {
        if (row.cle === 'organisme') setOrganisme((row.valeur as Organisme) ?? {});
        if (row.cle === 'smtp') setSmtp((row.valeur as Smtp) ?? {});
        if (row.cle === 'imap') setImap({ port: 993, ...((row.valeur as Imap) ?? {}) });
        if (row.cle === 'ai') setAi((row.valeur as Ai) ?? {});
        if (row.cle === 'chatbot') setChatbot((row.valeur as Chatbot) ?? {});
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
            <p className="mb-2 text-sm font-medium text-fg">Droits de contexte des conseillers</p>
            <p className="mb-3 text-xs text-muted">Sélectionnez les données que l'assistant peut consulter pour répondre à un conseiller. La direction a accès à l'ensemble.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DROIT_LABELS.map(({ key, label }) => {
                const cons = chatbot.droits?.conseiller ?? {};
                const checked = cons[key] === true;
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
              Accès à <strong>tous</strong> les contacts/dossiers (sinon uniquement ceux qui lui sont affectés)
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
      </div>
    </div>
  );
}
