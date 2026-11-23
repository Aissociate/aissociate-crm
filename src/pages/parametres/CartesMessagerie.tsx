import { useEffect, useState } from 'react';
import { Save, Mail, Inbox, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Spinner, Button, Field } from '@/components/ui';
import { buildSignatureHtml, type SignatureCfg } from '@/lib/signature';
import type { Imap, Organisme, Sauvegarde, Smtp } from './types';

/** Serveur SMTP sortant. */
export function CarteSmtp({
  smtp, setSmtp, persist, saving, savedMsg,
}: {
  smtp: Smtp;
  setSmtp: (v: Smtp) => void;
} & Sauvegarde) {
  return (
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
        <Field label="Mot de passe" hint="Stocké chiffré côté Supabase (table protégée admin)"><input className="input" type="password" value={smtp.password ?? ''} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} autoComplete="new-password" /></Field>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={!!smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} /> Connexion sécurisée (TLS/SSL, port 465)
        </label>
        <div className="flex items-center gap-3">
          <Button onClick={() => persist('smtp', smtp)} disabled={saving === 'smtp'}>
            <Save className="h-4 w-4" /> {saving === 'smtp' ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {savedMsg === 'smtp' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
        </div>
      </div>
    </Card>
  );
}

/** Serveur IMAP (réception). */
export function CarteImap({
  imap, setImap, persist, saving, savedMsg,
}: {
  imap: Imap;
  setImap: (v: Imap) => void;
} & Sauvegarde) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Inbox className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">Serveur IMAP (réception)</h2>
      </div>
      <div className="space-y-4">
        <Field label="Hôte IMAP" hint="ex. imap.gmail.com"><input className="input" value={imap.host ?? ''} onChange={(e) => setImap({ ...imap, host: e.target.value })} /></Field>
        <Field label="Port" hint="993 (SSL)"><input className="input" type="number" value={imap.port ?? 993} onChange={(e) => setImap({ ...imap, port: Number(e.target.value) })} /></Field>
        <Field label="Utilisateur"><input className="input" value={imap.user ?? ''} onChange={(e) => setImap({ ...imap, user: e.target.value })} /></Field>
        <Field label="Mot de passe"><input className="input" type="password" value={imap.password ?? ''} onChange={(e) => setImap({ ...imap, password: e.target.value })} autoComplete="new-password" /></Field>
        <div className="flex items-center gap-3">
          <Button onClick={() => persist('imap', imap)} disabled={saving === 'imap'}>
            <Save className="h-4 w-4" /> {saving === 'imap' ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {savedMsg === 'imap' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
        </div>
      </div>
    </Card>
  );
}

/** Signature des e-mails, commune à l'organisme. */
export function CarteSignature({
  signature, setSignature, organisme, persist, saving, savedMsg,
}: {
  signature: SignatureCfg;
  setSignature: (v: SignatureCfg) => void;
  organisme: Organisme;
} & Sauvegarde) {
  const { profile } = useAuth();

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Send className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">Signature des e-mails</h2>
      </div>
      <div className="space-y-4">
        <p className="text-sm text-muted">Ajoutée automatiquement au bas des e-mails envoyés depuis la Messagerie.</p>
        <Field label="Mode">
          <select className="input" value={signature.mode ?? 'auto'} onChange={(e) => setSignature({ ...signature, mode: e.target.value as SignatureCfg['mode'] })}>
            <option value="auto">Automatique (coordonnées + logo de l'organisme)</option>
            <option value="custom">Personnalisée (HTML libre)</option>
          </select>
        </Field>
        {signature.mode === 'custom' ? (
          <Field label="Signature HTML" hint="Code HTML inséré tel quel">
            <textarea className="input min-h-[120px] font-mono text-xs" value={signature.html ?? ''} onChange={(e) => setSignature({ ...signature, html: e.target.value })} placeholder="<div>…</div>" />
          </Field>
        ) : (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={signature.include_sender !== false} onChange={(e) => setSignature({ ...signature, include_sender: e.target.checked })} />
            Préfixer avec le nom et les coordonnées de l'expéditeur
          </label>
        )}
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Aperçu</p>
          <div className="rounded-lg border border-line bg-white p-3 text-slate-800"
            dangerouslySetInnerHTML={{ __html: buildSignatureHtml(signature, organisme, profile) || '<span style="color:#b3a79a">Aucune signature (renseignez l\'organisme).</span>' }} />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => persist('email_signature', signature)} disabled={saving === 'email_signature'}>
            <Save className="h-4 w-4" /> {saving === 'email_signature' ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {savedMsg === 'email_signature' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
        </div>
      </div>
    </Card>
  );
}

// Éditeur des signatures propres à chaque utilisateur (ajoutées à leurs e-mails).
type ProfSig = { id: string; prenom: string; nom: string; email: string; signature: string | null };
export function UserSignaturesCard() {
  const [profs, setProfs] = useState<ProfSig[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('profiles').select('id, prenom, nom, email, signature').order('nom')
      .then(({ data }) => { setProfs((data ?? []) as ProfSig[]); setLoading(false); });
  }, []);

  const saveOne = async (p: ProfSig) => {
    setSavingId(p.id);
    const val = (drafts[p.id] ?? p.signature ?? '').trim();
    const { error } = await supabase.from('profiles').update({ signature: val || null }).eq('id', p.id);
    setSavingId(null);
    if (error) { alert(error.message); return; }
    setProfs((prev) => prev.map((x) => (x.id === p.id ? { ...x, signature: val || null } : x)));
    setSavedId(p.id); setTimeout(() => setSavedId((s) => (s === p.id ? null : s)), 1500);
  };

  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <Send className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">Signatures par utilisateur</h2>
      </div>
      <p className="mb-4 text-sm text-muted">
        Signature propre à chaque utilisateur, insérée dans ses e-mails à la place du préfixe générique
        (nom + coordonnées). Une ligne par utilisateur ; laissez vide pour utiliser le préfixe automatique.
      </p>
      {loading ? (
        <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
      ) : (
        <div className="space-y-4">
          {profs.map((p) => (
            <div key={p.id} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-fg">{p.prenom} {p.nom} <span className="text-xs font-normal text-muted">· {p.email}</span></p>
                <div className="flex items-center gap-2">
                  {savedId === p.id && <span className="text-xs text-emerald-600">Enregistré ✓</span>}
                  <Button variant="secondary" onClick={() => saveOne(p)} disabled={savingId === p.id} className="py-1 text-sm">
                    <Save className="h-3.5 w-3.5" /> {savingId === p.id ? '…' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
              <textarea
                className="input min-h-[90px] text-sm"
                placeholder={`ex.\n${p.prenom} ${p.nom}\nAIssociate\nChargé(e) de formation\nTél : 06 …\nwww.aissociate.re`}
                value={drafts[p.id] ?? p.signature ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
