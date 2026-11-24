import { Save, Building2 } from 'lucide-react';
import { Card, Button, Field } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import type { Organisme, Sauvegarde } from './types';

/** Organisme de formation : coordonnées, logo, cachet. */
export function CarteOrganisme({
  organisme, setOrganisme, persist, saving, savedMsg,
}: {
  organisme: Organisme;
  setOrganisme: (v: Organisme) => void;
} & Sauvegarde) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">Organisme de formation</h2>
      </div>
      <div className="space-y-4">
        <Field label="Nom"><input className="input" value={organisme.nom ?? ''} onChange={(e) => setOrganisme({ ...organisme, nom: e.target.value })} /></Field>
        <Field label="N° Qualiopi"><input className="input" value={organisme.qualiopi ?? ''} onChange={(e) => setOrganisme({ ...organisme, qualiopi: e.target.value })} /></Field>
        <Field label="E-mail de contact"><input className="input" value={organisme.email ?? ''} onChange={(e) => setOrganisme({ ...organisme, email: e.target.value })} /></Field>
        <Field label="Téléphone"><input className="input" value={organisme.telephone ?? ''} onChange={(e) => setOrganisme({ ...organisme, telephone: e.target.value })} /></Field>
        <Field label="Adresse"><input className="input" value={organisme.adresse ?? ''} onChange={(e) => setOrganisme({ ...organisme, adresse: e.target.value })} /></Field>
        <Field label="Code postal"><input className="input" value={organisme.code_postal ?? ''} onChange={(e) => setOrganisme({ ...organisme, code_postal: e.target.value })} /></Field>
        <Field label="Ville"><input className="input" value={organisme.ville ?? ''} onChange={(e) => setOrganisme({ ...organisme, ville: e.target.value })} /></Field>
        <Field label="SIRET" hint="Figure sur les devis"><input className="input" value={organisme.siret ?? ''} onChange={(e) => setOrganisme({ ...organisme, siret: e.target.value })} /></Field>
        <Field label="N° déclaration d'activité" hint="Organisme de formation"><input className="input" value={organisme.nda ?? ''} onChange={(e) => setOrganisme({ ...organisme, nda: e.target.value })} /></Field>
        <Field label="Code NAF / APE"><input className="input" value={organisme.naf ?? ''} onChange={(e) => setOrganisme({ ...organisme, naf: e.target.value })} /></Field>
        <Field label="Pays"><input className="input" value={organisme.pays ?? ''} onChange={(e) => setOrganisme({ ...organisme, pays: e.target.value })} placeholder="FRANCE" /></Field>
        <Field label="TVA intracommunautaire" hint="Laisser vide si exonéré"><input className="input" value={organisme.tva_intra ?? ''} onChange={(e) => setOrganisme({ ...organisme, tva_intra: e.target.value })} /></Field>
        <Field label="Forme juridique" hint="ex. SARL, SAS"><input className="input" value={organisme.forme_juridique ?? ''} onChange={(e) => setOrganisme({ ...organisme, forme_juridique: e.target.value })} /></Field>
        <Field label="Capital social"><input className="input" value={organisme.capital ?? ''} onChange={(e) => setOrganisme({ ...organisme, capital: e.target.value })} /></Field>
        <div className="sm:col-span-2">
          <Field label="Logo" hint="Affiché en en-tête des devis (PNG/JPG)">
            <div className="flex items-center gap-3">
              <FileUpload bucket="documents" onUploaded={(v) => setOrganisme({ ...organisme, logo_url: v })} label="Téléverser un logo" />
              {organisme.logo_url && <FileLink bucket="documents" value={organisme.logo_url} onClear={() => setOrganisme({ ...organisme, logo_url: '' })} />}
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Cachet + signature" hint="Incrusté sur les attestations et documents signés (PNG/JPG, fond transparent de préférence)">
            <div className="flex items-center gap-3">
              <FileUpload bucket="documents" onUploaded={(v) => setOrganisme({ ...organisme, signature_url: v })} label="Téléverser le cachet" />
              {organisme.signature_url && <FileLink bucket="documents" value={organisme.signature_url} onClear={() => setOrganisme({ ...organisme, signature_url: '' })} />}
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => persist('organisme', organisme)} disabled={saving === 'organisme'}>
            <Save className="h-4 w-4" /> {saving === 'organisme' ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {savedMsg === 'organisme' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
        </div>
      </div>
    </Card>
  );
}
