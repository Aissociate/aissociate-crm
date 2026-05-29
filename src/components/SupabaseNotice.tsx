import { Database, ExternalLink } from 'lucide-react';
import { Logo } from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';

/** Affiche un guide quand les variables Supabase ne sont pas encore renseignees. */
export default function SupabaseNotice() {
  return (
    <div className="relative flex min-h-full items-center justify-center bg-app p-6">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="card max-w-xl p-8">
        <div className="mb-5"><Logo size="lg" tagline /></div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
          <Database className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-fg">Connexion Supabase requise</h1>
        <p className="mt-2 text-sm text-muted">
          L'application est prête, mais la base de données Supabase n'est pas encore branchée.
          Dans <strong className="text-fg">Bolt</strong>, cliquez sur <strong className="text-fg">« Connect to Supabase »</strong> (en haut à
          droite) pour créer/lier un projet : Bolt renseignera automatiquement les variables et
          appliquera les migrations du dossier <code className="rounded bg-surface-2 px-1">supabase/migrations</code>.
        </p>
        <div className="mt-4 rounded-lg bg-surface-2 p-4 text-sm">
          <p className="font-medium text-fg">En local / hors Bolt :</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
            <li>Copier <code className="rounded bg-surface px-1">.env.example</code> en <code className="rounded bg-surface px-1">.env</code></li>
            <li>Renseigner <code className="rounded bg-surface px-1">VITE_SUPABASE_URL</code> et <code className="rounded bg-surface px-1">VITE_SUPABASE_ANON_KEY</code></li>
            <li>Appliquer les migrations SQL puis recharger</li>
          </ol>
        </div>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary mt-5"
        >
          Ouvrir Supabase <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
