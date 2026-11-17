// « Mon périmètre » : ce que couvre la formule, consommation du mois, plafond
// IA du jour et interrupteur d'urgence (suspendre / relancer les agents).
import { useCallback, useEffect, useState } from 'react';
import { BatteryCharging, Lock, PauseCircle, PlayCircle } from 'lucide-react';
import { appel } from '../api';
import { Avatar, Bouton, Carte, Chargement, Titre, cx } from '../composants';
import Confirmation from '../composants/Confirmation';
import { useStudio } from '../StudioApp';

type Quota = { utilise?: number; max: number | null };
type Perimetre = {
  suspendu: boolean; suspendu_le: string | null; suspendu_par: string | null;
  budget_ia_jour_eur: number | null; budget_utilise_pct: number | null;
  offre: string; expire_le: string | null;
  agents: { id: string; prenom: string; metier: string; photo: string | null; couleur: string; ouvert: boolean }[];
  quotas: { demandes: Quota; images: Quota; videos: Quota; utilisateurs: Quota };
  recharges?: Recharges;
};
type Recharges = {
  solde: number; consommes_mois: number; achat_libre: boolean;
  packs: { prix: number; credits: number }[];
  couts: { demande: number; image: number; video: number };
  historique: { nature: string; credits: number; prix_ht: number | null; note: string | null; created_at: string }[];
};
const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

