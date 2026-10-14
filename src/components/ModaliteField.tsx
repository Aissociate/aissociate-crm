import { useState } from 'react';
import { MODALITES } from '@/lib/constants';

const LIBRE = '__libre__';
const estCode = (v: string) => (MODALITES as readonly string[]).includes(v);

/**
 * Modalité : un des codes standard, ou un libellé saisi à la main
 * (ex. « Présentiel (2 jours en collectif) + e-learning »). Le texte libre est
 * stocké tel quel et imprimé mot pour mot sur les documents.
 */
export default function ModaliteField({ value, onChange }: { value: string | null | undefined; onChange: (v: string) => void }) {
  const v = value ?? '';
  // Mode manuel conservé tant que l'utilisateur ne repasse pas sur un code,
  // même si son texte vide ou égal à un code.
  const [manuel, setManuel] = useState(!!v && !estCode(v));
  const libre = manuel || (!!v && !estCode(v));
  return (
    <div className="space-y-2">
      <select
        className="input"
        value={libre ? LIBRE : (v || 'presentiel')}
        onChange={(e) => {
          if (e.target.value === LIBRE) { setManuel(true); onChange(estCode(v) ? '' : v); }
          else { setManuel(false); onChange(e.target.value); }
        }}
      >
        {MODALITES.map((m) => <option key={m} value={m}>{m}</option>)}
        <option value={LIBRE}>Autre (saisie manuelle)…</option>
      </select>
      {libre && (
        <input
          className="input"
          placeholder="ex. Présentiel (2 jours en collectif) + e-learning"
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
