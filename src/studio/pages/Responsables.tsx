import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, UserMinus, UserCheck, Crown } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { appel } from '../api';
import { Bouton, Carte, Chargement, Titre } from '../composants';

const CONTRAT = '/studio/reglages/perimetre/contrat';

type Responsable = { id: string; email: string; prenom: string | null; nom: string | null; role: string; actif: boolean };
type Etat = { responsables: Responsable[]; max: number; actifs: number; proprietaire: boolean; moi: string };
type Reponse = Etat & { email_envoye?: boolean; mot_de_passe?: string | null };

/**
 * Responsables de l'espace : les personnes qui donnent des consignes aux agents.
 * Leur nombre dépend du contrat (et de l'avenant « Responsables supplémentaires ») ; le propriétaire
 * invite, retire et réactive lui-même (fonction studio, responsables.ts).
 */
export default function Responsables() {
  const { gerer } = useStudio();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState({ email: '', prenom: '', nom: '' });

  const charger = useCallback(async () => {
    try { setEtat(await appel<Etat>('responsables')); } catch (e) { setErreur(gerer(e)); }
  }, [gerer]);
  useEffect(() => { void charger(); }, [charger]);

  const agir = async (action: string, body: Record<string, unknown>, succes: (r: Reponse) => string) => {
    setErreur(''); setInfo(''); setEnvoi(true);
    try {
      const r = await appel<Reponse>(action, body);
      setEtat((e) => (e ? { ...e, ...r } : e));
      setInfo(succes(r));
      return true;
    } catch (e) { setErreur(gerer(e)); return false; } finally { setEnvoi(false); }
  };

  const inviter = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await agir('responsable_inviter', form, (r) => (r.email_envoye
      ? `Invitation envoyée à ${form.email}. Ses identifiants arrivent par e-mail.`
      : `Compte créé, mais l'e-mail n'est pas parti. Transmettez vous-même ce mot de passe provisoire à ${form.email} : ${r.mot_de_passe}`));
    if (ok) setForm({ email: '', prenom: '', nom: '' });
  };

  if (!etat) return erreur ? <p className="text-sm text-red-700">{erreur}</p> : <Chargement />;

  const plein = etat.actifs >= etat.max;
  const nomDe = (r: Responsable) => [r.prenom, r.nom].filter(Boolean).join(' ') || r.email;
  const champ = 'w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-900';

  return (
    <>
      <Titre sous="Les personnes de votre entreprise qui donnent des consignes aux agents et valident leur travail.">Responsables</Titre>

      <Carte className="mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm text-neutral-600">
            <span className="font-display text-2xl font-extrabold text-neutral-900">{etat.actifs} / {etat.max}</span>
            {' '}responsable{etat.max > 1 ? 's' : ''} inclus dans votre contrat
          </p>
          {etat.proprietaire && (
            <Link to={CONTRAT} className="text-sm font-medium text-orange-600 underline">
              Ajouter des places (14,90 € HT / responsable / mois)
            </Link>
          )}
        </div>

        <ul className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
          {etat.responsables.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className={r.actif ? '' : 'opacity-60'}>
                <p className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                  {nomDe(r)}
                  {r.role === 'proprietaire' && <span className="inline-flex items-center gap-1 text-xs font-normal text-neutral-500"><Crown className="h-3.5 w-3.5" /> propriétaire</span>}
                  {r.id === etat.moi && <span className="text-xs font-normal text-neutral-500">(vous)</span>}
                  {!r.actif && <span className="text-xs font-normal text-neutral-500">· retiré</span>}
                </p>
                {nomDe(r) !== r.email && <p className="text-xs text-neutral-500">{r.email}</p>}
              </div>
              {etat.proprietaire && r.role !== 'proprietaire' && (r.actif ? (
                <Bouton variante="fantome" disabled={envoi}
                  onClick={() => { if (window.confirm(`Retirer l'accès de ${nomDe(r)} ? Son historique est conservé ; vous pourrez le réactiver.`)) void agir('responsable_retirer', { id: r.id }, () => `${nomDe(r)} n'a plus accès au Studio.`); }}>
                  <UserMinus className="h-4 w-4" /> Retirer
                </Bouton>
              ) : (
                <Bouton variante="clair" disabled={envoi || plein} title={plein ? 'Toutes les places de votre contrat sont prises' : undefined}
                  onClick={() => agir('responsable_reactiver', { id: r.id }, () => `${nomDe(r)} a de nouveau accès au Studio.`)}>
                  <UserCheck className="h-4 w-4" /> Réactiver
                </Bouton>
              ))}
            </li>
          ))}
        </ul>

        {erreur && <p className="mt-4 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
        {info && <p className="mt-4 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{info}</p>}
      </Carte>

      {etat.proprietaire ? (
        <Carte className="max-w-3xl p-6">
          <h2 className="flex items-center gap-2 font-semibold"><UserPlus className="h-5 w-5" /> Inviter un responsable</h2>
          {plein ? (
            <p className="mt-3 text-sm text-neutral-600">
              Toutes les places de votre contrat sont prises.{' '}
              <Link to={CONTRAT} className="font-medium text-orange-600 underline">Ajoutez un responsable à votre contrat</Link>
              {' '}ou retirez quelqu'un pour libérer une place.
            </p>
          ) : (
            <form onSubmit={inviter} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-neutral-700 sm:col-span-2">E-mail
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={champ} /></label>
              <label className="text-sm text-neutral-700">Prénom
                <input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className={champ} /></label>
              <label className="text-sm text-neutral-700">Nom
                <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={champ} /></label>
              <p className="text-xs text-neutral-500 sm:col-span-2">Il reçoit ses identifiants par e-mail et choisit son mot de passe à la première connexion.</p>
              <div className="sm:col-span-2"><Bouton type="submit" disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer l\'invitation'}</Bouton></div>
            </form>
          )}
        </Carte>
      ) : (
        <p className="max-w-3xl text-sm text-neutral-600">Seul le propriétaire de l'espace peut inviter ou retirer des responsables.</p>
      )}
    </>
  );
}
