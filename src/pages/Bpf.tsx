import { useMemo, useState } from 'react';
import { Download, Info } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { PageHeader, Card, StatCard, Table, Spinner, Button, EmptyState } from '@/components/ui';
import { formatMoney } from '@/lib/utils';
import type { Facture, SessionFormation, SessionParticipant, Formation, Financeur, FinancementType } from '@/lib/database.types';

/**
 * BPF — Bilan Pédagogique et Financier (Cerfa 10443).
 * Pré-remplit les rubriques à partir des données du CRM :
 *   - Cadre C (origine des produits) : factures émises dans l'année, ventilées
 *     par type de financeur.
 *   - Cadre F (stagiaires) : participants des sessions de l'année.
 *   - Heures-stagiaires : durée de la formation × participants (repli : durée
 *     réelle de la session si la formation n'est pas rattachée).
 * Les montants restent à vérifier avant télédéclaration (les rubriques sans
 * données CRM — sous-traitance, formateurs externes — sont à compléter).
 */

// Rubriques du cadre C du Cerfa, par type de financeur du CRM.
const BPF_RUBRIQUES: { code: string; label: string; types: FinancementType[] }[] = [
  { code: 'C.1', label: 'Entreprises (fonds propres)', types: ['entreprise'] },
  { code: 'C.2', label: 'OPCO / dispositifs paritaires', types: ['opco', 'transition_pro'] },
  { code: 'C.3', label: 'CPF (Caisse des dépôts)', types: ['cpf'] },
  { code: 'C.4', label: 'Pouvoirs publics (France Travail, Région…)', types: ['france_travail', 'pole_emploi', 'conseil_regional'] },
  { code: 'C.5', label: "Fonds d'assurance formation de non-salariés (AGEFICE…)", types: ['agefice'] },
  { code: 'C.6', label: 'Particuliers (fonds propres)', types: ['particulier'] },
  { code: 'C.7', label: 'Autres origines', types: ['autre'] },
];

const heures = (s: SessionFormation, f: Formation | undefined): number => {
  if (f?.duree_heures) return Number(f.duree_heures) || 0;
  if (s.date_fin) {
    const h = (new Date(s.date_fin).getTime() - new Date(s.date_debut).getTime()) / 3_600_000;
    return h > 0 && h < 24 * 10 ? Math.round(h * 10) / 10 : 0;
  }
  return 0;
};

