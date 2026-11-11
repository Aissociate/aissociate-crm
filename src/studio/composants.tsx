// Briques d'interface du Studio IA (style propre au module, indépendant du thème CRM).
import { type ReactNode, Fragment } from 'react';

export function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' '); }

export function Avatar({ prenom, couleur, photo, taille = 40 }: { prenom: string; couleur: string; photo?: string | null; taille?: number }) {
  // Portrait (Nano Banana) si l'agent en a un, sinon pastille avec l'initiale.
  if (photo) {
    return (
      <img src={photo} alt="" aria-hidden width={taille} height={taille} loading="lazy"
        className="inline-block shrink-0 rounded-full object-cover object-top shadow-sm"
        style={{ width: taille, height: taille, background: couleur }} />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm"
      style={{ width: taille, height: taille, fontSize: taille * 0.42, background: `linear-gradient(135deg, ${couleur}, ${couleur}bb)` }}
      aria-hidden
    >
      {prenom.slice(0, 1)}
    </span>
  );
}

export function Bouton({
  children, variante = 'noir', className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'noir' | 'clair' | 'fantome' }) {
  const styles = {
    noir: 'bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-400',
    clair: 'bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 disabled:text-neutral-400',
    fantome: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
  }[variante];
  return (
    <button {...props} className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed', styles, className)}>
      {children}
    </button>
  );
}

export function Interrupteur({ actif, onChange, label }: { actif: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={actif} aria-label={label} onClick={() => onChange(!actif)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', actif ? 'bg-neutral-900' : 'bg-neutral-300')}
    >
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', actif ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Carte({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-neutral-200 bg-white p-5', className)}>{children}</div>;
}

export function Titre({ children, sous }: { children: ReactNode; sous?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{children}</h1>
      {sous && <p className="mt-1 text-sm text-neutral-500">{sous}</p>}
    </div>
  );
}

export function Chargement() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Chargement">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-orange-500 border-t-transparent" />
    </div>
  );
}

// ─── Markdown minimal et sûr (aucun HTML injecté) ───────────────────────────

function enLigne(texte: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let dernier = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(texte))) {
    if (m.index > dernier) out.push(texte.slice(dernier, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k++} className="rounded bg-neutral-100 px-1 py-0.5 text-[0.9em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    dernier = m.index + t.length;
  }
  if (dernier < texte.length) out.push(texte.slice(dernier));
  return out;
}

const cellules = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function Markdown({ texte }: { texte: string }) {
  const lignes = texte.replace(/\r/g, '').split('\n');
  const blocs: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lignes.length) {
    const l = lignes[i];
    if (l.trim().startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lignes.length && !lignes[i].trim().startsWith('```')) code.push(lignes[i++]);
      i++;
      blocs.push(<pre key={k++} className="overflow-x-auto rounded-xl bg-neutral-900 p-3 text-xs text-neutral-100">{code.join('\n')}</pre>);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lignes.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lignes[i + 1])) {
      const tete = cellules(l);
      i += 2;
      const rangs: string[][] = [];
      while (i < lignes.length && /^\s*\|.*\|\s*$/.test(lignes[i])) rangs.push(cellules(lignes[i++]));
      blocs.push(
        <div key={k++} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr>{tete.map((c, j) => <th key={j} className="border-b border-neutral-200 px-2 py-1.5 font-semibold">{enLigne(c)}</th>)}</tr></thead>
            <tbody>{rangs.map((r, x) => <tr key={x}>{r.map((c, j) => <td key={j} className="border-b border-neutral-100 px-2 py-1.5 align-top">{enLigne(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    const titre = /^(#{1,4})\s+(.*)$/.exec(l);
    if (titre) {
      const cls = titre[1].length <= 2 ? 'text-base font-semibold' : 'text-sm font-semibold';
      blocs.push(<p key={k++} className={cx(cls, 'mt-2')}>{enLigne(titre[2])}</p>);
      i++; continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordonnee = /^\s*\d/.test(l);
      const items: string[] = [];
      while (i < lignes.length && /^\s*([-*•]|\d+[.)])\s+/.test(lignes[i])) items.push(lignes[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
      const Liste = ordonnee ? 'ol' : 'ul';
      blocs.push(
        <Liste key={k++} className={cx('space-y-1 pl-5', ordonnee ? 'list-decimal' : 'list-disc')}>
          {items.map((it, j) => <li key={j}>{enLigne(it)}</li>)}
        </Liste>,
      );
      continue;
    }
    if (/^\s*---+\s*$/.test(l)) { blocs.push(<hr key={k++} className="border-neutral-200" />); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lignes.length && lignes[i].trim() && !/^(#{1,4}\s|```|\s*([-*•]|\d+[.)])\s|\s*\|)/.test(lignes[i])) para.push(lignes[i++]);
    if (!para.length) { para.push(l); i++; }
    blocs.push(<p key={k++}>{para.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{enLigne(p)}</Fragment>)}</p>);
  }
  return <div className="space-y-2 text-sm leading-relaxed text-neutral-800">{blocs}</div>;
}
