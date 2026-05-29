import { Database, ExternalLink } from 'lucide-react';

/** Affiche un guide quand les variables Supabase ne sont pas encore renseignees. */
export default function SupabaseNotice() {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-6">
      <div className="card max-w-xl p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Database className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Connexion Supabase requise</h1>
        <p className="mt-2 text-sm text-slate-600">
          L'application est prête, mais la base de données Supabase n'est pas encore branchée.
          Dans <strong>Bolt</strong>, cliquez sur <strong>« Connect to Supabase »</strong> (en haut à
          droite) pour créer/lier un projet : Bolt renseignera automatiquement les variables et
          appliquera les migrations du dossier <code className="rounded bg-slate-100 px-1">supabase/migrations</code>.
        </p>
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
          <p className="font-medium text-slate-700">En local / hors Bolt :</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
            <li>Copier <code className="rounded bg-white px-1">.env.example</code> en <code className="rounded bg-white px-1">.env</code></li>
            <li>Renseigner <code className="rounded bg-white px-1">VITE_SUPABASE_URL</code> et <code className="rounded bg-white px-1">VITE_SUPABASE_ANON_KEY</code></li>
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
