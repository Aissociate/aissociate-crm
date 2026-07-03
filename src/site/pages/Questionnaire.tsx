// @ts-nocheck
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface Question {
  id: string;
  label: string;
  type: 'textarea' | 'radio' | 'echelle' | 'nps' | 'text';
  options?: string[];
  echelle?: number;
  required?: boolean;
}

export default function Questionnaire() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [schema, setSchema] = useState<Question[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Page privée (lien tokenisé) : jamais indexée par les moteurs.
  useEffect(() => {
    document.title = 'Questionnaire — Aissociate';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('qualiopi-questionnaire', {
          body: { action: 'get', token },
        });
        if (error) throw error;
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        const d = data as { titre: string; description: string | null; schema: Question[]; alreadyAnswered: boolean };
        setTitre(d.titre);
        setDescription(d.description);
        setSchema(d.schema ?? []);
        if (d.alreadyAnswered) setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lien invalide.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const set = (id: string, v: unknown) => setValues((s) => ({ ...s, [id]: v }));

  const submit = async () => {
    for (const q of schema) {
      if (q.required && (values[q.id] === undefined || values[q.id] === '')) {
        alert('Merci de répondre à toutes les questions obligatoires.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('qualiopi-questionnaire', {
        body: { action: 'submit', token, reponses: values, commentaire: comment || null },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setDone(true);
    } catch (e) {
      alert('Envoi impossible : ' + (e instanceof Error ? e.message : ''));
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#ea6a1e', marginBottom: 16 }}>AIssociate</div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          {children}
        </div>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 16 }}>
          Organisme de formation certifié Qualiopi · vos réponses restent confidentielles.
        </p>
      </div>
    </div>
  );

  if (loading) return shell(<p style={{ color: '#64748b' }}>Chargement…</p>);
  if (error) return shell(<p style={{ color: '#dc2626' }}>{error}</p>);
  if (done) return shell(
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>✅</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '8px 0' }}>Merci pour votre réponse !</h1>
      <p style={{ color: '#64748b' }}>Votre retour a bien été enregistré. Il contribue à l'amélioration continue de nos formations.</p>
    </div>,
  );

  const inputStyle = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 14 };

  return shell(
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{titre}</h1>
      {description && <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>{description}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {schema.map((q) => (
          <div key={q.id}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              {q.label} {q.required && <span style={{ color: '#dc2626' }}>*</span>}
            </label>

            {q.type === 'textarea' && (
              <textarea style={{ ...inputStyle, minHeight: 80 }} value={(values[q.id] as string) ?? ''} onChange={(e) => set(q.id, e.target.value)} />
            )}
            {q.type === 'text' && (
              <input style={inputStyle} value={(values[q.id] as string) ?? ''} onChange={(e) => set(q.id, e.target.value)} />
            )}
            {q.type === 'radio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(q.options ?? []).map((opt) => (
                  <label key={opt} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
                    <input type="radio" name={q.id} checked={values[q.id] === opt} onChange={() => set(q.id, opt)} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {(q.type === 'echelle' || q.type === 'nps') && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Array.from({ length: q.type === 'nps' ? 11 : (q.echelle ?? 5) }, (_, i) => (q.type === 'nps' ? i : i + 1)).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set(q.id, n)}
                    style={{
                      width: 40, height: 40, borderRadius: 8, fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (values[q.id] === n ? '#ea6a1e' : '#cbd5e1'),
                      background: values[q.id] === n ? '#ea6a1e' : '#fff',
                      color: values[q.id] === n ? '#fff' : '#334155',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Commentaire libre (facultatif)</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          style={{
            background: '#ea6a1e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px',
            fontWeight: 700, fontSize: 15, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Envoi…' : 'Envoyer mes réponses'}
        </button>
      </div>
    </div>,
  );
}
