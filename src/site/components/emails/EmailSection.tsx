// @ts-nocheck
import { useState, useEffect } from 'react';
import { PenSquare, History, FileText, Inbox } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EmailComposer from './EmailComposer';
import EmailTemplatesManager from './EmailTemplatesManager';
import EmailHistory from './EmailHistory';
import EmailInbox from './EmailInbox';

type SubTab = 'inbox' | 'compose' | 'history' | 'templates';

interface EmailSectionProps {
  userId: string;
  userRole: string;
}

export default function EmailSection({ userId, userRole }: EmailSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('inbox');
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyTarget, setReplyTarget] = useState<{ email: string; name: string; subject: string } | null>(null);

  useEffect(() => {
    loadUnreadCount();
  }, [userId]);

  const loadUnreadCount = async () => {
    const { count } = await supabase
      .from('crm_received_emails')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  };

  const handleReply = (email: { from_email: string; from_name: string; subject: string }) => {
    setReplyTarget({
      email: email.from_email,
      name: email.from_name,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
    });
    setActiveSubTab('compose');
  };

  const subTabs: { key: SubTab; label: string; icon: typeof PenSquare; badge?: number }[] = [
    { key: 'inbox', label: 'Boite de reception', icon: Inbox, badge: unreadCount },
    { key: 'compose', label: 'Composer', icon: PenSquare },
    { key: 'history', label: 'Historique', icon: History },
    { key: 'templates', label: 'Modeles', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveSubTab(tab.key);
                if (tab.key !== 'compose') setReplyTarget(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md transition-all ${
                activeSubTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.badge && tab.badge > 0 ? (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeSubTab === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-600 text-white'
                }`}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeSubTab === 'inbox' && (
        <EmailInbox
          userId={userId}
          onReply={handleReply}
        />
      )}

      {activeSubTab === 'compose' && (
        <EmailComposer
          userId={userId}
          userRole={userRole}
          prefillTo={replyTarget?.email}
          prefillName={replyTarget?.name}
          onSent={() => {
            setReplyTarget(null);
            setActiveSubTab('history');
          }}
        />
      )}

      {activeSubTab === 'history' && (
        <EmailHistory userId={userId} />
      )}

      {activeSubTab === 'templates' && (
        <EmailTemplatesManager userId={userId} userRole={userRole} />
      )}
    </div>
  );
}
