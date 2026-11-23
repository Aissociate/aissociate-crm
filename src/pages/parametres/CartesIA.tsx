import { Save, Sparkles, ListTodo, Bot } from 'lucide-react';
import { Card, Button, Field } from '@/components/ui';
import { DROIT_LABELS, type Ai, type Chatbot, type MailActionsCfg, type Sauvegarde } from './types';

/** IA — modèles et clé OpenRouter. */
export function CarteIA({
  ai, setAi, persist, saving, savedMsg,
}: {
  ai: Ai;
  setAi: (v: Ai) => void;
} & Sauvegarde) {
  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">IA — génération de plans (OpenRouter)</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Field label="Modèle général" hint="Chatbot, articles, newsletter, résumés d'emails — ex. anthropic/claude-opus-4.8">
          <input className="input" value={ai.model ?? ''} onChange={(e) => setAi({ ...ai, model: e.target.value })} />
        </Field>
        <Field label="Modèle des plans de formation" hint="Doit être rapide : au-delà de 150 s de génération, la fonction est coupée (504). Éviter les modèles à raisonnement. Vide = modèle général.">
          <input className="input" value={ai.model_plan ?? ''} onChange={(e) => setAi({ ...ai, model_plan: e.target.value })} placeholder="anthropic/claude-sonnet-4.5" />
        </Field>
        <Field label="Clé API OpenRouter" hint="Lue uniquement côté serveur (jamais envoyée au navigateur)">
          <input className="input" type="password" value={ai.openrouter_key ?? ''} onChange={(e) => setAi({ ...ai, openrouter_key: e.target.value })} autoComplete="new-password" placeholder="sk-or-…" />
        </Field>
        <Field label="Modèle de l'assistant (agent)" hint="Doit gérer le tool calling de façon fiable — défaut : anthropic/claude-sonnet-4.5">
          <input className="input" value={ai.model_agent ?? ''} onChange={(e) => setAi({ ...ai, model_agent: e.target.value })} placeholder="anthropic/claude-sonnet-4.5" />
        </Field>
        <Field label="Modèle de transcription vocale" hint="Dictée et conversations enregistrées — défaut : google/gemini-3.8-flash (avec le vocabulaire du CRM, ~0,0015 $/min). Un id « whisper » ou « transcribe » utilise la transcription brute. Repli automatique sur openai/gpt-4o-mini-transcribe.">
          <input className="input" value={ai.model_stt ?? ''} onChange={(e) => setAi({ ...ai, model_stt: e.target.value })} placeholder="google/gemini-3.8-flash" />
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
  );
}

/** Actions automatiques créées à partir des messages. */
export function CarteActionsMail({
  mailActions, setMailActions, ai, setAi, persist, saving, savedMsg,
}: {
  mailActions: MailActionsCfg;
  setMailActions: (v: MailActionsCfg) => void;
  ai: Ai;
  setAi: (v: Ai) => void;
} & Sauvegarde) {
  return (
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
  );
}

/** Assistant IA interne — prompts maîtres et droits de contexte. */
export function CarteChatbot({
  chatbot, setChatbot, persist, saving, savedMsg,
}: {
  chatbot: Chatbot;
  setChatbot: (v: Chatbot) => void;
} & Sauvegarde) {
  return (
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
  );
}
