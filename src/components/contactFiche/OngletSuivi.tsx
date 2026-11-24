import ConversationsContact from '@/components/ConversationsContact';
import {
  Pencil, CircleCheck as CheckCircle2, NotebookPen, Save, Target, Plus, Trash2, ChevronDown,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui';
import type { Contact, ContactAction } from '@/lib/database.types';
import { ACTION_TYPES, ymd, shortHeure, jourCourt, titreSection } from './outils';
import { MarqueEnregistre } from './elements';
import type { JournalActions } from './useJournalActions';
import type { EditionContact } from './useEditionContact';

/** Onglet « Suivi » : quoi faire, où en est le besoin, notes. */
export function OngletSuivi({ c, journal, edition }: { c: Contact; journal: JournalActions; edition: EditionContact }) {
  const {
    na, setNa, addAction, QUICK_ACTIONS, toggleAction, editAction, setEditAction, saveEditAction, removeAction,
    toutesFaites, setToutesFaites, aFaire, faites, derniere, prochaine,
  } = journal;
  const { form, editField, blurSave, savedField } = edition;
  const enregistre = (champ: string) => savedField === champ && <MarqueEnregistre />;

  const aujourdhui = ymd(new Date());
  const quand = (a: ContactAction) => `${jourCourt(a.date_action)} ${formatDate(a.date_action)}${shortHeure(a.heure_action) ? ` · ${shortHeure(a.heure_action)}` : ''}`;

  // Une ligne du journal, avec son édition en place.
  const ligneAction = (a: ContactAction) => {
    const retard = !a.faite && a.date_action < aujourdhui;
    return (
      <li key={a.id} className={cn('rounded-lg border px-2.5 py-1.5 text-sm', retard ? 'border-red-500/40 bg-red-500/5' : 'border-line')}>
        <div className="flex items-center gap-2">
          <button onClick={() => toggleAction(a)} title={a.faite ? 'Réalisée (non modifiable)' : 'Marquer comme réalisée'}
            className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', a.faite ? 'bg-emerald-500 text-white' : 'border border-line text-transparent hover:border-emerald-500 hover:text-emerald-500')}>
            <CheckCircle2 className="h-3 w-3" />
          </button>
          <Badge className="bg-surface-2 text-muted">{a.type}</Badge>
          <span className="min-w-0 flex-1 text-fg">{a.description}</span>
          <span className={cn('shrink-0 text-xs', retard ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted')}>{retard ? 'en retard · ' : ''}{quand(a)}</span>
          <button onClick={() => setEditAction(editAction?.id === a.id ? null : a)} title="Modifier cette action" className="rounded p-0.5 text-muted hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => removeAction(a)} title="Supprimer cette action" className="rounded p-0.5 text-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
        {editAction?.id === a.id && (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-2">
            <select className="input w-[90px] py-1.5" value={editAction.type} onChange={(e) => setEditAction({ ...editAction, type: e.target.value })}>
              {/* Le type d'origine reste proposé s'il ne fait plus partie des choix. */}
              {[...new Set([...ACTION_TYPES, editAction.type])].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="input min-w-[140px] flex-1 py-1.5" value={editAction.description} onChange={(e) => setEditAction({ ...editAction, description: e.target.value })} />
            <input className="input w-[130px] py-1.5" type="date" value={editAction.date_action} onChange={(e) => setEditAction({ ...editAction, date_action: e.target.value })} />
            <input className="input w-[90px] py-1.5" type="time" value={shortHeure(editAction.heure_action)} onChange={(e) => setEditAction({ ...editAction, heure_action: e.target.value })} title="Heure" />
            <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={editAction.faite} onChange={(e) => setEditAction({ ...editAction, faite: e.target.checked })} /> Réalisée</label>
            <button onClick={saveEditAction} className="btn-secondary py-1.5 text-sm"><Save className="h-3.5 w-3.5" /> Enregistrer</button>
            <button onClick={() => setEditAction(null)} className="py-1.5 text-sm text-muted hover:text-fg">Annuler</button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-5">

      <section>
        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <div className={cn('rounded-lg p-2.5', prochaine ? (prochaine.date_action < aujourdhui ? 'bg-red-500/10' : 'bg-amber-500/10') : 'bg-surface-2')}>
            <p className={cn(prochaine && prochaine.date_action < aujourdhui ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
              {prochaine && prochaine.date_action < aujourdhui ? 'Prochaine action — en retard' : 'Prochaine action'}
            </p>
            <p className="text-sm font-medium text-fg">{prochaine ? prochaine.description : 'Aucune action prévue'}</p>
            {prochaine && <p className="text-muted">{quand(prochaine)}</p>}
          </div>
          <div className="rounded-lg bg-surface-2 p-2.5">
            <p className="text-muted">Dernier contact</p>
            <p className="text-sm font-medium text-fg">{derniere ? derniere.description : 'Jamais contacté'}</p>
            {derniere && <p className="text-muted">{quand(derniere)}</p>}
          </div>
        </div>

        {/* Nouvelle action : un raccourci remplit la ligne, on ajuste, on ajoute. */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((qa) => (
              <button key={qa.label} onClick={qa.run} className="rounded-full border border-amber-500/30 bg-surface px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-400">
                {qa.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <select className="input w-[90px] py-1.5" aria-label="Type d'action" value={na.type} onChange={(e) => setNa({ ...na, type: e.target.value })}>{ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <input className="input min-w-[140px] flex-1 py-1.5" placeholder="Qu'avez-vous fait, ou que reste-t-il à faire ?" value={na.description} onChange={(e) => setNa({ ...na, description: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addAction()} />
            <input className="input w-[130px] py-1.5" type="date" aria-label="Date" value={na.date_action} onChange={(e) => setNa((n) => ({ ...n, date_action: e.target.value, faite: e.target.value > ymd(new Date()) ? false : n.faite }))} />
            <input className="input w-[90px] py-1.5" type="time" value={na.heure_action} onChange={(e) => setNa({ ...na, heure_action: e.target.value })} title="Heure" />
            <label className="flex items-center gap-1.5 text-xs text-muted" title={na.date_action > ymd(new Date()) ? 'Une action datée dans le futur ne peut pas être déjà réalisée' : undefined}><input type="checkbox" checked={na.faite} disabled={na.date_action > ymd(new Date())} onChange={(e) => setNa({ ...na, faite: e.target.checked })} /> Déjà faite</label>
            <button onClick={addAction} disabled={!na.description.trim()} className="btn-primary py-1.5 text-sm"><Plus className="h-3.5 w-3.5" /> Ajouter</button>
          </div>
        </div>

        <h3 className={cn(titreSection, 'mb-2 mt-4')}>À faire ({aFaire.length})</h3>
        {aFaire.length === 0
          ? <p className="text-sm text-muted">Rien de prévu. Planifiez la prochaine action pour ne pas perdre ce contact de vue.</p>
          : <ul className="space-y-1.5">{aFaire.map(ligneAction)}</ul>}

        {faites.length > 0 && (
          <>
            <h3 className={cn(titreSection, 'mb-2 mt-4')}>Fait ({faites.length})</h3>
            <ul className="space-y-1.5">{(toutesFaites ? faites : faites.slice(0, 3)).map(ligneAction)}</ul>
            {faites.length > 3 && (
              <button onClick={() => setToutesFaites((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', toutesFaites && 'rotate-180')} />
                {toutesFaites ? 'Réduire' : `Voir tout (${faites.length})`}
              </button>
            )}
          </>
        )}
      </section>

      {/* Qualification */}
      <section className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
        <div className="mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-muted" /><h3 className={titreSection}>Qualification</h3>{savedField && savedField !== 'notes' && <span className="text-xs text-emerald-600">enregistré ✓</span>}</div>
        <div className="space-y-2">
          <div><label className="label">Besoin résumé</label><textarea className="input" rows={2} value={form.besoin_resume} onChange={(e) => editField('besoin_resume', e.target.value)} onBlur={(e) => blurSave('besoin_resume', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Formation envisagée</label><input className="input" value={form.formation_envisagee} onChange={(e) => editField('formation_envisagee', e.target.value)} onBlur={(e) => blurSave('formation_envisagee', e.target.value)} /></div>
            <div><label className="label">Financement envisagé</label><input className="input" placeholder="CPF, OPCO, AGEFICE…" value={form.financement_envisage} onChange={(e) => editField('financement_envisage', e.target.value)} onBlur={(e) => blurSave('financement_envisage', e.target.value)} /></div>
            <div><label className="label">Ville / Région</label><input className="input" placeholder="ex. Saint-Denis / Nord" value={form.ville} onChange={(e) => editField('ville', e.target.value)} onBlur={(e) => blurSave('ville', e.target.value)} /></div>
            <div><label className="label">Effectif</label><input className="input" value={form.effectif} onChange={(e) => editField('effectif', e.target.value)} onBlur={(e) => blurSave('effectif', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Intérêt</label><input className="input" value={form.interet} onChange={(e) => editField('interet', e.target.value)} onBlur={(e) => blurSave('interet', e.target.value)} /></div>
          </div>
        </div>
      </section>

      {/* Notes : même enregistrement automatique que le reste de la fiche */}
      <section>
        <div className="mb-2 flex items-center gap-2"><NotebookPen className="h-4 w-4 text-muted" /><h3 className={titreSection}>Notes</h3>{enregistre('notes')}</div>
        <textarea
          className="input min-h-[88px] resize-y text-sm"
          placeholder="Observations, rappels, informations de suivi…"
          value={form.notes}
          onChange={(e) => editField('notes', e.target.value)}
          onBlur={(e) => blurSave('notes', e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">Tout s'enregistre seul pendant la saisie et à la fermeture de la fiche.</p>
      </section>

      {/* Conversations enregistrées depuis la Capture mobile (masqué s'il n'y en a pas) */}
      <ConversationsContact contactId={c.id} />
    </div>
  );
}
