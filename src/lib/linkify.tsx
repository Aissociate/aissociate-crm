// Détection des liens dans un texte brut (ticket Benjamin « liens cliquables »).
// Un seul repérage sert aux deux usages : le HTML des e-mails sortants et
// l'affichage des messages dans la messagerie du CRM.

// URL explicite (http/https), domaine en www., adresse e-mail.
// La ponctuation finale (« . » « , » « ) » …) est volontairement laissée hors du
// lien : elle appartient à la phrase, pas à l'adresse.
const TOKEN = /((?:https?:\/\/|www\.)[^\s<>"']+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const TRAILING = /[.,;:!?)\]}«»"']+$/;

export type LinkPart =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string; href: string };

/** Découpe un texte en fragments texte / liens. */
export function linkParts(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let last = 0;
  for (const m of (text ?? '').matchAll(TOKEN)) {
    const start = m.index ?? 0;
    let token = m[0];
    // Ponctuation collée à la fin : elle reste dans le texte.
    const tail = token.match(TRAILING)?.[0] ?? '';
    if (tail) token = token.slice(0, -tail.length);
    if (!token) continue;
    if (start > last) parts.push({ kind: 'text', value: text.slice(last, start) });
    const href = token.includes('@') && !/^https?:\/\//i.test(token)
      ? `mailto:${token}`
      : (/^www\./i.test(token) ? `https://${token}` : token);
    parts.push({ kind: 'link', value: token, href });
    last = start + token.length;
  }
  if (last < (text ?? '').length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Texte brut → HTML pour un e-mail sortant : contenu échappé, liens rendus
 * cliquables, retours à la ligne conservés. Les destinataires se plaignaient de
 * liens « inactifs » : le corps partait en texte nu dans un message HTML.
 */
export function linkifyHtml(text: string): string {
  return linkParts(text ?? '')
    .map((p) =>
      p.kind === 'link'
        ? `<a href="${esc(p.href)}" style="color:#2563eb;text-decoration:underline">${esc(p.value)}</a>`
        : miseEnForme(esc(p.value)),
    )
    .join('')
    .replace(/\n/g, '<br>');
}

/**
 * Mise en forme légère du corps : **gras** et _italique_. Le corps reste du
 * texte dans la base (affichage et recherche inchangés) ; la conversion n'a lieu
 * qu'au moment de produire le HTML du message.
 * Appliqué sur du texte DÉJÀ échappé — d'où l'absence de nouvel échappement ici.
 */
function miseEnForme(html: string): string {
  return html
    .replace(/\*\*([^\n*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^\n_]+)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
}

/** Affichage in-app d'un texte dont les liens sont cliquables. */
export function LinkedText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {linkParts(text ?? '').map((p, i) =>
        p.kind === 'link' ? (
          <a
            key={i} href={p.href} target="_blank" rel="noopener noreferrer"
            className="text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-400"
            onClick={(e) => e.stopPropagation()}
          >
            {p.value}
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  );
}
