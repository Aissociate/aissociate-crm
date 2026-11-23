import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { genReference } from '@/lib/utils';
import type { Contact, ContactAction, ContactDocument, SessionFormation } from '@/lib/database.types';

/** Ajout d'opportunité, de dossier et de document depuis la fiche, et sessions proposées au calendrier. */
export function useAffaires(
  c: Contact, userId: string | undefined, actions: ContactAction[], loadRefs: () => Promise<void>,
) {
  // ── Ajout d'opportunité / dossier / inscription à une session ────────────────
  const [allSessions, setAllSessions] = useState<SessionFormation[]>([]);
  useEffect(() => { supabase.from('sessions_formation').select('*').order('date_debut', { ascending: false }).then(({ data }) => setAllSessions(data ?? [])); }, []);
  const [addPanel, setAddPanel] = useState<'opp' | 'doss' | null>(null);
  // Le calendrier miniature reste ouvert par défaut : positionner un contact sur
  // une session est un geste courant depuis la fiche.
  const [calOpen, setCalOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newOpp, setNewOpp] = useState({ titre: '', montant: '' });
  const [newDoss, setNewDoss] = useState({ intitule: '' });
  // Propriétaire = utilisateur courant (requis par la RLS d'écriture pour un conseiller).
  const ownerOf = userId ?? c.responsable_id ?? c.owner_id ?? null;

  const addOpp = async () => {
    if (!newOpp.titre.trim()) return;
    // Une opportunité sans suite prévue part en stand-by dans le pipeline : on
    // exige donc une action à faire avant de la créer (ticket « colonnes stand-by »).
    if (!actions.some((a) => !a.faite)) {
      alert("Création refusée : ce contact n'a aucune action à faire.\nPlanifiez d'abord une action (appel, e-mail, rdv) pour assurer le suivi de l'opportunité.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('opportunites').insert({
      contact_id: c.id, entreprise_id: c.entreprise_id, financeur_id: c.financeur_id,
      titre: newOpp.titre.trim(), montant: Number(newOpp.montant) || 0, stage: 'nouveau', probabilite: 0, owner_id: ownerOf,
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setNewOpp({ titre: '', montant: '' }); setAddPanel(null); void loadRefs();
  };
  const addDoss = async () => {
    if (!newDoss.intitule.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('dossiers').insert({
      contact_id: c.id, entreprise_id: c.entreprise_id, financeur_id: c.financeur_id,
      reference: genReference('DOS'), intitule: newDoss.intitule.trim(), owner_id: ownerOf,
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setNewDoss({ intitule: '' }); setAddPanel(null); void loadRefs();
  };
  // ── Coffre de documents rattachés au contact ─────────────────────────────────
  const addDoc = async (value: string, name?: string) => {
    const { error } = await supabase.from('contact_documents').insert({
      contact_id: c.id, titre: name || 'Document', fichier_url: value, created_by: userId ?? null,
    });
    if (error) { alert(error.message); return; }
    void loadRefs();
  };
  const removeDoc = async (d: ContactDocument) => {
    if (!confirm(`Supprimer « ${d.titre} » ?`)) return;
    const { error } = await supabase.from('contact_documents').delete().eq('id', d.id);
    if (error) { alert(error.message); return; }
    void loadRefs();
  };

  return {
    allSessions, addPanel, setAddPanel, calOpen, setCalOpen, busy, newOpp, setNewOpp, newDoss, setNewDoss,
    addOpp, addDoss, addDoc, removeDoc,
  };
}
export type Affaires = ReturnType<typeof useAffaires>;
