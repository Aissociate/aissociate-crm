// E-mails transactionnels du Studio (identifiants de l'essai…), par le même SMTP que la
// fonction send-email du CRM : secrets SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD,
// SMTP_FROM en priorité, sinon la table parametres (cle = 'smtp').
import nodemailer from "npm:nodemailer@6.9.15";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

type Smtp = { host?: string; port: number; user?: string; pass?: string; from?: string };

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

/** Envoie un e-mail ; lève une erreur si le SMTP n'est pas configuré ou refuse l'envoi. */
export async function envoyer(sb: SupabaseClient, m: { a: string; objet: string; html: string; texte: string }): Promise<void> {
  const c = await config(sb);
  if (!c.host || !c.user || !c.pass || !c.from) throw new Error("SMTP non configuré");
  const t = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass } });
  await t.sendMail({ from: c.from, to: m.a, subject: m.objet, html: m.html, text: m.texte });
}

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
