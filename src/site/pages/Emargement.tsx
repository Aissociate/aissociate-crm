import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type Creneau = {
  id: string; date: string; demi_journee: string; libelle: string; heures: number;
  echu: boolean;
  signature: { statut: string; mode: string; signe_at: string; motif: string | null } | null;
};
type Etat = {
  session: { titre: string; lieu: string | null; modalite: string; formateur: string | null } | null;
  participant: { nom: string; prenom: string | null };
  email_masque: string;
  creneaux: Creneau[];
  expire: boolean;
  code_actif: boolean;
  code_expire_at: string | null;
  validite_jours: number;
};

/**
 * Page publique d'émargement (lien tokenisé, sans compte).
 * Le stagiaire coche les demi-journées suivies et valide avec son code. Le code
 * restant valable plusieurs jours, la régularisation après coup est prévue :
 * en formation, la messagerie n'est pas toujours accessible sur le créneau.
 */
export default function Emargement() {
  const { token } = useParams();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Émargement — Aissociate';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const appeler = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('emargement', { body: { action, token, ...extra } });
    if (error) throw new Error('Service indisponible. Réessayez dans un instant.');
    const d = data as Etat & { error?: string; ok?: boolean; enregistrees?: number };
    if (d?.error) throw new Error(d.error);
    return d;
  };

  const charger = async () => {
    const d = await appeler('get');
    setEtat(d);
    // Pré-cochage des demi-journées échues non encore émargées : le cas courant
    // est « j'étais présent partout », le stagiaire décoche les exceptions.
    setCoches(new Set(d.creneaux.filter((c) => c.echu && !c.signature).map((c) => c.id)));
  };

  useEffect(() => {
    (async () => {
      try { await charger(); }
      catch (e) { setErreur(e instanceof Error ? e.message : 'Lien invalide.'); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const demanderCode = async () => {
    setBusy(true); setErreur(null); setInfo(null);
    try {
      const d = await appeler('code');
      setEtat((e) => (e ? { ...e, code_actif: true, code_expire_at: d.code_expire_at } : e));
      setInfo(`Code envoyé à ${etat?.email_masque ?? 'votre adresse'}. Il reste valable ${d.validite_jours ?? 7} jours : conservez-le jusqu'à la fin de la formation.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally { setBusy(false); }
  };

  const valider = async () => {
    setBusy(true); setErreur(null); setInfo(null);
    try {
      const d = await appeler('sign', { code: code.trim(), creneaux: [...coches] });
      setCode('');
      await charger();
      setInfo(`${d.enregistrees} demi-journée(s) émargée(s). Merci.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally { setBusy(false); }
  };

  if (loading) return <Cadre><p className="text-slate-500">Chargement…</p></Cadre>;
  if (erreur && !etat) return <Cadre><p className="text-red-600">{erreur}</p></Cadre>;

  const aFaire = (etat?.creneaux ?? []).filter((c) => c.echu && !c.signature);
  const aVenir = (etat?.creneaux ?? []).filter((c) => !c.echu);
  const faits = (etat?.creneaux ?? []).filter((c) => c.signature);

  const bascule = (id: string) =>
    setCoches((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Cadre>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Feuille d'émargement</h1>
      <p className="text-slate-600">{etat?.session?.titre}</p>
      <p className="mb-5 text-sm text-slate-500">
        {etat?.participant.prenom} {etat?.participant.nom}
        {etat?.session?.lieu ? ` · ${etat.session.lieu}` : ''}
      </p>

      {aFaire.length > 0 ? (
        <>
          <p className="mb-2 text-sm font-medium text-slate-700">Demi-journées à émarger</p>
          <div className="mb-4 space-y-2">
            {aFaire.map((c) => (
              <label key={c.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${coches.has(c.id) ? 'border-orange-400 bg-orange-50' : 'border-slate-200'}`}>
                <input type="checkbox" checked={coches.has(c.id)} onChange={() => bascule(c.id)} className="h-4 w-4" />
                <span className="flex-1 text-sm text-slate-800">{c.libelle}</span>
                <span className="text-xs text-slate-400">{c.heures} h</span>
              </label>
            ))}
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Décochez les demi-journées auxquelles vous n'étiez pas présent.
          </p>

          {!etat?.code_actif ? (
            <button onClick={demanderCode} disabled={busy}
              className="w-full rounded-lg bg-orange-600 px-4 py-3 font-medium text-white transition hover:bg-orange-700 disabled:opacity-50">
              {busy ? 'Envoi…' : 'Recevoir mon code par e-mail'}
            </button>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Votre code d'émargement</span>
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" placeholder="000000" autoComplete="one-time-code"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl tracking-[0.4em] outline-none focus:border-orange-500" />
              </label>
              <button onClick={valider} disabled={busy || code.length < 6 || coches.size === 0}
                className="w-full rounded-lg bg-orange-600 px-4 py-3 font-medium text-white transition hover:bg-orange-700 disabled:opacity-50">
                {busy ? 'Enregistrement…' : `Émarger ${coches.size} demi-journée(s)`}
              </button>
              <button onClick={demanderCode} disabled={busy}
                className="w-full text-sm text-slate-500 underline hover:text-slate-800">
                Renvoyer le code
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {faits.length > 0 ? 'Toutes les demi-journées écoulées sont émargées.' : 'Aucune demi-journée à émarger pour le moment.'}
        </p>
      )}

      {info && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>}
      {erreur && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      {faits.length > 0 && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Déjà émargé</p>
          <ul className="space-y-1 text-sm text-slate-500">
            {faits.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>{c.libelle}</span>
                <span className="shrink-0 text-xs">
                  {c.signature?.statut === 'present' ? '✓ présent' : c.signature?.statut}
                  {c.signature?.mode === 'declaratif' ? ' (déclaré par le formateur)' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aVenir.length > 0 && (
        <p className="mt-4 text-xs text-slate-400">
          {aVenir.length} demi-journée(s) à venir : elles pourront être émargées une fois passées.
        </p>
      )}

      <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-400">
        Émargement électronique horodaté. La date, l'heure, votre adresse IP et la validation
        du code sont enregistrées comme preuve de présence.
      </p>
    </Cadre>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </div>
  );
}
