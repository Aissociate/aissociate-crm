import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, Square, Pause, Play, Phone, UserPlus, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Loader2, ArrowLeft, RefreshCw, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn, fullName } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { EnregistreurSegmente, formatDuree, micSupporte, normaliserTelephone, type SegmentAudio } from '@/lib/audioRecorder';
import { traiterConversation } from '@/lib/conversation';
import type { Contact, Conversation, ConversationAnalyse, ConversationSegment } from '@/lib/database.types';

type ContactLeger = Pick<Contact, 'id' | 'nom' | 'prenom' | 'telephone' | 'email' | 'statut_prospect'>;
type EtatSegment = ConversationSegment & { statut: 'envoi' | 'ok' | 'erreur' };
type Etape = 'preparation' | 'enregistrement' | 'finalisation' | 'envoi' | 'resultat';

const extensionDe = (mime: string): string => {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
};

/**
 * Capture mobile — page pensée pour un téléphone Android, ouverte par le
 * conseiller (login CRM, installable sur l'écran d'accueil).
 *
 * Déroulé : on choisit l'interlocuteur (numéro composé ou contact existant),
 * on enregistre l'entretien au micro, l'audio part par tranches au fil de
 * l'eau, puis le serveur transcrit et déverse le compte-rendu dans la fiche.
 *
 * Limite Android à connaître : aucun navigateur n'a accès au flux d'un appel
 * téléphonique. On enregistre le micro — donc l'appel doit être passé en
 * haut-parleur, ou l'entretien avoir lieu en présentiel.
 */
