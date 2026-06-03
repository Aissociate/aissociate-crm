// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, Save, X, FileText, Share2, Loader2 } from 'lucide-react';

interface EmailTemplate {
  id: string;
  created_by: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  category: string;
  is_shared: boolean;
  created_at: string;
}

interface EmailTemplatesManagerProps {
  userId: string;
  userRole: string;
}

export default function EmailTemplatesManager({ userId, userRole }: EmailTemplatesManagerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<EmailTemplate> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_email_templates')
      .select('*')
      .order('name');
    if (data) setTemplates(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editing?.name || !editing?.subject) return;
    setSaving(true);

    if (editing.id) {
      await supabase
        .from('crm_email_templates')
        .update({
          name: editing.name,
          subject: editing.subject,
          body_html: editing.body_html || '',
          body_text: editing.body_text || '',
          is_shared: editing.is_shared || false,
          category: editing.category || userRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id);
    } else {
      await supabase
        .from('crm_email_templates')
        .insert({
          created_by: userId,
          name: editing.name,
          subject: editing.subject,
          body_html: editing.body_html || '',
          body_text: editing.body_text || '',
          is_shared: editing.is_shared || false,
          category: editing.category || userRole,
        });
    }

    setEditing(null);
    setSaving(false);
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce modele ?')) return;
    await supabase.from('crm_email_templates').delete().eq('id', id);
    loadTemplates();
  };

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-800">
            {editing.id ? 'Modifier le modele' : 'Nouveau modele'}
          </h3>
          <button onClick={() => setEditing(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Nom du modele *</label>
              <input
                type="text"
                value={editing.name || ''}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="ex: Relance prospect"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Categorie</label>
              <select
                value={editing.category || userRole}
                onChange={e => setEditing({ ...editing, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="fixer">Fixer</option>
                <option value="closer">Closer</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Objet *</label>
            <input
              type="text"
              value={editing.subject || ''}
              onChange={e => setEditing({ ...editing, subject: e.target.value })}
              placeholder="Objet de l'email"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Contenu HTML</label>
            <textarea
              value={editing.body_html || ''}
              onChange={e => setEditing({ ...editing, body_html: e.target.value })}
              placeholder="Contenu de l'email (HTML supporte)..."
              rows={12}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow resize-y"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_shared || false}
                onChange={e => setEditing({ ...editing, is_shared: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <Share2 className="w-3.5 h-3.5" />
              Partager avec les {editing.category || userRole}s
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.name || !editing.subject}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Modeles d'emails</h3>
          <span className="text-[11px] text-slate-400">{templates.length}</span>
        </div>
        <button
          onClick={() => setEditing({ category: userRole })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouveau modele
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 px-4">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Aucun modele</p>
          <p className="text-xs text-slate-400 mt-1">Creez votre premier modele d'email pour gagner du temps</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {templates.map(tpl => (
            <div key={tpl.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-slate-800 truncate">{tpl.name}</h4>
                  {tpl.is_shared && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded">
                      <Share2 className="w-2.5 h-2.5" />
                      Partage
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded capitalize">
                    {tpl.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{tpl.subject}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditing(tpl)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                {tpl.created_by === userId && (
                  <button
                    onClick={() => handleDelete(tpl.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
