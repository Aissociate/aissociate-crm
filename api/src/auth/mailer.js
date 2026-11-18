// E-mails de l'authentification, envoyés avec le SMTP déjà configuré dans le
// CRM (Paramètres › SMTP, table parametres). Variables SMTP_* en secours.
import nodemailer from 'nodemailer';
import { smtpSettings } from './store.js';

async function transportConfig() {
  const s = (await smtpSettings().catch(() => null)) ?? {};
  const host = s.host || process.env.SMTP_HOST;
  const user = s.user || process.env.SMTP_USERNAME;
  const pass = s.password || process.env.SMTP_PASSWORD;
  const from = s.from || process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) return null;
  const port = Number(s.port || process.env.SMTP_PORT || 465);
  return { from, options: { host, port, secure: s.secure ?? port === 465, auth: { user, pass }, connectionTimeout: 10_000, socketTimeout: 15_000 } };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Renvoie false (sans lever) si le SMTP n'est pas configuré ou si l'envoi échoue. */
export async function sendRecoveryEmail(to, link, log) {
  const cfg = await transportConfig();
  if (!cfg) { log.warn('auth : SMTP non configuré, e-mail de réinitialisation non envoyé'); return false; }
  try {
    await nodemailer.createTransport(cfg.options).sendMail({
      from: cfg.from,
      to,
      subject: 'Réinitialisation de votre mot de passe — Aissociate',
      text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure, utilisable une seule fois) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.\n\nAissociate`,
      html: `<p>Bonjour,</p><p>Pour choisir un nouveau mot de passe, cliquez sur ce lien (valable 1 heure, utilisable une seule fois) :</p><p><a href="${esc(link)}">Réinitialiser mon mot de passe</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.</p><p>Aissociate</p>`,
    });
    return true;
  } catch (err) {
    log.error({ msg: 'auth : envoi de l\'e-mail de réinitialisation impossible', err: err.message });
    return false;
  }
}
