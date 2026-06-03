// @ts-nocheck
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, CheckCircle2, AlertCircle, X, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import CSVColumnMapper, { autoMatchColumns } from './csv/CSVColumnMapper';
import CSVPreviewTable, { buildCompanyRows, ParsedCompanyRow } from './csv/CSVPreviewTable';
import { CrmFieldKey } from '../types/dossiers';

type WizardStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface ProspectsCSVUploadProps {
  onSuccess?: () => void;
}

function parseCSVRaw(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('Le fichier CSV doit contenir au moins une ligne d\'en-tete et une ligne de donnees');
  }

  const separator = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(separator).map(v => v.trim().replace(/^["']|["']$/g, ''));
    rows.push(values);
  }

  return { headers, rows };
}

export default function ProspectsCSVUpload({ onSuccess }: ProspectsCSVUploadProps) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, CrmFieldKey | ''>>({});
  const [companies, setCompanies] = useState<ParsedCompanyRow[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const reset = () => {
    setStep('upload');
    setError(null);
    setSuccess(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setCompanies([]);
    setImportProgress({ current: 0, total: 0 });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      const { headers, rows } = parseCSVRaw(text);

      if (rows.length === 0) {
        throw new Error('Le fichier ne contient aucune donnee');
      }

      setCsvHeaders(headers);
      setCsvRows(rows);

      const autoMapping = autoMatchColumns(headers);
      setMapping(autoMapping);
      setStep('mapping');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la lecture du fichier');
    }
  };

  const handleMappingConfirm = () => {
    try {
      const result = buildCompanyRows(csvRows, csvHeaders, mapping);
      if (result.length === 0) {
        setError('Aucune entreprise detectee. Verifiez le mapping de la colonne "Raison sociale".');
        return;
      }
      setCompanies(result);
      setError(null);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la preparation des donnees');
    }
  };

  const handleImport = async () => {
    setStep('importing');
    setError(null);
    setImportProgress({ current: 0, total: companies.length });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifie');

      let importedCompanies = 0;
      let importedContacts = 0;
      let importedPhones = 0;

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        setImportProgress({ current: i + 1, total: companies.length });

        const { data: companyData, error: companyError } = await supabase
          .from('crm_companies')
          .insert({
            raison_social: company.raison_social,
            activite: company.activite,
            adresse: company.adresse,
            city: company.city,
            postal_code: company.postal_code,
            description: company.description,
            commentaires: company.commentaires,
            imported_by: user.id,
          })
          .select('id')
          .maybeSingle();

        if (companyError) throw companyError;
        if (!companyData) continue;

        importedCompanies++;

        for (const contact of company.contacts) {
          const { data: contactData, error: contactError } = await supabase
            .from('crm_contacts')
            .insert({
              company_id: companyData.id,
              nom: contact.nom,
              prenom: contact.prenom,
            })
            .select('id')
            .maybeSingle();

          if (contactError) throw contactError;
          if (!contactData) continue;

          importedContacts++;

          if (contact.phones.length > 0) {
            const phonesToInsert = contact.phones.map((phone, idx) => ({
              contact_id: contactData.id,
              phone_number: phone,
              label: idx === 0 ? 'principal' : `tel_${idx + 1}`,
            }));

            const { error: phoneError } = await supabase
              .from('crm_phones')
              .insert(phonesToInsert);

            if (phoneError) throw phoneError;
            importedPhones += phonesToInsert.length;
          }
        }
      }

      setSuccess(
        `Import termine : ${importedCompanies} entreprise(s), ${importedContacts} contact(s), ${importedPhones} telephone(s)`
      );
      setStep('done');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'import');
      setStep('preview');
    }
  };

  const downloadTemplate = () => {
    const csvContent =
      'activite;adresse;city;description;postal_code;raison_social;tel/0;tel/1;tel/2;tel/3;commentaires;nom;prenom\n' +
      'Formation;12 rue de Paris;Paris;Organisme de formation;75001;FormaPro SAS;0612345678;0698765432;;;Prospect chaud;Dupont;Jean\n' +
      'Formation;12 rue de Paris;Paris;Organisme de formation;75001;FormaPro SAS;0611223344;;;;Martin;Marie\n' +
      'Consulting;5 av des Champs;Lyon;Cabinet conseil;69001;Conseil Plus;0678901234;;;0478123456;A recontacter;Bernard;Pierre';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_import_crm.csv';
    link.click();
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Import CSV - CRM Entreprises</h2>
          <p className="text-sm text-slate-500 mt-1">
            Importez des entreprises avec leurs contacts et telephones
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          Modele CSV
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {(['upload', 'mapping', 'preview'] as const).map((s, idx) => {
          const labels = ['Fichier', 'Colonnes', 'Apercu'];
          const isActive = step === s || (step === 'importing' && s === 'preview') || (step === 'done' && s === 'preview');
          const isPast =
            (s === 'upload' && step !== 'upload') ||
            (s === 'mapping' && ['preview', 'importing', 'done'].includes(step)) ||
            (s === 'preview' && step === 'done');

          return (
            <div key={s} className="flex items-center gap-2">
              {idx > 0 && <div className={`w-8 h-0.5 ${isPast ? 'bg-orange-400' : 'bg-slate-200'}`} />}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive ? 'bg-orange-100 text-orange-700' :
                isPast ? 'bg-green-100 text-green-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                {isPast ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-current/10 flex items-center justify-center text-[10px]">{idx + 1}</span>
                )}
                {labels[idx]}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Erreur</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-green-800 font-medium">Succes</p>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">1</div>
            <h3 className="text-lg font-bold text-slate-900">Selectionner un fichier</h3>
          </div>

          <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all group">
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3 group-hover:text-orange-400 transition-colors" />
            <p className="text-slate-700 font-medium">Cliquez ou glissez un fichier CSV</p>
            <p className="text-xs text-slate-400 mt-1">Separateurs acceptes : virgule, point-virgule, tabulation</p>
          </label>

          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Colonnes attendues :</p>
            <div className="flex flex-wrap gap-1.5">
              {['activite', 'adresse', 'city', 'description', 'postal_code', 'raison_social', 'tel/0', 'tel/1', 'tel/2', 'tel/3', 'commentaires', 'nom', 'prenom'].map(col => (
                <code key={col} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-slate-600">
                  {col}
                </code>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Plusieurs lignes avec la meme raison sociale seront regroupees en une seule entreprise avec plusieurs contacts.
            </p>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <CSVColumnMapper
          csvHeaders={csvHeaders}
          mapping={mapping}
          onMappingChange={setMapping}
          onConfirm={handleMappingConfirm}
          onBack={reset}
        />
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <CSVPreviewTable companies={companies} totalRawRows={csvRows.length} />

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('mapping')}
              className="px-6 py-2.5 border-2 border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-medium transition-colors"
            >
              Modifier le mapping
            </button>
            <button
              onClick={handleImport}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-lg font-semibold transition-colors"
            >
              <Upload className="w-5 h-5" />
              Importer {companies.length} entreprise{companies.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="py-12 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-orange-600 mx-auto" />
          <p className="text-slate-700 font-medium">Import en cours...</p>
          <div className="max-w-xs mx-auto">
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {importProgress.current} / {importProgress.total} entreprises traitees
            </p>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-slate-900 font-semibold text-lg">Import termine avec succes</p>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
          >
            Nouvel import
          </button>
        </div>
      )}
    </div>
  );
}
