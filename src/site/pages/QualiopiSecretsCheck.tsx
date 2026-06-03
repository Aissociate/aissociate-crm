// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function QualiopiSecretsCheck() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    status: 'success' | 'warning' | 'error';
    message: string;
    details?: any;
  } | null>(null);

  const checkSecrets = async () => {
    setChecking(true);
    setResult(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-openrouter-key`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        setResult({
          status: 'error',
          message: `Erreur de communication avec le serveur (${response.status})`,
        });
        return;
      }

      const data = await response.json();

      if (data.success && data.working) {
        setResult({
          status: 'success',
          message: 'La clé API OpenRouter est correctement configurée et fonctionne',
          details: {
            model: data.model,
            testResponse: data.testResponse,
          }
        });
      } else if (!data.configured) {
        setResult({
          status: 'error',
          message: 'La clé API OpenRouter N\'EST PAS configurée',
          details: {
            reason: 'La variable OPENROUTER_API_KEY n\'existe pas dans les secrets Supabase',
            needsConfiguration: true,
          }
        });
      } else if (!data.validFormat) {
        setResult({
          status: 'error',
          message: 'La clé API OpenRouter a un format invalide',
          details: {
            reason: 'La clé doit commencer par "sk-or-"',
            needsConfiguration: true,
          }
        });
      } else if (data.apiError) {
        setResult({
          status: 'error',
          message: `Erreur lors de l'appel à l'API OpenRouter (${data.status})`,
          details: {
            reason: 'La clé est peut-être invalide ou expirée',
            apiDetails: data.details,
            needsConfiguration: true,
          }
        });
      } else {
        setResult({
          status: 'error',
          message: 'Erreur inconnue lors du test',
          details: data,
        });
      }
    } catch (error: any) {
      setResult({
        status: 'error',
        message: `Erreur lors de la vérification: ${error?.message}`,
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/qualiopi')}
          className="group flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-all"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Retour au tableau de bord</span>
        </button>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">
            Vérification de la Clé API OpenRouter
          </h1>

          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="font-semibold text-blue-900 mb-2">À propos de cette vérification</h2>
            <p className="text-sm text-blue-800">
              Cette page vérifie si la clé API OpenRouter est correctement configurée dans les secrets
              de votre Edge Function Supabase. Un appel test est effectué directement à l'API OpenRouter
              pour confirmer que la clé fonctionne.
            </p>
          </div>

          <button
            onClick={checkSecrets}
            disabled={checking}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {checking ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Tester la clé API maintenant
              </>
            )}
          </button>

          {result && (
            <div
              className={`p-6 rounded-lg border-2 ${
                result.status === 'success'
                  ? 'bg-emerald-50 border-emerald-200'
                  : result.status === 'warning'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.status === 'success' && (
                  <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
                )}
                {result.status === 'warning' && (
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                )}
                {result.status === 'error' && (
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                )}
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-lg mb-2 ${
                      result.status === 'success'
                        ? 'text-emerald-900'
                        : result.status === 'warning'
                        ? 'text-amber-900'
                        : 'text-red-900'
                    }`}
                  >
                    {result.message}
                  </h3>

                  {result.status === 'success' && result.details && (
                    <div className="mt-3 p-3 bg-white rounded border border-emerald-300">
                      <p className="text-sm text-emerald-800">
                        <strong>Modèle testé:</strong> {result.details.model}
                      </p>
                      <p className="text-sm text-emerald-800 mt-1">
                        <strong>Réponse de test:</strong> {result.details.testResponse}
                      </p>
                    </div>
                  )}

                  {result.details?.reason && (
                    <div className="mt-3 p-3 bg-white rounded border border-red-300">
                      <p className="text-sm text-red-800">
                        <strong>Raison:</strong> {result.details.reason}
                      </p>
                    </div>
                  )}

                  {result.details?.apiDetails && (
                    <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-300">
                      <p className="text-xs text-slate-700 font-mono">
                        {result.details.apiDetails}
                      </p>
                    </div>
                  )}

                  {result.details?.needsConfiguration && (
                    <div className="mt-4 p-4 bg-white rounded-lg border-2 border-red-300">
                      <h4 className="font-semibold text-red-900 mb-3">
                        Comment configurer la clé API OpenRouter:
                      </h4>
                      <ol className="list-decimal list-inside space-y-3 text-sm text-red-800">
                        <li>
                          Obtenez une clé API sur{' '}
                          <a
                            href="https://openrouter.ai/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium"
                          >
                            OpenRouter.ai
                          </a>
                          {' '}(la clé commence par <code className="bg-red-100 px-1 rounded">sk-or-</code>)
                        </li>
                        <li>
                          Allez sur{' '}
                          <a
                            href={`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1]}/settings/functions`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium"
                          >
                            votre Dashboard Supabase
                          </a>
                          {' '}→ Section "Edge Functions"
                        </li>
                        <li>Cliquez sur l'onglet <strong>"Secrets"</strong> en haut de la page</li>
                        <li>
                          Cliquez sur <strong>"Add new secret"</strong> et remplissez:
                          <ul className="ml-6 mt-2 space-y-2 bg-red-50 p-3 rounded border border-red-200">
                            <li>
                              <strong>Name:</strong>{' '}
                              <code className="bg-red-200 px-2 py-1 rounded font-mono text-red-900">
                                OPENROUTER_API_KEY
                              </code>
                            </li>
                            <li>
                              <strong>Value:</strong> Collez votre clé OpenRouter (sk-or-...)
                            </li>
                          </ul>
                        </li>
                        <li>Cliquez sur <strong>"Create secret"</strong></li>
                        <li>
                          Attendez quelques secondes puis revenez ici et cliquez sur{' '}
                          <strong>"Tester la clé API maintenant"</strong>
                        </li>
                      </ol>
                      <div className="mt-4 p-3 bg-red-100 rounded border border-red-300">
                        <p className="text-xs text-red-900">
                          <strong>Important:</strong> La clé API dans votre fichier .env local n'est PAS utilisée
                          par les Edge Functions hébergées sur Supabase. Vous DEVEZ configurer le secret dans le
                          Dashboard Supabase.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">Obtenir une clé API OpenRouter</h3>
              <p className="text-sm text-slate-700 mb-3">
                Si vous n'avez pas encore de clé API OpenRouter, vous pouvez en obtenir une gratuitement:
              </p>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm bg-white px-4 py-2 rounded-lg border border-blue-300 hover:border-blue-400 transition-colors"
              >
                Créer une clé API sur OpenRouter
                <span className="text-lg">→</span>
              </a>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Test avec un vrai PDF de formation</h3>
              <p className="text-sm text-blue-800 mb-3">
                Une fois la clé API configurée et fonctionnelle, testez l'extraction automatique en
                uploadant un PDF de programme de formation complet depuis la page Formations Qualiopi.
              </p>
              <button
                onClick={() => navigate('/qualiopi/trainings')}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm bg-white px-4 py-2 rounded-lg border border-blue-300 hover:border-blue-400 transition-colors"
              >
                Aller vers Formations Qualiopi
                <span className="text-lg">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
