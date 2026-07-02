// Construction de la signature des e-mails sortants (ticket Benjamin « signature du mail »).
// Deux modes : « auto » (bâtie depuis l'organisme + logo, avec préfixe expéditeur
// optionnel) ou « custom » (HTML libre saisi dans Paramètres).

export type OrganismeInfo = {
  nom?: string; email?: string; telephone?: string; adresse?: string;
  code_postal?: string; ville?: string; logo_url?: string;
};

export type SignatureCfg = {
  mode?: 'auto' | 'custom';
  html?: string;
  include_sender?: boolean;
};

export type SignatureSender = {
  prenom?: string | null; nom?: string | null;
  telephone?: string | null; email?: string | null;
  signature?: string | null; // signature libre propre à l'utilisateur
};

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Renvoie le bloc HTML de signature à concaténer au corps de l'e-mail.
 * Chaîne vide si rien d'exploitable (ni organisme, ni signature personnalisée).
 */
export function buildSignatureHtml(
  cfg: SignatureCfg | null | undefined,
  org: OrganismeInfo | null | undefined,
  sender?: SignatureSender | null,
): string {
  const c = cfg ?? {};

  // Mode personnalisé : HTML libre saisi par l'administrateur.
  if (c.mode === 'custom' && c.html && c.html.trim()) return c.html;

  const o = org ?? {};
  const lines: string[] = [];

  // Préfixe « expéditeur » — activé par défaut. Priorité à la signature personnelle
  // (texte libre propre à l'utilisateur) ; à défaut, nom + coordonnées.
  if (c.include_sender !== false && sender?.signature && sender.signature.trim()) {
    lines.push(`<div style="color:#0f172a">${esc(sender.signature.trim()).replace(/\n/g, '<br>')}</div>`);
  } else if (c.include_sender !== false && sender && (sender.prenom || sender.nom)) {
    lines.push(`<div style="font-weight:600;color:#0f172a">${esc([sender.prenom, sender.nom].filter(Boolean).join(' '))}</div>`);
    const sub = [sender.telephone, sender.email].filter(Boolean).map((s) => esc(String(s))).join(' · ');
    if (sub) lines.push(`<div style="color:#475569">${sub}</div>`);
  }

  // Bloc organisme (coordonnées).
  if (o.nom) lines.push(`<div style="font-weight:600;color:#0f172a">${esc(o.nom)}</div>`);
  const addr = [o.adresse, [o.code_postal, o.ville].filter(Boolean).join(' ')]
    .filter(Boolean).map((s) => esc(String(s))).join(', ');
  if (addr) lines.push(`<div style="color:#475569">${addr}</div>`);
  const contact = [o.telephone ? `Tél. ${o.telephone}` : '', o.email]
    .filter(Boolean).map((s) => esc(String(s))).join(' · ');
  if (contact) lines.push(`<div style="color:#475569">${contact}</div>`);

  const logo = o.logo_url
    ? `<img src="${o.logo_url}" alt="${esc(o.nom ?? '')}" style="max-height:56px;margin-bottom:8px;display:block" />`
    : '';

  if (!logo && lines.length === 0) return '';

  return `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5">
${logo}${lines.join('\n')}
</div>`;
}

/** Aperçu texte court de la signature (pour l'UI de composition). */
export function signatureSummary(cfg: SignatureCfg | null | undefined, org: OrganismeInfo | null | undefined): string {
  const c = cfg ?? {};
  if (c.mode === 'custom') return 'Signature personnalisée (HTML)';
  const o = org ?? {};
  const bits = [o.nom, o.telephone, o.email].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Coordonnées de l\'organisme';
}
