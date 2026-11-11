import { useState } from 'react';
import { useStudio } from '../StudioApp';
import { appel } from '../api';
import { Bouton, Carte, Titre } from '../composants';

const MODELE = `Activité :
Ville / zone :
Clients cibles :
Offres et tarifs principaux :
Ce qui nous différencie :
Ton à employer (tutoiement/vouvoiement, style) :
Réseaux sociaux utilisés :
Site web : `;

export default function Entreprise() {
  const { me, gerer, rafraichir } = useStudio();
  const proprietaire = me.user.role === 'proprietaire';
  const [texte, setTexte] = useState(me.workspace.contexte_entreprise || MODELE);
  const [etat, setEtat] = useState<'' | 'envoi' | 'ok'>('');
  const [erreur, setErreur] = useState('');

  const enregistrer = async () => {
    setEtat('envoi'); setErreur('');
    try { await appel('contexte_update', { contexte_entreprise: texte }); await rafraichir(); setEtat('ok'); }
    catch (e) { setErreur(gerer(e)); setEtat(''); }
  };

  return (
    <>
      <Titre sous="Cette fiche est lue par tous vos agents avant chaque mission : c'est elle qui rend leurs réponses vraiment personnalisées.">
        Mon entreprise
      </Titre>
      <Carte className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <p><span className="text-neutral-500">Espace :</span> {me.workspace.nom}</p>
          <p><span className="text-neutral-500">Offre :</span> {{ essentiel: 'Essentiel', pro: 'Pro', sur_mesure: 'Sur mesure' }[me.workspace.offre] ?? me.workspace.offre}</p>
          <p><span className="text-neutral-500">Échéance :</span> {me.workspace.expire_le ? new Date(me.workspace.expire_le).toLocaleDateString('fr-FR') : '—'}</p>
        </div>
        <textarea value={texte} onChange={(e) => { setTexte(e.target.value); setEtat(''); }} rows={16} readOnly={!proprietaire}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-900 focus:bg-white" />
        {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
        {proprietaire ? (
          <div className="flex items-center gap-3">
            <Bouton onClick={enregistrer} disabled={etat === 'envoi'}>{etat === 'envoi' ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
            {etat === 'ok' && <span className="text-sm text-emerald-700">Enregistré — vos agents en tiennent compte dès maintenant.</span>}
          </div>
        ) : <p className="text-sm text-neutral-500">Seul le propriétaire de l'espace peut modifier cette fiche.</p>}
      </Carte>
    </>
  );
}
