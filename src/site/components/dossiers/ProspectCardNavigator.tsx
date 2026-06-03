// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Phone,
  MapPin,
  Briefcase,
  MessageSquare,
  Loader2,
  Inbox,
  CheckCircle2,
  Clock,
  Mail
} from 'lucide-react';

interface CompanyProspect {
  id: string;
  raison_social: string;
  activite: string;
  adresse: string;
  city: string;
  postal_code: string;
  description: string;
  commentaires: string;
  dispatch_status: string;
  contacts: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    commentaires: string;
    phones: { id: string; phone_number: string; label: string }[];
  }[];
}

interface ProspectCardNavigatorProps {
  fixerId: string;
}

export default function ProspectCardNavigator({ fixerId }: ProspectCardNavigatorProps) {
  const [prospects, setProspects] = useState<CompanyProspect[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadProspects = useCallback(async () => {
    setLoading(true);
    try {
      const { data: companies, error: compError } = await supabase
        .from('crm_companies')
        .select('id, raison_social, activite, adresse, city, postal_code, description, commentaires, dispatch_status')
        .eq('assigned_to', fixerId)
        .in('dispatch_status', ['assigned', 'in_progress'])
        .order('assigned_at', { ascending: true });

      if (compError) throw compError;
      if (!companies || companies.length === 0) {
        setProspects([]);
        setLoading(false);
        return;
      }

      const companyIds = companies.map(c => c.id);

      const { data: contacts, error: ctError } = await supabase
        .from('crm_contacts')
        .select('id, company_id, nom, prenom, email, commentaires')
        .in('company_id', companyIds);

      if (ctError) throw ctError;

      let phonesMap: Record<string, { id: string; phone_number: string; label: string }[]> = {};
      if (contacts && contacts.length > 0) {
        const contactIds = contacts.map(c => c.id);
        const { data: phones, error: phError } = await supabase
          .from('crm_phones')
          .select('id, contact_id, phone_number, label')
          .in('contact_id', contactIds);

        if (phError) throw phError;
        if (phones) {
          phonesMap = phones.reduce((acc, p) => {
            if (!acc[p.contact_id]) acc[p.contact_id] = [];
            acc[p.contact_id].push(p);
            return acc;
          }, {} as Record<string, typeof phones>);
        }
      }

      const enriched: CompanyProspect[] = companies.map(c => ({
        ...c,
        contacts: (contacts || [])
          .filter(ct => ct.company_id === c.id)
          .map(ct => ({
            ...ct,
            phones: phonesMap[ct.id] || [],
          })),
      }));

      setProspects(enriched);
      if (currentIndex >= enriched.length) {
        setCurrentIndex(Math.max(0, enriched.length - 1));
      }
    } catch (err) {
      console.error('Error loading prospects:', err);
    } finally {
      setLoading(false);
    }
  }, [fixerId, currentIndex]);

  useEffect(() => {
    loadProspects();
  }, [fixerId]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prospects.length - 1));
  }, [prospects.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev < prospects.length - 1 ? prev + 1 : 0));
  }, [prospects.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext]);

  const markStatus = async (status: 'in_progress' | 'completed') => {
    const prospect = prospects[currentIndex];
    if (!prospect) return;

    await supabase
      .from('crm_companies')
      .update({ dispatch_status: status })
      .eq('id', prospect.id);

    if (status === 'completed') {
      const updated = prospects.filter((_, i) => i !== currentIndex);
      setProspects(updated);
      if (currentIndex >= updated.length) setCurrentIndex(Math.max(0, updated.length - 1));
    } else {
      setProspects(prev => prev.map((p, i) =>
        i === currentIndex ? { ...p, dispatch_status: status } : p
      ));
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500">Chargement des prospects...</p>
      </div>
    );
  }

  if (prospects.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Inbox className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">Aucun prospect assigne</p>
        <p className="text-xs text-slate-500">Vos prospects apparaitront ici une fois assignes par l'admin.</p>
      </div>
    );
  }

  const prospect = prospects[currentIndex];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <div className="h-12 px-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span className="text-[11px] font-semibold text-slate-800 uppercase tracking-wide">Prospects</span>
          <span className="text-[11px] text-slate-400 font-medium ml-1">
            {currentIndex + 1} / {prospects.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
          </button>

          <div className="flex gap-1 px-1">
            {prospects.length <= 12 && prospects.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === currentIndex ? 'bg-blue-600 w-4' : 'bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
            {prospects.length > 12 && (
              <span className="text-[10px] text-slate-400 font-medium px-1">{currentIndex + 1}/{prospects.length}</span>
            )}
          </div>

          <button
            onClick={goToNext}
            className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{prospect.raison_social}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {prospect.activite && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Briefcase className="w-3 h-3 text-slate-400" />
                  {prospect.activite}
                </span>
              )}
              {(prospect.city || prospect.postal_code) && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {prospect.adresse && `${prospect.adresse}, `}{prospect.city} {prospect.postal_code}
                </span>
              )}
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
            prospect.dispatch_status === 'in_progress'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {prospect.dispatch_status === 'in_progress' ? 'En cours' : 'Nouveau'}
          </span>
        </div>

        {prospect.description && (
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 rounded-lg p-3 border border-slate-100 mb-3">
            {prospect.description}
          </p>
        )}

        {prospect.commentaires && (
          <div className="flex items-start gap-2 text-xs bg-amber-50/60 rounded-lg p-3 border border-amber-100 mb-4">
            <MessageSquare className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 leading-relaxed">{prospect.commentaires}</p>
          </div>
        )}

        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Contacts ({prospect.contacts.length})
          </p>

          {prospect.contacts.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Aucun contact</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {prospect.contacts.map(contact => (
                <div
                  key={contact.id}
                  className="border border-slate-200/80 rounded-lg p-3.5 hover:border-blue-200 transition-colors bg-slate-50/30"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {contact.prenom} {contact.nom}
                      </p>
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <Mail className="w-2.5 h-2.5" />
                          {contact.email}
                        </a>
                      )}
                    </div>
                  </div>

                  {contact.phones.length > 0 && (
                    <div className="space-y-1 ml-[42px]">
                      {contact.phones.map(phone => (
                        <a
                          key={phone.id}
                          href={`tel:${phone.phone_number}`}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          onClick={e => e.stopPropagation()}
                        >
                          <Phone className="w-3 h-3" />
                          {phone.phone_number}
                          <span className="text-[10px] text-slate-400 font-normal">({phone.label})</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {contact.commentaires && (
                    <p className="mt-2 ml-[42px] text-[11px] text-slate-500 leading-relaxed">{contact.commentaires}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex gap-2">
            {prospect.dispatch_status !== 'in_progress' && (
              <button
                onClick={() => markStatus('in_progress')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors border border-blue-100"
              >
                <Clock className="w-3.5 h-3.5" />
                Marquer en cours
              </button>
            )}
            <button
              onClick={() => markStatus('completed')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors border border-emerald-100"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Marquer termine
            </button>
          </div>

          <span className="text-[10px] text-slate-400">
            Fleches du clavier pour naviguer
          </span>
        </div>
      </div>
    </div>
  );
}
