// Bulle « Parler à Sam » présente sur toutes les pages du site (montée par SiteFrame).
// Sur /agents-ia, elle s'efface tant que la démo intégrée (#sam) est à l'écran : même conversation.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import SamChat from './SamChat';
import { useSam } from './samStore';
import { trackClick } from '@/lib/track';

export default function SamWidget() {
  const { pathname } = useLocation();
  const [ouvert, setOuvert] = useState(false);
  const [demoVisible, setDemoVisible] = useState(false);
  const { messages } = useSam();

  // La démo intégrée est-elle à l'écran ?
  useEffect(() => {
    const cible = document.getElementById('sam');
    if (!cible) { setDemoVisible(false); return; }
    const obs = new IntersectionObserver(([e]) => setDemoVisible(e.isIntersecting), { threshold: 0.25 });
    obs.observe(cible);
    return () => obs.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!ouvert) return;
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [ouvert]);

  if (demoVisible && !ouvert) return null;

  if (!ouvert) {
    const enCours = messages.length > 1;
    return (
      <button type="button" onClick={() => { setOuvert(true); trackClick('sam'); }} aria-label="Parler à Sam, l'agent IA d'Aissociate"
        className="group fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-neutral-950 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white shadow-xl ring-1 ring-white/15 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">
        <span className="relative">
          <img src="/agents-ia/studio/sam.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover object-top" style={{ background: '#3b82f6' }} />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-950 bg-emerald-400" />
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span>{enCours ? 'Reprendre avec Sam' : 'Parler à Sam'}</span>
          <span className="flex items-center gap-1 text-[11px] font-normal text-neutral-400"><MessageSquare className="h-3 w-3" /> Agent IA · en ligne</span>
        </span>
      </button>
    );
  }

  return (
    <div role="dialog" aria-label="Conversation avec Sam"
      className="fixed inset-0 z-[60] sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100vh-2.5rem))] sm:w-[400px]">
      <SamChat focus onFermer={() => setOuvert(false)} className="h-full shadow-2xl sm:rounded-2xl sm:ring-1 sm:ring-neutral-900/10" />
    </div>
  );
}
