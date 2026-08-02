import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Link2, Copy, Check, Send, Loader as Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Button, Field, Modal, Spinner, Badge, EmptyState, type Tone } from '@/components/ui';
import { formatDate, fullName, ymdLocal } from '@/lib/utils';
import type {
  SessionFormation, SessionParticipant, EmargementCreneau, EmargementAcces, EmargementSignature,
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

export default function Emargement() {
  const { session: auth } = useAuth();
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

  const ouvrirDeclaratif = (creneau: EmargementCreneau, participant: SessionParticipant) => {
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
        <EmptyState title="Aucune demi-journée" message="Cliquez sur « Créer les demi-journées » pour générer la grille d'émargement." />
      ) : participants.length === 0 ? (
        <EmptyState title="Aucun participant" message="Inscrivez des participants à la session depuis le calendrier." />
      ) : loading ? (
        <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
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
