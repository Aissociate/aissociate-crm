// Paiement en ligne Stripe du Studio : recharges de crédits (paiement unique) et
// abonnement : contrats de la grille (contrats.ts, CDD mensuel ou CDI annuel) et, pour les
// abonnés d'avant le 23/11/2026, ancienne grille (agents au tarif dégressif + connecteurs en sus).
//
// Compte Stripe PARTAGÉ avec d'autres produits d'Aissociate : tout objet du Studio porte
// metadata.app = "studio", et le Studio a son propre webhook (cette fonction, en-tête
// Stripe-Signature). Les produits, prix (lookup_key), taux de TVA et configuration du portail
// client sont retrouvés ou créés à la volée : passer du bac à sable au réel = changer
// STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET, puis vider les colonnes stripe_* des espaces.
//
// TVA : taux fixe de 8,5 % pour tous les clients (décision du 18/11/2026, TAXE_AUTOMATIQUE = false).
// Le calcul automatique par Stripe Tax (20 % en métropole, adresse et n° de TVA demandés au paiement)
// reste codé : il exige une immatriculation TVA France sur le compte Stripe, absente en réel.
//
// Les crédits d'une recharge ne sont ajoutés qu'à réception du paiement confirmé (webhook),
// une seule fois par session Stripe (index unique sur studio_recharges.stripe_ref).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { journaliser } from "./journal.ts";
import * as contrats from "./contrats.ts";

const API = "https://api.stripe.com/v1";
export const TVA_POURCENT = 8.5; // La Réunion
/** false : 8,5 % pour tous ; true : 8,5 % à La Réunion (974…), Stripe Tax ailleurs. */
export const TAXE_AUTOMATIQUE = false;
/** Libellé du relevé bancaire des abonnements (le compte Stripe est partagé avec d'autres produits). */
const LIBELLE_BANCAIRE = "AISSOCIATE STUDIO IA";
/** Abonnement mensuel HT, en centimes, du 1er au 5e agent (et au-delà : dernier palier). */
// 149 € HT le premier agent, puis −12 %, −25 %, −37,5 % et −50 % (arrondis à l'euro, sauf le dernier palier).
// Changer un montant impose une nouvelle clé (un prix Stripe ne se modifie pas) : v1 = 99 €, v2 = 149 €.
export const PALIERS_AGENTS = [14900, 13100, 11200, 9300, 7450];
export const CLE_AGENTS = "studio_agents_v2";
export const cleConnecteur = (centimes: number) => `studio_connecteur_${centimes}`;
const TOLERANCE_S = 300;
/** Statuts où l'abonnement existe encore chez Stripe (pas de nouvelle souscription). */
export const STATUTS_EN_COURS = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"];

const cle = () => Deno.env.get("STRIPE_SECRET_KEY") ?? "";
export const stripeConfigure = () => Boolean(cle());
export const modeTest = () => cle().startsWith("sk_test_") || cle().startsWith("rk_test_");

// ─── Partie pure (testée) ────────────────────────────────────────────────────

/** Corps x-www-form-urlencoded à la manière de Stripe : objets et tableaux aplatis (a[b][0][c]=…). */
export function formulaire(o: Record<string, unknown>): string {
  const p = new URLSearchParams();
  const ajouter = (k: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => ajouter(`${k}[${i}]`, x));
    else if (typeof v === "object") for (const [s, x] of Object.entries(v as Record<string, unknown>)) ajouter(`${k}[${s}]`, x);
    else p.append(k, String(v));
  };
  for (const [k, v] of Object.entries(o)) ajouter(k, v);
  return p.toString();
}

/** Montant mensuel HT (en euros) pour n agents, paliers dégressifs cumulés. */
export function montantAgents(n: number): number {
  let t = 0;
  for (let i = 0; i < Math.max(0, Math.floor(n)); i++) t += PALIERS_AGENTS[Math.min(i, PALIERS_AGENTS.length - 1)];
  return t / 100;
}

/** Taux fixe de La Réunion (974…) ; sinon TVA calculée par Stripe Tax. */
export function tvaReunion(codePostal: unknown): boolean {
  return /^974\d{2}$/.test(String(codePostal ?? "").replace(/\s/g, ""));
}