export default function Bpf() {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear() - (now.getMonth() < 3 ? 1 : 0));
  const factures = useCollection<Facture>('factures');
  const sessions = useCollection<SessionFormation>('sessions_formation');
  const participants = useCollection<SessionParticipant>('session_participants');
  const formations = useCollection<Formation>('formations');
  const financeurs = useCollection<Financeur>('financeurs');

  const loading = factures.loading || sessions.loading || participants.loading || formations.loading || financeurs.loading;

  const calc = useMemo(() => {
    const y = String(annee);
    const finById = new Map(financeurs.data.map((f) => [f.id, f]));
    const forById = new Map(formations.data.map((f) => [f.id, f]));

    // Cadre C — produits : factures émises dans l'année (hors brouillons/annulées).
    const factAnnee = factures.data.filter((f) =>
      f.date_emission.startsWith(y) && f.statut !== 'brouillon' && f.statut !== 'annulee');
    const produits = BPF_RUBRIQUES.map((r) => {
      const rows = factAnnee.filter((f) => {
        const t = f.financeur_id ? finById.get(f.financeur_id)?.type : undefined;
        return t ? r.types.includes(t) : r.code === 'C.6'; // sans financeur → particulier/direct
      });
      return { ...r, montant: rows.reduce((s, f) => s + (Number(f.total_ht) || 0), 0), nb: rows.length };
    });
    const totalProduits = produits.reduce((s, p) => s + p.montant, 0);

    // Cadres E/F — sessions et stagiaires de l'année.
    const sessAnnee = sessions.data.filter((s) => s.date_debut.startsWith(y));
    const partBySession = new Map<string, SessionParticipant[]>();
    for (const p of participants.data) {
      if (p.statut === 'annule') continue;
      const arr = partBySession.get(p.session_id) ?? [];
      arr.push(p);
      partBySession.set(p.session_id, arr);
    }
    let stagiaires = 0;
    let heuresStagiaires = 0;
    const contactsDistincts = new Set<string>();
    const parFormation = new Map<string, { intitule: string; stagiaires: number; heures: number; sessions: number }>();
    for (const s of sessAnnee) {
      const parts = partBySession.get(s.id) ?? [];
      const f = s.formation_id ? forById.get(s.formation_id) : undefined;
      const h = heures(s, f);
      stagiaires += parts.length;
      heuresStagiaires += h * parts.length;
      for (const p of parts) contactsDistincts.add(p.contact_id ?? p.email ?? p.id);
      const key = f?.id ?? 'hors-catalogue';
      const cur = parFormation.get(key) ?? { intitule: f?.intitule ?? s.titre, stagiaires: 0, heures: 0, sessions: 0 };
      cur.stagiaires += parts.length;
      cur.heures += h * parts.length;
      cur.sessions += 1;
      parFormation.set(key, cur);
    }

    return {
      produits, totalProduits,
      sessions: sessAnnee.length, stagiaires, distincts: contactsDistincts.size,
      heuresStagiaires: Math.round(heuresStagiaires),
      parFormation: [...parFormation.values()].sort((a, b) => b.heures - a.heures),
    };
  }, [annee, factures.data, sessions.data, participants.data, formations.data, financeurs.data]);

  const exportCsv = () => {
    const sep = ';';
    const lignes: string[][] = [
      [`BPF ${annee} — pré-remplissage CRM Aissociate (à vérifier avant télédéclaration)`],
      [],
      ['Cadre C — Origine des produits (HT)'],
      ['Rubrique', 'Libellé', 'Montant HT (€)', 'Nb factures'],
      ...calc.produits.map((p) => [p.code, p.label, p.montant.toFixed(2).replace('.', ','), String(p.nb)]),
      ['', 'TOTAL', calc.totalProduits.toFixed(2).replace('.', ','), ''],
      [],
      ['Cadre F — Stagiaires'],
      ['Sessions réalisées', String(calc.sessions)],
      ['Stagiaires (inscriptions)', String(calc.stagiaires)],
      ['Stagiaires distincts', String(calc.distincts)],
      ['Heures-stagiaires', String(calc.heuresStagiaires)],
      [],
      ['Détail par formation'],
      ['Formation', 'Sessions', 'Stagiaires', 'Heures-stagiaires'],
      ...calc.parFormation.map((f) => [f.intitule, String(f.sessions), String(f.stagiaires), String(Math.round(f.heures))]),
    ];
    const csv = '﻿' + lignes.map((l) => l.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(sep)).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `BPF_${annee}_aissociate.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const annees = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <PageHeader
        title="Bilan Pédagogique et Financier"
        subtitle="Pré-remplissage du Cerfa 10443 à partir des factures et des sessions du CRM"
        actions={
          <>
            <select className="input" value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
              {annees.map((a) => <option key={a} value={a}>Exercice {a}</option>)}
            </select>
            <Button onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          </>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Produits de formation (HT)" value={formatMoney(calc.totalProduits)} hint={`Factures émises en ${annee}`} />
            <StatCard label="Sessions réalisées" value={calc.sessions} />
            <StatCard label="Stagiaires" value={calc.stagiaires} hint={`${calc.distincts} personne(s) distincte(s)`} />
            <StatCard label="Heures-stagiaires" value={calc.heuresStagiaires.toLocaleString('fr-FR')} />
          </div>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-fg">Cadre C — Origine des produits</h2>
            {calc.totalProduits === 0 ? (
              <EmptyState title="Aucune facture émise sur l'exercice" message="Le cadre C se remplit à partir du module Factures." />
            ) : (
              <Table head={<tr><th className="px-4 py-3">Rubrique</th><th className="px-4 py-3">Origine</th><th className="px-4 py-3 text-right">Montant HT</th><th className="px-4 py-3 text-right">Factures</th></tr>}>
                {calc.produits.filter((p) => p.montant > 0 || p.nb > 0).map((p) => (
                  <tr key={p.code}>
                    <td className="px-4 py-3 font-medium text-fg">{p.code}</td>
                    <td className="px-4 py-3 text-muted">{p.label}</td>
                    <td className="px-4 py-3 text-right text-fg">{formatMoney(p.montant)}</td>
                    <td className="px-4 py-3 text-right text-muted">{p.nb}</td>
                  </tr>
                ))}
                <tr className="bg-surface-2 font-semibold">
                  <td className="px-4 py-3" colSpan={2}>Total des produits</td>
                  <td className="px-4 py-3 text-right text-fg">{formatMoney(calc.totalProduits)}</td>
                  <td />
                </tr>
              </Table>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-fg">Détail par formation (cadres E-F)</h2>
            {calc.parFormation.length === 0 ? (
              <EmptyState title="Aucune session sur l'exercice" message="Les stagiaires et heures-stagiaires se calculent depuis le Calendrier (sessions + participants)." />
            ) : (
              <Table head={<tr><th className="px-4 py-3">Formation</th><th className="px-4 py-3 text-right">Sessions</th><th className="px-4 py-3 text-right">Stagiaires</th><th className="px-4 py-3 text-right">Heures-stagiaires</th></tr>}>
                {calc.parFormation.map((f, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-fg">{f.intitule}</td>
                    <td className="px-4 py-3 text-right text-muted">{f.sessions}</td>
                    <td className="px-4 py-3 text-right text-muted">{f.stagiaires}</td>
                    <td className="px-4 py-3 text-right text-muted">{Math.round(f.heures).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <p className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Ce pré-remplissage couvre les rubriques calculables depuis le CRM. Restent à compléter
              manuellement sur le Cerfa : charges (cadre D), sous-traitance, formateurs externes,
              et la ventilation par spécialité de formation (NSF). Les participants marqués
              « annulé » sont exclus ; la durée retenue est celle de la formation au catalogue
              (à défaut, la durée réelle de la session).
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
