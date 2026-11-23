import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { CONTACT_TYPE_LABELS } from '@/lib/constants';
import { importContactsMapped, guessMapping, CONTACT_IMPORT_FIELDS, type ColumnMapping } from '@/lib/importExcel';
import type { ContactType } from '@/lib/database.types';
import { TYPES } from './constantes';

/**
 * Import d'un fichier CSV avec correspondance des colonnes. Montée une fois le fichier lu :
 * les colonnes sont pré-associées automatiquement.
 */
export function ModaleImportCsv({
  mapHeaders, mapRows, isManager, userId, importing, setImporting, recordImport, refresh, onClose,
}: {
  mapHeaders: string[];
  mapRows: Record<string, string>[];
  isManager: boolean;
  userId: string | undefined;
  importing: boolean;
  setImporting: (v: boolean) => void;
  recordImport: (ids: string[], source: 'csv' | 'csv_mapping') => Promise<void>;
  refresh: () => unknown;
  onClose: () => void;
}) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => guessMapping(mapHeaders));
  const [mapOwner, setMapOwner] = useState<'none' | 'me'>(isManager ? 'none' : 'me');
  const [mapType, setMapType] = useState<ContactType>('prospect');

  const runMappedImport = async () => {
    if (!mapping.nom && !mapping.nom_complet) { alert('Mappez au moins la colonne « Nom » ou « Nom complet ».'); return; }
    setImporting(true);
    try {
      const ownerId = mapOwner === 'me' ? (userId ?? null) : null;
      const r = await importContactsMapped(mapRows, mapping, { ownerId, defaultType: mapType });
      await recordImport(r.created ?? [], 'csv_mapping');
      onClose();
      void refresh();
      alert(`${r.importes} contact(s) importé(s)/mis à jour sur ${r.lus} ligne(s) (${(r.created ?? []).length} créé(s)).`);
    } catch (err) {
      alert(`Échec de l'import : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} wide
      title="Importer un fichier CSV"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={runMappedImport} disabled={importing || (!mapping.nom && !mapping.nom_complet)}>
          {importing ? 'Import…' : `Importer ${mapRows.length} ligne(s)`}
        </Button>
      </>}
    >
      <p className="mb-3 text-sm text-muted">
        Associez chaque champ du contact à une colonne de votre fichier. Les colonnes ont été pré-mappées automatiquement ; ajustez si besoin. Au moins « Nom » ou « Nom complet » est requis.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CONTACT_IMPORT_FIELDS.map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <label className="w-1/2 shrink-0 text-sm text-fg">{f.label}</label>
            <select
              className="input flex-1"
              value={mapping[f.key] ?? ''}
              onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
            >
              <option value="">{f.key === 'type' ? '— Valeur fixe ↓ —' : '— Ignorer —'}</option>
              {mapHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            {/* Type non mappé à une colonne : on choisit une valeur fixe (types définis en base). */}
            {f.key === 'type' && !mapping.type && (
              <select className="input flex-1" value={mapType} onChange={(e) => setMapType(e.target.value as ContactType)} title="Type appliqué à tous les contacts importés">
                {TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-1 text-sm font-medium text-fg">Affectation</p>
        <select className="input max-w-xs" value={mapOwner} onChange={(e) => setMapOwner(e.target.value as 'none' | 'me')}>
          <option value="me">M'attribuer ces contacts</option>
          {isManager && <option value="none">Non affecté (à répartir ensuite)</option>}
        </select>
      </div>

      {/* Aperçu des 3 premières lignes selon le mapping */}
      <div className="mt-4">
        <p className="mb-1 text-sm font-medium text-fg">Aperçu</p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-muted">
              <tr>{CONTACT_IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => <th key={f.key} className="px-2 py-1.5 text-left font-medium">{f.label}</th>)}</tr>
            </thead>
            <tbody>
              {mapRows.slice(0, 3).map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {CONTACT_IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                    <td key={f.key} className="px-2 py-1.5 text-fg">{r[mapping[f.key] as string] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Dédoublonnage par e-mail (ou téléphone/nom) ; réimporter le même fichier met à jour les contacts.</p>
      </div>
    </Modal>
  );
}