/** Paramètres de taxe d'une session Checkout selon la zone du client. */
export function parametresTaxe(reunion: boolean, tauxReunion: string | null) {
  return reunion
    ? { lignes: { tax_rates: [tauxReunion] }, session: {} }
    : {
      lignes: {},
      session: {
        automatic_tax: { enabled: true }, billing_address_collection: "required",
        customer_update: { address: "auto", name: "auto" }, tax_id_collection: { enabled: true },
      },
    };
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Vérifie l'en-tête Stripe-Signature (t=…,v1=…) : HMAC-SHA256 de « t.corps », horodatage récent. */
export async function verifierSignature(secret: string, entete: string | null, corps: string, maintenant = Date.now() / 1000): Promise<boolean> {
  if (!secret || !entete) return false;
  const parts = entete.split(",").map((x) => x.split("=")) as [string, string][];
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !signatures.length || Math.abs(maintenant - Number(t)) > TOLERANCE_S) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const attendu = hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${corps}`)));
  return signatures.some((s) => s.length === attendu.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ attendu.charCodeAt(i)), 0) === 0);
}

type Article = { id: string; quantity?: number; price?: { id?: string; lookup_key?: string | null; unit_amount?: number | null }; current_period_end?: number };
type Abonnement = { id: string; status: string; customer: string; metadata?: Record<string, string>; current_period_end?: number; items?: { data: Article[] } };

/** Lecture d'un abonnement Stripe : quantités d'agents et de connecteurs, montant HT, fin de période. */
export function lireAbonnement(a: Abonnement) {
  const articles = a.items?.data ?? [];
  const agents = articles.find((x) => x.price?.lookup_key === CLE_AGENTS);
  const conn = articles.find((x) => String(x.price?.lookup_key ?? "").startsWith("studio_connecteur_"));
  const nAgents = agents?.quantity ?? 0, nConn = conn?.quantity ?? 0;
  const fin = a.current_period_end ?? articles[0]?.current_period_end;
  // Grille des contrats (contrats.ts) : montant mensuel lissé, remise CDI comprise.
  const contrat = contrats.choixDepuisArticles(articles.map((x) => ({ lookup_key: x.price?.lookup_key, quantite: x.quantity ?? 1 })));
  return {
    agents: nAgents, connecteurs: nConn, articleAgents: agents?.id ?? null, articleConnecteurs: conn?.id ?? null,
    contrat, articles: articles.map((x) => x.id),
    montant_ht: contrat ? contrats.bulletin(contrat).mensuel_ht : Math.round((montantAgents(nAgents) + nConn * (conn?.price?.unit_amount ?? 0) / 100) * 100) / 100,
    fin: fin ? new Date(fin * 1000).toISOString() : null,
  };
}

// ─── Réseau ──────────────────────────────────────────────────────────────────

export async function appel<T = Record<string, unknown>>(methode: "GET" | "POST" | "DELETE", chemin: string, params: Record<string, unknown> = {}, idem?: string): Promise<T> {
  const corps = formulaire(params);
  const r = await fetch(methode === "GET" && corps ? `${API}${chemin}?${corps}` : `${API}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${cle()}`,
      ...(methode === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idem ? { "Idempotency-Key": idem } : {}),
    },
    body: methode === "POST" ? corps : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(`Stripe : ${j.error?.message ?? `HTTP ${r.status}`}`);
  return j;
}

/** Taux de TVA du Studio (8,5 %, hors taxe), retrouvé ou créé. */
async function tauxTva(): Promise<string> {
  const l = await appel<{ data: { id: string; percentage: number; inclusive: boolean; metadata?: Record<string, string> }[] }>("GET", "/tax_rates", { active: true, limit: 100 });
  const t = l.data.find((x) => x.metadata?.studio === "tva" && Number(x.percentage) === TVA_POURCENT && !x.inclusive);
  if (t) return t.id;
  return (await appel<{ id: string }>("POST", "/tax_rates", {
    display_name: "TVA", description: "TVA 8,5 % (Studio IA)", percentage: TVA_POURCENT, inclusive: false,
    country: "FR", jurisdiction: "La Réunion", metadata: { studio: "tva", app: "studio" },
  })).id;
}

/** Prix récurrent repéré par sa lookup_key, créé avec son produit s'il n'existe pas. */
async function prix(lookup: string, nomProduit: string, def: Record<string, unknown>): Promise<string> {
  const l = await appel<{ data: { id: string }[] }>("GET", "/prices", { lookup_keys: [lookup], active: true, limit: 1 });
  if (l.data[0]) return l.data[0].id;
  const produit = await appel<{ id: string }>("POST", "/products", { name: nomProduit, statement_descriptor: LIBELLE_BANCAIRE, metadata: { app: "studio" } }, `studio-produit-${lookup}-libelle`);
  return (await appel<{ id: string }>("POST", "/prices", {
    product: produit.id, currency: "eur", lookup_key: lookup, recurring: { interval: "month" }, tax_behavior: "exclusive", metadata: { app: "studio" }, ...def,
  }, `studio-prix-${lookup}`)).id;
}

const prixAgents = () => prix(CLE_AGENTS, "Studio IA — agents (abonnement mensuel)", {
  billing_scheme: "tiered", tiers_mode: "graduated",
  tiers: PALIERS_AGENTS.map((c, i) => ({ up_to: i === PALIERS_AGENTS.length - 1 ? "inf" : i + 1, unit_amount: c })),
});
const prixConnecteur = (centimes: number) => prix(cleConnecteur(centimes), "Studio IA — connecteur supplémentaire", { unit_amount: centimes });

/** Prix d'un élément de la grille des contrats (mensuel, ou annuel pour un CDI). */
const prixContrat = (a: { element: string; nom: string; centimes: number }, cdi: boolean) =>
  prix(contrats.clePrix(a.element, cdi), a.nom, { unit_amount: a.centimes, recurring: { interval: cdi ? "year" : "month" } });

/** Client Stripe de l'espace (créé au premier paiement, coordonnées de « Mon entreprise ») et sa zone de TVA. */
async function clientStripe(sb: SupabaseClient, wsId: string, email: string): Promise<{ id: string; reunion: boolean }> {
  const { data: w } = await sb.from("studio_workspaces").select("nom, stripe_client, entete").eq("id", wsId).single();
  const e = (w?.entete ?? {}) as Record<string, string>;
  const reunion = tvaReunion(e.code_postal);
  if (w?.stripe_client) return { id: String(w.stripe_client), reunion };
  const c = await appel<{ id: string }>("POST", "/customers", {
    name: (e.raison_sociale || String(w?.nom ?? "")).replace(/^Démo — /, "").slice(0, 250), email: email || undefined,
    address: e.adresse || e.ville ? { line1: e.adresse || undefined, postal_code: e.code_postal || undefined, city: e.ville || undefined, country: reunion ? "RE" : "FR" } : undefined,
    preferred_locales: ["fr"], metadata: { app: "studio", workspace_id: wsId },
  }, `studio-client-${wsId}-${modeTest() ? "test" : "reel"}`);
  await sb.from("studio_workspaces").update({ stripe_client: c.id }).eq("id", wsId);
  return { id: c.id, reunion };
}

/** Page de paiement Stripe d'un pack de recharge. */
export async function sessionRecharge(sb: SupabaseClient, p: { wsId: string; email: string; origine: string; pack: { prix: number; credits: number } }) {
  const client = await clientStripe(sb, p.wsId, p.email);
  const fixe = !TAXE_AUTOMATIQUE || client.reunion;
  const taxe = parametresTaxe(fixe, fixe ? await tauxTva() : null);
  const meta = { app: "studio", workspace_id: p.wsId };
  const s = await appel<{ url: string }>("POST", "/checkout/sessions", {
    mode: "payment", customer: client.id, locale: "fr", ...taxe.session,
    line_items: [{
      quantity: 1, ...taxe.lignes,
      price_data: { currency: "eur", unit_amount: Math.round(p.pack.prix * 100), tax_behavior: "exclusive", product_data: { name: `Studio IA — recharge de ${p.pack.credits} crédits` } },
    }],
    metadata: { ...meta, nature: "recharge", credits: p.pack.credits, prix_ht: p.pack.prix, acteur: `client:${p.email}` },
    payment_intent_data: { metadata: meta, statement_descriptor_suffix: "STUDIO IA" },
    invoice_creation: { enabled: true, invoice_data: { metadata: meta } },
    success_url: `${p.origine}/studio/perimetre?paiement=recharge`,
    cancel_url: `${p.origine}/studio/perimetre?paiement=annule`,
  });
  return s.url;
}

/** Page de souscription de l'abonnement mensuel (agents + connecteurs supplémentaires). */
export async function sessionAbonnement(sb: SupabaseClient, p: { wsId: string; email: string; origine: string; agents: number; connecteurs: number; prixConnecteur: number }) {
  const centimes = Math.round(p.prixConnecteur * 100);
  const [client, pa, pc] = await Promise.all([
    clientStripe(sb, p.wsId, p.email), prixAgents(), p.connecteurs > 0 ? prixConnecteur(centimes) : Promise.resolve(""),
  ]);
  const fixe = !TAXE_AUTOMATIQUE || client.reunion;
  const taxe = parametresTaxe(fixe, fixe ? await tauxTva() : null);
  const meta = { app: "studio", workspace_id: p.wsId };
  const s = await appel<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription", customer: client.id, locale: "fr", ...taxe.session,
    line_items: [{ price: pa, quantity: p.agents }, ...(p.connecteurs > 0 ? [{ price: pc, quantity: p.connecteurs }] : [])],
    subscription_data: { metadata: meta, ...(fixe ? { default_tax_rates: taxe.lignes.tax_rates } : {}), description: "Studio IA — Aissociate" },
    metadata: { ...meta, nature: "abonnement" },
    success_url: `${p.origine}/studio/perimetre?paiement=abonnement`,
    cancel_url: `${p.origine}/studio/perimetre?paiement=annule`,
  });
  return s.url;
}

/** Page de souscription d'un contrat de la grille (contrat + avenants, CDD mensuel ou CDI annuel). */
export async function sessionContrat(sb: SupabaseClient, p: { wsId: string; email: string; origine: string; choix: contrats.Choix }) {
  const elements = contrats.articles(p.choix);
  if (!elements.length) throw new Error("Rien à payer pour ce contrat.");
  const [client, ...prixIds] = await Promise.all([clientStripe(sb, p.wsId, p.email), ...elements.map((a) => prixContrat(a, p.choix.cdi))]);
  const fixe = !TAXE_AUTOMATIQUE || client.reunion;
  const taxe = parametresTaxe(fixe, fixe ? await tauxTva() : null);
  const meta = { app: "studio", workspace_id: p.wsId };
  const s = await appel<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription", customer: client.id, locale: "fr", ...taxe.session,
    line_items: elements.map((a, i) => ({ price: prixIds[i], quantity: a.quantite })),
    subscription_data: { metadata: { ...meta, grille: contrats.VERSION }, ...(fixe ? { default_tax_rates: taxe.lignes.tax_rates } : {}), description: "Studio IA — Aissociate" },
    metadata: { ...meta, nature: "abonnement" },
    success_url: `${p.origine}/studio/perimetre?paiement=abonnement`,
    cancel_url: `${p.origine}/studio/reglages/perimetre/contrat?paiement=annule`,
  });
  return s.url;
}

/**
 * Change le contrat d'un abonnement en cours (y compris un abonnement de l'ancienne grille par
 * agent) : tous les articles sont remplacés, la différence est calculée au prorata.
 */
export async function modifierContrat(sb: SupabaseClient, wsId: string, choix: contrats.Choix) {
  const { data: w } = await sb.from("studio_workspaces").select("stripe_abonnement").eq("id", wsId).single();
  if (!w?.stripe_abonnement) throw new Error("Aucun abonnement en ligne pour cet espace.");
  const elements = contrats.articles(choix);
  if (!elements.length) throw new Error("Pour revenir au Stage gratuit, résiliez depuis « Gérer mon abonnement » : vous y passerez à la fin de la période payée.");
  const a = lireAbonnement(await appel<Abonnement>("GET", `/subscriptions/${w.stripe_abonnement}`));
  const prixIds = await Promise.all(elements.map((x) => prixContrat(x, choix.cdi)));
  const items = [
    ...a.articles.map((id) => ({ id, deleted: true })),
    ...elements.map((x, i) => ({ price: prixIds[i], quantity: x.quantite })),
  ];
  const maj = await appel<Abonnement>("POST", `/subscriptions/${w.stripe_abonnement}`, {
    items, proration_behavior: "create_prorations", metadata: { app: "studio", workspace_id: wsId, grille: contrats.VERSION },
  });
  await enregistrerAbonnement(sb, maj);
  return lireAbonnement(maj);
}

/** Modèle d'IA de la qualification Expert (doit figurer dans MODELES_STUDIO d'index.ts). */
export const MODELE_EXPERT = "anthropic/claude-haiku-5.5";

/** Applique à l'espace les droits d'un contrat : quota d'heures, badges, responsables, casier, Expert. */
export async function appliquerContrat(sb: SupabaseClient, wsId: string, choix: contrats.Choix) {
  const d = contrats.droits(choix);
  const { data: w } = await sb.from("studio_workspaces").select("modele").eq("id", wsId).maybeSingle();
  // Expert : modèle supérieur, sans écraser un modèle posé à la main depuis le CRM.
  const modele = d.expert ? (w?.modele || MODELE_EXPERT) : (w?.modele === MODELE_EXPERT ? null : w?.modele ?? null);
  await sb.from("studio_workspaces").update({
    contrat: choix.contrat, contrat_choix: choix, quota_messages_mois: d.quota_messages_mois, connecteurs_max: d.connecteurs_max,
    max_utilisateurs: d.max_utilisateurs, stockage_go: d.stockage_go, astreinte: d.astreinte, modele,
  }).eq("id", wsId);
}

/** Portail client Stripe (carte, factures, résiliation), avec une configuration propre au Studio. */
// `resilier` : le portail s'ouvre directement sur la résiliation de cet abonnement (fin de période).
export async function sessionPortail(sb: SupabaseClient, p: { wsId: string; email: string; origine: string; resilier?: string | null }) {
  const client = (await clientStripe(sb, p.wsId, p.email)).id;
  const l = await appel<{ data: { id: string; active: boolean; metadata?: Record<string, string> }[] }>("GET", "/billing_portal/configurations", { limit: 100 });
  const config = l.data.find((c) => c.active && c.metadata?.app === "studio")?.id ?? (await appel<{ id: string }>("POST", "/billing_portal/configurations", {
    business_profile: { headline: "Studio IA — Aissociate" },
    features: {
      invoice_history: { enabled: true }, payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address", "name", "tax_id"] },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
    metadata: { app: "studio" },
  })).id;
  return (await appel<{ url: string }>("POST", "/billing_portal/sessions", {
    customer: client, configuration: config, return_url: `${p.origine}/studio/perimetre`, locale: "fr",
    ...(p.resilier ? {
      flow_data: {
        type: "subscription_cancel", subscription_cancel: { subscription: p.resilier },
        after_completion: { type: "redirect", redirect: { return_url: `${p.origine}/studio/perimetre?paiement=resilie` } },
      },
    } : {}),
  })).url;
}

/** Aligne l'abonnement sur l'équipe actuelle (prorata au jour près). */
export async function synchroniser(sb: SupabaseClient, wsId: string, agents: number, connecteurs: number, prixConn: number) {
  const { data: w } = await sb.from("studio_workspaces").select("stripe_abonnement").eq("id", wsId).single();
  if (!w?.stripe_abonnement) throw new Error("Aucun abonnement en ligne pour cet espace.");
  const a = lireAbonnement(await appel<Abonnement>("GET", `/subscriptions/${w.stripe_abonnement}`));
  // Contrat de la grille : agents illimités, rien à aligner.
  if (a.contrat) return a;
  const items: Record<string, unknown>[] = [];
  if (a.articleAgents) items.push({ id: a.articleAgents, quantity: agents });
  else items.push({ price: await prixAgents(), quantity: agents });
  if (a.articleConnecteurs) items.push(connecteurs > 0 ? { id: a.articleConnecteurs, quantity: connecteurs } : { id: a.articleConnecteurs, deleted: true });
  else if (connecteurs > 0) items.push({ price: await prixConnecteur(Math.round(prixConn * 100)), quantity: connecteurs });
  const maj = await appel<Abonnement>("POST", `/subscriptions/${w.stripe_abonnement}`, { items, proration_behavior: "create_prorations" });
  await enregistrerAbonnement(sb, maj);
  return lireAbonnement(maj);
}

async function enregistrerAbonnement(sb: SupabaseClient, a: Abonnement) {
  const wsId = a.metadata?.workspace_id;
  if (!wsId) return;
  const l = lireAbonnement(a);
  const enCours = STATUTS_EN_COURS.includes(a.status);
  await sb.from("studio_workspaces").update({
    stripe_abonnement: a.id, stripe_client: a.customer, abonnement_statut: a.status, abonnement_fin: l.fin,
    abonnement_agents: enCours ? l.agents : null, abonnement_connecteurs: enCours ? l.connecteurs : null,
    ...(enCours && a.status !== "incomplete" ? { abonnement_mensuel: l.montant_ht } : {}),
  }).eq("id", wsId);
  // Abonnement payé : l'espace d'essai devient un espace client (formule Essentiel).
  if (["active", "trialing"].includes(a.status)) {
    await sb.from("studio_workspaces").update({ offre: "essentiel", essai_fin: null }).eq("id", wsId).eq("offre", "essai");
  }
  // Grille des contrats : droits du contrat payé ; abonnement terminé → retour au Stage gratuit.
  if (l.contrat && ["active", "trialing", "past_due"].includes(a.status)) await appliquerContrat(sb, wsId, l.contrat);
  else if (["canceled", "incomplete_expired", "unpaid"].includes(a.status)) {
    const { data: w } = await sb.from("studio_workspaces").select("contrat, stripe_abonnement").eq("id", wsId).maybeSingle();
    if (w?.contrat && w.stripe_abonnement === a.id) await appliquerContrat(sb, wsId, contrats.CHOIX_STAGE);
  }
}

type Session = {
  id: string; mode: string; payment_status: string; subscription?: string | null;
  metadata?: Record<string, string>;
};

/** Traite un événement Stripe déjà authentifié ; renvoie ce qui a été fait (journal de la fonction). */
export async function traiterEvenement(sb: SupabaseClient, evt: { type: string; data: { object: Record<string, unknown> } }): Promise<string> {
  const o = evt.data.object;
  if ((o.metadata as Record<string, string> | undefined)?.app !== "studio") return "ignoré (hors Studio)";
  if (evt.type === "checkout.session.completed" || evt.type === "checkout.session.async_payment_succeeded") {
    const s = o as unknown as Session;
    const m = s.metadata ?? {};
    if (s.mode === "payment" && m.nature === "recharge") {
      if (s.payment_status !== "paid") return "recharge en attente de paiement";
      const credits = Math.floor(Number(m.credits)), prixHt = Number(m.prix_ht);
      if (!m.workspace_id || !(credits > 0)) return "recharge illisible";
      const { error } = await sb.from("studio_recharges").insert({
        workspace_id: m.workspace_id, nature: "achat", credits, prix_ht: Number.isFinite(prixHt) ? prixHt : null,
        acteur: m.acteur || "stripe", note: `Recharge de ${credits} crédits (payée en ligne)`, stripe_ref: s.id,
      });
      if (error) return error.code === "23505" ? "recharge déjà créditée" : `recharge : ${error.message}`;
      await journaliser(sb, { wsId: m.workspace_id, acteur: m.acteur || "stripe", action: "recharge_achetee", detail: { credits, prix_ht: prixHt, stripe: s.id } });
      return `recharge de ${credits} crédits créditée`;
    }
    if (s.mode === "subscription" && s.subscription) {
      await enregistrerAbonnement(sb, await appel<Abonnement>("GET", `/subscriptions/${s.subscription}`));
      return "abonnement enregistré";
    }
    return "session ignorée";
  }
  if (evt.type.startsWith("customer.subscription.")) {
    await enregistrerAbonnement(sb, o as unknown as Abonnement);
    return `abonnement ${String(o.status)}`;
  }
  return "ignoré";
}
