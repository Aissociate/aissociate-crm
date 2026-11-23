import { useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import type { Contact, ContactAction } from '@/lib/database.types';
import { ymd, hm, actionSortKey } from './outils';

/** Journal d'actions du contact : saisie, raccourcis, réalisation, édition en place, suppression. */
export function useJournalActions(
  c: Contact, actions: ContactAction[], setActions: Dispatch<SetStateAction<ContactAction[]>>,
) {
  // ── Journal d'actions ───────────────────────────────────────────────────────
  const [na, setNa] = useState(() => { const d = new Date(); return { date_action: ymd(d), heure_action: hm(d), type: 'appel', description: '', faite: true }; });
  const sortActions = (list: ContactAction[]) => [...list].sort((x, y) => actionSortKey(y).localeCompare(actionSortKey(x)));
  const addAction = async () => {
    if (!na.description.trim()) return;
    // Détrompeur : une action datée dans le futur ne peut pas être « réalisée ».
    const faite = na.faite && na.date_action <= ymd(new Date());
    const { data } = await supabase.from('contact_actions')
      .insert({ contact_id: c.id, date_action: na.date_action, heure_action: na.heure_action || null, type: na.type, description: na.description.trim(), faite })
      .select().single();
    if (data) setActions((p) => sortActions([data, ...p]));
    setNa({ ...na, description: '' });
  };

  // Raccourcis : pré-remplissent le formulaire (type, description, date, heure)
  // SANS valider — l'utilisateur ajuste la description puis clique « Ajouter ».
  const prefillAction = (opts: { type: string; faite: boolean; when: Date; description: string }) =>
    setNa({
      type: opts.type, description: opts.description,
      date_action: ymd(opts.when), heure_action: hm(opts.when),
      faite: opts.faite && ymd(opts.when) <= ymd(new Date()),
    });
  const inMinutes = (m: number) => new Date(Date.now() + m * 60000);
  const atToday = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };
  const tomorrowAt = (h: number) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d; };
  const QUICK_ACTIONS: { label: string; run: () => void }[] = [
    { label: 'Appel fait', run: () => prefillAction({ type: 'appel', faite: true, when: new Date(), description: 'Appel réalisé' }) },
    { label: 'Mail à envoyer', run: () => prefillAction({ type: 'email', faite: false, when: new Date(), description: 'Envoyer un e-mail (ASAP)' }) },
    // Une relance se fait par téléphone : ces rappels sont des appels.
    { label: 'Rappel +15 min', run: () => prefillAction({ type: 'appel', faite: false, when: inMinutes(15), description: 'Rappeler' }) },
    { label: 'Rappel +1 h', run: () => prefillAction({ type: 'appel', faite: false, when: inMinutes(60), description: 'Rappeler' }) },
    { label: 'Cet après-midi', run: () => prefillAction({ type: 'appel', faite: false, when: atToday(14), description: 'Rappeler' }) },
    { label: 'Demain matin', run: () => prefillAction({ type: 'appel', faite: false, when: tomorrowAt(9), description: 'Rappeler' }) },
  ];
  // Détrompeur : une action consignée comme réalisée l'est définitivement — on ne
  // peut plus la décocher (il reste la suppression). Et une action future ne peut
  // pas être cochée « réalisée ».
  const toggleAction = async (a: ContactAction) => {
    if (a.faite) { alert("Une action déjà réalisée ne peut plus être décochée. Supprimez-la si elle a été saisie par erreur."); return; }
    if (a.date_action > ymd(new Date())) { alert("Cette action est datée dans le futur : elle ne peut pas être notée comme réalisée."); return; }
    setActions((p) => p.map((x) => (x.id === a.id ? { ...x, faite: true } : x)));
    await supabase.from('contact_actions').update({ faite: true }).eq('id', a.id);
  };

  // ── Édition d'une action existante ──────────────────────────────────────────
  // Mêmes règles qu'à la saisie : pas d'action future marquée réalisée.
  const [editAction, setEditAction] = useState<ContactAction | null>(null);
  const saveEditAction = async () => {
    const a = editAction;
    if (!a) return;
    if (!a.description.trim()) { alert('La description est obligatoire.'); return; }
    if (a.faite && a.date_action > ymd(new Date())) {
      alert("Modification refusée : une action datée dans le futur ne peut pas être notée comme réalisée.");
      return;
    }
    const fields = {
      type: a.type, description: a.description.trim(),
      date_action: a.date_action, heure_action: a.heure_action || null, faite: a.faite,
    };
    const { error } = await supabase.from('contact_actions').update(fields).eq('id', a.id);
    if (error) { alert(`Modification impossible : ${error.message}`); return; }
    setActions((p) => sortActions(p.map((x) => (x.id === a.id ? { ...x, ...fields } : x))));
    setEditAction(null);
  };
  const removeAction = async (a: ContactAction) => {
    await supabase.from('contact_actions').delete().eq('id', a.id);
    setActions((p) => p.filter((x) => x.id !== a.id));
  };
  // Les actions réalisées s'accumulent : on n'en montre que les dernières.
  const [toutesFaites, setToutesFaites] = useState(false);
  // Tri fait ici plutôt que supposé : à faire, la plus ancienne (donc la plus
  // en retard) d'abord ; fait, la plus récente d'abord.
  const aFaire = sortActions(actions.filter((a) => !a.faite)).reverse();
  const faites = sortActions(actions.filter((a) => a.faite));
  const derniere = faites[0];
  const prochaine = aFaire[0];

  return {
    na, setNa, addAction, QUICK_ACTIONS, toggleAction, editAction, setEditAction, saveEditAction, removeAction,
    toutesFaites, setToutesFaites, aFaire, faites, derniere, prochaine,
  };
}
export type JournalActions = ReturnType<typeof useJournalActions>;
