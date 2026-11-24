import { useState } from 'react';
import { Save, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Field } from '@/components/ui';
import { functionErrorMessage } from '@/lib/invokeError';
import type { BrevoCfg, NewsletterCfg, Sauvegarde } from './types';

/** Brevo — envoi des newsletters par API. */
export function CarteBrevo({
  brevo, setBrevo, persist, saving, savedMsg,
}: {
  brevo: BrevoCfg;
  setBrevo: (v: BrevoCfg) => void;
} & Sauvegarde) {
  const [brevoTest, setBrevoTest] = useState<{ loading: boolean; ok?: boolean; text?: string }>({ loading: false });

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

  return (
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
  );
}

/** Newsletter hebdomadaire. */
export function CarteNewsletter({
  newsletter, setNewsletter, persist, saving, savedMsg,
}: {
  newsletter: NewsletterCfg;
  setNewsletter: (v: NewsletterCfg) => void;
} & Sauvegarde) {
  return (
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
  );
}
