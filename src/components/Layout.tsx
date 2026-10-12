import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, Users, Building2, TrendingUp, GraduationCap, FileText, FolderKanban, FolderArchive, Mail, Send, UserPlus, UsersRound, ChartBar as BarChart3, LayoutGrid, CalendarDays, CalendarCheck, Presentation, ListTodo, Settings, ShieldCheck, BadgeCheck, LogOut, Menu, X, Bug, Bot, ReceiptText, Newspaper, Mic, Search, FileSpreadsheet, Euro, Wallet, ClipboardCheck, Sparkles } from 'lucide-react';
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

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Pilotage',
    items: [
      { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { to: '/assistant', label: 'Assistant IA', icon: Bot },
      { to: '/actions', label: 'Actions à faire', icon: ListTodo },
      { to: '/statistiques', label: 'Statistiques', icon: BarChart3 },
      { to: '/tresorerie', label: 'Trésorerie', icon: Wallet, managerOnly: true },
    ],
  },
  {
    title: 'CRM',
    items: [
      { to: '/contacts', label: 'Contacts', icon: Users },
      { to: '/entreprises', label: 'Entreprises', icon: Building2 },
      { to: '/pipeline', label: 'Pipeline commercial', icon: TrendingUp },
      { to: '/mobile', label: 'Capture mobile', icon: Mic },
      { to: '/conseillers', label: 'Conseillers', icon: UsersRound, managerOnly: true },
    ],
  },
  {
    title: 'Formation',
    items: [
      { to: '/catalogue', label: 'Catalogue', icon: GraduationCap },
      { to: '/devis', label: 'Devis', icon: ReceiptText },
      { to: '/factures', label: 'Factures', icon: Euro },
      // Dossier client : convention, plan individuel, paperasse, financeur, coffre-fort,
      // historique, messagerie et calendrier. Plans de formation et Positionnement
      // n'ont plus d'entrée propre : leurs pages restent accessibles depuis le dossier.
      { to: '/dossiers', label: 'Dossiers clients', icon: FolderKanban },
      { to: '/calendrier', label: 'Calendrier', icon: CalendarDays },
      { to: '/emargement', label: 'Émargement', icon: CalendarCheck },
      { to: '/formateurs', label: 'Formateurs', icon: Presentation },
      { to: '/qualiopi', label: 'Conformité Qualiopi', icon: BadgeCheck },
      { to: '/bpf', label: 'BPF', icon: FileSpreadsheet, managerOnly: true },
    ],
  },
  {
    title: 'Suivi & collaboration',
    items: [
      { to: '/documents', label: 'Espace documentaire', icon: FolderArchive },
      { to: '/kanban', label: 'Tableau Kanban', icon: LayoutGrid },
      { to: '/messagerie', label: 'Messagerie', icon: Mail },
      { to: '/blog-admin', label: 'Blog', icon: Newspaper, managerOnly: true },
      { to: '/newsletter', label: 'Newsletter', icon: Send, managerOnly: true },
      { to: '/recrutement', label: 'Recrutement', icon: UserPlus, managerOnly: true },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/administration', label: 'Administration', icon: ShieldCheck, adminOnly: true },
      { to: '/parametres', label: 'Paramètres', icon: Settings, adminOnly: true },
      { to: '/tickets', label: 'Développement', icon: Bug },
    ],
  },
];

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
  const sections = rail
    ? [{ title: 'Mode avancé', items: [{ to: '/commande', label: 'Poste de commande', icon: Sparkles }] as NavItem[] }, ...SECTIONS]
    : SECTIONS;
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
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
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
                      {item.to === '/messagerie' && unreadMails > 0 && (
                        <span className={cn('inline-flex min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white', rail && 'lg:absolute lg:right-0.5 lg:top-0.5 lg:min-w-[16px] lg:px-1 lg:text-[10px]')} title={`${unreadMails} mail(s) entrant(s) non lu(s)`}>
                          {unreadMails > 99 ? '99+' : unreadMails}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
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
