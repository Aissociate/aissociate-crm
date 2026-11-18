// E-mails transactionnels du Studio (identifiants de l'essai…), envoyés depuis contact@aissociate.re,
// sur le serveur SMTP du CRM (SMTP_HOST / SMTP_PORT, sinon la table parametres, cle = 'smtp').
//
// Le serveur peut refuser un expéditeur qui n'appartient pas à la boîte authentifiée. Ordre d'essai :
//   1. boîte contact@ elle-même si ses identifiants sont posés (STUDIO_SMTP_USERNAME / STUDIO_SMTP_PASSWORD) ;
//   2. boîte du CRM avec l'expéditeur contact@ ;
//   3. boîte du CRM avec son propre expéditeur.
// Les réponses vont toujours à contact@aissociate.re. STUDIO_SMTP_FROM change l'expéditeur.
import nodemailer from "npm:nodemailer@6.9.15";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

type Smtp = { host?: string; port: number; user?: string; pass?: string; from?: string };

export const ADRESSE_STUDIO = "contact@aissociate.re";
export const EXPEDITEUR_STUDIO = `"Aissociate Studio IA" <${ADRESSE_STUDIO}>`;

async function config(sb: SupabaseClient): Promise<Smtp> {
  const env = {
    host: Deno.env.get("SMTP_HOST"), user: Deno.env.get("SMTP_USERNAME"), pass: Deno.env.get("SMTP_PASSWORD"),
    from: Deno.env.get("SMTP_FROM"), port: Number(Deno.env.get("SMTP_PORT") ?? "0") || 587,
  };
  if (env.host && env.user && env.pass) return { ...env, from: env.from ?? env.user };
  const { data } = await sb.from("parametres").select("valeur").eq("cle", "smtp").maybeSingle();
  const c = (data?.valeur ?? {}) as Record<string, unknown>;
  return {
    host: c.host as string | undefined, user: c.user as string | undefined, pass: c.password as string | undefined,
    from: (c.from as string | undefined) ?? (c.user as string | undefined), port: Number(c.port) || 587,
  };
}

async function expedier(c: Smtp, m: { a: string; objet: string; html: string; texte: string }, from: string) {
  if (!c.host || !c.user || !c.pass || !from) throw new Error("SMTP non configuré");
  const t = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass } });
  await t.sendMail({ from, replyTo: ADRESSE_STUDIO, to: m.a, subject: m.objet, html: m.html, text: m.texte });
}

/** Envoie un e-mail depuis contact@ (voir l'ordre d'essai en tête) ; erreur si aucun envoi n'a abouti. */
export async function envoyer(sb: SupabaseClient, m: { a: string; objet: string; html: string; texte: string }): Promise<void> {
  const c = await config(sb);
  const from = Deno.env.get("STUDIO_SMTP_FROM")?.trim() || EXPEDITEUR_STUDIO;
  const user = Deno.env.get("STUDIO_SMTP_USERNAME")?.trim(), pass = Deno.env.get("STUDIO_SMTP_PASSWORD");
  const essais: [Smtp, string][] = [...(user && pass ? [[{ ...c, user, pass }, from] as [Smtp, string]] : []), [c, from], [c, c.from ?? ""]];
  let derniere: unknown = null;
  for (const [smtp, expediteur] of essais) {
    try { await expedier(smtp, m, expediteur); return; }
    catch (e) {
      derniere = e;
      console.error(`[studio] envoi refusé (${smtp.user} → ${expediteur}) :`, e instanceof Error ? e.message : String(e));
    }
  }
  throw derniere instanceof Error ? derniere : new Error("Envoi impossible");
}

