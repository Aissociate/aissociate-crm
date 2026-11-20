// Petite animation pendant qu'une réponse se prépare : l'agent au travail (anneau qui pulse),
// et, s'il a sollicité un collègue, un fil de points animé jusqu'au collègue qui travaille à son tour.
// Les animations ne jouent que si l'utilisateur n'a pas demandé de réduire les mouvements.
import type { Agent } from './api';
import { Avatar, cx } from './composants';

function AvatarActif({ a, actif }: { a: Agent; actif: boolean }) {
  return (
    <span className="relative inline-flex shrink-0">
      {actif && <span aria-hidden className="absolute inset-0 rounded-full motion-safe:animate-ping" style={{ background: `${a.couleur}55` }} />}
      <span className={cx('relative rounded-full ring-2 ring-offset-1', actif ? 'ring-orange-400' : 'ring-transparent opacity-70')}>
        <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={26} />
      </span>
    </span>
  );
}

const Points = ({ couleur = 'bg-neutral-300' }: { couleur?: string }) => (
  <span aria-hidden className="flex items-center gap-1">
    {[0, 1, 2].map((d) => (
      <span key={d} className={cx('h-1.5 w-1.5 rounded-full motion-safe:animate-bounce', couleur)} style={{ animationDelay: `${d * 140}ms` }} />
    ))}
  </span>
);

export default function EnTravail({ agent, collegue }: { agent: Agent; collegue: Agent | null }) {
  const texte = collegue ? `${agent.prenom} a sollicité ${collegue.prenom}, qui travaille…` : `${agent.prenom} travaille…`;
  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 py-1 text-xs text-neutral-500">
      <AvatarActif a={agent} actif={!collegue} />
      {collegue ? (
        <>
          <Points couleur="bg-orange-400" />
          <AvatarActif a={collegue} actif />
        </>
      ) : <Points />}
      <span>{texte}</span>
    </div>
  );
}