export default function CaptureMobile() {
  const { session, profile } = useAuth();
  const [contacts, setContacts] = useState<ContactLeger[]>([]);
  const [recherche, setRecherche] = useState('');
  const [contact, setContact] = useState<ContactLeger | null>(null);
  const [creerContact, setCreerContact] = useState(false);
  const [nouveauNom, setNouveauNom] = useState('');

  const [etape, setEtape] = useState<Etape>('preparation');
  const [secondes, setSecondes] = useState(0);
  const [niveau, setNiveau] = useState(0);
  const [enPause, setEnPause] = useState(false);
  const [segments, setSegments] = useState<EtatSegment[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState<ConversationAnalyse | null>(null);
  const [transcription, setTranscription] = useState('');
  const [voirTranscription, setVoirTranscription] = useState(false);
  const [historique, setHistorique] = useState<Conversation[]>([]);

  const enregistreur = useRef<EnregistreurSegmente | null>(null);
  const conversationId = useRef<string | null>(null);
  const segmentsRef = useRef<ConversationSegment[]>([]);
  const enversRef = useRef(0);          // téléversements en cours
  const arretRef = useRef(false);       // le micro a rendu son dernier segment
  const secondesRef = useRef(0);

  useEffect(() => { document.title = 'Capture mobile — Aissociate'; }, []);

  // Les contacts tiennent en une requête : le rapprochement par numéro se fait
  // en local, car les numéros sont saisis avec des espaces, des points ou un
  // indicatif — aucun `ilike` ne les rattraperait tous.
  const chargerContacts = useCallback(async () => {
    const { data } = await supabase.from('contacts')
      .select('id, nom, prenom, telephone, email, statut_prospect')
      .order('updated_at', { ascending: false })
      .limit(3000);
    setContacts((data ?? []) as ContactLeger[]);
  }, []);

  const chargerHistorique = useCallback(async () => {
    const { data } = await supabase.from('conversations')
      .select('*').order('created_at', { ascending: false }).limit(8);
    setHistorique((data ?? []) as Conversation[]);
  }, []);

  useEffect(() => { void chargerContacts(); void chargerHistorique(); }, [chargerContacts, chargerHistorique]);

  // ── Recherche : chiffres → numéro, lettres → nom ────────────────────────────
  const numeroSaisi = normaliserTelephone(recherche);
  const chercheNumero = numeroSaisi.length >= 4 && /^[\d\s+.()-]+$/.test(recherche.trim());
  const resultats = (() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2) return [];
    return contacts.filter((c) => {
      if (chercheNumero) {
        const tel = normaliserTelephone(c.telephone ?? '');
        return tel.length >= 6 && (tel.endsWith(numeroSaisi) || numeroSaisi.endsWith(tel));
      }
      return fullName(c.prenom, c.nom).toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q);
    }).slice(0, 6);
  })();

  const telephoneRetenu = contact?.telephone?.trim() || (chercheNumero ? recherche.trim() : '');
  const pretADemarrer = Boolean(contact) || (chercheNumero && (!creerContact || nouveauNom.trim().length > 1));

  // ── Téléversement d'un segment ──────────────────────────────────────────────
  const envoyerSegment = useCallback(async (seg: SegmentAudio) => {
    const convId = conversationId.current;
    if (!convId) return;
    const path = `${convId}/${String(seg.index).padStart(3, '0')}.${extensionDe(seg.mime)}`;
    const entree: EtatSegment = {
      index: seg.index, path, duree: seg.duree, taille: seg.blob.size, mime: seg.mime, statut: 'envoi',
    };
    setSegments((prev) => [...prev, entree]);
    enversRef.current += 1;

    const { error } = await supabase.storage.from('conversations')
      .upload(path, seg.blob, { contentType: seg.mime, upsert: true });
    enversRef.current -= 1;

    if (error) {
      setSegments((prev) => prev.map((s) => (s.index === seg.index ? { ...s, statut: 'erreur' } : s)));
      setErreur(`Le morceau ${seg.index + 1} n'a pas pu être envoyé : ${error.message}`);
      return;
    }
    setSegments((prev) => prev.map((s) => (s.index === seg.index ? { ...s, statut: 'ok' } : s)));

    // La ligne est mise à jour après chaque morceau : une coupure ne perd que
    // le morceau en cours.
    const { statut: _ignore, ...persiste } = entree;
    segmentsRef.current = [...segmentsRef.current, persiste];
    await supabase.from('conversations').update({
      segments: segmentsRef.current, duree_secondes: secondesRef.current,
    }).eq('id', convId);
  }, []);

  // ── Démarrage ───────────────────────────────────────────────────────────────
  const demarrer = async () => {
    setErreur(null);
    if (!micSupporte()) { setErreur("Ce navigateur ne sait pas enregistrer le micro. Utilisez Chrome sur Android."); return; }

    let contactId = contact?.id ?? null;
    // Numéro inconnu : on crée la fiche prospect tout de suite, pour que le
    // compte-rendu ait où atterrir.
    if (!contactId && creerContact && nouveauNom.trim()) {
      const { data, error } = await supabase.from('contacts').insert({
        nom: nouveauNom.trim(), type: 'prospect', telephone: recherche.trim(),
        owner_id: session?.user.id ?? null, responsable_id: session?.user.id ?? null,
        statut_prospect: 'nouveau',
      }).select('id, nom, prenom, telephone, email, statut_prospect').maybeSingle();
      if (error) { setErreur(`Création du contact impossible : ${error.message}`); return; }
      if (data) { setContact(data as ContactLeger); contactId = data.id; void chargerContacts(); }
    }

    const { data: conv, error: convErr } = await supabase.from('conversations').insert({
      contact_id: contactId,
      telephone: telephoneRetenu || 'inconnu',
      titre: contact ? fullName(contact.prenom, contact.nom) : (nouveauNom.trim() || telephoneRetenu),
      auteur_id: session?.user.id ?? null,
      source: 'micro',
      statut: 'en_cours',
    }).select('id').maybeSingle();
    if (convErr || !conv) { setErreur(`Impossible d'ouvrir la conversation : ${convErr?.message ?? 'inconnu'}`); return; }

    conversationId.current = conv.id;
    segmentsRef.current = [];
    secondesRef.current = 0;
    arretRef.current = false;
    setSegments([]); setSecondes(0); setAnalyse(null); setTranscription('');

    const rec = new EnregistreurSegmente({
      onSegment: (seg) => { void envoyerSegment(seg); },
      onTick: (s) => { secondesRef.current = s; setSecondes(s); },
      onLevel: setNiveau,
      onArret: () => { arretRef.current = true; },
      onError: (m) => setErreur(m),
    });
    try {
      await rec.demarrer();
    } catch {
      setErreur("Micro refusé. Autorisez l'accès au microphone dans les réglages du navigateur, puis réessayez.");
      await supabase.from('conversations').delete().eq('id', conv.id);
      conversationId.current = null;
      return;
    }
    enregistreur.current = rec;
    setEnPause(false);
    setEtape('enregistrement');
  };

  const basculerPause = () => {
    const rec = enregistreur.current;
    if (!rec) return;
    if (rec.enPause) { rec.reprendre(); setEnPause(false); } else { rec.pause(); setEnPause(true); }
  };

  // ── Arrêt : on attend le dernier morceau et la fin des téléversements ───────
  const terminer = async () => {
    setEtape('finalisation');
    enregistreur.current?.arreter();
    enregistreur.current = null;
    setNiveau(0);

    const debut = Date.now();
    while ((!arretRef.current || enversRef.current > 0) && Date.now() - debut < 60000) {
      await new Promise((r) => setTimeout(r, 300));
    }
    const convId = conversationId.current;
    if (convId) {
      await supabase.from('conversations').update({
        statut: 'a_traiter', segments: segmentsRef.current, duree_secondes: secondesRef.current,
      }).eq('id', convId);
    }
    if (!segmentsRef.current.length) {
      setErreur("Aucun audio n'a été enregistré.");
      setEtape('preparation');
      return;
    }
    await envoyerAuCrm();
  };

  // ── Transcription + compte-rendu côté serveur ──────────────────────────────
  const envoyerAuCrm = async (id?: string) => {
    const convId = id ?? conversationId.current;
    if (!convId) return;
    conversationId.current = convId;
    setEtape('envoi'); setErreur(null);

    const { conversation, erreur: echec } = await traiterConversation(convId);
    if (echec) setErreur(echec);
    setTranscription(conversation?.transcription ?? '');
    setAnalyse(conversation?.compte_rendu ?? null);
    setEtape('resultat');
    void chargerHistorique();
  };

  const nouvelleCapture = () => {
    conversationId.current = null;
    segmentsRef.current = [];
    setEtape('preparation'); setSegments([]); setSecondes(0); setRecherche('');
    setContact(null); setCreerContact(false); setNouveauNom('');
    setAnalyse(null); setTranscription(''); setErreur(null); setVoirTranscription(false);
  };

  // Quitter la page pendant l'enregistrement libère le micro.
  useEffect(() => () => { enregistreur.current?.arreter(); }, []);

  const enregistre = etape === 'enregistrement';

  return (
    <div className="min-h-screen bg-app pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Link to="/dashboard" className="rounded-lg p-1.5 text-muted hover:bg-surface-2" title="Retour au CRM">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Logo size="sm" />
        <span className="ml-auto truncate text-xs text-muted">{profile?.prenom} {profile?.nom}</span>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-5">
        <h1 className="text-xl font-bold text-fg">Capture mobile</h1>
        <p className="mt-1 text-sm text-muted">
          Enregistrez l'entretien, il est transcrit et déversé dans la fiche du contact.
        </p>

        {erreur && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erreur}</span>
          </div>
        )}

        {/* ── 1. Interlocuteur ─────────────────────────────────────────────── */}
        {etape === 'preparation' && (
          <section className="card mt-4 p-4">
            <p className="label">Numéro appelé ou nom du contact</p>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="input pl-9" inputMode="tel" autoComplete="off"
                placeholder="06 92 12 34 56 ou Dupont"
                value={contact ? fullName(contact.prenom, contact.nom) : recherche}
                onChange={(e) => { setContact(null); setRecherche(e.target.value); }}
              />
            </div>

            {!contact && resultats.length > 0 && (
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
                {resultats.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => { setContact(c); setCreerContact(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{fullName(c.prenom, c.nom)}</p>
                        <p className="truncate text-xs text-muted">{c.telephone ?? c.email ?? '—'}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {contact && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{fullName(contact.prenom, contact.nom)}</p>
                  <p className="truncate text-xs text-muted">{contact.telephone ?? '—'}</p>
                </div>
                <button onClick={() => { setContact(null); setRecherche(''); }} className="text-xs text-muted underline">
                  changer
                </button>
              </div>
            )}

            {!contact && chercheNumero && resultats.length === 0 && (
              <div className="mt-3 rounded-lg bg-amber-500/10 p-3">
                <p className="text-sm text-fg">Aucune fiche pour ce numéro.</p>
                <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={creerContact} onChange={(e) => setCreerContact(e.target.checked)} />
                  Créer un nouveau prospect
                </label>
                {creerContact && (
                  <input
                    className="input mt-2" placeholder="Nom de l'interlocuteur"
                    value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)}
                  />
                )}
                {!creerContact && (
                  <p className="mt-2 text-xs text-muted">
                    Sans fiche, l'enregistrement est conservé et transcrit, mais aucun compte-rendu
                    n'est ajouté au CRM.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => void demarrer()} disabled={!pretADemarrer}
              className="btn btn-primary mt-4 w-full justify-center py-3 text-base disabled:opacity-40"
            >
              {creerContact && !contact ? <UserPlus className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              Démarrer l'enregistrement
            </button>
            <p className="mt-3 text-xs text-muted">
              L'appel doit être en <strong className="text-fg">haut-parleur</strong> : le navigateur enregistre le
              micro du téléphone, il ne peut pas capter la ligne téléphonique. Gardez l'écran allumé et cette
              page au premier plan. Prévenez votre interlocuteur que l'échange est enregistré.
            </p>
          </section>
        )}

        {/* ── 2. Enregistrement ────────────────────────────────────────────── */}
        {(enregistre || etape === 'finalisation') && (
          <section className="card mt-4 p-5 text-center">
            <p className="text-sm text-muted">
              {contact ? fullName(contact.prenom, contact.nom) : telephoneRetenu}
            </p>
            <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-fg">{formatDuree(secondes)}</p>

            <div className="mx-auto mt-4 h-2 w-48 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn('h-full rounded-full transition-[width] duration-100',
                  enPause ? 'bg-amber-500' : 'bg-brand-500')}
                style={{ width: `${Math.round(niveau * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {etape === 'finalisation' ? 'Finalisation…' : enPause ? 'En pause' : 'Enregistrement en cours'}
            </p>

            {enregistre && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button onClick={basculerPause} className="btn btn-secondary h-14 w-14 justify-center rounded-full p-0">
                  {enPause ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
                </button>
                <button onClick={() => void terminer()} className="btn btn-danger h-16 w-16 justify-center rounded-full p-0">
                  <Square className="h-7 w-7" />
                </button>
              </div>
            )}

            <ul className="mt-5 space-y-1 text-left text-xs text-muted">
              {segments.map((s) => (
                <li key={s.index} className="flex items-center gap-2">
                  {s.statut === 'envoi' && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" />}
                  {s.statut === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  {s.statut === 'erreur' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                  Morceau {s.index + 1} — {formatDuree(s.duree)}
                  {s.statut === 'ok' && ' · en sécurité'}
                </li>
              ))}
              {!segments.length && <li>Le premier morceau est envoyé au bout de 4 minutes.</li>}
            </ul>
          </section>
        )}

        {/* ── 3. Traitement ────────────────────────────────────────────────── */}
        {etape === 'envoi' && (
          <section className="card mt-4 flex flex-col items-center p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="mt-4 text-sm font-medium text-fg">Transcription et compte-rendu en cours…</p>
            <p className="mt-1 text-xs text-muted">
              Comptez environ une minute pour dix minutes d'entretien. Ne fermez pas la page.
            </p>
          </section>
        )}

        {/* ── 4. Résultat ──────────────────────────────────────────────────── */}
        {etape === 'resultat' && (
          <section className="card mt-4 p-4">
            {analyse ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <h2 className="font-semibold text-fg">Compte-rendu enregistré</h2>
                </div>
                {contact
                  ? <p className="mt-1 text-xs text-muted">Ajouté à la fiche de {fullName(contact.prenom, contact.nom)}.</p>
                  : <p className="mt-1 text-xs text-muted">Aucune fiche liée : le compte-rendu n'est pas dans le CRM.</p>}

                <p className="mt-4 whitespace-pre-line text-sm text-fg">{analyse.resume}</p>

                {analyse.points_cles?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-muted">
                    {analyse.points_cles.map((p, i) => <li key={i}>• {p}</li>)}
                  </ul>
                )}
                {analyse.prochaine_action?.description && (
                  <p className="mt-3 rounded-lg bg-brand-500/10 p-3 text-sm text-fg">
                    <strong>Relance planifiée :</strong> {analyse.prochaine_action.description}
                  </p>
                )}

                {transcription && (
                  <>
                    <button onClick={() => setVoirTranscription((v) => !v)} className="mt-3 text-sm text-brand-500 underline">
                      {voirTranscription ? 'Masquer' : 'Voir'} la transcription
                    </button>
                    {voirTranscription && (
                      <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-lg bg-surface-2 p-3 text-xs text-muted">
                        {transcription}
                      </p>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <h2 className="font-semibold text-fg">Audio conservé, compte-rendu à relancer</h2>
                  <p className="mt-1 text-xs text-muted">
                    L'enregistrement est en sécurité. Relancez le traitement depuis l'historique ci-dessous.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button onClick={nouvelleCapture} className="btn btn-primary flex-1 justify-center">
                <Mic className="h-4 w-4" /> Nouvelle capture
              </button>
              {contact && (
                <Link to={`/contacts?contact=${contact.id}`} className="btn btn-secondary justify-center">
                  Voir la fiche
                </Link>
              )}
            </div>
          </section>
        )}

        {/* ── Historique ───────────────────────────────────────────────────── */}
        {etape === 'preparation' && historique.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-fg">Dernières captures</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              {historique.map((h) => (
                <li key={h.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{h.titre || h.telephone}</p>
                    <p className="truncate text-xs text-muted">
                      {new Date(h.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      {h.duree_secondes ? ` · ${formatDuree(h.duree_secondes)}` : ''}
                      {h.statut === 'traitee' ? ' · traitée' : h.statut === 'erreur' ? ' · échec' : ` · ${h.statut}`}
                    </p>
                  </div>
                  {(h.statut === 'a_traiter' || h.statut === 'erreur') && (
                    <button
                      onClick={() => void envoyerAuCrm(h.id)}
                      className="btn btn-ghost px-2 py-1 text-xs" title="Relancer la transcription"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Relancer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
