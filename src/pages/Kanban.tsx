import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Spinner, Modal, Field, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { KanbanBoard, KanbanColonne, KanbanCarte } from '@/lib/database.types';

export default function Kanban() {
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [colonnes, setColonnes] = useState<KanbanColonne[]>([]);
  const [cartes, setCartes] = useState<KanbanCarte[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [desc, setDesc] = useState('');
  const [echeance, setEcheance] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: boards } = await supabase.from('kanban_boards').select('*').order('created_at').limit(1);
    const b = boards?.[0] ?? null;
    setBoard(b);
    if (b) {
      const { data: cols } = await supabase.from('kanban_colonnes').select('*').eq('board_id', b.id).order('ordre');
      setColonnes(cols ?? []);
      const colIds = (cols ?? []).map((c) => c.id);
      if (colIds.length) {
        const { data: cs } = await supabase.from('kanban_cartes').select('*').in('colonne_id', colIds).order('ordre');
        setCartes(cs ?? []);
      } else setCartes([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openAdd = (colId: string) => { setTarget(colId); setTitre(''); setDesc(''); setEcheance(''); setOpen(true); };

  const addCarte = async () => {
    if (!target || !titre.trim()) return;
    const { data, error } = await supabase.from('kanban_cartes')
      .insert({ colonne_id: target, titre: titre.trim(), description: desc || null, echeance: echeance || null, ordre: cartes.length })
      .select().single();
    if (error) { alert(error.message); return; }
    if (data) setCartes((p) => [...p, data]);
    setOpen(false);
  };

  const moveCarte = async (carte: KanbanCarte, dir: -1 | 1) => {
    const idx = colonnes.findIndex((c) => c.id === carte.colonne_id);
    const next = colonnes[idx + dir];
    if (!next) return;
    const { error } = await supabase.from('kanban_cartes').update({ colonne_id: next.id }).eq('id', carte.id);
    if (error) { alert(error.message); void load(); return; }
    setCartes((p) => p.map((c) => (c.id === carte.id ? { ...c, colonne_id: next.id } : c)));
  };

  const removeCarte = async (carte: KanbanCarte) => {
    const { error } = await supabase.from('kanban_cartes').delete().eq('id', carte.id);
    if (error) { alert(error.message); return; }
    setCartes((p) => p.filter((c) => c.id !== carte.id));
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader title="Tableau Kanban" subtitle={board?.description ?? 'Suivi visuel des dossiers (4.6)'} />
      {!board ? (
        <EmptyState title="Aucun tableau" message="Le tableau par défaut est créé via le seed Supabase." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {colonnes.map((col) => {
            const items = cartes.filter((c) => c.colonne_id === col.id);
            return (
              <div key={col.id} className="flex w-72 shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.couleur }} />
                    {col.titre}
                  </span>
                  <button onClick={() => openAdd(col.id)} className="rounded p-1 text-muted hover:bg-surface-2"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 space-y-2 rounded-xl bg-surface-2 p-2">
                  {items.map((carte) => {
                    const colIdx = colonnes.findIndex((c) => c.id === carte.colonne_id);
                    return (
                      <div key={carte.id} className="card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-fg">{carte.titre}</p>
                          <button onClick={() => removeCarte(carte)} className="rounded p-0.5 text-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        {carte.description && <p className="mt-1 text-xs text-muted">{carte.description}</p>}
                        {carte.echeance && <p className="mt-1 text-xs text-amber-600">Échéance : {formatDate(carte.echeance)}</p>}
                        <div className="mt-2 flex justify-between">
                          <button disabled={colIdx === 0} onClick={() => moveCarte(carte, -1)} className="rounded p-1 text-muted hover:bg-surface-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                          <button disabled={colIdx === colonnes.length - 1} onClick={() => moveCarte(carte, 1)} className="rounded p-1 text-muted hover:bg-surface-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} title="Nouvelle carte"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={addCarte} disabled={!titre.trim()}>Ajouter</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Titre" required><input className="input" value={titre} onChange={(e) => setTitre(e.target.value)} /></Field>
          <Field label="Description"><textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <Field label="Échéance"><input className="input" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
