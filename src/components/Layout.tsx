import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, Users, Building2, TrendingUp, GraduationCap, FolderKanban, Mail, Send, UsersRound, CalendarDays, ListTodo, Settings, ShieldCheck, BadgeCheck, LogOut, Menu, X, Bug, Bot, ReceiptText, Newspaper, Mic, Search, FileSpreadsheet, Wallet, Sparkles, MoreHorizontal, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/constants';
import { initials, cn, isConseillerInactif } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import BugReporter from '@/components/BugReporter';
import NotificationBell from '@/components/NotificationBell';
import GlobalSearch from '@/components/GlobalSearch';
import { useModeAvance } from '@/hooks/useModeAvance';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  managerOnly?: boolean;
  adminOnly?: boolean;
}

// Menu en deux niveaux. Le premier tient en neuf entrées : ce qu'un conseiller
// ouvre chaque jour pour traiter ses leads et monter ses dossiers. Tout le reste
// (gestion, marketing, réglages) est rangé sous « Plus », replié par défaut.
const PRINCIPAL: { title: string; items: NavItem[] }[] = [
  {
    title: 'Au quotidien',
    items: [
      { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { to: '/actions', label: 'Actions à faire', icon: ListTodo },
      { to: '/contacts', label: 'Contacts', icon: Users },
      { to: '/pipeline', label: 'Pipeline', icon: TrendingUp },
      { to: '/messagerie', label: 'Messagerie', icon: Mail },
    ],
  },
  {
    title: 'Dossiers',
    items: [
      { to: '/devis', label: 'Devis', icon: ReceiptText },
      // Dossier client : parcours (devis, montage, formation, clôture), documents
      // et échanges. Plans de formation, Positionnement et Évaluations n'ont pas
      // d'entrée propre : leurs pages s'ouvrent depuis le dossier ou Qualiopi.
      { to: '/dossiers', label: 'Dossiers clients', icon: FolderKanban },
      // Émargement et Formateurs s'ouvrent depuis le Calendrier.
      { to: '/calendrier', label: 'Calendrier', icon: CalendarDays },
      // L'Espace documentaire est un onglet de la conformité Qualiopi.
      { to: '/qualiopi', label: 'Qualiopi', icon: BadgeCheck },
    ],
  },
];

const PLUS: NavItem[] = [
  { to: '/assistant', label: 'Assistant IA', icon: Bot },
  { to: '/entreprises', label: 'Entreprises', icon: Building2 },
  { to: '/catalogue', label: 'Catalogue', icon: GraduationCap },
  { to: '/mobile', label: 'Capture mobile', icon: Mic },
  { to: '/conseillers', label: 'Conseillers', icon: UsersRound, managerOnly: true },
  { to: '/tresorerie', label: 'Trésorerie', icon: Wallet, managerOnly: true },
  { to: '/bpf', label: 'BPF', icon: FileSpreadsheet, managerOnly: true },
  { to: '/blog-admin', label: 'Blog', icon: Newspaper, managerOnly: true },
  { to: '/newsletter', label: 'Newsletter', icon: Send, managerOnly: true },
  // Studio IA : espaces agentiques des entreprises clientes (module src/studio).
  { to: '/studio-admin', label: 'Studio IA clients', icon: Sparkles, managerOnly: true },
  { to: '/administration', label: 'Administration', icon: ShieldCheck, adminOnly: true },
  { to: '/parametres', label: 'Paramètres', icon: Settings, adminOnly: true },
  { to: '/tickets', label: 'Développement', icon: Bug },
];

const CLE_PLUS = 'menu-plus-ouvert';

export default function Layout() {
  const { profile, role, isAdmin, isManager, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Mode avancé : barre d'icônes au lieu du menu complet, poste de commande IA
  // en page d'accueil. À l'ouverture du CRM, le tableau de bord laisse la place
  // au poste de commande (une seule fois : le tableau reste accessible).
  const [modeAvance, setModeAvance] = useModeAvance();
  const redirige = useRef(false);
  useEffect(() => {
    if (redirige.current) return;
    redirige.current = true;
    if (modeAvance && location.pathname === '/dashboard') navigate('/commande', { replace: true });
  }, [modeAvance, location.pathname, navigate]);
  const basculerMode = () => {
    const actif = !modeAvance;
    setModeAvance(actif);
    if (actif) navigate('/commande');
    else if (location.pathname === '/commande') navigate('/dashboard');
  };
  const rail = modeAvance;

  // « Plus » : replié par défaut, choix gardé dans le navigateur. Il s'ouvre de
  // lui-même quand la page affichée s'y trouve, pour qu'on voie où l'on est.
  const dansPlus = PLUS.some((i) => location.pathname.startsWith(i.to));
  const [plusOuvert, setPlusOuvert] = useState(() => {
    try { return localStorage.getItem(CLE_PLUS) === '1'; } catch { return false; }
  });
  const basculerPlus = () => setPlusOuvert((o) => {
    try { localStorage.setItem(CLE_PLUS, o ? '0' : '1'); } catch { /* préférence d'affichage seulement */ }
    return !o;
  });
  const plusVisible = plusOuvert || dansPlus;

  const sections = [
    ...(rail ? [{ title: 'Mode avancé', items: [{ to: '/commande', label: 'Poste de commande', icon: Sparkles }] as NavItem[] }] : []),
    ...PRINCIPAL,
  ];
  const pleinePage = location.pathname === '/commande';

  // Recherche globale : Ctrl+K / ⌘K ou clic sur le bouton de la sidebar.
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Badge « mails entrants non lus » (RLS : chacun ne compte que ses mails ;
  // la direction voit tout). Rafraîchi périodiquement et à chaque navigation.
  // Les mails rattachés à un conseiller devenu inactif sont exclus du décompte.
  const [unreadMails, setUnreadMails] = useState(0);
  useEffect(() => {
    let on = true;
    const load = async () => {
      const { data: profs } = await supabase.from('profiles')
        .select('id, actif, approved, statut_conseiller');
      const inactifs = (profs ?? []).filter(isConseillerInactif).map((p) => p.id);

      let q = supabase.from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'entrant').eq('lu', false).neq('canal', 'whatsapp');
      // `owner_id is null` = non affecté (direction) : reste notifié.
      if (inactifs.length) q = q.or(`owner_id.is.null,owner_id.not.in.(${inactifs.join(',')})`);
      const { count } = await q;
      if (on) setUnreadMails(count ?? 0);
    };
    void load();
    // Temps réel (insertion / lecture d'un mail) + intervalle de secours.
    const channel = supabase
      .channel('layout-emails')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, () => { void load(); })
      .subscribe();
    const t = setInterval(load, 60000);
    return () => { on = false; clearInterval(t); void supabase.removeChannel(channel); };
  }, [location.pathname]);

  // Pastille « actions en retard ou dues aujourd'hui » (RLS : chacun ne compte
  // que les siennes). C'est le premier signal que regarde un conseiller.
  const [actionsDues, setActionsDues] = useState(0);
  useEffect(() => {
    let on = true;
    const d = new Date();
    const auj = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    supabase.from('contact_actions')
      .select('id', { count: 'exact', head: true })
      .eq('faite', false).lte('date_action', auj)
      .then(({ count }) => { if (on) setActionsDues(count ?? 0); });
    return () => { on = false; };
  }, [location.pathname]);

  const pastille = (to: string): { n: number; titre: string } | null => {
    if (to === '/messagerie' && unreadMails > 0) return { n: unreadMails, titre: `${unreadMails} mail(s) entrant(s) non lu(s)` };
    if (to === '/actions' && actionsDues > 0) return { n: actionsDues, titre: `${actionsDues} action(s) en retard ou à faire aujourd'hui` };
    return null;
  };

  const lien = (item: NavItem) => {
    const p = pastille(item.to);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={() => setOpen(false)}
        title={rail ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
            rail && 'lg:justify-center lg:px-0',
            isActive
              ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
              : 'text-muted hover:bg-surface-2 hover:text-fg',
          )
        }
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className={cn('flex-1', rail && 'lg:hidden')}>{item.label}</span>
        {p && (
          <span className={cn('inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white', item.to === '/actions' ? 'bg-red-500' : 'bg-brand-500', rail && 'lg:absolute lg:right-0.5 lg:top-0.5 lg:min-w-[16px] lg:px-1 lg:text-[10px]')} title={p.titre}>
            {p.n > 99 ? '99+' : p.n}
          </span>
        )}
      </NavLink>
    );
  };

  const visible = (item: NavItem) =>
    (!item.managerOnly || isManager) && (!item.adminOnly || isAdmin);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:static lg:translate-x-0',
          rail && 'lg:w-16',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={cn('flex items-center justify-between border-b border-line px-4 py-4', rail && 'lg:justify-center lg:px-2')}>
          <div className={cn(rail && 'lg:hidden')}><Logo size="md" tagline /></div>
          {rail && <div className="hidden lg:block"><Logo size="sm" /></div>}
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        <div className={cn('px-3 pt-3', rail && 'lg:px-2')}>
          <button
            onClick={() => setSearchOpen(true)}
            title="Rechercher (Ctrl K)"
            className={cn('flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg', rail && 'lg:justify-center lg:px-0')}
          >
            <Search className="h-4 w-4" />
            <span className={cn('flex-1 text-left', rail && 'lg:hidden')}>Rechercher…</span>
            <kbd className={cn('rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold', rail && 'lg:hidden')}>Ctrl K</kbd>
          </button>
        </div>

        <nav className={cn('flex-1 space-y-5 overflow-y-auto px-3 py-4', rail && 'lg:space-y-3 lg:px-2')}>
          {sections.map((section) => {
            const items = section.items.filter(visible);
            if (items.length === 0) return null;
            return (
              <div key={section.title}>
                <p className={cn('px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted/70', rail && 'lg:hidden')}>
                  {section.title}
                </p>
                <div className="space-y-0.5">{items.map(lien)}</div>
              </div>
            );
          })}

          {/* Tout ce qui ne sert pas chaque jour */}
          <div>
            <button
              onClick={basculerPlus}
              aria-expanded={plusVisible}
              title={rail ? (plusVisible ? 'Replier « Plus »' : 'Plus') : undefined}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-fg', rail && 'lg:justify-center lg:px-0')}
            >
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span className={cn('flex-1 text-left', rail && 'lg:hidden')}>Plus</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', plusVisible && 'rotate-180', rail && 'lg:hidden')} />
            </button>
            {plusVisible && <div className="mt-0.5 space-y-0.5">{PLUS.filter(visible).map(lien)}</div>}
          </div>
        </nav>

        <div className={cn('border-t border-line p-3', rail && 'lg:px-2')}>
          <button
            onClick={basculerMode}
            title={modeAvance ? 'Revenir au mode classique' : 'Passer en mode avancé (assistant IA au centre)'}
            className={cn(
              'mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
              modeAvance
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'border border-brand-500/30 text-brand-600 hover:bg-brand-500/10 dark:text-brand-400',
              rail && 'lg:justify-center lg:px-0',
            )}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className={cn('flex-1 text-left', rail && 'lg:hidden')}>{modeAvance ? 'Mode avancé activé' : 'Mode avancé'}</span>
          </button>
          <div className={cn('flex items-center gap-3 rounded-lg px-2 py-2', rail && 'lg:flex-col lg:gap-1 lg:px-0')}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-sm font-semibold text-brand-600 dark:text-brand-400"
              title={rail ? `${profile?.prenom ?? ''} ${profile?.nom ?? ''}`.trim() : undefined}>
              {initials(profile?.nom, profile?.prenom)}
            </div>
            <div className={cn('min-w-0 flex-1', rail && 'lg:hidden')}>
              <p className="truncate text-sm font-medium text-fg">
                {profile?.prenom} {profile?.nom}
              </p>
              <p className="truncate text-xs text-muted">{role ? ROLE_LABELS[role] : ''}</p>
            </div>
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              title="Se déconnecter"
              className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-red-500"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-surface-2">
            <Menu className="h-5 w-5 text-fg" />
          </button>
          <Logo size="sm" />
          <button onClick={basculerMode} title={modeAvance ? 'Revenir au mode classique' : 'Passer en mode avancé'}
            className={cn('ml-auto rounded-lg p-2 transition', modeAvance ? 'bg-brand-500 text-white' : 'text-brand-600 hover:bg-surface-2 dark:text-brand-400')}>
            <Sparkles className="h-4 w-4" />
          </button>
          <ThemeToggle />
        </header>
        <main className={cn('flex-1', pleinePage ? 'min-h-0 overflow-hidden' : 'overflow-y-auto p-4 sm:p-6 lg:p-8')}>
          <Outlet />
        </main>
      </div>
      <BugReporter />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
