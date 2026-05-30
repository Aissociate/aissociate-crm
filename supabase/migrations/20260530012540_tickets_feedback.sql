/*
  # Espace développement : tickets bugs & propositions

  ## Nouvelles tables
  - `tickets`
    - id, created_at, updated_at
    - type : 'bug' | 'proposition'
    - titre, description (requis)
    - statut : 'ouvert' | 'en_cours' | 'resolu' | 'refuse'
    - priorite : 'faible' | 'normale' | 'haute' | 'critique' (pertinent pour les bugs)
    - created_by : référence profiles(id)
    - admin_note : réponse/commentaire admin
  - `ticket_votes`
    - (ticket_id, user_id) clé primaire composite
    - Permet à chaque utilisateur de voter une fois pour une proposition

  ## Sécurité
  - RLS activé sur les deux tables
  - Tous les utilisateurs authentifiés peuvent lire tous les tickets
  - Chaque utilisateur peut créer ses propres tickets
  - Seuls les admins peuvent modifier le statut et la note admin
  - Les utilisateurs peuvent modifier leurs propres tickets si statut = 'ouvert'
  - Les votes : chaque utilisateur peut voter/dévote ses propres votes
*/

CREATE TABLE IF NOT EXISTS tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  type        text NOT NULL CHECK (type IN ('bug', 'proposition')),
  titre       text NOT NULL,
  description text NOT NULL DEFAULT '',
  statut      text NOT NULL DEFAULT 'ouvert'
              CHECK (statut IN ('ouvert', 'en_cours', 'resolu', 'refuse')),
  priorite    text CHECK (priorite IN ('faible', 'normale', 'haute', 'critique')),
  created_by  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_note  text
);

CREATE TABLE IF NOT EXISTS ticket_votes (
  ticket_id  uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

-- Trigger updated_at sur tickets
CREATE OR REPLACE FUNCTION update_ticket_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_updated_at ON tickets;
CREATE TRIGGER trg_ticket_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_ticket_updated_at();

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
CREATE INDEX IF NOT EXISTS idx_tickets_statut ON tickets(statut);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_ticket_votes_ticket ON ticket_votes(ticket_id);

-- RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_votes ENABLE ROW LEVEL SECURITY;

-- Tickets : SELECT – tous les utilisateurs authentifiés voient tous les tickets
CREATE POLICY "tickets_select"
  ON tickets FOR SELECT
  TO authenticated
  USING (true);

-- Tickets : INSERT – utilisateur authentifié, created_by = soi
CREATE POLICY "tickets_insert"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Tickets : UPDATE – admin peut tout modifier ; propriétaire peut modifier si statut = 'ouvert'
CREATE POLICY "tickets_update"
  ON tickets FOR UPDATE
  TO authenticated
  USING (is_manager() OR created_by = auth.uid())
  WITH CHECK (is_manager() OR (created_by = auth.uid() AND statut = 'ouvert'));

-- Tickets : DELETE – admin uniquement
CREATE POLICY "tickets_delete"
  ON tickets FOR DELETE
  TO authenticated
  USING (is_manager());

-- Votes : SELECT – tous
CREATE POLICY "ticket_votes_select"
  ON ticket_votes FOR SELECT
  TO authenticated
  USING (true);

-- Votes : INSERT – chaque utilisateur vote pour lui-même
CREATE POLICY "ticket_votes_insert"
  ON ticket_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Votes : DELETE – chaque utilisateur retire son propre vote
CREATE POLICY "ticket_votes_delete"
  ON ticket_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
