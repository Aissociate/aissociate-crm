// @ts-nocheck
import { ArrowRight, Check, AlertTriangle, Building2, User, Phone } from 'lucide-react';
import { CRM_FIELD_DEFINITIONS, CrmFieldKey } from '../../types/dossiers';

interface CSVColumnMapperProps {
  csvHeaders: string[];
  mapping: Record<string, CrmFieldKey | ''>;
  onMappingChange: (mapping: Record<string, CrmFieldKey | ''>) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const AUTO_MATCH_RULES: Record<string, string[]> = {
  raison_social: ['raison_social', 'raison sociale', 'societe', 'société', 'entreprise', 'company'],
  activite: ['activite', 'activité', 'activity', 'secteur', 'sector'],
  adresse: ['adresse', 'address', 'rue', 'street'],
  city: ['city', 'ville', 'commune'],
  postal_code: ['postal_code', 'code_postal', 'cp', 'zip', 'zipcode', 'code postal'],
  description: ['description', 'desc'],
  commentaires: ['commentaires', 'commentaire', 'comment', 'comments', 'notes', 'note', 'remarque'],
  nom: ['nom', 'name', 'last_name', 'lastname', 'family_name'],
  prenom: ['prenom', 'prénom', 'firstname', 'first_name', 'given_name'],
  tel_0: ['tel/0', 'tel0', 'phone', 'telephone', 'tel', 'mobile', 'phone_1', 'tel_1'],
  tel_1: ['tel/1', 'tel1', 'phone_2', 'tel_2', 'telephone_2'],
  tel_2: ['tel/2', 'tel2', 'phone_3', 'tel_3', 'telephone_3'],
  tel_3: ['tel/3', 'tel3', 'phone_4', 'tel_4', 'telephone_4'],
};

export function autoMatchColumns(csvHeaders: string[]): Record<string, CrmFieldKey | ''> {
  const mapping: Record<string, CrmFieldKey | ''> = {};
  const usedFields = new Set<string>();

  for (const header of csvHeaders) {
    const normalized = header.trim().toLowerCase().replace(/[\s_-]+/g, '_');
    let matched = false;

    for (const [fieldKey, patterns] of Object.entries(AUTO_MATCH_RULES)) {
      if (usedFields.has(fieldKey)) continue;

      for (const pattern of patterns) {
        const normalizedPattern = pattern.replace(/[\s_-]+/g, '_');
        if (normalized === normalizedPattern || normalized.includes(normalizedPattern)) {
          mapping[header] = fieldKey as CrmFieldKey;
          usedFields.add(fieldKey);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      mapping[header] = '';
    }
  }

  return mapping;
}

const GROUP_ICONS = {
  company: Building2,
  contact: User,
  phone: Phone,
};

const GROUP_COLORS = {
  company: 'text-blue-600 bg-blue-50 border-blue-200',
  contact: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  phone: 'text-amber-600 bg-amber-50 border-amber-200',
};

export default function CSVColumnMapper({
  csvHeaders,
  mapping,
  onMappingChange,
  onConfirm,
  onBack,
}: CSVColumnMapperProps) {
  const usedFields = new Set(Object.values(mapping).filter(Boolean));

  const requiredFields = CRM_FIELD_DEFINITIONS.filter(f => f.required);
  const allRequiredMapped = requiredFields.every(f =>
    Object.values(mapping).includes(f.key)
  );

  const handleChange = (csvHeader: string, value: CrmFieldKey | '') => {
    const updated = { ...mapping, [csvHeader]: value };
    onMappingChange(updated);
  };

  const getFieldDef = (key: string) =>
    CRM_FIELD_DEFINITIONS.find(f => f.key === key);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">2</div>
        <h3 className="text-lg font-bold text-slate-900">Correspondance des colonnes</h3>
      </div>

      <p className="text-sm text-slate-600">
        Associez chaque colonne de votre CSV a un champ CRM. Les champs marques d'un * sont obligatoires.
      </p>

      {!allRequiredMapped && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Veuillez mapper au minimum : {requiredFields.map(f => f.label).join(', ')}
          </p>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-200">
          <div className="px-4 py-3 text-sm font-semibold text-slate-700">Colonne CSV</div>
          <div className="px-4 py-3 text-sm font-semibold text-slate-700">Champ CRM</div>
        </div>

        <div className="divide-y divide-slate-100">
          {csvHeaders.map((header) => {
            const currentValue = mapping[header] || '';
            const fieldDef = currentValue ? getFieldDef(currentValue) : null;
            const groupColor = fieldDef ? GROUP_COLORS[fieldDef.group as keyof typeof GROUP_COLORS] : '';

            return (
              <div key={header} className="grid grid-cols-2 items-center hover:bg-slate-50 transition-colors">
                <div className="px-4 py-3">
                  <code className="text-sm bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono">
                    {header}
                  </code>
                </div>
                <div className="px-4 py-3 flex items-center gap-2">
                  {currentValue && fieldDef && (
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      fieldDef.group === 'company' ? 'bg-blue-500' :
                      fieldDef.group === 'contact' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                  )}
                  <select
                    value={currentValue}
                    onChange={(e) => handleChange(header, e.target.value as CrmFieldKey | '')}
                    className={`flex-1 text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                      currentValue ? `${groupColor} border` : 'border-slate-300 text-slate-500'
                    }`}
                  >
                    <option value="">-- Ignorer --</option>
                    <optgroup label="Entreprise">
                      {CRM_FIELD_DEFINITIONS.filter(f => f.group === 'company').map(f => (
                        <option
                          key={f.key}
                          value={f.key}
                          disabled={usedFields.has(f.key) && mapping[header] !== f.key}
                        >
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Contact">
                      {CRM_FIELD_DEFINITIONS.filter(f => f.group === 'contact').map(f => (
                        <option
                          key={f.key}
                          value={f.key}
                          disabled={usedFields.has(f.key) && mapping[header] !== f.key}
                        >
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Telephones">
                      {CRM_FIELD_DEFINITIONS.filter(f => f.group === 'phone').map(f => (
                        <option
                          key={f.key}
                          value={f.key}
                          disabled={usedFields.has(f.key) && mapping[header] !== f.key}
                        >
                          {f.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Entreprise
          <span className="w-2 h-2 rounded-full bg-emerald-500 ml-2" /> Contact
          <span className="w-2 h-2 rounded-full bg-amber-500 ml-2" /> Telephone
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="px-6 py-2.5 border-2 border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-medium transition-colors"
        >
          Retour
        </button>
        <button
          onClick={onConfirm}
          disabled={!allRequiredMapped}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-5 h-5" />
          Confirmer le mapping
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
