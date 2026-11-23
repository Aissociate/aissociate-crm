import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Modal, Spinner } from '@/components/ui';
import { formatMoney, cn } from '@/lib/utils';
import type { Opportunite, TresorerieEncaissement, EncaissementStatut } from '@/lib/database.types';
import { STATUT_ENC_LABELS, ajouterMois, aujourdhui, ligneVide, type LigneEcheance } from './calculs';

/**
 * Modale « Échéancier » d'une affaire gagnée : les versements datés qui composent son encaissement.
 * Montée à l'ouverture (une instance par affaire) : son état part des échéances déjà enregistrées.
 */
export function ModaleEcheancier({
  planifOpp, encaissements, userId, onClose, setErreur, onSaved,
}: {
  planifOpp: Opportunite;
  encaissements: TresorerieEncaissement[];
  userId: string | null;
  onClose: () => void;
  setErreur: (message: string | null) => void;
  /** Recharge les données après un enregistrement réussi. */
  onSaved: () => Promise<unknown>;
}) {
  const [lignesEch, setLignesEch] = useState<LigneEcheance[]>(() => {
    const toutes = encaissements.filter((e) => e.opportunite_id === planifOpp.id);
    return toutes.length
      ? toutes.map((e) => ({
          id: e.id, libelle: e.libelle, date_prevue: e.date_prevue,
          montant: String(e.montant), statut: e.statut,
          date_encaissement: e.date_encaissement ?? '', mode_reglement: e.mode_reglement ?? '',
        }))
      : [{ ...ligneVide(planifOpp.titre), montant: String(planifOpp.montant ?? 0) }];
  });
  const [nbVersements, setNbVersements] = useState('3');
  const [savingEch, setSavingEch] = useState(false);

  const majLigne = (i: number, k: keyof LigneEcheance, v: string) =>
    setLignesEch((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  const totalLignes = lignesEch
    .filter((l) => l.statut !== 'annule')
    .reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const resteLignes = Math.round((Number(planifOpp.montant || 0) - totalLignes) * 100) / 100;

  /** Étale le reste (ou le montant total si l'échéancier est vide) en N mensualités. */
  const repartir = () => {
    const n = Math.max(1, Math.min(60, Number(nbVersements) || 1));
    const complete = resteLignes > 0.5;
    const base = complete ? resteLignes : Number(planifOpp.montant || 0);
    if (base <= 0) return;
    const part = Math.floor((base / n) * 100) / 100;
    const depart = complete && lignesEch.length
      ? ajouterMois(lignesEch[lignesEch.length - 1].date_prevue, 1)
      : aujourdhui();
    const nouvelles: LigneEcheance[] = Array.from({ length: n }, (_, i) => ({
      ...ligneVide(`${planifOpp.titre} — versement ${i + 1}/${n}`),
      date_prevue: ajouterMois(depart, i),
      // Le dernier versement absorbe l'arrondi : la somme retombe au centime.
      montant: String(i === n - 1 ? Math.round((base - part * (n - 1)) * 100) / 100 : part),
    }));
    // Il reste à planifier → on complète l'échéancier ; sinon on le remplace.
    setLignesEch((ls) => (complete ? [...ls, ...nouvelles] : nouvelles));
  };

  const enregistrerEcheancier = async () => {
    setSavingEch(true);
    setErreur(null);
    const existantes = encaissements.filter((e) => e.opportunite_id === planifOpp.id);
    const gardes = new Set(lignesEch.map((l) => l.id).filter(Boolean) as string[]);
    const aSupprimer = existantes.filter((e) => !gardes.has(e.id)).map((e) => e.id);

    let msg: string | null = null;
    if (aSupprimer.length) {
      const { error } = await supabase.from('tresorerie_encaissements').delete().in('id', aSupprimer);
      msg = msg ?? error?.message ?? null;
    }
    for (const l of lignesEch) {
      const payload = {
        opportunite_id: planifOpp.id,
        libelle: l.libelle.trim() || planifOpp.titre,
        montant: Number(l.montant) || 0,
        date_prevue: l.date_prevue,
        statut: l.statut,
        date_encaissement: l.statut === 'encaisse' ? (l.date_encaissement || l.date_prevue) : null,
        mode_reglement: l.mode_reglement.trim() || null,
      };
      const { error } = l.id
        ? await supabase.from('tresorerie_encaissements').update(payload).eq('id', l.id)
        : await supabase.from('tresorerie_encaissements').insert({ ...payload, created_by: userId });
      msg = msg ?? error?.message ?? null;
    }
    setSavingEch(false);
    if (msg) { setErreur(msg); return; }
    onClose();
    await onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Échéancier — ${planifOpp.titre}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => void enregistrerEcheancier()} disabled={savingEch}>
            {savingEch && <Spinner className="h-4 w-4" />} Enregistrer
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <p className="text-xs text-muted">Montant gagné</p>
            <p className="font-semibold text-fg">{formatMoney(Number(planifOpp.montant || 0))}</p>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <p className="text-xs text-muted">Total échéancier</p>
            <p className="font-semibold text-fg">{formatMoney(totalLignes)}</p>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <p className="text-xs text-muted">Reste à planifier</p>
            <p className={cn(
              'font-semibold',
              Math.abs(resteLignes) < 0.5
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400',
            )}>
              {formatMoney(resteLignes)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3">
          <div>
            <label className="label">Étaler en</label>
            <input
              type="number" min={1} max={60} className="input w-24"
              value={nbVersements}
              onChange={(e) => setNbVersements(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={repartir}>versements mensuels</Button>
          <p className="min-w-[14rem] flex-1 text-xs text-muted">
            Répartit le reste à planifier — ou le montant total quand tout est déjà planifié —
            en mensualités consécutives. Chaque ligne reste modifiable ensuite.
          </p>
        </div>

        <div className="space-y-2">
          {lignesEch.map((l, i) => (
            <div key={l.id ?? `n${i}`} className="grid items-end gap-2 rounded-lg border border-line p-3 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <label className="label">Libellé</label>
                <input
                  className="input" value={l.libelle} placeholder={planifOpp.titre}
                  onChange={(e) => majLigne(i, 'libelle', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Date prévue</label>
                <input
                  type="date" className="input" value={l.date_prevue}
                  onChange={(e) => majLigne(i, 'date_prevue', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Montant</label>
                <input
                  type="number" step="0.01" className="input" value={l.montant}
                  onChange={(e) => majLigne(i, 'montant', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Statut</label>
                <select
                  className="input" value={l.statut}
                  onChange={(e) => majLigne(i, 'statut', e.target.value)}
                >
                  {(Object.keys(STATUT_ENC_LABELS) as EncaissementStatut[]).map((s) => (
                    <option key={s} value={s}>{STATUT_ENC_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Encaissé le</label>
                <input
                  type="date" className="input" value={l.date_encaissement}
                  disabled={l.statut !== 'encaisse'}
                  onChange={(e) => majLigne(i, 'date_encaissement', e.target.value)}
                />
              </div>
              <div className="flex justify-end sm:col-span-1">
                <button
                  className="btn-ghost"
                  onClick={() => setLignesEch((ls) => ls.filter((_, idx) => idx !== i))}
                  aria-label="Supprimer le versement"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() => setLignesEch((ls) => [
              ...ls,
              {
                ...ligneVide(planifOpp.titre),
                date_prevue: ls.length ? ajouterMois(ls[ls.length - 1].date_prevue, 1) : aujourdhui(),
                montant: resteLignes > 0.5 ? String(resteLignes) : '',
              },
            ])}
          >
            <Plus className="h-4 w-4" /> Ajouter un versement
          </Button>
        </div>
      </div>
    </Modal>
  );
}
