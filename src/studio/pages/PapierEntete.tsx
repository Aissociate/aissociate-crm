// « Mon entreprise » › Papier à en-tête : logo et coordonnées repris en tête et
// en pied de chaque document exporté (Word, PDF).
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { appel, type Entete, type EnteteComplete } from '../api';
import { Bouton, Carte, Chargement } from '../composants';
import { chargerEntete } from '../exports';

const CHAMPS: { nom: keyof Entete; label: string; aide?: string; large?: boolean }[] = [
  { nom: 'raison_sociale', label: 'Raison sociale', aide: 'Les Délices de Saint-Pierre SARL', large: true },
  { nom: 'adresse', label: 'Adresse', aide: '12 rue des Bons-Enfants', large: true },
  { nom: 'code_postal', label: 'Code postal', aide: '97410' },
  { nom: 'ville', label: 'Ville', aide: 'Saint-Pierre' },
  { nom: 'telephone', label: 'Téléphone' },
  { nom: 'email', label: 'E-mail' },
  { nom: 'site', label: 'Site web' },
  { nom: 'siret', label: 'SIRET' },
  { nom: 'mentions', label: 'Mentions de pied de page', aide: 'Capital, RCS, TVA intracommunautaire…', large: true },
];

/** Lit un fichier en base64 (sans le préfixe data:). */
const enBase64 = (f: File) => new Promise<string>((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] ?? '');
  r.onerror = () => ko(new Error('Lecture du fichier impossible'));
  r.readAsDataURL(f);
});

export default function PapierEntete() {
  const { me, gerer } = useStudio();
  const proprietaire = me.user.role === 'proprietaire';
  const [donnees, setDonnees] = useState<EnteteComplete | null>(null);
  const [v, setV] = useState<Entete>({});
  const [etat, setEtat] = useState<'' | 'envoi' | 'ok'>('');
  const [erreur, setErreur] = useState('');
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    appel<EnteteComplete>('entete').then((d) => {
      setDonnees(d);
      setV({ raison_sociale: me.workspace.nom.replace(/^Démo — /, ''), ...d.entete });
    }).catch((e) => setErreur(gerer(e)));
  }, [gerer, me.workspace.nom]);

  const enregistrer = async () => {
    setEtat('envoi'); setErreur('');
    try { await appel('entete_update', { entete: v }); chargerEntete(true); setEtat('ok'); }
    catch (e) { setErreur(gerer(e)); setEtat(''); }
  };

  const envoyerLogo = async (f: File) => {
    setErreur('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) { setErreur('Logo au format PNG, JPEG ou WebP.'); return; }
    if (f.size > 500_000) { setErreur('Logo de 500 Ko maximum.'); return; }
    try {
      const r = await appel<{ logo_url: string }>('entete_logo', { fichier: await enBase64(f), type: f.type });
      setDonnees((d) => (d ? { ...d, logo_url: r.logo_url } : d));
      chargerEntete(true);
    } catch (e) { setErreur(gerer(e)); }
    finally { if (fichier.current) fichier.current.value = ''; }
  };

  const retirerLogo = async () => {
    try { await appel('entete_logo', { supprimer: true }); setDonnees((d) => (d ? { ...d, logo_url: null } : d)); chargerEntete(true); }
    catch (e) { setErreur(gerer(e)); }
  };

  if (!donnees) return <Carte><Chargement /></Carte>;
  if (!donnees.disponible) return null; // migration non appliquée : on n'affiche pas le bloc

  const ligneAdresse = [v.adresse, [v.code_postal, v.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const contacts = [v.telephone, v.email, v.site].filter(Boolean).join(' · ');
  const champ = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:bg-white disabled:opacity-70';

  return (
    <Carte className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Papier à en-tête</h2>
        <p className="text-sm text-neutral-500">Repris en tête et en pied de chaque document exporté en Word ou en PDF.</p>
      </div>

      {/* Aperçu */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm" aria-label="Aperçu de l'en-tête">
        <div className="flex items-start justify-between gap-4 border-b-2 border-neutral-900 pb-3">
          {donnees.logo_url
            ? <img src={donnees.logo_url} alt="Logo" className="max-h-16 max-w-[180px] object-contain" />
            : <span className="flex h-14 w-32 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-400">Votre logo</span>}
          <div className="text-right text-xs leading-relaxed text-neutral-600">
            <p className="text-sm font-semibold text-neutral-900">{v.raison_sociale || 'Raison sociale'}</p>
            {ligneAdresse && <p>{ligneAdresse}</p>}
            {contacts && <p>{contacts}</p>}
          </div>
        </div>
        <div className="space-y-1.5 py-4">
          <div className="h-2 w-3/4 rounded bg-neutral-100" /><div className="h-2 w-full rounded bg-neutral-100" /><div className="h-2 w-2/3 rounded bg-neutral-100" />
        </div>
        <p className="border-t border-neutral-200 pt-2 text-center text-[10px] text-neutral-400">
          {[v.raison_sociale, v.siret && `SIRET ${v.siret}`, v.mentions].filter(Boolean).join(' · ') || 'Pied de page : SIRET et mentions légales'}
        </p>
      </div>

      {proprietaire && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fichier} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && envoyerLogo(e.target.files[0])} />
          <Bouton variante="clair" onClick={() => fichier.current?.click()}><ImagePlus className="h-4 w-4" /> {donnees.logo_url ? 'Changer le logo' : 'Ajouter un logo'}</Bouton>
          {donnees.logo_url && <Bouton variante="fantome" onClick={retirerLogo}><Trash2 className="h-4 w-4" /> Retirer</Bouton>}
          <span className="text-xs text-neutral-500">PNG, JPEG ou WebP, 500 Ko maximum. Un fond transparent rend mieux.</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {CHAMPS.map((c) => (
          <label key={c.nom} className={c.large ? 'sm:col-span-2' : ''}>
            <span className="mb-1 block text-sm text-neutral-700">{c.label}</span>
            <input className={champ} value={v[c.nom] ?? ''} placeholder={c.aide} disabled={!proprietaire}
              onChange={(e) => { setV({ ...v, [c.nom]: e.target.value }); setEtat(''); }} />
          </label>
        ))}
      </div>
      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
      {proprietaire ? (
        <div className="flex items-center gap-3">
          <Bouton onClick={enregistrer} disabled={etat === 'envoi'}>{etat === 'envoi' ? 'Enregistrement…' : 'Enregistrer l\'en-tête'}</Bouton>
          {etat === 'ok' && <span className="text-sm text-emerald-700">Enregistré : appliqué à vos prochains exports.</span>}
        </div>
      ) : <p className="text-sm text-neutral-500">Seul le propriétaire de l'espace peut modifier l'en-tête.</p>}
    </Carte>
  );
}
