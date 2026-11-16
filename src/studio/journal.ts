// Libellés du journal d'audit, partagés par le Studio et le CRM.
export type LigneJournal = {
  id: number; acteur: string; agent_id: string | null; action: string;
  detail: Record<string, unknown> | null; created_at: string;
};

const LIBELLES: Record<string, string> = {
  mission: 'Mission traitée',
  media: 'Visuel ou vidéo lancé',
  livrable_soumis: 'Livrable soumis à validation',
  drive_recherche: 'Recherche dans le Google Drive',
  drive_lecture: "Lecture d'un document du Drive",
  action_executee: 'Action exécutée après validation',
  action_echec: 'Action après validation en échec',
  livrable_valide: 'Livrable validé',
  livrable_refuse: 'Livrable refusé',
  livrable_publie: 'Livrable publié',
  livrable_a_valider: 'Livrable remis en validation',
  suspension: 'Agents suspendus',
  reprise: 'Agents relancés',
  espace_cree: 'Espace créé',
  connecteur_enregistre: 'Connecteur enregistré',
  connecteur_supprime: 'Connecteur retiré',
  connexion_retiree: 'Application déconnectée',
  fiche_entreprise_modifiee: 'Fiche entreprise modifiée',
  mail_traitee: 'E-mail traité',
  mail_quarantaine: 'E-mail bloqué (quarantaine)',
  mail_ignoree: 'E-mail ignoré',
  mail_erreur: 'E-mail en erreur',
  liaison_activee: 'Canal e-mail activé',
  liaison_coupee: 'Canal e-mail coupé',
};

export const libelleAction = (a: string) => LIBELLES[a] ?? a.replace(/_/g, ' ');
