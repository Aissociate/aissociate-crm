import { useEffect, useMemo, useState } from 'react';
import { FileSignature, Loader as Loader2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Button, Modal, Field, SearchSelect } from '@/components/ui';
import { FileLink } from '@/components/FileUpload';
import AddToDossierButton from '@/components/AddToDossierButton';
import { fullName, formatDate } from '@/lib/utils';
import type {
  Positionnement as Pos, Contact, Dossier, SessionFormation, Entreprise, Formation,
} from '@/lib/database.types';

/**
 * Convention de formation générée depuis les répondants au test de
 * positionnement. Les répondants peuvent être hors base : l'entreprise est
 * alors l'organisation qu'ils ont déclarée. Le PDF est produit par l'Edge
 * Function `generate-agefice` en mode direct (sans plan de formation) et
 * rejoint la liste des PDF générés des Plans de formation.
 */

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Valeur la plus fréquente d'une liste (les vides sont ignorés). */
function plusFrequent(valeurs: (string | null | undefined)[]): string {
  const compte = new Map<string, number>();
  for (const v of valeurs) if (v) compte.set(v, (compte.get(v) ?? 0) + 1);
  return [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

export default function ConventionPositionnementModal({
  open, onClose, repondants, contacts, dossiers, sessions,
}: {
  open: boolean;
  onClose: () => void;
  repondants: Pos[];
  contacts: Contact[];
  dossiers: Dossier[];
  sessions: SessionFormation[];
}) {
  const { session } = useAuth();
  const entreprises = useCollection<Entreprise>('entreprises', { orderBy: { column: 'raison_sociale', ascending: true } });
  const formations = useCollection<Formation>('formations', { orderBy: { column: 'intitule', ascending: true } });

  const [entrepriseId, setEntrepriseId] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [formationId, setFormationId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [signataireId, setSignataireId] = useState('');
  const [retenus, setRetenus] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ fichier_url: string; titre: string; effectif: number } | null>(null);

  const contactDe = (p: Pos) => contacts.find((c) => c.id === p.contact_id) ?? null;
  /** Nom porté sur la convention : celui du CRM si le répondant y est, sinon le nom déclaré. */
  const nomDe = (p: Pos) => { const c = contactDe(p); return c ? fullName(c.prenom, c.nom) : p.nom; };

  // Pré-remplissage à chaque ouverture, d'après les répondants choisis.
  useEffect(() => {
    if (!open) return;
    setResultat(null); setErreur(null); setSignataireId('');
    setRetenus(new Set(repondants.map((p) => p.id)));

    // Entreprise : celle des contacts du CRM si elle est unique, sinon
    // l'organisation déclarée retrouvée parmi les entreprises connues.
    const entContacts = [...new Set(repondants.map((p) => contactDe(p)?.entreprise_id).filter(Boolean) as string[])];
    const orga = plusFrequent(repondants.map((p) => p.organisation?.trim()));
    const parNom = entreprises.data.find((e) => orga && norm(e.raison_sociale) === norm(orga));
    setEntrepriseId(entContacts.length === 1 ? entContacts[0] : parNom?.id ?? '');
    setOrganisation(orga);

    // Formation : celle des dossiers rattachés, sinon l'intitulé déclaré.
    const depuisDossiers = plusFrequent(repondants.map((p) => dossiers.find((d) => d.id === p.dossier_id)?.formation_id));
    const intitule = plusFrequent(repondants.map((p) => p.formation_intitule?.trim()));
    const parIntitule = formations.data.find((f) => intitule && norm(f.intitule) === norm(intitule));
    setFormationId(depuisDossiers || parIntitule?.id || '');
    setSessionId(plusFrequent(repondants.map((p) => p.session_id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, repondants, entreprises.data.length, formations.data.length]);

  const choisis = repondants.filter((p) => retenus.has(p.id));
  const entreprise = entreprises.data.find((e) => e.id === entrepriseId) ?? null;

  // Dossiers où déposer la convention : ceux des répondants, et ceux de leurs
  // contacts sur la formation retenue (un dossier par contact et formation).
  const cibles = useMemo(() => {
    const ids = new Set(choisis.map((p) => p.dossier_id).filter(Boolean) as string[]);
    const contactIds = new Set(choisis.map((p) => p.contact_id).filter(Boolean) as string[]);
    return dossiers.filter((d) => ids.has(d.id)
      || (!!d.contact_id && contactIds.has(d.contact_id) && (!formationId || d.formation_id === formationId)));
  }, [choisis, dossiers, formationId]);

  const optionsEntreprises = entreprises.data.map((e) => ({ value: e.id, label: e.raison_sociale, sub: e.ville ?? undefined }));
  const optionsFormations = formations.data.map((f) => ({ value: f.id, label: f.intitule, sub: `${f.duree_heures} h` }));
  const optionsSessions = sessions.map((s) => ({ value: s.id, label: s.titre, sub: formatDate(s.date_debut) }));
  // Signataire pour l'entreprise : de préférence un contact de l'entreprise.
  const optionsSignataires = contacts
    .filter((c) => !entrepriseId || c.entreprise_id === entrepriseId)
    .map((c) => ({ value: c.id, label: fullName(c.prenom, c.nom), sub: c.fonction ?? undefined }));

  const generer = async () => {
    if (!choisis.length) { setErreur('Cochez au moins un stagiaire.'); return; }
    if (!entrepriseId && !organisation.trim()) { setErreur("Indiquez l'entreprise cocontractante."); return; }
    if (!formationId) { setErreur('Choisissez la formation du catalogue.'); return; }
    setBusy(true); setErreur(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-agefice', {
        body: {
          type: 'convention', userId: session?.user.id ?? null,
          direct: {
            entrepriseId: entrepriseId || null,
            organisation: entrepriseId ? null : organisation.trim(),
            formationId, sessionId: sessionId || null, contactId: signataireId || null,
            dossierIds: cibles.map((d) => d.id),
            stagiaires: choisis.map(nomDe),
          },
        },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      const res = data as { error?: string; fichier_url?: string; titre?: string; effectif?: number } | null;
      if (res?.error) throw new Error(res.error);
      setResultat({ fichier_url: res?.fichier_url ?? '', titre: res?.titre ?? 'Convention', effectif: res?.effectif ?? choisis.length });
    } catch (e) {
      setErreur(`Génération impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open} onClose={onClose} title="Convention de formation"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
          {!resultat && (
            <Button onClick={generer} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Générer la convention
            </Button>
          )}
        </>
      }
    >
      {resultat ? (
        <div className="space-y-3">
          <p className="text-sm text-fg">
            <strong>{resultat.titre}</strong> générée — {resultat.effectif} stagiaire(s) dans l'effectif.
          </p>
          <div className="flex items-center gap-2">
            <FileLink bucket="plans" value={resultat.fichier_url} />
            <AddToDossierButton
              contactId={null} dossiers={dossiers} cibles={cibles}
              fichierUrl={resultat.fichier_url} sourceBucket="plans"
              pieceLibelle="Convention / contrat de formation" documentLabel="convention de formation"
            />
            <span className="text-xs text-muted">
              {cibles.length
                ? `Ajouter aux ${cibles.length} dossier(s) des stagiaires`
                : 'Aucun dossier rattaché aux stagiaires'}
            </span>
          </div>
          <p className="text-xs text-muted">Elle figure aussi dans les PDF générés de la page Plans de formation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {erreur && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{erreur}</div>}

          <Field label={`Stagiaires (${choisis.length}/${repondants.length})`} hint="Répondants au test repris dans l'effectif de la convention.">
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {repondants.map((p) => {
                const c = contactDe(p);
                const ent = c?.entreprise_id ? entreprises.data.find((e) => e.id === c.entreprise_id)?.raison_sociale : null;
                return (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-surface-2">
                    <input
                      type="checkbox" checked={retenus.has(p.id)}
                      onChange={() => setRetenus((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                    />
                    <span className="flex-1 text-fg">{nomDe(p)}</span>
                    <span className="text-xs text-muted">{ent ?? p.organisation ?? (c ? 'sans entreprise' : 'hors base')}</span>
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label="Entreprise cocontractante" hint="Sans entreprise au CRM, l'organisation déclarée est reprise telle quelle.">
            <SearchSelect value={entrepriseId} onChange={setEntrepriseId} options={optionsEntreprises}
              emptyLabel="Aucune (organisation déclarée)" placeholder="Rechercher une entreprise…" />
          </Field>
          {!entrepriseId && (
            <Field label="Organisation">
              <input className="input" value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
            </Field>
          )}
          {entreprise && !entreprise.adresse && (
            <p className="text-xs text-muted">L'adresse de {entreprise.raison_sociale} n'est pas renseignée : elle restera à compléter sur la convention.</p>
          )}

          <Field label="Formation" required>
            <SearchSelect value={formationId} onChange={setFormationId} options={optionsFormations}
              emptyLabel="Choisir…" placeholder="Rechercher une formation…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Session" hint="Dates, lieu et formateur.">
              <SearchSelect value={sessionId} onChange={setSessionId} options={optionsSessions}
                emptyLabel="Aucune" placeholder="Rechercher une session…" />
            </Field>
            <Field label="Signataire pour l'entreprise" hint="« Représentée par ».">
              <SearchSelect value={signataireId} onChange={setSignataireId} options={optionsSignataires}
                emptyLabel="À compléter" placeholder="Rechercher un contact…" />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
