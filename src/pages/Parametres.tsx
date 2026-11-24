import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Spinner } from '@/components/ui';
import type { SignatureCfg } from '@/lib/signature';
import { DEFAULT_TEMPLATES, type MessageTemplate } from '@/lib/messageTemplates';
import { JetonsMcpCard } from '@/components/JetonsMcpCard';
import type {
  AgeficeCfg, Ai, Blog, BrevoCfg, Chatbot, Imap, LinkedinCfg, MailActionsCfg, MetaAds, NewsletterCfg,
  Organisme, Smtp,
} from './parametres/types';
import { CarteStatut, CarteLinkedin, CarteMeta } from './parametres/CartesIntegrations';
import { CarteOrganisme } from './parametres/CarteOrganisme';
import { CarteSmtp, CarteImap, CarteSignature, UserSignaturesCard } from './parametres/CartesMessagerie';
import { CarteModeles } from './parametres/CarteModeles';
import { CarteIA, CarteActionsMail, CarteChatbot } from './parametres/CartesIA';
import { CarteAgefice } from './parametres/CarteAgefice';
import { CarteBlog } from './parametres/CarteBlog';
import { CarteBrevo, CarteNewsletter } from './parametres/CartesNewsletter';

/**
 * Paramètres — réservés à la direction. Cette page charge tous les blocs de la table `parametres`
 * en une requête, tient leur état et les enregistre ; chaque bloc est affiché par une carte de
 * `parametres/` (les cartes ne sont montées qu'une fois le chargement terminé).
 */
export default function Parametres() {
  const [organisme, setOrganisme] = useState<Organisme>({});
  const [smtp, setSmtp] = useState<Smtp>({});
  const [imap, setImap] = useState<Imap>({});
  const [ai, setAi] = useState<Ai>({ model: 'anthropic/claude-opus-4.8' });
  // Actions créées automatiquement à la réception d'un mail (ticket Benjamin).
  const [mailActions, setMailActions] = useState<MailActionsCfg>({ enabled: true, resume_ia: true, max_par_passage: 10 });
  // Informations reprises dans les documents AGEFICE générés depuis un plan.
  const [agefice, setAgefice] = useState<AgeficeCfg>({});
  const [chatbot, setChatbot] = useState<Chatbot>({});
  const [blog, setBlog] = useState<Blog>({});
  const [linkedin, setLinkedin] = useState<LinkedinCfg>({ enabled: true, client_id: '77aw0sfxqvjnwo' });
  const [metaAds, setMetaAds] = useState<MetaAds>({ api_version: 'v21.0' });
  const [newsletter, setNewsletter] = useState<NewsletterCfg>({ rgpd_only: true, sender_name: 'Aissociate' });
  const [brevo, setBrevo] = useState<BrevoCfg>({ sender_name: 'Aissociate' });
  const [signature, setSignature] = useState<SignatureCfg>({ mode: 'auto', include_sender: true });
  const [templates, setTemplates] = useState<MessageTemplate[]>(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('parametres').select('*').in('cle', ['organisme', 'smtp', 'imap', 'ai', 'mail_actions', 'agefice', 'chatbot', 'blog', 'linkedin', 'meta_ads', 'newsletter', 'email_signature', 'brevo', 'message_templates']);
      for (const row of data ?? []) {
        if (row.cle === 'organisme') setOrganisme((row.valeur as Organisme) ?? {});
        if (row.cle === 'smtp') setSmtp((row.valeur as Smtp) ?? {});
        if (row.cle === 'imap') setImap({ port: 993, ...((row.valeur as Imap) ?? {}) });
        if (row.cle === 'ai') setAi((row.valeur as Ai) ?? {});
        if (row.cle === 'mail_actions') setMailActions({ enabled: true, resume_ia: true, max_par_passage: 10, ...((row.valeur as MailActionsCfg) ?? {}) });
        if (row.cle === 'agefice') setAgefice((row.valeur as AgeficeCfg) ?? {});
        if (row.cle === 'chatbot') setChatbot((row.valeur as Chatbot) ?? {});
        if (row.cle === 'blog') setBlog((row.valeur as Blog) ?? {});
        if (row.cle === 'linkedin') setLinkedin({ enabled: true, client_id: '77aw0sfxqvjnwo', ...((row.valeur as LinkedinCfg) ?? {}) });
        if (row.cle === 'meta_ads') setMetaAds({ api_version: 'v21.0', ...((row.valeur as MetaAds) ?? {}) });
        if (row.cle === 'newsletter') setNewsletter({ rgpd_only: true, sender_name: 'Aissociate', ...((row.valeur as NewsletterCfg) ?? {}) });
        if (row.cle === 'brevo') setBrevo({ sender_name: 'Aissociate', ...((row.valeur as BrevoCfg) ?? {}) });
        if (row.cle === 'email_signature') setSignature({ mode: 'auto', include_sender: true, ...((row.valeur as SignatureCfg) ?? {}) });
        if (row.cle === 'message_templates') { const items = ((row.valeur as { items?: MessageTemplate[] }) ?? {}).items ?? []; if (items.length) setTemplates(items); }
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (cle: string, valeur: Record<string, unknown>) => {
    setSaving(cle);
    const { error } = await supabase.from('parametres').upsert({ cle, valeur }, { onConflict: 'cle' });
    setSaving(null);
    if (error) { alert(error.message); return; }
    setSavedMsg(cle);
    setTimeout(() => setSavedMsg(null), 2000);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  const smtpOk = !!(smtp.host && smtp.user && smtp.password && smtp.from);
  const imapOk = !!(imap.host && imap.user && imap.password);
  const aiOk = !!ai.openrouter_key;
  const linkedinOk = !!(linkedin.access_token && linkedin.org_urn);
  const metaOk = !!(metaAds.access_token && metaAds.ad_account_id);
  const s = { persist, saving, savedMsg };

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Organisme, messagerie et secrets d'intégration" />

      <CarteStatut smtpOk={smtpOk} imapOk={imapOk} aiOk={aiOk} linkedinOk={linkedinOk} metaOk={metaOk} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CarteLinkedin linkedin={linkedin} setLinkedin={setLinkedin} {...s} />
        <CarteMeta metaAds={metaAds} setMetaAds={setMetaAds} {...s} />
        <CarteOrganisme organisme={organisme} setOrganisme={setOrganisme} {...s} />
        <CarteSmtp smtp={smtp} setSmtp={setSmtp} {...s} />
        <CarteSignature signature={signature} setSignature={setSignature} organisme={organisme} {...s} />
        {/* Signatures propres à chaque utilisateur */}
        <UserSignaturesCard />
        {/* Jetons du serveur MCP distant (agents externes) */}
        <JetonsMcpCard />
        <CarteModeles templates={templates} setTemplates={setTemplates} {...s} />
        <CarteImap imap={imap} setImap={setImap} {...s} />
        <CarteIA ai={ai} setAi={setAi} {...s} />
        <CarteAgefice agefice={agefice} setAgefice={setAgefice} {...s} />
        <CarteActionsMail mailActions={mailActions} setMailActions={setMailActions} ai={ai} setAi={setAi} {...s} />
        <CarteChatbot chatbot={chatbot} setChatbot={setChatbot} {...s} />
        <CarteBlog blog={blog} setBlog={setBlog} {...s} />
        <CarteBrevo brevo={brevo} setBrevo={setBrevo} {...s} />
        <CarteNewsletter newsletter={newsletter} setNewsletter={setNewsletter} {...s} />
      </div>
    </div>
  );
}
