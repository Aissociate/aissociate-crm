import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, FileText, ReceiptText, FolderArchive, ClipboardList, PenLine, CalendarCheck, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Espace client / apprenant — page publique tokenisée (/espace/:token), hors
 * chrome du site et non indexée. Toutes les données passent par l'Edge
 * Function `espace-client` (service role + token) ; chaque consultation est
 * tracée côté serveur (Qualiopi).
 */

type Session = { id: string; titre: string; date_debut: string; date_fin: string | null; lieu: string | null; modalite: string; formateur: string | null };
type LigneDoc = { numero?: string; titre?: string; date_emission?: string; date_echeance?: string; statut?: string; total_ht?: number; total_ttc?: number; fichier_url: string | null; created_at?: string };
type Espace = {
  prenom: string | null; nom: string | null;
  sessions: Session[];
  devis: LigneDoc[];
  factures: LigneDoc[];
  documents: LigneDoc[];
  questionnaires: { token: string; titre: string; statut: string; sent_at: string | null }[];
  signatures: { token: string; libelle: string; statut: string; created_at: string }[];
  emargements: { token: string; session_id: string; expire_at: string | null }[];
};

const frDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('fr-FR') : '—';
const frDateHeure = (s?: string | null) => s ? new Date(s).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const eur = (n?: number) => (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

export default function EspaceClient() {
  const { token } = useParams();
  const [espace, setEspace] = useState<Espace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Mon espace — Aissociate';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('espace-client', { body: { action: 'get', token } });
        if (error) throw new Error('Espace indisponible');
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        setEspace(data as Espace);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    })();
  }, [token]);

  const telecharger = async (bucket: string, path: string | null) => {
    if (!path) return;
    setDownloading(`${bucket}/${path}`);
    try {
      const { data, error } = await supabase.functions.invoke('espace-client', { body: { action: 'download', token, bucket, path } });
      if (error || (data as { error?: string })?.error) throw new Error('Téléchargement indisponible');
      window.open((data as { url: string }).url, '_blank', 'noopener');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setDownloading(null);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Lien invalide ou désactivé</p>
          <p className="mt-2 text-sm text-slate-500">Contactez votre conseiller Aissociate pour recevoir un nouveau lien d'accès.</p>
        </div>
      </div>
    );
  }
  if (!espace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
      </div>
    );
  }

  const aFaire = espace.questionnaires.length + espace.signatures.length;

  const Section = ({ icon: Icon, titre, children, vide }: { icon: typeof FileText; titre: string; children?: React.ReactNode; vide?: boolean }) => (
    vide ? null : (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <Icon className="h-5 w-5 text-orange-600" /> {titre}
        </h2>
        {children}
      </section>
    )
  );

  const BoutonPdf = ({ bucket, path }: { bucket: string; path: string | null }) => (
    path ? (
      <button
        onClick={() => telecharger(bucket, path)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-orange-300 hover:text-orange-700"
      >
        {downloading === `${bucket}/${path}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
      </button>
    ) : null
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">Aissociate — Organisme de formation</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Bonjour {espace.prenom ?? ''} 👋</h1>
          <p className="mt-1 text-sm text-slate-500">
            Votre espace personnel : formations, documents et démarches en cours.
            {aFaire > 0 && <span className="ml-1 font-medium text-orange-700">{aFaire} action(s) attendue(s) de votre part.</span>}
          </p>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-3xl space-y-5 px-4">
        {/* Actions attendues en premier */}
        <Section icon={ClipboardList} titre="Questionnaires à compléter" vide={espace.questionnaires.length === 0}>
          <ul className="divide-y divide-slate-100">
            {espace.questionnaires.map((q) => (
              <li key={q.token} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{q.titre}</p>
                  <p className="text-xs text-slate-500">Envoyé le {frDate(q.sent_at)}</p>
                </div>
                <a href={`/q/${q.token}`} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700">Répondre</a>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={PenLine} titre="Documents à signer" vide={espace.signatures.length === 0}>
          <ul className="divide-y divide-slate-100">
            {espace.signatures.map((s) => (
              <li key={s.token} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{s.libelle}</p>
                  <p className="text-xs text-slate-500">Demandé le {frDate(s.created_at)}</p>
                </div>
                <a href={`/signature/${s.token}`} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700">Signer</a>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={CalendarCheck} titre="Émargement" vide={espace.emargements.length === 0}>
          <ul className="divide-y divide-slate-100">
            {espace.emargements.map((e) => (
              <li key={e.token} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm text-slate-800">Feuille d'émargement de votre session</p>
                <a href={`/emargement/${e.token}`} className="rounded-lg border border-orange-600 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50">Émarger</a>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={CalendarDays} titre="Mes sessions de formation" vide={espace.sessions.length === 0}>
          <ul className="divide-y divide-slate-100">
            {espace.sessions.map((s) => (
              <li key={s.id} className="py-2.5">
                <p className="text-sm font-medium text-slate-800">{s.titre}</p>
                <p className="text-xs text-slate-500">
                  Du {frDateHeure(s.date_debut)}{s.date_fin ? ` au ${frDateHeure(s.date_fin)}` : ''}
                  {s.lieu ? ` · ${s.lieu}` : ''} · {s.modalite}{s.formateur ? ` · Formateur : ${s.formateur}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={ReceiptText} titre="Mes devis" vide={espace.devis.length === 0}>
          <ul className="divide-y divide-slate-100">
            {espace.devis.map((d) => (
              <li key={d.numero} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{d.numero} — {eur(d.total_ht)}</p>
                  <p className="text-xs text-slate-500">Émis le {frDate(d.date_emission)} · {d.statut}</p>
                </div>
                <BoutonPdf bucket="devis" path={d.fichier_url} />
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={FileText} titre="Mes factures" vide={espace.factures.length === 0}>
          <ul className="divide-y divide-slate-100">
            {espace.factures.map((f) => (
              <li key={f.numero} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{f.numero} — {eur(f.total_ttc)}</p>
                  <p className="text-xs text-slate-500">Émise le {frDate(f.date_emission)} · échéance {frDate(f.date_echeance)} · {f.statut === 'payee' ? 'réglée' : f.statut}</p>
                </div>
                <BoutonPdf bucket="factures" path={f.fichier_url} />
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={FolderArchive} titre="Mes documents" vide={espace.documents.length === 0}>
          <ul className="divide-y divide-slate-100">
            {espace.documents.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{d.titre}</p>
                  <p className="text-xs text-slate-500">Ajouté le {frDate(d.created_at)}</p>
                </div>
                <BoutonPdf bucket="coffre" path={d.fichier_url} />
              </li>
            ))}
          </ul>
        </Section>

        {espace.sessions.length + espace.devis.length + espace.factures.length + espace.documents.length + aFaire + espace.emargements.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Rien à afficher pour le moment. Votre conseiller alimentera cet espace au fil de votre parcours.
          </div>
        )}

        <p className="pt-2 text-center text-xs text-slate-400">
          Espace confidentiel — ne partagez pas ce lien. Aissociate · <a className="underline" href="/confidentialite">Politique de confidentialité</a>
        </p>
      </main>
    </div>
  );
}
