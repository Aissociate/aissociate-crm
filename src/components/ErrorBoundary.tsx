import { Component, type ReactNode, type ErrorInfo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Capture toute erreur de rendu pour ne JAMAIS laisser un écran blanc :
 * affiche le message d'erreur (et la pile) au lieu d'un écran vide.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Visible dans la console du navigateur pour le diagnostic
    console.error('Erreur applicative capturée :', error, info.componentStack);
    // Remontée en base (Administration › Santé des jobs) — best effort :
    // ne doit jamais aggraver l'erreur d'origine ni bloquer l'affichage.
    if (isSupabaseConfigured) {
      void (async () => {
        try {
          const { data } = await supabase.auth.getUser();
          await supabase.from('client_errors').insert({
            user_id: data.user?.id ?? null,
            url: window.location.pathname,
            message: String(error.message ?? error).slice(0, 2000),
            stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`.slice(0, 8000),
          });
        } catch { /* silencieux */ }
      })();
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, background: '#0b1120', color: '#e2e8f0',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{
            maxWidth: 640, width: '100%', background: '#111827', border: '1px solid #1f2937',
            borderRadius: 12, padding: 24,
          }}>
            <h1 style={{ margin: 0, fontSize: 18, color: '#fb9a3c' }}>Une erreur est survenue</h1>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>
              L'application a rencontré une erreur au chargement. Détail ci-dessous :
            </p>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0b1120',
              border: '1px solid #1f2937', borderRadius: 8, padding: 12, fontSize: 12,
              color: '#fca5a5', maxHeight: 280, overflow: 'auto',
            }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); location.reload(); }}
              style={{
                marginTop: 12, padding: '8px 14px', borderRadius: 8, border: 'none',
                background: '#ea6a1e', color: '#fff', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
