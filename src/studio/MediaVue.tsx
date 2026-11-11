// Affiche un visuel ou une vidéo générés ; tant qu'ils sont « en cours », interroge
// l'Edge Function (qui fait aussi avancer les jobs vidéo) toutes les 5 s.
import { useEffect, useState } from 'react';
import { Download, ImageIcon, Video } from 'lucide-react';
import { appel, type Media } from './api';

export default function MediaVue({ media: initial }: { media: Media }) {
  const [media, setMedia] = useState(initial);
  const [secondes, setSecondes] = useState(0);

  useEffect(() => { setMedia(initial); }, [initial]);

  useEffect(() => {
    if (media.statut !== 'en_cours') return;
    let actif = true;
    const debut = Date.now();
    const tic = setInterval(() => setSecondes(Math.round((Date.now() - debut) / 1000)), 1000);
    const sonde = setInterval(async () => {
      try {
        const r = await appel<{ media: Media }>('media_statut', { id: media.id });
        if (actif && r.media.statut !== 'en_cours') setMedia(r.media);
      } catch { /* réseau : on réessaie au tour suivant */ }
    }, 5000);
    return () => { actif = false; clearInterval(tic); clearInterval(sonde); };
  }, [media.id, media.statut]);

  if (media.statut === 'en_cours') {
    const Icone = media.type === 'image' ? ImageIcon : Video;
    return (
      <div className="flex aspect-video max-w-md flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500">
        <Icone className="h-6 w-6 animate-pulse text-orange-500" />
        {media.type === 'image' ? 'Création du visuel…' : 'Tournage de la vidéo…'} {secondes > 0 && `${secondes} s`}
        <span className="text-xs text-neutral-400">
          {media.type === 'image' ? 'En général moins d\'une minute.' : 'Comptez quelques minutes ; vous pouvez quitter cette page.'}
        </span>
      </div>
    );
  }
  if (media.statut === 'echec' || !media.url) {
    return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">La génération a échoué : {media.erreur ?? 'erreur inconnue'}. Relancez la mission.</p>;
  }
  return (
    <div className="max-w-md space-y-1.5">
      {media.type === 'image'
        ? <img src={media.url} alt="Visuel généré" className="w-full rounded-xl border border-neutral-200" />
        : <video src={media.url} controls playsInline className="w-full rounded-xl border border-neutral-200" />}
      <a href={media.url} download target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
        <Download className="h-3.5 w-3.5" /> Télécharger
      </a>
    </div>
  );
}
