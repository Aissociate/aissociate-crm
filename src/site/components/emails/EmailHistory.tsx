// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Mail, Eye, MousePointer, CheckCircle, XCircle, Clock,
  Loader2, ChevronDown, ChevronUp, Search, AlertTriangle,
  Send, RefreshCw
} from 'lucide-react';

interface SentEmail {
  id: string;
  from_email: string;
  from_name: string;
  to_email: string;
  to_name: string;
  subject: string;
  body_html: string;
  status: string;
  open_count: number;
  opened_at: string | null;
  click_count: number;
  clicked_at: string | null;
  error_message: string;
  created_at: string;
}

interface EmailHistoryProps {
  userId: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string; bg: string }> = {
  sent: { label: 'Envoye', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  delivered: { label: 'Delivre', icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  queued: { label: 'En attente', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  failed: { label: 'Echoue', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  bounced: { label: 'Rejete', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
};

export default function EmailHistory({ userId }: EmailHistoryProps) {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_sent_emails')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setEmails(data);
    setLoading(false);
  };

  const filtered = emails.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.to_email.toLowerCase().includes(q) ||
        e.to_name.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total: emails.length,
    sent: emails.filter(e => e.status === 'sent' || e.status === 'delivered').length,
    opened: emails.filter(e => e.open_count > 0).length,
    clicked: emails.filter(e => e.click_count > 0).length,
    failed: emails.filter(e => e.status === 'failed' || e.status === 'bounced').length,
  };

  const openRate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;
  const clickRate = stats.opened > 0 ? Math.round((stats.clicked / stats.opened) * 100) : 0;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Envoyes" value={stats.total} icon={<Send className="w-4 h-4" />} color="slate" />
        <StatCard label="Delivres" value={stats.sent} icon={<CheckCircle className="w-4 h-4" />} color="emerald" />
        <StatCard label="Ouverts" value={`${stats.opened} (${openRate}%)`} icon={<Eye className="w-4 h-4" />} color="blue" />
        <StatCard label="Cliques" value={`${stats.clicked} (${clickRate}%)`} icon={<MousePointer className="w-4 h-4" />} color="cyan" />
        <StatCard label="Echoues" value={stats.failed} icon={<XCircle className="w-4 h-4" />} color="red" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 w-52 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-1">
              {['all', 'sent', 'queued', 'failed'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    statusFilter === s
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {{ all: 'Tous', sent: 'Envoyes', queued: 'En attente', failed: 'Echoues' }[s]}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={loadEmails}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Aucun email envoye</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filtered.map(email => {
              const statusCfg = STATUS_CONFIG[email.status] || STATUS_CONFIG.queued;
              const StatusIcon = statusCfg.icon;
              const isExpanded = expandedId === email.id;

              return (
                <div key={email.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : email.id)}
                    className="w-full text-left px-5 py-3 hover:bg-slate-50/50 transition-colors flex items-center gap-4"
                  >
                    <div className={`w-7 h-7 rounded-full ${statusCfg.bg} flex items-center justify-center flex-shrink-0`}>
                      <StatusIcon className={`w-3.5 h-3.5 ${statusCfg.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{email.subject}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {email.to_name ? `${email.to_name} <${email.to_email}>` : email.to_email}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {email.open_count > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-600">
                          <Eye className="w-3 h-3" /> {email.open_count}
                        </span>
                      )}
                      {email.click_count > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-cyan-600">
                          <MousePointer className="w-3 h-3" /> {email.click_count}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 w-24 text-right">{formatDate(email.created_at)}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400">De:</span>
                            <p className="text-slate-700 font-medium">{email.from_name} &lt;{email.from_email}&gt;</p>
                          </div>
                          <div>
                            <span className="text-slate-400">A:</span>
                            <p className="text-slate-700 font-medium">{email.to_name || email.to_email}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Statut:</span>
                            <p className={`font-medium ${statusCfg.color}`}>{statusCfg.label}</p>
                          </div>
                        </div>

                        {email.open_count > 0 && (
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-slate-400">Premiere ouverture:</span>
                            <span className="text-slate-700">{email.opened_at ? formatDate(email.opened_at) : '-'}</span>
                            <span className="text-slate-400">Total ouvertures:</span>
                            <span className="text-blue-600 font-semibold">{email.open_count}</span>
                          </div>
                        )}

                        {email.click_count > 0 && (
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-slate-400">Premier clic:</span>
                            <span className="text-slate-700">{email.clicked_at ? formatDate(email.clicked_at) : '-'}</span>
                            <span className="text-slate-400">Total clics:</span>
                            <span className="text-cyan-600 font-semibold">{email.click_count}</span>
                          </div>
                        )}

                        {email.error_message && (
                          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">
                            <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            {email.error_message}
                          </div>
                        )}

                        <div className="border-t border-slate-200 pt-3">
                          <p className="text-[11px] text-slate-400 mb-2">Apercu du contenu:</p>
                          <div
                            className="bg-white rounded-md border border-slate-200 p-3 text-xs text-slate-700 max-h-40 overflow-y-auto prose prose-sm"
                            dangerouslySetInnerHTML={{ __html: email.body_html }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
      <div className={`w-8 h-8 rounded-full ${colorMap[color]} flex items-center justify-center mx-auto mb-1.5`}>
        {icon}
      </div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
