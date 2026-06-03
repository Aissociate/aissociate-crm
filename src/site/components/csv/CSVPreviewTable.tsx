// @ts-nocheck
import { Building2, User, Phone } from 'lucide-react';
import { CRM_FIELD_DEFINITIONS, CrmFieldKey } from '../../types/dossiers';

export interface ParsedCompanyRow {
  raison_social: string;
  activite: string;
  adresse: string;
  city: string;
  postal_code: string;
  description: string;
  commentaires: string;
  contacts: {
    nom: string;
    prenom: string;
    phones: string[];
  }[];
}

interface CSVPreviewTableProps {
  companies: ParsedCompanyRow[];
  totalRawRows: number;
}

export function buildCompanyRows(
  rawRows: string[][],
  csvHeaders: string[],
  mapping: Record<string, CrmFieldKey | ''>
): ParsedCompanyRow[] {
  const getVal = (row: string[], fieldKey: CrmFieldKey): string => {
    const headerIndex = csvHeaders.findIndex(h => mapping[h] === fieldKey);
    if (headerIndex === -1) return '';
    return (row[headerIndex] || '').trim();
  };

  const companyMap = new Map<string, ParsedCompanyRow>();

  for (const row of rawRows) {
    const raisonSocial = getVal(row, 'raison_social');
    if (!raisonSocial) continue;

    const key = raisonSocial.toLowerCase().trim();

    if (!companyMap.has(key)) {
      companyMap.set(key, {
        raison_social: raisonSocial,
        activite: getVal(row, 'activite'),
        adresse: getVal(row, 'adresse'),
        city: getVal(row, 'city'),
        postal_code: getVal(row, 'postal_code'),
        description: getVal(row, 'description'),
        commentaires: getVal(row, 'commentaires'),
        contacts: [],
      });
    }

    const company = companyMap.get(key)!;

    const nom = getVal(row, 'nom');
    const prenom = getVal(row, 'prenom');
    const phones = [
      getVal(row, 'tel_0'),
      getVal(row, 'tel_1'),
      getVal(row, 'tel_2'),
      getVal(row, 'tel_3'),
    ].filter(Boolean);

    if (nom || prenom || phones.length > 0) {
      company.contacts.push({ nom, prenom, phones });
    }
  }

  return Array.from(companyMap.values());
}

export default function CSVPreviewTable({ companies, totalRawRows }: CSVPreviewTableProps) {
  const totalContacts = companies.reduce((sum, c) => sum + c.contacts.length, 0);
  const totalPhones = companies.reduce(
    (sum, c) => sum + c.contacts.reduce((s, ct) => s + ct.phones.length, 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">3</div>
        <h3 className="text-lg font-bold text-slate-900">Apercu des donnees</h3>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalRawRows}</p>
          <p className="text-xs text-slate-500">Lignes CSV</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{companies.length}</p>
          <p className="text-xs text-blue-600 flex items-center justify-center gap-1">
            <Building2 className="w-3 h-3" /> Entreprises
          </p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{totalContacts}</p>
          <p className="text-xs text-emerald-600 flex items-center justify-center gap-1">
            <User className="w-3 h-3" /> Contacts
          </p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{totalPhones}</p>
          <p className="text-xs text-amber-600 flex items-center justify-center gap-1">
            <Phone className="w-3 h-3" /> Telephones
          </p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Raison sociale</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Activite</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Ville</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Contacts</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Telephones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.slice(0, 50).map((company, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors align-top">
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">{company.raison_social}</span>
                  {company.adresse && (
                    <p className="text-xs text-slate-400 mt-0.5">{company.adresse}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{company.activite || '-'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {company.city}{company.postal_code ? ` (${company.postal_code})` : ''}
                  {!company.city && '-'}
                </td>
                <td className="px-4 py-3">
                  {company.contacts.length === 0 ? (
                    <span className="text-slate-400">-</span>
                  ) : (
                    <div className="space-y-1">
                      {company.contacts.map((c, ci) => (
                        <div key={ci} className="text-slate-800">
                          {c.prenom} {c.nom}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {company.contacts.length === 0 ? (
                    <span className="text-slate-400">-</span>
                  ) : (
                    <div className="space-y-1">
                      {company.contacts.map((c, ci) => (
                        <div key={ci} className="text-slate-600 text-xs">
                          {c.phones.length > 0 ? c.phones.join(', ') : '-'}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {companies.length > 50 && (
          <div className="p-3 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
            ... et {companies.length - 50} entreprise(s) de plus
          </div>
        )}
      </div>
    </div>
  );
}
