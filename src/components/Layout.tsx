import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, Users, Building2, TrendingUp, GraduationCap, FileText, FolderKanban, FolderArchive, Mail, Send, UserPlus, UsersRound, ChartBar as BarChart3, LayoutGrid, CalendarDays, CalendarCheck, Presentation, ListTodo, Settings, ShieldCheck, BadgeCheck, LogOut, Menu, X, Bug, Bot, ReceiptText, Newspaper, Mic } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/constants';
import { initials, cn, isConseillerInactif } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import BugReporter from '@/components/BugReporter';

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
      { to: '/plans', label: 'Plans de formation', icon: FileText },
      { to: '/devis', label: 'Devis', icon: ReceiptText },
      { to: '/dossiers', label: 'Dossiers', icon: FolderKanban },
      { to: '/calendrier', label: 'Calendrier', icon: CalendarDays },
      { to: '/emargement', label: 'Émargement', icon: CalendarCheck },
      { to: '/formateurs', label: 'Formateurs', icon: Presentation },
      { to: '/qualiopi', label: 'Conformité Qualiopi', icon: BadgeCheck },
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
    const t = setInterval(load, 60000);
    return () => { on = false; clearInterval(t); };
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
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <Logo size="md" tagline />
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {SECTIONS.map((section) => {
            const items = section.items.filter(visible);
            if (items.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted/70">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                          isActive
                            ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                            : 'text-muted hover:bg-surface-2 hover:text-fg',
                        )
                      }
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.to === '/messagerie' && unreadMails > 0 && (
                        <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white" title={`${unreadMails} mail(s) entrant(s) non lu(s)`}>
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

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 text-sm font-semibold text-brand-600 dark:text-brand-400">
              {initials(profile?.nom, profile?.prenom)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">
                {profile?.prenom} {profile?.nom}
              </p>
              <p className="truncate text-xs text-muted">{role ? ROLE_LABELS[role] : ''}</p>
            </div>
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
          <ThemeToggle className="ml-auto" />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <BugReporter />
    </div>
  );
}
