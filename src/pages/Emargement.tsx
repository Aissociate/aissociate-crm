import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CalendarPlus, Link2, Check, Send, Loader as Loader2, ShieldCheck, UserCheck, UserPlus } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Button, Field, Modal, Spinner, Badge, EmptyState, SearchSelect, type Tone } from '@/components/ui';
import { formatDate, fullName, ymdLocal } from '@/lib/utils';
import type {
  Contact, SessionFormation, SessionParticipant, EmargementCreneau, EmargementAcces, EmargementSignature,
} from '@/lib/database.types';

const DEMIS: { key: 'matin' | 'apres_midi'; label: string }[] = [
  { key: 'matin', label: 'Matin' },
  { key: 'apres_midi', label: 'Après-midi' },
];

const STATUT_TONE: Record<string, Tone> = { present: 'success', absent: 'danger', excuse: 'warning' };
const STATUT_LABEL: Record<string, string> = { present: 'Présent', absent: 'Absent', excuse: 'Excusé' };

/** Toutes les dates entre deux bornes incluses (une session peut durer plusieurs jours). */
function joursEntre(debut: string, fin: string | null): string[] {
  const d0 = new Date(debut);
  const d1 = fin ? new Date(fin) : d0;
  const out: string[] = [];
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) out.push(ymdLocal(d));
  return out.slice(0, 60); // garde-fou
}

const escHtml = (v: unknown) =>
  String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));

/** Feuille composée à la main : date, demi-journées et participants choisis. */
type Feuille = { date: string; matin: boolean; apresMidi: boolean; choisis: Set<string>; envoyer: boolean };
const feuilleVide = (participants: SessionParticipant[]): Feuille => ({
  date: ymdLocal(new Date()), matin: true, apresMidi: true,
  choisis: new Set(participants.map((p) => p.id)), envoyer: true,
});

