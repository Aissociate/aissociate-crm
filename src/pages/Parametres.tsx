import { useEffect, useState } from 'react';
import { Save, Building2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Spinner, Button, Field } from '@/components/ui';

type Organisme = { nom?: string; qualiopi?: string; email?: string; telephone?: string; adresse?: string };
type Smtp = { host?: string; port?: number; secure?: boolean; user?: string; from?: string };

export default function Parametres() {
  const [organisme, setOrganisme] = useState<Organisme>({});
  const [smtp, setSmtp] = useState<Smtp>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('parametres').select('*').in('cle', ['organisme', 'smtp']);
      for (const row of data ?? []) {
        if (row.cle === 'organisme') setOrganisme((row.valeur as Organisme) ?? {});
        if (row.cle === 'smtp') setSmtp((row.valeur as Smtp) ?? {});
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (cle: string, valeur: Record<string, unknown>) => {
    setSaving(cle);
    const { error } = await supabase.from('parametres').upsert({ cle, valeur }, { onConflict: 'cle' });
    setSaving(null);
    if (error) { alert(error.message); return; }
    setSavedMsg(cle);
    setTimeout(() => setSavedMsg(null), 2000);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration de l'organisme et de la messagerie (4.9 / 4.7)" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Organisme de formation</h2>
          </div>
          <div className="space-y-4">
            <Field label="Nom"><input className="input" value={organisme.nom ?? ''} onChange={(e) => setOrganisme({ ...organisme, nom: e.target.value })} /></Field>
            <Field label="N° Qualiopi"><input className="input" value={organisme.qualiopi ?? ''} onChange={(e) => setOrganisme({ ...organisme, qualiopi: e.target.value })} /></Field>
            <Field label="E-mail de contact"><input className="input" value={organisme.email ?? ''} onChange={(e) => setOrganisme({ ...organisme, email: e.target.value })} /></Field>
            <Field label="Téléphone"><input className="input" value={organisme.telephone ?? ''} onChange={(e) => setOrganisme({ ...organisme, telephone: e.target.value })} /></Field>
            <Field label="Adresse"><input className="input" value={organisme.adresse ?? ''} onChange={(e) => setOrganisme({ ...organisme, adresse: e.target.value })} /></Field>
            <div className="flex items-center gap-3">
              <Button onClick={() => persist('organisme', organisme)} disabled={saving === 'organisme'}>
                <Save className="h-4 w-4" /> {saving === 'organisme' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {savedMsg === 'organisme' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-fg">Serveur SMTP sortant</h2>
          </div>
          <div className="space-y-4">
            <Field label="Hôte SMTP" hint="ex. smtp.gmail.com"><input className="input" value={smtp.host ?? ''} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Port"><input className="input" type="number" value={smtp.port ?? 587} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} /></Field>
              <Field label="Adresse d'expédition"><input className="input" value={smtp.from ?? ''} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} /></Field>
            </div>
            <Field label="Utilisateur"><input className="input" value={smtp.user ?? ''} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={!!smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} /> Connexion sécurisée (TLS/SSL)
            </label>
            <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
              Le mot de passe SMTP ne se stocke pas ici : ajoutez-le comme <strong>secret Supabase</strong>
              et envoyez les e-mails via une <strong>Edge Function</strong> (CDC 4.7).
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={() => persist('smtp', smtp)} disabled={saving === 'smtp'}>
                <Save className="h-4 w-4" /> {saving === 'smtp' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {savedMsg === 'smtp' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