function Jauge({ label, q }: { label: string; q: Quota }) {
  const pct = q.max ? Math.min(100, Math.round(((q.utilise ?? 0) / q.max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-neutral-600">{label}</span>
        <span className="font-medium">{q.utilise ?? 0}{q.max != null ? ` / ${q.max}` : ' (illimité)'}</span></div>
      {q.max != null && (
        <div className="mt-1.5 h-2 rounded-full bg-neutral-100">
          <div className={cx('h-2 rounded-full', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function PagePerimetre() {
  const { me, gerer } = useStudio();
  const [p, setP] = useState<Perimetre | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [demandeSuspension, setDemandeSuspension] = useState(false);
  const [achat, setAchat] = useState<number | null>(null);
  const [merci, setMerci] = useState('');
  const proprietaire = me.user.role === 'proprietaire';

  const charger = useCallback(() => appel<Perimetre>('perimetre').then(setP).catch((e) => setErreur(gerer(e))), [gerer]);
  useEffect(() => { charger(); }, [charger]);

  const appliquerBascule = async () => {
    if (!p) return;
    setEnvoi(true);
    try { await appel('suspendre', { suspendu: !p.suspendu }); await charger(); }
    catch (e) { setErreur(gerer(e)); } finally { setEnvoi(false); setDemandeSuspension(false); }
  };

  const acheter = async () => {
    if (achat === null || !p?.recharges) return;
    const pack = p.recharges.packs[achat];
    setEnvoi(true); setErreur('');
    try {
      await appel('recharge_acheter', { pack: achat });
      setMerci(`${pack.credits} crédits ajoutés. ${eur(pack.prix)} HT figureront sur votre prochaine facture.`);
      await charger();
    } catch (e) { setErreur(gerer(e)); } finally { setEnvoi(false); setAchat(null); }
  };

  const basculer = () => {
    if (!p) return;
    // Suspension = geste à risque : on demande confirmation. Reprise = direct.
    if (!p.suspendu) setDemandeSuspension(true);
    else void appliquerBascule();
  };

  if (!p) return erreur ? <p className="text-sm text-red-700">{erreur}</p> : <Chargement />;
  return (
    <div className="space-y-6">
      <Titre sous="Ce que couvre votre formule, ce que vous avez consommé ce mois-ci, et l'arrêt d'urgence de vos agents.">Mon périmètre</Titre>

      <Carte className={cx(p.suspendu && 'border-red-200 bg-red-50')}>
        <div className="flex flex-wrap items-center gap-4">
          {p.suspendu ? <PauseCircle className="h-8 w-8 text-red-600" /> : <PlayCircle className="h-8 w-8 text-emerald-600" />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.suspendu ? 'Vos agents sont suspendus' : 'Vos agents sont actifs'}</p>
            <p className="text-sm text-neutral-600">
              {p.suspendu
                ? `Depuis le ${new Date(p.suspendu_le ?? '').toLocaleString('fr-FR')}${p.suspendu_par === 'crm' ? ' (par Aissociate)' : ''}. Aucune mission n'est traitée.`
                : 'En cas de doute (erreur répétée, donnée sensible…), suspendez-les d\'un clic : tout s\'arrête immédiatement.'}
            </p>
          </div>
          {proprietaire && (
            <Bouton variante={p.suspendu ? 'noir' : 'clair'} onClick={basculer} disabled={envoi}
              className={cx(!p.suspendu && 'border-red-200 text-red-700 hover:bg-red-50')}>
              {p.suspendu ? 'Relancer les agents' : 'Suspendre les agents'}
            </Bouton>
          )}
        </div>
      </Carte>

      <div className="grid gap-6 lg:grid-cols-2">
        <Carte>
          <p className="mb-4 font-semibold">Consommation du mois</p>
          <div className="space-y-4">
            <Jauge label="Demandes aux agents" q={p.quotas.demandes} />
            <Jauge label="Visuels" q={p.quotas.images} />
            <Jauge label="Vidéos" q={p.quotas.videos} />
          </div>
          <p className="mt-3 text-xs text-neutral-500">1 demande = 1 message envoyé à un agent (relances comprises). Une demande relayée à un collègue ne compte pas ; les visuels et vidéos ont leurs propres quotas.</p>
          {p.budget_utilise_pct != null && (
            <div className="mt-5 border-t border-neutral-100 pt-4">
              <Jauge label="Plafond IA du jour (en %)" q={{ utilise: p.budget_utilise_pct, max: 100 }} />
              <p className="mt-1.5 text-xs text-neutral-500">Au plafond, les agents s'arrêtent jusqu'au lendemain : jamais de dépassement surprise.</p>
            </div>
          )}
        </Carte>

        <Carte>
          <p className="mb-1 font-semibold">Votre équipe</p>
          <p className="mb-4 text-sm text-neutral-500">
            Formule {p.offre.replace('_', ' ')}{p.expire_le ? ` — jusqu'au ${new Date(p.expire_le).toLocaleDateString('fr-FR')}` : ''}
            {p.quotas.utilisateurs.max ? ` · ${p.quotas.utilisateurs.max} accès inclus` : ''}
          </p>
          <ul className="space-y-2">
            {p.agents.map((a) => (
              <li key={a.id} className={cx('flex items-center gap-3 rounded-xl p-2', !a.ouvert && 'opacity-50')}>
                <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.prenom}</p>
                  <p className="truncate text-xs text-neutral-500">{a.metier}</p>
                </div>
                {a.ouvert
                  ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Inclus</span>
                  : <span className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500"><Lock className="h-3 w-3" /> Hors formule</span>}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-neutral-500">
            Un agent de plus ? Écrivez à <a className="underline" href="mailto:contact@aissociate.re">contact@aissociate.re</a>.
          </p>
        </Carte>
      </div>
      {p.recharges && (() => {
        const r = p.recharges;
        return (
          <Carte>
            <div className="flex flex-wrap items-start gap-6">
              <div className="min-w-[12rem]">
                <p className="flex items-center gap-2 font-semibold"><BatteryCharging className="h-5 w-5 text-emerald-600" />Crédits de recharge</p>
                <p className="mt-2 text-3xl font-semibold">{r.solde}<span className="text-base font-normal text-neutral-400"> crédits</span></p>
                <p className="mt-1 text-xs text-neutral-500">Reportés de mois en mois, sans date limite.{r.consommes_mois ? ` ${r.consommes_mois} utilisés ce mois-ci.` : ''}</p>
              </div>
              <div className="min-w-0 flex-1 text-sm text-neutral-600">
                <p>Utilisés seulement quand un quota du mois est atteint, pour continuer sans attendre le mois suivant :</p>
                <p className="mt-1 text-neutral-500">1 demande = {r.couts.demande} crédit{r.couts.demande > 1 ? 's' : ''} · 1 visuel = {r.couts.image} · 1 vidéo = {r.couts.video}</p>
                {proprietaire && r.achat_libre ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.packs.map((pk, i) => (
                      <Bouton key={i} variante={i === 0 ? 'clair' : 'noir'} disabled={envoi} onClick={() => { setMerci(''); setAchat(i); }}>
                        +{pk.credits} crédits · {eur(pk.prix)} HT
                      </Bouton>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">
                    {r.achat_libre ? "Le propriétaire de l'espace peut ajouter des crédits." : <>Pour ajouter des crédits, écrivez à <a className="underline" href="mailto:contact@aissociate.re">contact@aissociate.re</a>.</>}
                  </p>
                )}
                {merci && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{merci}</p>}
              </div>
            </div>
            {r.historique.length > 0 && (
              <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100 text-sm">
                {r.historique.map((h, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2">
                    <span className="text-neutral-600">{new Date(h.created_at).toLocaleDateString('fr-FR')} · {h.note || (h.nature === 'offert' ? 'Crédits offerts' : 'Ajustement')}</span>
                    <span className="whitespace-nowrap font-medium">{h.credits > 0 ? '+' : ''}{h.credits}{h.prix_ht ? ` · ${eur(Number(h.prix_ht))} HT` : h.nature === 'offert' ? ' · offerts' : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        );
      })()}
      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      <Confirmation
        ouvert={achat !== null}
        titre={achat !== null && p.recharges ? `Ajouter ${p.recharges.packs[achat].credits} crédits ?` : ''}
        message={achat !== null && p.recharges ? `${eur(p.recharges.packs[achat].prix)} HT, ajoutés à votre prochaine facture. Les crédits sont disponibles tout de suite et se reportent de mois en mois.` : ''}
        confirmer={{ label: 'Ajouter les crédits', onClick: acheter }}
        annuler={{ onClick: () => setAchat(null) }}
        enCours={envoi}
      />
      <Confirmation
        ouvert={demandeSuspension}
        titre="Suspendre tous les agents ?"
        message="Plus aucune mission ne sera traitée tant que vous n'aurez pas relancé l'espace. Les conversations en cours seront interrompues."
        confirmer={{ label: 'Suspendre', danger: true, onClick: appliquerBascule }}
        annuler={{ onClick: () => setDemandeSuspension(false) }}
        enCours={envoi}
      />
    </div>
  );
}