/** Contrôle des connexions SMTP (sans envoi) : chaque compte de la chaîne d'envoi s'authentifie-t-il ? */
export async function verifierSmtp(sb: SupabaseClient): Promise<{ compte: string; ok: boolean; erreur?: string }[]> {
  const c = await config(sb);
  const user = Deno.env.get("STUDIO_SMTP_USERNAME")?.trim(), pass = Deno.env.get("STUDIO_SMTP_PASSWORD");
  const comptes: [string, Smtp][] = [...(user && pass ? [[`boîte dédiée (${user})`, { ...c, user, pass }] as [string, Smtp]] : []), [`boîte du CRM (${c.user ?? "non configurée"})`, c]];
  return await Promise.all(comptes.map(async ([compte, s]) => {
    if (!s.host || !s.user || !s.pass) return { compte, ok: false, erreur: "SMTP non configuré" };
    try {
      const t = nodemailer.createTransport({ host: s.host, port: s.port, secure: s.port === 465, auth: { user: s.user, pass: s.pass }, connectionTimeout: 15_000 });
      await t.verify();
      return { compte, ok: true };
    } catch (e) {
      return { compte, ok: false, erreur: e instanceof Error ? e.message : String(e) };
    }
  }));
}

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** E-mail « mot de passe oublié » : lien à usage unique, valable une heure. */
export function mailReinitialisation(p: { prenom: string | null; lien: string }) {
  const bonjour = `Bonjour${p.prenom ? ` ${p.prenom}` : ""},`;
  const lignes = [
    "Vous avez demandé à choisir un nouveau mot de passe pour votre Studio IA. Ce lien est valable une heure et ne sert qu'une fois.",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.",
  ];
  const texte = [bonjour, "", lignes[0], "", p.lien, "", lignes[1], "", "L'équipe Aissociate"].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:560px">
<p>${echapper(bonjour)}</p><p>${echapper(lignes[0])}</p>
<p><a href="${echapper(p.lien)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px">Choisir un nouveau mot de passe</a></p>
<p style="color:#6b7280;font-size:13px">${echapper(lignes[1])}</p><p>L'équipe Aissociate</p></div>`;
  return { objet: "Studio IA : choisissez un nouveau mot de passe", html, texte };
}

/** E-mail d'accueil de l'essai : adresse de connexion, identifiant, mot de passe provisoire. */
export function mailIdentifiants(p: { prenom: string | null; entreprise: string; email: string; motDePasse: string; site: string; finEssai: string; jours: number }) {
  const url = `${p.site.replace(/\/$/, "")}/studio/connexion`;
  const fin = new Date(p.finEssai).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Indian/Reunion" });
  const bonjour = `Bonjour${p.prenom ? ` ${p.prenom}` : ""},`;
  const lignes = [
    `Votre Studio IA${p.entreprise ? ` « ${p.entreprise} »` : ""} est prêt : vous pouvez l'essayer gratuitement pendant ${p.jours} jours, jusqu'au ${fin}.`,
    `Pendant l'essai, vos agents travaillent avec les quotas habituels et vous pouvez connecter un outil (messagerie, agenda ou réseau social). À la fin de l'essai, choisissez votre abonnement dans « Mon périmètre » pour continuer : sans abonnement, l'accès aux agents est suspendu.`,
  ];
  const texte = [
    bonjour, "", ...lignes, "",
    `Adresse : ${url}`, `Identifiant : ${p.email}`, `Mot de passe provisoire : ${p.motDePasse}`, "",
    "À la première connexion, vous choisirez votre propre mot de passe puis accepterez nos conditions générales de vente et notre accord de traitement des données.",
    "", "Une question ? Répondez simplement à cet e-mail ou écrivez à contact@aissociate.re.", "", "L'équipe Aissociate",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:560px">
<p>${echapper(bonjour)}</p>${lignes.map((l) => `<p>${echapper(l)}</p>`).join("")}
<table style="border-collapse:collapse;margin:18px 0;background:#f5f5f4;border-radius:12px"><tbody>
<tr><td style="padding:10px 16px;color:#6b7280">Adresse</td><td style="padding:10px 16px"><a href="${echapper(url)}">${echapper(url)}</a></td></tr>
<tr><td style="padding:10px 16px;color:#6b7280">Identifiant</td><td style="padding:10px 16px">${echapper(p.email)}</td></tr>
<tr><td style="padding:10px 16px;color:#6b7280">Mot de passe provisoire</td><td style="padding:10px 16px;font-family:monospace;font-size:16px"><b>${echapper(p.motDePasse)}</b></td></tr>
</tbody></table>
<p><a href="${echapper(url)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px">Ouvrir mon Studio IA</a></p>
<p style="color:#6b7280;font-size:13px">À la première connexion, vous choisirez votre propre mot de passe puis accepterez nos conditions générales de vente et notre accord de traitement des données.</p>
<p>Une question ? Répondez simplement à cet e-mail ou écrivez à contact@aissociate.re.</p><p>L'équipe Aissociate</p></div>`;
  return { objet: "Votre Studio IA est prêt : vos identifiants pour l'essai gratuit", html, texte };
}
