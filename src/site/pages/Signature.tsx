import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type Etat = {
  libelle: string;
  signataire_nom: string;
  email_masque: string;
  statut: string;
  signe_at: string | null;
  expire: boolean;
  code_envoye: boolean;
  validite_minutes?: number;
};

/**
 * Page publique de signature électronique (lien tokenisé, sans compte).
 * Déroulé : le signataire demande un code, le reçoit par e-mail, saisit son
 * nom et le code, puis valide. La preuve est constituée côté serveur.
 */
export default function Signature() {
  const { token } = useParams();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [signe, setSigne] = useState(false);

  // Lien privé : jamais indexé.
  useEffect(() => {
    document.title = 'Signature électronique — Aissociate';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const appeler = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('signature', { body: { action, token, ...extra } });
    if (error) throw new Error("Service indisponible. Réessayez dans un instant.");
    const d = data as Etat & { error?: string; ok?: boolean };
    if (d?.error) throw new Error(d.error);
    return d;
  };

  useEffect(() => {
    void (async () => {
      try {
        const d = await appeler('get');
        setEtat(d);
        setNom(d.signataire_nom ?? '');
        if (d.statut === 'signee') setSigne(true);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Lien invalide.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const demanderCode = async () => {
    setBusy(true); setErreur(null); setInfo(null);
    try {
      const d = await appeler('code');
      setEtat((e) => (e ? { ...e, code_envoye: true } : e));
      setInfo(`Code envoyé à ${d.email_masque ?? 'votre adresse'}. Valable ${d.validite_minutes ?? 30} minutes.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally { setBusy(false); }
  };

  const signer = async () => {
    setBusy(true); setErreur(null); setInfo(null);
    try {
      await appeler('sign', { code: code.trim(), nom: nom.trim() });
      setSigne(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Signature impossible.');
    } finally { setBusy(false); }
  };

  if (loading) {
    return <Cadre><p className="text-neutral-500">Chargement…</p></Cadre>;
  }
  if (erreur && !etat) {
    return <Cadre><p className="text-red-600">{erreur}</p></Cadre>;
  }
  if (signe) {
    return (
      <Cadre>
        <div className="mb-4 text-4xl">✓</div>
        <h1 className="tracking-tight mb-2 text-xl font-semibold text-neutral-950">Document signé</h1>
        <p className="text-neutral-600">
          Merci. Votre signature de «&nbsp;<strong>{etat?.libelle}</strong>&nbsp;» a bien été enregistrée.
          Une copie signée est conservée par l'organisme de formation.
        </p>
      </Cadre>
    );
  }

  return (
    <Cadre>
      <h1 className="tracking-tight mb-1 text-xl font-semibold text-neutral-950">Signature électronique</h1>
      <p className="mb-5 text-neutral-600">{etat?.libelle}</p>

      <ol className="mb-5 space-y-3 text-sm text-neutral-600">
        <li><strong className="text-neutral-950">1.</strong> Recevez un code à 6 chiffres sur {etat?.email_masque}.</li>
        <li><strong className="text-neutral-950">2.</strong> Saisissez vos nom et prénom, puis le code.</li>
        <li><strong className="text-neutral-950">3.</strong> Validez : le document est signé et archivé.</li>
      </ol>

      {!etat?.code_envoye ? (
        <button onClick={demanderCode} disabled={busy}
          className="w-full rounded-xl bg-orange-500 px-4 py-3 font-medium text-neutral-950 transition hover:bg-orange-400 disabled:opacity-50">
          {busy ? 'Envoi…' : 'Recevoir mon code par e-mail'}
        </button>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Vos nom et prénom</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-orange-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Code reçu par e-mail</span>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" placeholder="000000" autoComplete="one-time-code"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-center text-2xl tracking-[0.4em] outline-none focus:border-orange-500" />
          </label>
          <button onClick={signer} disabled={busy || code.length < 6 || nom.trim().length < 3}
            className="w-full rounded-xl bg-orange-500 px-4 py-3 font-medium text-neutral-950 transition hover:bg-orange-400 disabled:opacity-50">
            {busy ? 'Signature…' : 'Signer le document'}
          </button>
          <button onClick={demanderCode} disabled={busy}
            className="w-full text-sm text-neutral-500 underline hover:text-neutral-800">
            Je n'ai pas reçu le code — le renvoyer
          </button>
        </div>
      )}

      {info && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>}
      {erreur && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      <p className="mt-6 border-t border-neutral-200 pt-4 text-xs text-neutral-400">
        Signature électronique simple au sens du règlement (UE) n° 910/2014 (eIDAS).
        La date, l'heure, votre adresse IP et la validation du code sont enregistrées
        et jointes au document comme preuve de signature.
      </p>
    </Cadre>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </div>
  );
}
