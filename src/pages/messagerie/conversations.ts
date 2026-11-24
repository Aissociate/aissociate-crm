// Messagerie — types et règles pures : qui est l'interlocuteur d'un message, comment les messages
// se regroupent en conversations, qui a expédié un message sortant. Aucun état React, aucun réseau.
import type { Tone } from '@/components/ui';
import { fullName } from '@/lib/utils';
import type {
  Email, Contact, EmailDirection, EmailCanal, Formateur, Candidat, OpportuniteStage, EmailOrigine,
} from '@/lib/database.types';

export type SmtpCfg = { host?: string; user?: string; password?: string; from?: string };
export type SyncInfo = { last_at?: string; ok?: boolean; imported?: number; skipped?: number; error?: string };
export type View = 'conversations' | 'envoyes' | 'orphelins';

// Adresse e-mail nue de « Nom <a@b.com> », normalisée.
export const emailAddr = (s: string | null): string => {
  if (!s) return '';
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
};
export const digits = (s: string | null): string => (s ?? '').replace(/[^\d]/g, '');
export const reSubject = (s: string | null): string => /^\s*re\s*:/i.test(s ?? '') ? (s ?? '') : `Re: ${s ?? ''}`;
// « Fwd: » n'est pas empilé sur un objet déjà transféré, et un « Re: » existant
// est conservé : « Fwd: Re: Devis » dit bien d'où vient le message.
export const fwdSubject = (s: string | null): string =>
  /^\s*(fwd?|tr)\s*:/i.test(s ?? '') ? (s ?? '') : `Fwd: ${s ?? ''}`;

export type MatchKind = 'contact' | 'formateur' | 'candidat';
export const KIND_LABEL: Record<MatchKind, string> = { contact: 'Contact', formateur: 'Formateur', candidat: 'Recrutement' };
export const KIND_TONE: Record<MatchKind, Tone> = {
  contact: 'brand',
  formateur: 'info',
  candidat: 'warning',
};

export type Peer = { key: string; label: string; kind: MatchKind | null; contactId: string | null; ownerId: string | null };
export type Convo = {
  key: string; label: string; kind: MatchKind | null; contactId: string | null;
  emails: Email[]; owners: Set<string>; channels: Set<EmailCanal>;
  lastAt: string; lastDir: EmailDirection; lastCanal: EmailCanal;
  hasInbound: boolean; hasOutbound: boolean; unread: boolean; matched: boolean;
  /** Un message sortant existe après le dernier message entrant. */
  answered: boolean;
  /** Discussion marquée « close » : aucune réponse n'est attendue. */
  closed: boolean;
  /** Étape de l'opportunité du contact lié, `null` s'il n'en a pas. */
  oppStage: OpportuniteStage | null;
};

// Périmètres de recherche activables (ticket « Messagerie fonction de recherche »).
export type Scope = 'expediteur' | 'destinataire' | 'objet' | 'corps' | 'piece_jointe';
export const SCOPE_LABELS: Record<Scope, string> = {
  expediteur: 'Expéditeurs', destinataire: 'Destinataires', objet: 'Objet',
  corps: 'Corps du texte', piece_jointe: 'Pièces jointes',
};
export const ALL_SCOPES = Object.keys(SCOPE_LABELS) as Scope[];

/** Date d'un message : son envoi, à défaut sa création. */
export const atOf = (e: Email) => e.sent_at ?? e.created_at;

/** « Jean Dupont <j@d.fr> » → { prenom: 'Jean', nom: 'Dupont' } ; vide si absent. */
export const parseDisplayName = (raw: string | null): { prenom: string; nom: string } => {
  const m = (raw ?? '').match(/^\s*"?([^"<]+?)"?\s*</);
  const parts = (m?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { prenom: '', nom: '' };
  if (parts.length === 1) return { prenom: '', nom: parts[0] };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
};

// ── Expéditeur d'un message sortant : IA, automate ou utilisateur ──
export type Expediteur = { origine: EmailOrigine; label: string };
// Les lignes antérieures à la colonne `origine` sont déduites : un envoi
// rattaché à un utilisateur (owner_id) est le sien, sinon il est automatique.
export function expediteurDuMessage(e: Email, ownerName: (id: string | null) => string | null): Expediteur {
  const o: EmailOrigine = e.origine ?? (e.owner_id ? 'utilisateur' : 'automatique');
  if (o === 'ia_assistant') return { origine: o, label: e.origine_libelle || 'Assistant IA' };
  if (o === 'ia_studio') return { origine: o, label: e.origine_libelle || 'Agent IA (Studio)' };
  if (o === 'automatique') return { origine: o, label: e.origine_libelle || 'Envoi automatique' };
  return { origine: o, label: ownerName(e.owner_id) ?? e.origine_libelle ?? 'Utilisateur' };
}
export const estIA = (o: EmailOrigine) => o === 'ia_assistant' || o === 'ia_studio';

