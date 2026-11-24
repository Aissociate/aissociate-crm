import { Save, BadgeCheck } from 'lucide-react';
import { Card, Button, Field } from '@/components/ui';
import type { AgeficeCfg, Sauvegarde } from './types';

/** AGEFICE — données reprises dans les documents officiels. */
export function CarteAgefice({
  agefice, setAgefice, persist, saving, savedMsg,
}: {
  agefice: AgeficeCfg;
  setAgefice: (v: AgeficeCfg) => void;
} & Sauvegarde) {
  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <BadgeCheck className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">AGEFICE — documents de financement</h2>
      </div>
      <p className="mb-4 text-sm text-muted">
        Renseignées une fois, ces informations alimentent automatiquement la demande préalable de
        financement, la convention, la feuille d'émargement et l'attestation d'assiduité, générées
        depuis un plan de formation. Le reste provient du contact, de l'entreprise, du plan et du devis.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Field label="Civilité du représentant légal">
          <select className="input" value={agefice.responsable_civilite ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_civilite: e.target.value })}>
            <option value="">—</option><option value="M.">M.</option><option value="Mme">Mme</option>
          </select>
        </Field>
        <Field label="Prénom du représentant légal">
          <input className="input" value={agefice.responsable_prenom ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_prenom: e.target.value })} />
        </Field>
        <Field label="Nom du représentant légal">
          <input className="input" value={agefice.responsable_nom ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_nom: e.target.value })} />
        </Field>
        <Field label="Qualité" hint="ex. Gérant, Président — figure sur l'attestation d'assiduité">
          <input className="input" value={agefice.responsable_qualite ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_qualite: e.target.value })} placeholder="ex. Gérant" />
        </Field>
        <Field label="Téléphone du représentant">
          <input className="input" value={agefice.responsable_tel ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_tel: e.target.value })} placeholder="défaut : téléphone de l'organisme" />
        </Field>
        <Field label="E-mail du représentant">
          <input className="input" value={agefice.responsable_email ?? ''} onChange={(e) => setAgefice({ ...agefice, responsable_email: e.target.value })} placeholder="défaut : e-mail de l'organisme" />
        </Field>
        <Field label="DREETS / préfet de région" hint="Autorité auprès de laquelle le NDA est enregistré">
          <input className="input" value={agefice.prefet_region ?? ''} onChange={(e) => setAgefice({ ...agefice, prefet_region: e.target.value })} placeholder="ex. DEETS La Réunion" />
        </Field>
        <div className="lg:col-span-2">
          <Field label="Adresse du formulaire officiel" hint="AGEFICE republie le formulaire chaque campagne : collez ici la nouvelle adresse le moment venu">
            <input className="input" value={agefice.demande_url ?? ''} onChange={(e) => setAgefice({ ...agefice, demande_url: e.target.value })} placeholder="https://communication-agefice.fr/…-Editable.pdf" />
          </Field>
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">
        Le formulaire officiel est téléchargé une fois puis conservé dans l'espace de stockage :
        les générations suivantes ne dépendent plus du site de l'AGEFICE. Changer l'adresse
        ci-dessus déclenche automatiquement un nouveau téléchargement.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => persist('agefice', { ...agefice })} disabled={saving === 'agefice'}>
          <Save className="h-4 w-4" /> {saving === 'agefice' ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {savedMsg === 'agefice' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
      </div>
    </Card>
  );
}
