// CRM › fiche d'un espace › « Connexions en un clic » (Nango) : état des connexions
// du client et envoi par e-mail d'un lien pour qu'il connecte lui-même ses applications.
import { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Badge, Button } from '@/components/ui';

type Integration = { id: string; nom: string };
type Connexion = { integration_id: string; statut: string; connecte_par: string | null; updated_at: string };
type Etat = { configure: boolean; integrations: Integration[]; connexions: Connexion[] };

async function studio<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('studio', { body });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as T;
}

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function NangoEspace({ workspaceId, nomEspace, emailDefaut }: { workspaceId: string; nomEspace: string; emailDefaut: string }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [integration, setIntegration] = useState('');
  const [email, setEmail] = useState(emailDefaut);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try { setEtat(await studio<Etat>({ action: 'admin_nango_etat', workspace_id: workspaceId })); }
    catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
  }, [workspaceId]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { setEmail(emailDefaut); }, [emailDefaut]);

  const envoyer = async () => {
    setErreur(''); setMessage(''); setEnvoi(true);
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Adresse e-mail invalide.');
      const { url } = await studio<{ url: string }>({
        action: 'admin_nango_invitation', workspace_id: workspaceId, integration_id: integration || null,
        email: email.trim(), origine: window.location.origin,
      });
      const appli = etat?.integrations.find((i) => i.id === integration)?.nom;
      const quoi = appli ? `votre compte ${appli}` : 'vos applications (messagerie, agenda, réseaux sociaux…)';
      const espace = nomEspace.replace(/^Démo — /, '');
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email.trim(),
          subject: appli ? `Connectez ${appli} à votre Studio IA` : 'Connectez vos applications à votre Studio IA',
          text: `Bonjour,\n\nPour que vos agents IA puissent travailler avec ${quoi}, autorisez la connexion en un clic :\n${url}\n\nLe lien est valable 7 jours et réservé à l'espace « ${espace} ». Vos identifiants ne sont jamais transmis à Aissociate, et rien n'est envoyé ni publié sans votre validation.\n\nL'équipe Aissociate`,
          html: `<p>Bonjour,</p><p>Pour que vos agents IA puissent travailler avec ${echapper(quoi)}, autorisez la connexion en un clic :</p>`
            + `<p><a href="${echapper(url)}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Connecter ${echapper(appli ?? 'mes applications')}</a></p>`
            + `<p style="color:#6b7280;font-size:13px">Lien valable 7 jours, réservé à l'espace « ${echapper(espace)} ». Vos identifiants ne sont jamais transmis à Aissociate, et rien n'est envoyé ni publié sans votre validation.</p>`
            + '<p>L\'équipe Aissociate</p>',
        },
      });
      if (error) throw new Error(`Lien créé mais e-mail non envoyé : ${await functionErrorMessage(error)}. Lien à transmettre : ${url}`);
      setMessage(`Lien envoyé à ${email.trim()} (valable 7 jours).`);
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setEnvoi(false); }
  };

  if (!etat) return null;
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-semibold text-fg">Connexions en un clic (Nango)</h3>
        <button className="ml-auto text-muted hover:text-fg" onClick={charger} aria-label="Actualiser"><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>
      {!etat.configure ? (
        <p className="text-sm text-muted">Secret NANGO_SECRET_KEY non configuré sur Supabase.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">
            Le client autorise lui-même ses applications, depuis le Studio ou via le lien reçu par e-mail. Chaque connexion est rattachée
            à cet espace uniquement. Intégrations proposées : celles activées dans votre compte Nango.
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {etat.integrations.map((i) => {
              const c = etat.connexions.find((x) => x.integration_id === i.id);
              return (
                <Badge key={i.id} tone={c?.statut === 'connecte' ? 'success' : c ? 'warning' : 'neutral'}>
                  {i.nom}{c?.statut === 'connecte' ? ' · connecté' : c ? ' · à reconnecter' : ''}
                </Badge>
              );
            })}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
            <select className="input" value={integration} onChange={(e) => setIntegration(e.target.value)}>
              <option value="">Toutes les applications</option>
              {etat.integrations.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
            </select>
            <input className="input" placeholder="E-mail du client" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button onClick={envoyer} disabled={envoi}><Mail className="mr-1 inline h-4 w-4" />{envoi ? 'Envoi…' : 'Envoyer le lien'}</Button>
          </div>
          {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
        </>
      )}
      {erreur && <p className="mt-2 break-all rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}
    </section>
  );
}
