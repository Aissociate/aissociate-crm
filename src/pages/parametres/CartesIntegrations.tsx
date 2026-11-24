import { useEffect, useState } from 'react';
import { Save, ShieldAlert, CircleCheck as CheckCircle2, Circle as XCircle, Linkedin, Megaphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Field } from '@/components/ui';
import { functionErrorMessage } from '@/lib/invokeError';
import { LINKEDIN_REDIRECT_URI, type LinkedinCfg, type MetaAds, type Sauvegarde } from './types';

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

/** Statut des intégrations / secrets requis. */
export function CarteStatut({ smtpOk, imapOk, aiOk, linkedinOk, metaOk }: {
  smtpOk: boolean; imapOk: boolean; aiOk: boolean; linkedinOk: boolean; metaOk: boolean;
}) {
  return (
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
  );
}

/** LinkedIn — partage auto des articles (connexion OAuth). */
export function CarteLinkedin({
  linkedin, setLinkedin, persist, saving, savedMsg,
}: {
  linkedin: LinkedinCfg;
  setLinkedin: (v: LinkedinCfg) => void;
} & Sauvegarde) {
  const [linkedinMsg, setLinkedinMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [linkedinConnecting, setLinkedinConnecting] = useState(false);

  // Retour de la connexion OAuth LinkedIn (?linkedin=ok|error&linkedin_msg=…).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const st = q.get('linkedin');
    if (!st) return;
    // LinkedIn renvoie error_description avec des entités HTML (&quot;…).
    const raw = new DOMParser().parseFromString(q.get('linkedin_msg') ?? 'erreur inconnue', 'text/html').body.textContent ?? '';
    const scope = raw.match(/Scope "([^"]+)" is not authorized/)?.[1];
    setLinkedinMsg(st === 'ok'
      ? { ok: true, text: 'LinkedIn connecté ✓' }
      : { ok: false, text: scope
          ? `Connexion LinkedIn refusée : l'app n'a pas le droit « ${scope} ». Demandez le produit « Community Management API » (onglet Products de l'app LinkedIn), attendez sa validation, puis reconnectez.`
          : `Connexion LinkedIn échouée : ${raw}` });
    q.delete('linkedin'); q.delete('linkedin_msg');
    window.history.replaceState(null, '', window.location.pathname + (q.toString() ? `?${q}` : ''));
  }, []);

  // Enregistre Client ID / Secret puis part sur la page d'autorisation LinkedIn.
  const connectLinkedin = async () => {
    setLinkedinConnecting(true);
    setLinkedinMsg(null);
    try {
      const { error: saveErr } = await supabase.from('parametres').upsert({ cle: 'linkedin', valeur: linkedin }, { onConflict: 'cle' });
      if (saveErr) throw new Error(saveErr.message);
      const { data, error } = await supabase.functions.invoke('linkedin-oauth', {
        body: { action: 'start', return_to: window.location.origin + window.location.pathname },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      const r = data as { url?: string; error?: string };
      if (!r?.url) throw new Error(r?.error ?? 'Réponse invalide');
      window.location.href = r.url;
    } catch (err) {
      setLinkedinConnecting(false);
      setLinkedinMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const linkedinExpiry = linkedin.expires_at ? new Date(linkedin.expires_at) : null;
  const linkedinExpired = !!linkedinExpiry && linkedinExpiry.getTime() < Date.now();

  return (
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
        <div className="space-y-2 rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={connectLinkedin} disabled={linkedinConnecting || !linkedin.client_id || !linkedin.client_secret}>
              <Linkedin className="h-4 w-4" /> {linkedinConnecting ? 'Redirection…' : linkedin.access_token ? 'Reconnecter LinkedIn' : 'Connecter LinkedIn'}
            </Button>
            {linkedinMsg && <span className={`text-sm ${linkedinMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{linkedinMsg.text}</span>}
          </div>
          {linkedin.access_token && (
            <p className="text-xs text-muted">
              {linkedin.org_name ? <>Page : <strong>{linkedin.org_name}</strong> · </> : null}
              {linkedinExpiry
                ? <>Token {linkedinExpired ? <strong className="text-red-600">expiré</strong> : 'valide'} jusqu'au {linkedinExpiry.toLocaleDateString('fr-FR')}</>
                : "Token saisi manuellement (date d'expiration inconnue)"}
              {linkedin.refresh_token
                ? ` · renouvellement automatique${linkedin.refresh_expires_at ? ` jusqu'au ${new Date(linkedin.refresh_expires_at).toLocaleDateString('fr-FR')}` : ''}`
                : ' · pas de renouvellement automatique : reconnecter avant expiration'}
            </p>
          )}
          <p className="text-xs text-muted">
            URL de redirection à déclarer dans l'app LinkedIn (onglet Auth) :{' '}
            <code className="select-all break-all">{LINKEDIN_REDIRECT_URI}</code>. Connectez-vous avec un compte
            administrateur de la page entreprise.
          </p>
        </div>
        <Field label="Access token" required hint="Rempli par « Connecter LinkedIn » (ou à coller à la main)">
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
  );
}

/** Publicité Meta — performances Ads (lecture seule) et import des prospects. */
export function CarteMeta({
  metaAds, setMetaAds, persist, saving, savedMsg,
}: {
  metaAds: MetaAds;
  setMetaAds: (v: MetaAds) => void;
} & Sauvegarde) {
  const [leadsMeta, setLeadsMeta] = useState<{ loading: boolean; ok?: boolean; text?: string }>({ loading: false });

  // Import immédiat des prospects des formulaires Meta (sinon toutes les 5 min par le cron).
  const importerLeadsMeta = async () => {
    setLeadsMeta({ loading: true });
    try {
      const { data, error } = await supabase.functions.invoke('meta-leads', { body: {} });
      if (error) throw new Error(await functionErrorMessage(error));
      const r = data as { ok?: boolean; configured?: boolean; message?: string; error?: string; formulaires?: number; lus?: number; crees?: number; releads?: number };
      if (r?.configured === false) throw new Error(r.message ?? 'Jeton Meta absent.');
      if (!r?.ok) throw new Error(r?.error ?? 'Import impossible.');
      setLeadsMeta({
        loading: false, ok: true,
        text: `${r.formulaires} formulaire(s) lu(s), ${r.lus} prospect(s) sur la période : ${r.crees} créé(s), ${r.releads} relead(s).`,
      });
    } catch (err) {
      setLeadsMeta({ loading: false, ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
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

        <div className="border-t border-line pt-4">
          <h3 className="mb-1 text-sm font-semibold text-fg">Prospects des formulaires (Lead Ads)</h3>
          <p className="mb-3 text-xs text-muted">
            Les prospects des formulaires de la page arrivent dans Contacts toutes les 5 minutes (tag « nouveau prospect »
            et nom du formulaire, répartis entre les conseillers). Les formulaires de recrutement sont ignorés.
          </p>
          <div className="space-y-4">
            <Field label="Jeton de page" hint="Jeton de la page Facebook avec la permission leads_retrieval. Vide : le jeton ci-dessus est utilisé (utilisateur système avec accès à la page).">
              <input className="input" type="password" value={metaAds.leads_page_token ?? ''} onChange={(e) => setMetaAds({ ...metaAds, leads_page_token: e.target.value })} placeholder="••••••••" />
            </Field>
            <Field label="ID de la page" hint="Vide : page Aissociate (112479281807858)">
              <input className="input" value={metaAds.leads_page_id ?? ''} onChange={(e) => setMetaAds({ ...metaAds, leads_page_id: e.target.value })} placeholder="112479281807858" />
            </Field>
            <Field label="Formulaires à importer" hint="IDs séparés par des virgules. Vide : tous les formulaires de la page sauf le recrutement.">
              <input className="input" value={metaAds.leads_form_ids ?? ''} onChange={(e) => setMetaAds({ ...metaAds, leads_form_ids: e.target.value })} placeholder="Tous" />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={importerLeadsMeta} disabled={leadsMeta.loading}>
                <Megaphone className="h-4 w-4" /> {leadsMeta.loading ? 'Import…' : 'Importer maintenant'}
              </Button>
              {leadsMeta.text && (
                <span className={`text-sm ${leadsMeta.ok ? 'text-emerald-600' : 'text-red-600'}`}>{leadsMeta.text}</span>
              )}
            </div>
            <p className="text-xs text-muted">Enregistrez d'abord le jeton, puis lancez l'import pour vérifier.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => persist('meta_ads', metaAds)} disabled={saving === 'meta_ads'}>
            <Save className="h-4 w-4" /> {saving === 'meta_ads' ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {savedMsg === 'meta_ads' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
        </div>
      </div>
    </Card>
  );
}