export default function Emargement() {
  const { session: auth, profile } = useAuth();
  const contacts = useCollection<Contact>('contacts', {
    select: 'id, nom, prenom, email', orderBy: { column: 'nom', ascending: true },
  });
  const sessions = useCollection<SessionFormation>('sessions_formation', {
    orderBy: { column: 'date_debut', ascending: false },
  });
  const [selId, setSelId] = useState<string | null>(null);
  const selected = sessions.data.find((s) => s.id === selId) ?? sessions.data[0] ?? null;

  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [creneaux, setCreneaux] = useState<EmargementCreneau[]>([]);
  const [acces, setAcces] = useState<EmargementAcces[]>([]);
  const [signatures, setSignatures] = useState<EmargementSignature[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  // Saisie déclarative : le formateur atteste à la place du stagiaire.
  const [declar, setDeclar] = useState<{ creneau: EmargementCreneau; participant: SessionParticipant } | null>(null);
  const [declarStatut, setDeclarStatut] = useState<EmargementSignature['statut']>('present');
  const [declarMotif, setDeclarMotif] = useState('');
  // Nouvelle feuille : date, demi-journées et participants choisis, puis envoi par e-mail.
  const [feuille, setFeuille] = useState<Feuille | null>(null);
  const [ajoutLibre, setAjoutLibre] = useState({ nom: '', prenom: '', email: '' });
  // Adresse d'expédition réelle pour la trace en Messagerie (cf. Positionnement).
  const [smtpFrom, setSmtpFrom] = useState<string | null>(null);
  useEffect(() => {
    void supabase.from('parametres').select('valeur').eq('cle', 'smtp').maybeSingle()
      .then(({ data }) => setSmtpFrom(((data?.valeur ?? {}) as { from?: string }).from ?? null));
  }, []);

  const charger = useCallback(async () => {
    if (!selected) { setParticipants([]); setCreneaux([]); setAcces([]); setSignatures([]); return; }
    setLoading(true);
    const [{ data: p }, { data: c }, { data: a }] = await Promise.all([
      supabase.from('session_participants').select('*').eq('session_id', selected.id).order('nom'),
      supabase.from('emargement_creneaux').select('*').eq('session_id', selected.id).order('date').order('demi_journee'),
      supabase.from('emargement_acces').select('*').eq('session_id', selected.id),
    ]);
    setParticipants(p ?? []); setCreneaux(c ?? []); setAcces(a ?? []);
    const ids = (c ?? []).map((x) => x.id);
    if (ids.length) {
      const { data: s } = await supabase.from('emargement_signatures').select('*').in('creneau_id', ids);
      setSignatures(s ?? []);
    } else setSignatures([]);
    setLoading(false);
  }, [selected]);

  useEffect(() => { void charger(); }, [charger]);

  const sigDe = useMemo(() => {
    const m = new Map<string, EmargementSignature>();
    for (const s of signatures) m.set(`${s.creneau_id}:${s.participant_id}`, s);
    return m;
  }, [signatures]);
  const accesDe = useMemo(
    () => new Map(acces.map((a) => [a.participant_id, a])), [acces],
  );

  /** Crée les demi-journées manquantes sur toute la durée de la session. */
  const genererCreneaux = async () => {
    if (!selected) return;
    setBusy('creneaux');
    const existants = new Set(creneaux.map((c) => `${c.date}:${c.demi_journee}`));
    const lignes = joursEntre(selected.date_debut, selected.date_fin).flatMap((date) =>
      DEMIS.filter((d) => !existants.has(`${date}:${d.key}`))
        .map((d) => ({ session_id: selected.id, date, demi_journee: d.key })),
    );
    if (lignes.length === 0) { setBusy(null); alert('Les demi-journées sont déjà créées.'); return; }
    const { error } = await supabase.from('emargement_creneaux').insert(lignes);
    setBusy(null);
    if (error) { alert(error.message); return; }
    void charger();
  };

  /** Crée le lien d'émargement d'un participant s'il n'existe pas encore. */
  const assurerAcces = async (p: SessionParticipant): Promise<EmargementAcces | null> => {
    const deja = accesDe.get(p.id);
    if (deja) return deja;
    const { data, error } = await supabase.from('emargement_acces')
      .insert({ session_id: selected!.id, participant_id: p.id }).select().single();
    if (error) { alert(error.message); return null; }
    setAcces((prev) => [...prev, data as EmargementAcces]);
    return data as EmargementAcces;
  };

  const envoyerCode = async (p: SessionParticipant) => {
    if (!p.email) { alert(`Aucune adresse e-mail pour ${p.prenom ?? ''} ${p.nom}.`); return; }
    setBusy(p.id);
    const a = await assurerAcces(p);
    if (!a) { setBusy(null); return; }
    const { data, error } = await supabase.functions.invoke('emargement', { body: { action: 'code', token: a.token } });
    setBusy(null);
    if (error) { alert("Envoi impossible. Vérifiez la configuration SMTP."); return; }
    const err = (data as { error?: string } | null)?.error;
    if (err) { alert(err); return; }
    void charger();
    alert(`Code d'émargement envoyé à ${p.email}.`);
  };

  const copierLien = async (p: SessionParticipant) => {
    const a = await assurerAcces(p);
    if (!a) return;
    await navigator.clipboard.writeText(`${window.location.origin}/emargement/${a.token}`);
    setCopie(p.id);
    setTimeout(() => setCopie(null), 2000);
  };

  const optionsContacts = useMemo(
    () => contacts.data.map((c) => ({ value: c.id, label: fullName(c.prenom, c.nom), sub: c.email ?? undefined })),
    [contacts.data],
  );

  /** Inscrit un participant à la session depuis la feuille, et le coche. */
  const ajouterParticipant = async (ligne: { nom: string; prenom: string | null; email: string | null; contact_id: string | null }) => {
    if (!selected) return;
    const email = ligne.email?.trim().toLowerCase() || null;
    const doublon = participants.find((p) =>
      (ligne.contact_id && p.contact_id === ligne.contact_id) || (email && p.email?.toLowerCase() === email));
    if (doublon) {
      setFeuille((f) => f && { ...f, choisis: new Set(f.choisis).add(doublon.id) });
      return;
    }
    setBusy('ajout');
    const { data, error } = await supabase.from('session_participants')
      .insert({ session_id: selected.id, ...ligne, email }).select().single();
    setBusy(null);
    if (error) { alert(error.message); return; }
    const p = data as SessionParticipant;
    setParticipants((prev) => [...prev, p].sort((a, b) => a.nom.localeCompare(b.nom)));
    setFeuille((f) => f && { ...f, choisis: new Set(f.choisis).add(p.id) });
  };

  const ajouterContact = (id: string) => {
    const c = contacts.data.find((x) => x.id === id);
    if (c) void ajouterParticipant({ nom: c.nom, prenom: c.prenom, email: c.email, contact_id: c.id });
  };

  const ajouterLibre = async () => {
    if (!ajoutLibre.nom.trim()) { alert('Renseignez au moins le nom.'); return; }
    await ajouterParticipant({
      nom: ajoutLibre.nom.trim(), prenom: ajoutLibre.prenom.trim() || null,
      email: ajoutLibre.email.trim() || null, contact_id: null,
    });
    setAjoutLibre({ nom: '', prenom: '', email: '' });
  };

  /** Envoie au participant le lien de sa feuille d'émargement, et le trace en Messagerie. */
  const envoyerLien = async (p: SessionParticipant, dateFeuille: string, demis: string[]): Promise<boolean> => {
    const a = await assurerAcces(p);
    if (!a || !p.email || !selected) return false;
    const url = `${window.location.origin}/emargement/${a.token}`;
    const quand = `${formatDate(dateFeuille, 'EEEE d MMMM yyyy')} (${demis.join(' et ').toLowerCase()})`;
    const sujet = `Feuille d'émargement — ${selected.titre}`;
    const html = `
      <p>Bonjour ${escHtml(p.prenom ?? p.nom)},</p>
      <p>Voici votre feuille d'émargement pour la formation «&nbsp;<strong>${escHtml(selected.titre)}</strong>&nbsp;»
      du ${escHtml(quand)}.</p>
      <p><a href="${url}" style="background:#ea6a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Signer ma feuille d'émargement</a></p>
      <p>Sur la page, cliquez sur « Recevoir mon code » : un code vous est envoyé par e-mail pour valider
      votre signature. Vous pouvez signer à partir du jour de la formation.</p>
      <p>Ou copiez ce lien : ${url}</p>
      <p>Merci,<br/>L'équipe Aissociate</p>`;
    // Version texte : c'est elle que la Messagerie affiche, lien compris.
    const texte = [
      `Bonjour ${p.prenom ?? p.nom},`,
      '',
      `Voici votre feuille d'émargement pour la formation « ${selected.titre} » du ${quand}.`,
      '',
      `Signer ma feuille d'émargement : ${url}`,
      '',
      'Sur la page, cliquez sur « Recevoir mon code » : un code vous est envoyé par e-mail pour valider votre signature. Vous pouvez signer à partir du jour de la formation.',
      '',
      'Merci,',
      "L'équipe Aissociate",
    ].join('\n');
    const { error } = await supabase.functions.invoke('send-email', { body: { to: p.email, subject: sujet, html, text: texte } });
    if (error) return false;
    await supabase.from('emails').insert({
      destinataires: [p.email], copie: [], sujet, corps: texte,
      statut: 'envoye', canal: 'email', direction: 'sortant',
      expediteur: smtpFrom ?? profile?.email ?? null,
      contact_id: p.contact_id, sent_at: new Date().toISOString(),
      owner_id: auth?.user.id ?? null, attachments: [],
    });
    return true;
  };

  const creerFeuille = async () => {
    if (!selected || !feuille) return;
    const demis = DEMIS.filter((d) => (d.key === 'matin' ? feuille.matin : feuille.apresMidi));
    if (!feuille.date) { alert('Choisissez la date.'); return; }
    if (demis.length === 0) { alert('Cochez au moins une demi-journée.'); return; }
    const choisis = participants.filter((p) => feuille.choisis.has(p.id));
    if (choisis.length === 0) { alert('Cochez au moins un participant.'); return; }
    setBusy('feuille');
    const { error } = await supabase.from('emargement_creneaux').upsert(
      demis.map((d) => ({ session_id: selected.id, date: feuille.date, demi_journee: d.key })),
      { onConflict: 'session_id,date,demi_journee', ignoreDuplicates: true },
    );
    if (error) { setBusy(null); alert(error.message); return; }
    const sansEmail: string[] = [];
    const echecs: string[] = [];
    let envoyes = 0;
    if (feuille.envoyer) {
      for (const p of choisis) {
        if (!p.email) { sansEmail.push(fullName(p.prenom, p.nom)); continue; }
        if (await envoyerLien(p, feuille.date, demis.map((d) => d.label))) envoyes++;
        else echecs.push(fullName(p.prenom, p.nom));
      }
    }
    setBusy(null);
    setFeuille(null);
    void charger();
    const bilan = [`Feuille du ${formatDate(feuille.date)} créée.`];
    if (feuille.envoyer) bilan.push(`${envoyes} e-mail(s) envoyé(s).`);
    if (sansEmail.length) bilan.push(`Sans adresse e-mail : ${sansEmail.join(', ')}.`);
    if (echecs.length) bilan.push(`Envoi impossible (SMTP ?) : ${echecs.join(', ')}.`);
    alert(bilan.join('\n'));
  };

  const ouvrirDeclaratif =(creneau: EmargementCreneau, participant: SessionParticipant) => {
    const existante = sigDe.get(`${creneau.id}:${participant.id}`);
    setDeclarStatut(existante?.statut ?? 'present');
    setDeclarMotif(existante?.motif ?? '');
    setDeclar({ creneau, participant });
  };

  const enregistrerDeclaratif = async () => {
    if (!declar) return;
    setBusy('declar');
    const { error } = await supabase.from('emargement_signatures').upsert({
      creneau_id: declar.creneau.id, participant_id: declar.participant.id,
      statut: declarStatut, mode: 'declaratif',
      signe_at: new Date().toISOString(),
      declare_par: auth?.user.id ?? null,
      motif: declarMotif.trim() || null,
    }, { onConflict: 'creneau_id,participant_id' });
    setBusy(null);
    if (error) { alert(error.message); return; }
    setDeclar(null);
    void charger();
  };

  if (sessions.loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader
        title="Émargement"
        subtitle="Présence par demi-journée — signature par code du stagiaire, ou déclaration du formateur"
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <Field label="Session">
              <select className="input" value={selected?.id ?? ''} onChange={(e) => setSelId(e.target.value)}>
                {sessions.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.date_debut)} — {s.titre}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button onClick={() => setFeuille(feuilleVide(participants))} disabled={!selected}>
            <CalendarPlus className="h-4 w-4" />
            Nouvelle feuille
          </Button>
          <Button variant="secondary" onClick={genererCreneaux} disabled={!selected || busy === 'creneaux'}>
            {busy === 'creneaux' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Créer les demi-journées
          </Button>
        </div>
        {selected && (
          <p className="mt-3 text-sm text-muted">
            {formatDate(selected.date_debut)}{selected.date_fin ? ` → ${formatDate(selected.date_fin)}` : ''}
            {selected.lieu ? ` · ${selected.lieu}` : ''} · {selected.modalite}
            {selected.formateur ? ` · ${selected.formateur}` : ''}
          </p>
        )}
      </Card>

      {!selected ? (
        <EmptyState title="Aucune session" message="Créez une session dans le calendrier pour démarrer un émargement." />
      ) : creneaux.length === 0 ? (
        <EmptyState title="Aucune demi-journée" message="Cliquez sur « Nouvelle feuille » pour choisir la date et les participants, ou sur « Créer les demi-journées » pour toute la durée de la session." />
      ) : loading ? (
        <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
      ) : participants.length === 0 ? (
        // Demi-journées créées mais personne d'inscrit : sans cette porte
        // d'entrée, la grille (et donc l'envoi des liens) restait invisible.
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface py-14 text-center">
          <p className="font-medium text-fg">Aucun participant inscrit à cette session</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            {creneaux.length} demi-journée(s) prête(s). Ajoutez les participants (contacts du CRM ou saisie libre)
            et envoyez-leur leur lien de signature.
          </p>
          <Button className="mt-4" onClick={() => setFeuille(feuilleVide(participants))}>
            <UserPlus className="h-4 w-4" /> Ajouter des participants et envoyer les liens
          </Button>
        </div>
      ) : (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-fg">Grille de présence</h2>
            <span className="text-sm text-muted">
              {signatures.filter((s) => s.statut === 'present').length} présence(s) enregistrée(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2">Participant</th>
                  {creneaux.map((c) => (
                    <th key={c.id} className="px-3 py-2 text-center font-medium">
                      <span className="block text-fg">{formatDate(c.date, 'dd/MM')}</span>
                      <span className="block text-[10px] normal-case">{DEMIS.find((d) => d.key === c.demi_journee)?.label}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Lien &amp; code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {participants.map((p) => {
                  const a = accesDe.get(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-surface-2">
                      <td className="px-3 py-2">
                        <span className="block font-medium text-fg">{fullName(p.prenom, p.nom)}</span>
                        <span className="block text-xs text-muted">{p.email ?? 'sans e-mail'}</span>
                        {a?.code_expire_at && new Date(a.code_expire_at) > new Date() && (
                          <Badge tone="info" className="mt-1">Code actif jusqu'au {formatDate(a.code_expire_at)}</Badge>
                        )}
                      </td>
                      {creneaux.map((c) => {
                        const s = sigDe.get(`${c.id}:${p.id}`);
                        return (
                          <td key={c.id} className="px-3 py-2 text-center">
                            <button
                              onClick={() => ouvrirDeclaratif(c, p)}
                              title={s
                                ? `${STATUT_LABEL[s.statut]} · ${s.mode === 'code' ? 'signé par le stagiaire' : 'déclaré par le formateur'} le ${formatDate(s.signe_at, 'dd/MM/yyyy HH:mm')}`
                                : 'Déclarer la présence'}
                              className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-line transition hover:border-brand-400"
                            >
                              {s
                                ? <span className={s.statut === 'present' ? 'text-emerald-600' : s.statut === 'absent' ? 'text-red-600' : 'text-amber-600'}>
                                    {s.statut === 'present' ? (s.mode === 'code' ? <ShieldCheck className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />) : s.statut === 'absent' ? '✕' : '~'}
                                  </span>
                                : <span className="text-muted">·</span>}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => copierLien(p)} title="Copier le lien d'émargement"
                            className="rounded p-1.5 text-muted hover:text-brand-600">
                            {copie === p.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
                          </button>
                          <button onClick={() => envoyerCode(p)} disabled={busy === p.id || !p.email}
                            title={p.email ? 'Envoyer le code par e-mail' : "Aucune adresse e-mail"}
                            className="rounded p-1.5 text-muted hover:text-brand-600 disabled:opacity-30">
                            {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Signé par le stagiaire (code)</span>
            <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Déclaré par le formateur</span>
            <span>Cliquez sur une case pour déclarer ou corriger une présence.</span>
          </div>
        </Card>
      )}

      {/* Nouvelle feuille : date, demi-journées et participants choisis à la main */}
      <Modal
        open={!!feuille} onClose={() => setFeuille(null)} title="Nouvelle feuille d'émargement" wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setFeuille(null)}>Annuler</Button>
            <Button onClick={creerFeuille} disabled={busy === 'feuille'}>
              {busy === 'feuille' ? <Loader2 className="h-4 w-4 animate-spin" /> : feuille?.envoyer ? <Send className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
              {feuille?.envoyer ? `Créer et envoyer (${feuille.choisis.size})` : 'Créer la feuille'}
            </Button>
          </>
        }
      >
        {feuille && selected && (
          <div className="space-y-5">
            <p className="text-sm text-muted">Session : <strong className="text-fg">{selected.titre}</strong></p>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Date">
                <input type="date" className="input" value={feuille.date}
                  onChange={(e) => setFeuille({ ...feuille, date: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 pb-2 text-sm text-fg">
                <input type="checkbox" checked={feuille.matin} onChange={(e) => setFeuille({ ...feuille, matin: e.target.checked })} />
                Matin
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-fg">
                <input type="checkbox" checked={feuille.apresMidi} onChange={(e) => setFeuille({ ...feuille, apresMidi: e.target.checked })} />
                Après-midi
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-fg">Participants</span>
                {participants.length > 0 && (
                  <button type="button" className="text-xs text-brand-600 hover:underline"
                    onClick={() => setFeuille({
                      ...feuille,
                      choisis: feuille.choisis.size === participants.length ? new Set() : new Set(participants.map((p) => p.id)),
                    })}>
                    {feuille.choisis.size === participants.length ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                )}
              </div>
              {participants.length === 0 ? (
                <p className="text-sm text-muted">Aucun participant pour l'instant : ajoutez-en ci-dessous.</p>
              ) : (
                <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                  {participants.map((p) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-2">
                        <input type="checkbox" checked={feuille.choisis.has(p.id)}
                          onChange={() => {
                            const n = new Set(feuille.choisis);
                            if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
                            setFeuille({ ...feuille, choisis: n });
                          }} />
                        <span className="flex-1 text-sm text-fg">{fullName(p.prenom, p.nom)}</span>
                        <span className={`text-xs ${p.email ? 'text-muted' : 'text-amber-600'}`}>{p.email ?? 'sans e-mail'}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3 rounded-lg bg-surface-2 p-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-fg"><UserPlus className="h-4 w-4" /> Ajouter un participant</span>
              <Field label="Depuis les contacts du CRM">
                <SearchSelect value="" onChange={ajouterContact} options={optionsContacts}
                  placeholder="Rechercher un contact…" disabled={busy === 'ajout'} />
              </Field>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
                <Field label="Nom"><input className="input" value={ajoutLibre.nom} onChange={(e) => setAjoutLibre({ ...ajoutLibre, nom: e.target.value })} /></Field>
                <Field label="Prénom"><input className="input" value={ajoutLibre.prenom} onChange={(e) => setAjoutLibre({ ...ajoutLibre, prenom: e.target.value })} /></Field>
                <Field label="E-mail"><input type="email" className="input" value={ajoutLibre.email} onChange={(e) => setAjoutLibre({ ...ajoutLibre, email: e.target.value })} /></Field>
                <Button variant="secondary" onClick={ajouterLibre} disabled={busy === 'ajout'}>Ajouter</Button>
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-fg">
              <input type="checkbox" className="mt-0.5" checked={feuille.envoyer}
                onChange={(e) => setFeuille({ ...feuille, envoyer: e.target.checked })} />
              <span>
                Envoyer la feuille par e-mail aux participants cochés
                <span className="block text-xs text-muted">Chacun reçoit son lien de signature et valide avec un code reçu par e-mail.</span>
              </span>
            </label>
          </div>
        )}
      </Modal>

      {/* Repli déclaratif : le formateur atteste à la place du stagiaire */}
      <Modal
        open={!!declar} onClose={() => setDeclar(null)} title="Déclarer la présence"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclar(null)}>Annuler</Button>
            <Button onClick={enregistrerDeclaratif} disabled={busy === 'declar'}>
              {busy === 'declar' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        {declar && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              <strong className="text-fg">{fullName(declar.participant.prenom, declar.participant.nom)}</strong>
              {' — '}{formatDate(declar.creneau.date)} · {DEMIS.find((d) => d.key === declar.creneau.demi_journee)?.label}
            </p>
            <Field label="Statut">
              <select className="input" value={declarStatut}
                onChange={(e) => setDeclarStatut(e.target.value as EmargementSignature['statut'])}>
                {Object.entries(STATUT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Motif" hint="Pourquoi la présence est-elle déclarée plutôt que signée ? (traçabilité)">
              <input className="input" value={declarMotif} onChange={(e) => setDeclarMotif(e.target.value)}
                placeholder="ex. pas d'accès à sa messagerie pendant la session" />
            </Field>
            <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
              Cette déclaration est enregistrée à votre nom et horodatée. Elle est distinguée
              d'une signature par code dans la grille et dans les exports.
            </p>
            {sigDe.get(`${declar.creneau.id}:${declar.participant.id}`)?.mode === 'code' && (
              <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                Attention : ce créneau a déjà été signé par le stagiaire. L'enregistrer en déclaratif
                remplacera sa signature.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