// ── Résolution de l'INTERLOCUTEUR d'un message (clé de regroupement) ──
// Un e-mail connu et un WhatsApp du même contact partagent la même clé
// `contact:<id>` -> ils tombent dans la même conversation.
export function interlocuteurDe(e: Email, contacts: Contact[], formateurs: Formateur[], candidats: Candidat[]): Peer {
  const raw = e.direction === 'entrant' ? (e.expediteur ?? '') : (e.destinataires[0] ?? '');
  if (e.canal === 'whatsapp') {
    const ph = digits(raw);
    const c = ph ? contacts.find((x) => x.telephone && digits(x.telephone) === ph) : null;
    const cc = c ?? (e.contact_id ? contacts.find((x) => x.id === e.contact_id) : null);
    if (cc) return { key: `contact:${cc.id}`, label: fullName(cc.prenom, cc.nom), kind: 'contact', contactId: cc.id, ownerId: cc.responsable_id ?? cc.owner_id ?? null };
    return { key: `wa:${ph || raw || '?'}`, label: raw || 'WhatsApp', kind: null, contactId: null, ownerId: null };
  }
  const addr = emailAddr(raw);
  const c = addr ? contacts.find((x) => emailAddr(x.email) === addr) : null;
  if (c) return { key: `contact:${c.id}`, label: fullName(c.prenom, c.nom), kind: 'contact', contactId: c.id, ownerId: c.responsable_id ?? c.owner_id ?? null };
  const f = addr ? formateurs.find((x) => emailAddr(x.email) === addr) : null;
  if (f) return { key: `formateur:${f.id}`, label: fullName(f.prenom, f.nom), kind: 'formateur', contactId: null, ownerId: null };
  const k = addr ? candidats.find((x) => emailAddr(x.email) === addr) : null;
  if (k) return { key: `candidat:${k.id}`, label: fullName(k.prenom, k.nom), kind: 'candidat', contactId: null, ownerId: null };
  if (e.contact_id) { const cc = contacts.find((x) => x.id === e.contact_id); if (cc) return { key: `contact:${cc.id}`, label: fullName(cc.prenom, cc.nom), kind: 'contact', contactId: cc.id, ownerId: cc.responsable_id ?? cc.owner_id ?? null }; }
  return { key: `addr:${addr || raw || '?'}`, label: raw || addr || '—', kind: null, contactId: null, ownerId: null };
}

/** Conversations regroupées par interlocuteur (tous canaux, tous sens). */
export function regrouperConversations({
  data, chrono, closedKeys, oppByContact, resolvePeer,
}: {
  data: Email[];
  /** Vrai = ordre chronologique (plus ancien d'abord). */
  chrono: boolean;
  /** Clés des discussions marquées « closes ». */
  closedKeys: Set<string>;
  /** Étape de l'opportunité la plus récente, par contact. */
  oppByContact: Map<string, OpportuniteStage>;
  resolvePeer: (e: Email) => Peer;
}): Convo[] {
  const map = new Map<string, Convo>();
  data.forEach((e) => {
    const p = resolvePeer(e);
    let cv = map.get(p.key);
    if (!cv) { cv = { key: p.key, label: p.label, kind: p.kind, contactId: p.contactId, emails: [], owners: new Set(), channels: new Set(), lastAt: '', lastDir: 'sortant', lastCanal: 'email', hasInbound: false, hasOutbound: false, unread: false, matched: p.kind !== null, answered: false, closed: false, oppStage: null }; map.set(p.key, cv); }
    cv.emails.push(e);
    cv.channels.add(e.canal === 'whatsapp' ? 'whatsapp' : 'email');
    const t = e.sent_at ?? e.created_at;
    if (t > cv.lastAt) { cv.lastAt = t; cv.lastDir = e.direction; cv.lastCanal = e.canal === 'whatsapp' ? 'whatsapp' : 'email'; }
    if (e.direction === 'entrant') { cv.hasInbound = true; if (!e.lu) cv.unread = true; } else cv.hasOutbound = true;
    if (e.owner_id) cv.owners.add(e.owner_id);
    if (p.ownerId) cv.owners.add(p.ownerId);
  });
  const dir = chrono ? -1 : 1; // chrono = plus ancien d'abord
  const at = (e: Email) => e.sent_at ?? e.created_at;
  return [...map.values()]
    .map((cv) => {
      cv.emails.sort((a, b) => ((at(a) < at(b) ? 1 : -1) * dir));
      // « Répondu » = un sortant postérieur au dernier entrant. Une conversation
      // sans aucun message entrant n'attend rien : elle est considérée traitée.
      const lastIn = cv.emails.filter((e) => e.direction === 'entrant').map(at).sort().at(-1);
      cv.answered = !lastIn || cv.emails.some((e) => e.direction === 'sortant' && at(e) > lastIn);
      cv.closed = closedKeys.has(cv.key);
      cv.oppStage = cv.contactId ? (oppByContact.get(cv.contactId) ?? null) : null;
      return cv;
    })
    .sort((a, b) => ((a.lastAt < b.lastAt ? 1 : -1) * dir));
}
