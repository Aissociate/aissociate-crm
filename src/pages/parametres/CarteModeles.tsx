import type { Dispatch, SetStateAction } from 'react';
import { Save, MessageSquareText, Plus, Trash2 } from 'lucide-react';
import { Card, Button, Field } from '@/components/ui';
import { TEMPLATE_PLACEHOLDERS, type MessageTemplate } from '@/lib/messageTemplates';
import type { Sauvegarde } from './types';

/** Modèles de messages — réponses rapides (e-mail / WhatsApp). */
export function CarteModeles({
  templates, setTemplates, persist, saving, savedMsg,
}: {
  templates: MessageTemplate[];
  setTemplates: Dispatch<SetStateAction<MessageTemplate[]>>;
} & Sauvegarde) {
  const addTemplate = () => setTemplates((t) => [...t, { id: crypto.randomUUID(), nom: '', canal: 'email', sujet: '', corps: '' }]);
  const updateTemplate = (id: string, patch: Partial<MessageTemplate>) => setTemplates((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeTemplate = (id: string) => setTemplates((t) => t.filter((x) => x.id !== id));
  const saveTemplates = () => persist('message_templates', {
    items: templates
      .filter((t) => t.nom.trim() && t.corps.trim())
      .map((t) => ({ ...t, nom: t.nom.trim(), sujet: t.canal === 'whatsapp' ? undefined : (t.sujet?.trim() || undefined) })),
  });

  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquareText className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">Modèles de messages (réponses rapides)</h2>
      </div>
      <p className="text-sm text-muted">
        Messages prédéfinis proposés à l'envoi depuis la <strong>Messagerie</strong> et la <strong>fiche contact</strong>.
        Insérez des variables qui seront remplacées automatiquement :
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TEMPLATE_PLACEHOLDERS.map((p) => (
          <span key={p.token} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted" title={p.label}>
            <code className="text-brand-600 dark:text-brand-400">{p.token}</code> {p.label}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {templates.length === 0 && (
          <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">
            Aucun modèle. Cliquez sur « Ajouter un modèle » pour créer votre première réponse rapide.
          </p>
        )}
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-line bg-surface-2/40 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <Field label="Nom du modèle">
                <input className="input" value={t.nom} onChange={(e) => updateTemplate(t.id, { nom: e.target.value })} placeholder="ex. Relance devis" />
              </Field>
              <Field label="Canal">
                <select className="input" value={t.canal} onChange={(e) => updateTemplate(t.id, { canal: e.target.value as MessageTemplate['canal'] })}>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="both">E-mail &amp; WhatsApp</option>
                </select>
              </Field>
              <button onClick={() => removeTemplate(t.id)} title="Supprimer ce modèle"
                className="mb-1 inline-flex h-9 w-9 items-center justify-center self-end rounded-lg border border-line text-muted transition hover:border-red-300 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {t.canal !== 'whatsapp' && (
              <div className="mt-3">
                <Field label="Objet (e-mail)">
                  <input className="input" value={t.sujet ?? ''} onChange={(e) => updateTemplate(t.id, { sujet: e.target.value })} placeholder="ex. Votre devis de formation" />
                </Field>
              </div>
            )}
            <div className="mt-3">
              <Field label="Message">
                <textarea className="input" rows={4} value={t.corps} onChange={(e) => updateTemplate(t.id, { corps: e.target.value })}
                  placeholder={"Bonjour {{prenom}},\n\n…\n\nCordialement,\n{{conseiller}}"} />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={addTemplate}><Plus className="h-4 w-4" /> Ajouter un modèle</Button>
        <Button onClick={saveTemplates} disabled={saving === 'message_templates'}>
          <Save className="h-4 w-4" /> {saving === 'message_templates' ? 'Enregistrement…' : 'Enregistrer les modèles'}
        </Button>
        {savedMsg === 'message_templates' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
      </div>
    </Card>
  );
}
