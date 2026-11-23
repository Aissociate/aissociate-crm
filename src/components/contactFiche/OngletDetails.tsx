import {
  Building2, User, CircleCheck as CheckCircle2, Circle as XCircle, Calendar, Tag, TableProperties, Save,
  ListChecks, Coins,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn, fullName, formatDate } from '@/lib/utils';
import type { Contact, Entreprise, Financeur, Profile } from '@/lib/database.types';
import { META_SKIP, titreSection } from './outils';
import { InfoRow, MarqueEnregistre } from './elements';
import type { EditionContact } from './useEditionContact';

/** Onglet « Détails » : ce qu'on remplit rarement (coordonnées complémentaires, conformité, commissions). */
export function OngletDetails({
  c, edition, entreprise, financeur, owner,
}: {
  c: Contact;
  edition: EditionContact;
  entreprise: Entreprise | undefined;
  financeur: Financeur | undefined;
  owner: Profile | undefined;
}) {
  const { form, setFf, savingSec, cc, saveSection, patch, savedField, editField, blurSave } = edition;
  const enregistre = (champ: string) => savedField === champ && <MarqueEnregistre />;
  const CHECKLIST: { key: keyof Contact; label: string }[] = [
    { key: 'eligibilite_verifiee', label: 'Éligibilité vérifiée' },
    { key: 'financement_demande', label: 'Financement demandé' },
    { key: 'financement_valide', label: 'Financement validé' },
    { key: 'inscription_validee', label: 'Inscription validée' },
  ];

  // Entrées metadata à afficher (exclut les doublons avec les champs principaux)
  const metaEntries = c.metadata
    ? Object.entries(c.metadata).filter(([k, v]) => k && !META_SKIP.has(k.toLowerCase().trim()) && v && String(v).trim())
    : [];

  // Fallback : parse le champ notes si pas de metadata structuré (anciens imports)
  const parsedNotes = !c.metadata && c.notes
    ? c.notes.split('\n').reduce<Array<[string, string]>>((acc, line) => {
        const idx = line.indexOf(' : ');
        if (idx > 0) acc.push([line.slice(0, idx).trim(), line.slice(idx + 3).trim()]);
        return acc;
      }, [])
    : [];

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-5">

      {/* Coordonnées complémentaires */}
      <section className="rounded-xl border border-line bg-surface-2/40 p-4">
        <h3 className={cn(titreSection, 'mb-1')}>Coordonnées complémentaires</h3>
        <p className="mb-3 text-xs text-muted">Nom, e-mail principal, téléphone, entreprise et tags se changent avec le crayon en haut de la fiche.</p>
        <div className="space-y-3">
          {/* Deux adresses complémentaires, chacune avec son libellé : une
              organisation peut avoir plusieurs services interlocuteurs. */}
          {([['email2', 'email2_libelle'], ['email3', 'email3_libelle']] as const).map(([champ, libelle], i) => (
            <div key={champ} className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Autre e-mail {i + 1} {enregistre(champ)}</label>
                <input className="input" type="email" placeholder="adresse@exemple.fr"
                  value={form[champ]} onChange={(e) => editField(champ, e.target.value)} onBlur={(e) => blurSave(champ, e.target.value)} />
              </div>
              <div>
                <label className="label">À quoi correspond cette adresse</label>
                <input className="input" placeholder="ex. comptabilité, service formation…"
                  value={form[libelle]} onChange={(e) => editField(libelle, e.target.value)} onBlur={(e) => blurSave(libelle, e.target.value)} />
              </div>
            </div>
          ))}
          <div>
            <label className="label">Autres coordonnées {enregistre('autres')}</label>
            <textarea className="input" rows={2} placeholder="Téléphones / e-mails supplémentaires…"
              value={form.autres} onChange={(e) => editField('autres', e.target.value)} onBlur={(e) => blurSave('autres', e.target.value)} />
          </div>
          {entreprise ? (
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="SIRET (entreprise)"
              value={entreprise.siret || <span className="italic text-muted">non renseigné sur la fiche entreprise</span>} />
          ) : (
            <div>
              <label className="label">SIRET {enregistre('siret')}</label>
              <input className="input" placeholder="14 chiffres — repris sur le devis et le plan si aucune entreprise n'est reliée"
                value={form.siret} onChange={(e) => editField('siret', e.target.value)} onBlur={(e) => blurSave('siret', e.target.value)} />
            </div>
          )}
          {financeur && <InfoRow icon={<Tag className="h-4 w-4" />} label="Financeur" value={financeur.nom} />}
          <InfoRow icon={<User className="h-4 w-4" />} label="Conseiller affecté"
            value={owner ? fullName(owner.prenom, owner.nom) : <span className="text-amber-600">Non affecté</span>} />
        </div>
      </section>

      {/* Checklist conformité */}
      <section className="rounded-xl border border-line bg-surface-2/40 p-4">
        <div className="mb-3 flex items-center gap-2"><ListChecks className="h-4 w-4 text-muted" /><h3 className={titreSection}>Checklist conformité dossier</h3></div>
        <div className="mb-2"><label className="label">Date fixée</label><input className="input" type="date" value={cc.date_fixee ?? ''} onChange={(e) => patch({ date_fixee: e.target.value || null })} /></div>
        <div className="space-y-1.5">{CHECKLIST.map((item) => (
          <label key={String(item.key)} className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={Boolean(cc[item.key])} onChange={() => patch({ [item.key]: !cc[item.key] } as Partial<Contact>)} /> {item.label}
          </label>))}
        </div>
      </section>

      {/* Commissions */}
      <section className="rounded-xl border border-line bg-surface-2/40 p-4">
        <div className="mb-3 flex items-center gap-2"><Coins className="h-4 w-4 text-muted" /><h3 className={titreSection}>Commissions</h3></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Date formation</label><input className="input" type="date" value={form.date_formation ?? ''} onChange={(e) => setFf('date_formation', e.target.value)} /></div>
          <div><label className="label">Assiette (€)</label><input className="input" type="number" value={form.assiette_commission ?? ''} onChange={(e) => setFf('assiette_commission', e.target.value)} /></div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={cc.commission_validee} onChange={() => patch({ commission_validee: !cc.commission_validee })} /> Validée</label>
          <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={cc.commission_payee} onChange={() => patch({ commission_payee: !cc.commission_payee })} /> Payée</label>
        </div>
        <button onClick={() => saveSection('comm', { date_formation: form.date_formation || null, assiette_commission: form.assiette_commission ? Number(form.assiette_commission) : null })}
          disabled={savingSec === 'comm'} className="btn-secondary mt-2 py-1.5 text-sm"><Save className="h-3.5 w-3.5" /> {savingSec === 'comm' ? '…' : 'Enregistrer'}</button>
      </section>

      {/* RGPD + dates */}
      <section>
        <h3 className={cn(titreSection, 'mb-3')}>Informations</h3>
        <div className="space-y-3">
          <InfoRow
            icon={c.rgpd_consent ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
            label="Consentement RGPD"
            value={c.rgpd_consent ? 'Recueilli' : 'Non recueilli'}
          />
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="Créé"
            value={`${formatDate(c.created_at)} · ${formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}`}
          />
        </div>
      </section>

      {/* Données importées (metadata structuré ou notes parsées) */}
      {(metaEntries.length > 0 || parsedNotes.length > 0) && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <TableProperties className="h-4 w-4 text-muted" />
            <h3 className={titreSection}>Données importées</h3>
          </div>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {(metaEntries.length > 0 ? metaEntries : parsedNotes).map(([key, val]) => (
                  <tr key={key} className="hover:bg-surface-2">
                    <td className="w-2/5 px-3 py-2 align-top text-xs font-medium text-muted">
                      {key.replace(/_/g, ' ').replace(/\?+/g, '?')}
                    </td>
                    <td className="break-words px-3 py-2 align-top text-fg">
                      {String(val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {metaEntries.length > 0
              ? `${metaEntries.length} champ(s) issus du fichier importé`
              : 'Données reconstruites depuis le champ notes — re-importez pour obtenir la vue structurée'}
          </p>
        </section>
      )}
    </div>
  );
}
