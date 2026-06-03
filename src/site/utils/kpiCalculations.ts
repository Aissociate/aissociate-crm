// @ts-nocheck
import { Dossier, FixerKPIs, CloserKPIs } from '../types/dossiers';

export function calculateFixerKPIs(dossiers: Dossier[]): FixerKPIs {
  const totalCalls = dossiers.filter(d => d.initial_call_date).length;
  const conversations = dossiers.filter(d => d.prospect_response === true).length;
  const rdvPlanned = dossiers.filter(d => d.rdv_date).length;
  const rdvHeld = dossiers.filter(d => d.show_up === true).length;
  const clientsPaid = dossiers.filter(d => d.paid && !d.dispute).length;

  const qualityScores = dossiers
    .filter(d => d.lead_quality !== null)
    .map(d => d.lead_quality as number);

  const avgQuality = qualityScores.length > 0
    ? qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length
    : 0;

  return {
    responseRate: totalCalls > 0 ? (conversations / totalCalls) * 100 : 0,
    showUpRate: rdvPlanned > 0 ? (rdvHeld / rdvPlanned) * 100 : 0,
    conversionToRDV: conversations > 0 ? (rdvPlanned / conversations) * 100 : 0,
    conversionToEncaissement: rdvHeld > 0 ? (clientsPaid / rdvHeld) * 100 : 0,
    avgQuality,
    clientsPaid,
    rdvPlanned,
    rdvHeld,
  };
}

export function calculateCloserKPIs(dossiers: Dossier[]): CloserKPIs {
  const rdvHeld = dossiers.filter(d => d.rdv_closer_date && d.decision).length;
  const decisionsOui = dossiers.filter(d => d.decision === 'oui').length;
  const clientsPaid = dossiers.filter(d => d.paid && !d.dispute).length;
  const disputes = dossiers.filter(d => d.dispute && d.paid).length;

  const paidAmounts = dossiers
    .filter(d => d.paid && !d.dispute)
    .map(d => d.amount);

  const avgAmount = paidAmounts.length > 0
    ? paidAmounts.reduce((sum, amt) => sum + amt, 0) / paidAmounts.length
    : 0;

  const qualityScores = dossiers
    .filter(d => d.lead_quality !== null)
    .map(d => d.lead_quality as number);

  const avgQuality = qualityScores.length > 0
    ? qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length
    : 0;

  return {
    closingRate: rdvHeld > 0 ? (decisionsOui / rdvHeld) * 100 : 0,
    rdvPerClient: clientsPaid > 0 ? rdvHeld / clientsPaid : 0,
    avgAmount,
    disputeRate: clientsPaid > 0 ? (disputes / clientsPaid) * 100 : 0,
    clientsPaid,
    rdvHeld,
    avgQuality,
  };
}

export function calculateBonusEstimate(
  clientsPaid: number,
  showUpRate: number,
  avgQuality: number,
  bonus: {
    tier_1_clients: number;
    tier_1_amount: number;
    tier_2_clients: number;
    tier_2_amount: number;
    tier_3_clients: number;
    tier_3_amount: number;
    min_show_up_rate: number;
    min_quality_score: number;
  }
): { amount: number; tier: number; nextTier: number | null; clientsToNext: number } {
  const meetsConditions = showUpRate >= bonus.min_show_up_rate && avgQuality >= bonus.min_quality_score;

  if (!meetsConditions) {
    return {
      amount: 0,
      tier: 0,
      nextTier: bonus.tier_1_clients,
      clientsToNext: bonus.tier_1_clients - clientsPaid
    };
  }

  if (clientsPaid >= bonus.tier_3_clients) {
    return {
      amount: bonus.tier_3_amount,
      tier: 3,
      nextTier: null,
      clientsToNext: 0
    };
  } else if (clientsPaid >= bonus.tier_2_clients) {
    return {
      amount: bonus.tier_2_amount,
      tier: 2,
      nextTier: bonus.tier_3_clients,
      clientsToNext: bonus.tier_3_clients - clientsPaid
    };
  } else if (clientsPaid >= bonus.tier_1_clients) {
    return {
      amount: bonus.tier_1_amount,
      tier: 1,
      nextTier: bonus.tier_2_clients,
      clientsToNext: bonus.tier_2_clients - clientsPaid
    };
  } else {
    return {
      amount: 0,
      tier: 0,
      nextTier: bonus.tier_1_clients,
      clientsToNext: bonus.tier_1_clients - clientsPaid
    };
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fr-FR');
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('fr-FR');
}
