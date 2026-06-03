// @ts-nocheck
import { Edit2, Phone, Mail, Calendar, Building2, Bell } from 'lucide-react';
import { Dossier, getStatusLabel, getStatusColor, getFullName } from '../../types/dossiers';
import { formatDate, formatDateTime } from '../../utils/kpiCalculations';

interface DossierListProps {
  dossiers: Dossier[];
  onEdit: (dossier: Dossier) => void;
  onEmail?: (dossier: Dossier) => void;
  role: 'fixer' | 'closer' | 'admin';
}

export default function DossierList({ dossiers, onEdit, onEmail, role }: DossierListProps) {
  if (dossiers.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Aucun dossier</p>
        <p className="text-xs text-slate-500 mt-1">Creez votre premier dossier pour commencer</p>
      </div>
    );
  }

  if (role === 'fixer') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nom</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Prenom</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Entreprise</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Telephone</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Commentaire</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Entree</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Prochaine action</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Objectif</th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-16"></th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map(dossier => (
              <tr
                key={dossier.id}
                className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                onClick={() => onEdit(dossier)}
              >
                <td className="px-4 py-3.5">
                  <span className="text-sm font-semibold text-slate-900">{dossier.contact_last_name}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-slate-700">{dossier.contact_first_name}</span>
                </td>
                <td className="px-4 py-3.5">
                  <div>
                    <span className="text-sm text-slate-900">{dossier.company}</span>
                    {dossier.sector && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{dossier.sector}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  {dossier.phone ? (
                    <a
                      href={`tel:${dossier.phone}`}
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      {dossier.phone}
                    </a>
                  ) : (
                    <span className="text-slate-300 text-sm">--</span>
                  )}
                </td>
                <td className="px-4 py-3.5 max-w-[200px]">
                  {dossier.fixer_notes ? (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed" title={dossier.fixer_notes}>
                      {dossier.fixer_notes}
                    </p>
                  ) : (
                    <span className="text-slate-300 text-sm">--</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-slate-500">{formatDate(dossier.created_at)}</span>
                </td>
                <td className="px-4 py-3.5">
                  {dossier.next_step_date ? (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-blue-500" />
                      <span className="text-xs font-medium text-slate-700">{formatDate(dossier.next_step_date)}</span>
                    </div>
                  ) : (
                    <span className="text-slate-300 text-sm">--</span>
                  )}
                </td>
                <td className="px-4 py-3.5 max-w-[180px]">
                  {dossier.next_step_action ? (
                    <p className="text-xs text-slate-600 line-clamp-2" title={dossier.next_step_action}>
                      {dossier.next_step_action}
                    </p>
                  ) : (
                    <span className="text-slate-300 text-sm">--</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEmail && dossier.email && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEmail(dossier); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title={`Envoyer un email a ${dossier.email}`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(dossier); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Entreprise</th>
            {role === 'closer' && (
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Produit</th>
            )}
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">RDV</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Show-up</th>
            {role === 'closer' && (
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Qualite</th>
            )}
            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Derniere activite</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-16"></th>
          </tr>
        </thead>
        <tbody>
          {dossiers.map(dossier => (
            <tr
              key={dossier.id}
              className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer group"
              onClick={() => onEdit(dossier)}
            >
              <td className="px-4 py-3.5">
                <div>
                  <span className="text-sm font-semibold text-slate-900">{dossier.company}</span>
                  {dossier.sector && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{dossier.sector}</p>
                  )}
                </div>
              </td>
              {role === 'closer' && (
                <td className="px-4 py-3.5">
                  <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-medium ${
                    dossier.product_type === 'marche_public'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {dossier.product_type === 'marche_public' ? 'Marche Public' : 'Formations IA'}
                  </span>
                </td>
              )}
              <td className="px-4 py-3.5">
                <div>
                  <span className="text-sm text-slate-900">{getFullName(dossier)}</span>
                  {dossier.contact_function && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{dossier.contact_function}</p>
                  )}
                  <div className="flex gap-2 mt-1">
                    {dossier.phone && (
                      <a href={`tel:${dossier.phone}`} className="text-blue-500 hover:text-blue-600" onClick={e => e.stopPropagation()}>
                        <Phone className="w-3 h-3" />
                      </a>
                    )}
                    {dossier.email && (
                      <a href={`mailto:${dossier.email}`} className="text-blue-500 hover:text-blue-600" onClick={e => e.stopPropagation()}>
                        <Mail className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-medium ${getStatusColor(dossier.status)}`}>
                    {getStatusLabel(dossier.status)}
                  </span>
                  {dossier.is_rappel && (
                    <Bell className="w-3.5 h-3.5 text-orange-500" title={`Rappel: ${dossier.rappel_date ? formatDateTime(dossier.rappel_date) : 'Non defini'}`} />
                  )}
                </div>
                {dossier.dispute && (
                  <p className="mt-1 text-[11px] text-red-600 font-medium">Litige</p>
                )}
                {dossier.paid && !dossier.dispute && (
                  <p className="mt-1 text-[11px] text-emerald-600 font-medium">Encaisse</p>
                )}
              </td>
              <td className="px-4 py-3.5">
                {dossier.rdv_date ? (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-600">{formatDate(dossier.rdv_date)}</span>
                  </div>
                ) : (
                  <span className="text-slate-300 text-sm">--</span>
                )}
              </td>
              <td className="px-4 py-3.5">
                {dossier.show_up === true && (
                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium">Oui</span>
                )}
                {dossier.show_up === false && (
                  <span className="inline-block px-2 py-0.5 rounded bg-red-50 text-red-600 text-[11px] font-medium">Non</span>
                )}
                {dossier.show_up === null && (
                  <span className="text-slate-300 text-sm">--</span>
                )}
              </td>
              {role === 'closer' && (
                <td className="px-4 py-3.5">
                  {dossier.lead_quality !== null ? (
                    <span className={`text-sm font-semibold ${dossier.lead_quality >= 7 ? 'text-emerald-600' : dossier.lead_quality >= 5 ? 'text-amber-600' : 'text-red-500'}`}>
                      {dossier.lead_quality}/10
                    </span>
                  ) : (
                    <span className="text-slate-300 text-sm">--</span>
                  )}
                </td>
              )}
              <td className="px-4 py-3.5">
                <span className="text-xs text-slate-500">{formatDate(dossier.last_activity)}</span>
              </td>
              <td className="px-4 py-3.5 text-center">
                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEmail && dossier.email && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEmail(dossier); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title={`Envoyer un email a ${dossier.email}`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(dossier); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
