// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Inbox, Mail, MailOpen, Loader2, Search, RefreshCw,
  ChevronDown, ChevronUp, Reply, Clock, User, ArrowLeft
} from 'lucide-react';

interface ReceivedEmail {
  id: string;
  owner_id: string;
  from_email: string;
  from_name: string;
  to_email: string;
  subject: string;
  body_html: string;
  body_text: string;
  in_reply_to_email_id: string | null;
  is_read: boolean;
  received_at: string;
  original_subject?: string;
  original_to_email?: string;
}

interface EmailInboxProps {
  userId: string;
  onReply?: (email: ReceivedEmail) => void;
}

export default function EmailInbox({ userId, onReply }: EmailInboxProps) {
  const [emails, setEmails] = useState<ReceivedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    loadEmails();
  }, [userId]);

  const loadEmails = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_received_emails')
      .select('*')
      .eq('owner_id', userId)
      .order('received_at', { ascending: false })
      .limit(200);

    if (data) {
      const emailsWithContext = await enrichWithOriginals(data);
      setEmails(emailsWithContext);
    }
    setLoading(false);
  };

  const enrichWithOriginals = async (received: ReceivedEmail[]) => {
    const replyIds = received
      .filter(e => e.in_reply_to_email_id)
      .map(e => e.in_reply_to_email_id!);

    if (replyIds.length === 0) return received;

    const { data: originals } = await supabase
      .from('crm_sent_emails')
      .select('id, subject, to_email')
      .in('id', replyIds);

    if (!originals) return received;

    const originalsMap = new Map(originals.map(o => [o.id, o]));

    return received.map(e => {
      if (e.in_reply_to_email_id) {
        const orig = originalsMap.get(e.in_reply_to_email_id);
        if (orig) {
          return {
            ...e,
            original_subject: orig.subject,
            original_to_email: orig.to_email,
          };
        }
      }
      return e;
    });
  };

  const markAsRead = async (email: ReceivedEmail) => {
    if (email.is_read) return;
    await supabase
      .from('crm_received_emails')
      .update({ is_read: true })
      .eq('id', email.id);
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: true } : e));
  };

  const handleSelect = (email: ReceivedEmail) => {
    setSelectedEmail(email);
    markAsRead(email);
  };

  const filtered = emails.filter(e => {
    if (filter === 'unread' && e.is_read) return false;
    if (filter === 'read' && !e.is_read) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.from_email.toLowerCase().includes(q) ||
        e.from_name.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadCount = emails.filter(e => !e.is_read).length;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "A l'instant";
    if (diffMin < 60) return `Il y a ${diffMin}min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 7) return `Il y a ${diffD}j`;

    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      const parts = name.split(' ');
      return parts.length > 1
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (selectedEmail) {
    return (
      <EmailDetail
        email={selectedEmail}
        onBack={() => setSelectedEmail(null)}
        onReply={onReply}
        formatDate={formatDate}
        getInitials={getInitials}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total recus"
          value={emails.length}
          icon={<Inbox className="w-4 h-4" />}
          color="slate"
        />
        <StatCard
          label="Non lus"
          value={unreadCount}
          icon={<Mail className="w-4 h-4" />}
          color="blue"
        />
        <StatCard
          label="Lus"
          value={emails.length - unreadCount}
          icon={<MailOpen className="w-4 h-4" />}
          color="emerald"
        />
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
              {(['all', 'unread', 'read'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    filter === f
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {{ all: 'Tous', unread: 'Non lus', read: 'Lus' }[f]}
                  {f === 'unread' && unreadCount > 0 && (
                    <span className="ml-1 px-1 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold">
                      {unreadCount}
                    </span>
                  )}
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
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Aucun email recu</p>
            <p className="text-xs text-slate-400 mt-1">
              Les reponses des prospects apparaitront ici
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filtered.map(email => (
              <button
                key={email.id}
                onClick={() => handleSelect(email)}
                className={`w-full text-left px-5 py-3.5 transition-colors flex items-center gap-4 ${
                  !email.is_read
                    ? 'bg-blue-50/40 hover:bg-blue-50/70'
                    : 'hover:bg-slate-50/50'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  !email.is_read
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {getInitials(email.from_name, email.from_email)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!email.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                    )}
                    <span className={`text-sm truncate ${
                      !email.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                    }`}>
                      {email.from_name || email.from_email}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 truncate ${
                    !email.is_read ? 'text-slate-700 font-medium' : 'text-slate-500'
                  }`}>
                    {email.subject}
                  </p>
                  {email.body_text && (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {email.body_text.substring(0, 100)}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[11px] text-slate-400">{formatDate(email.received_at)}</span>
                  {email.in_reply_to_email_id && (
                    <span className="flex items-center gap-0.5 text-[10px] text-blue-500 font-medium">
                      <Reply className="w-2.5 h-2.5" />
                      Reponse
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmailDetail({ email, onBack, onReply, formatDate, getInitials }: {
  email: ReceivedEmail;
  onBack: () => void;
  onReply?: (email: ReceivedEmail) => void;
  formatDate: (iso: string) => string;
  getInitials: (name: string, email: string) => string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-semibold text-slate-800 truncate max-w-md">
            {email.subject}
          </h3>
        </div>
        {onReply && (
          <button
            onClick={() => onReply(email)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
          >
            <Reply className="w-3.5 h-3.5" />
            Repondre
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {getInitials(email.from_name, email.from_email)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {email.from_name || email.from_email}
                </p>
                <p className="text-xs text-slate-500">{email.from_email}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                {formatDate(email.received_at)}
              </div>
            </div>

            {email.in_reply_to_email_id && email.original_subject && (
              <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                <Reply className="w-3 h-3 text-blue-500 flex-shrink-0" />
                <p className="text-[11px] text-blue-600">
                  En reponse a: <span className="font-medium">{email.original_subject}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          {email.body_html ? (
            <div
              className="prose prose-sm max-w-none text-sm text-slate-700 [&_a]:text-blue-600 [&_img]:max-w-full [&_img]:rounded"
              dangerouslySetInnerHTML={{ __html: email.body_html }}
            />
          ) : (
            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
              {email.body_text}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
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
