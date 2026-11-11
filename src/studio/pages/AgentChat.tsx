import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUp, ArrowRight, Copy, Check, Pin, PinOff, Plus, Square, ThumbsDown, ThumbsUp, Trash2, ChevronLeft, FileText, Zap, MessageCircle } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { appel, discuter, extraireRelais, type Conversation, type Media, type Message, type SuperPouvoir } from '../api';
import MediaVue from '../MediaVue';
import { Avatar, Markdown, cx } from '../composants';

export default function AgentChat() {
  const { me, gerer, rafraichir } = useStudio();
  const { agentId } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const agent = me.agents.find((a) => a.id === agentId);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convId, setConvId] = useState<string | null>(params.get('c'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [ressources, setRessources] = useState<string[]>([]);
  const [copie, setCopie] = useState<string | null>(null);
  const stop = useRef<AbortController | null>(null);
  const bas = useRef<HTMLDivElement>(null);
  const initial = useRef(false);
  const envoi = useRef(false);
  // Super-pouvoir ouvert (?p=…) : formulaire cadré à la place de la saisie libre.
  const pouvoir = agent?.super_pouvoirs?.find((p) => p.id === params.get('p')) ?? null;

  const chargerListe = useCallback(async () => {
    try { setConversations((await appel<{ conversations: Conversation[] }>('conversations', { agent_id: agentId })).conversations); }
    catch (e) { gerer(e); }
  }, [agentId, gerer]);

  useEffect(() => { chargerListe(); }, [chargerListe]);

  // Ouverture d'une conversation existante (?c=…).
  useEffect(() => {
    const c = params.get('c');
    // Une réponse en cours d'arrivée ne doit pas être effacée (mission transmise
    // au montage, double effet du StrictMode, navigation pendant le flux).
    if (!c) { if (!envoi.current) { setConvId(null); setRessources([]); setMessages([]); } return; }
    setConvId(c);
    setRessources([]);
    appel<{ messages: Message[] }>('messages', { conversation_id: c })
      .then((r) => setMessages(r.messages)).catch((e) => setErreur(gerer(e)));
  }, [params, gerer]);

  useEffect(() => { bas.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const envoyer = useCallback(async (texte: string, sp?: { pouvoir: SuperPouvoir; valeurs: Record<string, string> }) => {
    if (!agent || (!texte.trim() && !sp) || enCours) return;
    setErreur(''); setSaisie(''); setEnCours(true);
    envoi.current = true;
    // Même rendu que l'historique serveur pour un super-pouvoir.
    const affiche = sp
      ? `**${sp.pouvoir.titre}**\n` + sp.pouvoir.champs.filter((c) => sp.valeurs[c.nom]?.trim())
        .map((c) => `- ${c.label} : ${sp.valeurs[c.nom].length > 300 ? sp.valeurs[c.nom].slice(0, 300) + '…' : sp.valeurs[c.nom]}`).join('\n')
      : texte;
    setMessages((m) => [...m, { role: 'user', content: affiche }, { role: 'assistant', content: '' }]);
    const ctrl = new AbortController();
    stop.current = ctrl;
    try {
      // Super-pouvoir média : réponse JSON immédiate, le média se suit ensuite (MediaVue).
      if (sp?.pouvoir.media) {
        const r = await appel<{ conversation_id: string; message_id: string | null; content: string; media: Media }>('chat', {
          agent_id: agent.id, conversation_id: convId, pouvoir: { id: sp.pouvoir.id, valeurs: sp.valeurs },
        });
        setMessages((m) => [...m.slice(0, -1), { role: 'assistant', id: r.message_id ?? undefined, content: r.content, media: r.media }]);
        setParams({ c: r.conversation_id }, { replace: true });
        chargerListe();
        rafraichir();
        return;
      }
      const fin = await discuter(
        sp
          ? { agent_id: agent.id, conversation_id: convId, pouvoir: { id: sp.pouvoir.id, valeurs: sp.valeurs } }
          : { agent_id: agent.id, message: texte, conversation_id: convId },
        {
          onMeta: (m) => setRessources(m.ressources ?? []),
          onDelta: (t) => setMessages((m) => {
            const der = m[m.length - 1];
            if (der?.role !== 'assistant') return [...m, { role: 'assistant', content: t }];
            return [...m.slice(0, -1), { ...der, content: der.content + t }];
          }),
        },
        ctrl.signal,
      );
      setMessages((m) => (m.length ? [...m.slice(0, -1), { ...m[m.length - 1], id: fin.message_id ?? undefined }] : m));
      if (sp) {
        // Le formulaire a servi : on quitte ?p= pour le fil de la conversation.
        setParams({ c: fin.conversation_id }, { replace: true });
      } else if (fin.conversation_id !== convId) {
        setConvId(fin.conversation_id);
        // Mise à jour de l'URL sans recharger les messages déjà affichés.
        window.history.replaceState(null, '', `/studio/assistants/${agent.id}?c=${fin.conversation_id}`);
      }
      chargerListe();
      rafraichir();
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setErreur(gerer(e));
      setMessages((m) => (m[m.length - 1]?.content ? m : m.slice(0, -1)));
    } finally { setEnCours(false); stop.current = null; envoi.current = false; }
  }, [agent, convId, enCours, chargerListe, rafraichir, gerer, setParams]);

  // Mission transmise depuis l'accueil ou une suggestion.
  useEffect(() => {
    const msg = (location.state as { message?: string } | null)?.message;
    if (msg && !initial.current && !params.get('c')) {
      initial.current = true;
      navigate(location.pathname, { replace: true, state: null });
      envoyer(msg);
    }
  }, [location, params, navigate, envoyer]);

  if (!agent) return <Navigate to="/studio/assistants" replace />;

  const soumettre = (e: FormEvent) => { e.preventDefault(); envoyer(saisie); };
  const nouvelle = () => { setParams({}); setMessages([]); setConvId(null); };

  const majMessage = async (i: number, action: 'retour' | 'epingler', valeur: number | boolean) => {
    const m = messages[i];
    if (!m.id) return;
    const patch = action === 'retour' ? { retour: valeur as number } : { epingle: valeur as boolean };
    setMessages((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    try {
      await appel(action, action === 'retour' ? { message_id: m.id, valeur } : { message_id: m.id, epingle: valeur });
      if (action === 'retour') rafraichir();
    } catch (e) { setErreur(gerer(e)); }
  };

  const supprimer = async (id: string) => {
    if (!confirm('Supprimer cette conversation ?')) return;
    try { await appel('conversation_delete', { conversation_id: id }); } catch (e) { setErreur(gerer(e)); }
    if (id === convId) nouvelle();
    chargerListe();
  };

  const copier = async (texte: string, cle: string) => {
    try { await navigator.clipboard.writeText(texte); setCopie(cle); setTimeout(() => setCopie(null), 1500); } catch { /* refusé */ }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <Link to="/studio/assistants" className="mb-4 flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ChevronLeft className="h-4 w-4" /> Assistants
        </Link>
        <p className="mb-1 px-2 text-xs text-neutral-400">Super-pouvoirs de {agent.prenom}</p>
        <div className="mb-4 space-y-0.5">
          {agent.super_pouvoirs.map((p) => (
            <Link key={p.id} to={`?p=${p.id}`}
              className={cx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm', pouvoir?.id === p.id && messages.length === 0 ? 'bg-orange-50 font-medium text-orange-800' : 'hover:bg-neutral-100')}>
              <Zap className="h-3.5 w-3.5 shrink-0 text-orange-500" /> <span className="truncate">{p.titre}</span>
            </Link>
          ))}
          <button onClick={nouvelle} className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm', !pouvoir && !convId ? 'bg-neutral-200/70 font-medium' : 'hover:bg-neutral-100')}>
            <MessageCircle className="h-3.5 w-3.5 shrink-0" /> Demande libre
          </button>
        </div>
        <p className="mb-1 px-2 text-xs text-neutral-400">Historique</p>
        <div className="space-y-0.5">
          {conversations.map((c) => (
            <div key={c.id} className={cx('group flex items-center rounded-lg', c.id === convId ? 'bg-neutral-200/70' : 'hover:bg-neutral-100')}>
              <Link to={`?c=${c.id}`} className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm">{c.titre}</Link>
              <button onClick={() => supprimer(c.id)} aria-label="Supprimer" className="hidden p-1.5 text-neutral-400 hover:text-red-600 group-hover:block">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[calc(100vh-8rem)] flex-col">
        <header className="mb-4 flex items-center gap-3 border-b border-neutral-200 pb-4">
          <Avatar prenom={agent.prenom} couleur={agent.couleur} photo={agent.photo} taille={44} />
          <div className="min-w-0">
            <p className="font-semibold">{agent.prenom}</p>
            <p className="text-sm text-neutral-500">{agent.metier}</p>
          </div>
          <button onClick={nouvelle} className="ml-auto rounded-xl border border-neutral-200 bg-white p-2 lg:hidden" aria-label="Nouvelle mission"><Plus className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-5">
          {pouvoir && messages.length === 0 && (
            <FormulairePouvoir key={pouvoir.id} pouvoir={pouvoir} enCours={enCours} onSubmit={(valeurs) => envoyer('', { pouvoir, valeurs })} />
          )}
          {!pouvoir && messages.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-lg font-medium">{agent.accroche}</p>
              <p className="mt-1 text-sm text-neutral-500">Choisissez une mission cadrée, ou décrivez votre besoin ci-dessous.</p>
              <div className="mx-auto mt-4 grid max-w-2xl gap-2 sm:grid-cols-3">
                {agent.super_pouvoirs.map((p) => (
                  <Link key={p.id} to={`?p=${p.id}`}
                    className="rounded-2xl border border-neutral-200 bg-white p-3 text-left text-sm hover:border-neutral-900">
                    <p className="flex items-center gap-1.5 font-medium"><Zap className="h-3.5 w-3.5 text-orange-500" />{p.titre}</p>
                    <p className="mt-1 line-clamp-3 text-xs text-neutral-500">{p.description}</p>
                  </Link>
                ))}
              </div>
              <p className="mx-auto mt-4 max-w-xl text-xs text-neutral-400">
                {agent.prenom} ne traite que son métier ({agent.metier.toLowerCase()}). Une demande hors de son domaine sera confiée au bon collègue.
              </p>
            </div>
          )}

          {messages.map((m, i) => m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-sm text-white">
                {m.content.startsWith('**') ? m.content.replace(/\*\*/g, '') : m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <Avatar prenom={agent.prenom} couleur={agent.couleur} photo={agent.photo} taille={30} />
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl rounded-tl-md border border-neutral-200 bg-white px-4 py-3">
                  {m.media && <div className="mb-2"><MediaVue media={m.media} /></div>}
                  {m.content ? <Markdown texte={extraireRelais(m.content).texte} /> : (
                    <span className="flex gap-1 py-1" aria-label={`${agent.prenom} rédige`}>
                      {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: `${d * 120}ms` }} />)}
                    </span>
                  )}
                </div>
                <Relais contenu={m.content} termine={Boolean(m.id)} demande={messages[i - 1]?.content} agentId={agent.id} />
                {i === messages.length - 1 && ressources.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-neutral-400">
                    <FileText className="h-3 w-3" /> S'appuie sur : {ressources.join(' · ')}
                  </p>
                )}
                {m.id && (
                  <div className="mt-1 flex items-center gap-0.5 text-neutral-400">
                    <button onClick={() => copier(m.content, String(i))} className="rounded-lg p-1.5 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Copier">
                      {copie === String(i) ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => majMessage(i, 'retour', m.retour === 1 ? 0 : 1)} aria-label="Utile"
                      className={cx('rounded-lg p-1.5 hover:bg-neutral-100', m.retour === 1 && 'text-emerald-600')}><ThumbsUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => majMessage(i, 'retour', m.retour === -1 ? 0 : -1)} aria-label="À revoir"
                      className={cx('rounded-lg p-1.5 hover:bg-neutral-100', m.retour === -1 && 'text-red-600')}><ThumbsDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => majMessage(i, 'epingler', !m.epingle)} aria-label={m.epingle ? 'Retirer de Mes créations' : 'Garder dans Mes créations'}
                      className={cx('flex items-center gap-1 rounded-lg p-1.5 text-xs hover:bg-neutral-100', m.epingle && 'text-orange-600')}>
                      {m.epingle ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} {m.epingle ? 'Gardé' : 'Garder'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
          <div ref={bas} />
        </div>

        <form onSubmit={soumettre} className="sticky bottom-4 mt-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
          <div className="flex items-end gap-2">
            <textarea
              value={saisie} onChange={(e) => setSaisie(e.target.value)} rows={2}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(saisie); } }}
              placeholder={`Confiez une mission à ${agent.prenom}…`}
              className="max-h-48 flex-1 resize-y bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-neutral-400"
            />
            {enCours ? (
              <button type="button" onClick={() => stop.current?.abort()} aria-label="Arrêter"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white"><Square className="h-3.5 w-3.5" /></button>
            ) : (
              <button type="submit" disabled={!saisie.trim()} aria-label="Envoyer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white disabled:bg-neutral-300"><ArrowUp className="h-4 w-4" /></button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * Demande hors périmètre : l'agent a refusé et désigné un collègue ([[RELAIS:id]]).
 * Le bouton transmet la demande d'origine au collègue, qui l'exécute aussitôt.
 */
function Relais({ contenu, termine, demande, agentId }: { contenu: string; termine: boolean; demande?: string; agentId: string }) {
  const { me } = useStudio();
  const { relais } = extraireRelais(contenu);
  const collegue = relais && relais !== agentId ? me.agents.find((a) => a.id === relais) : null;
  if (!collegue || !termine) return null;
  return (
    <Link to={`/studio/assistants/${collegue.id}`} state={{ message: demande?.replace(/\*\*/g, '') }}
      className="mt-2 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm hover:border-neutral-900">
      <Avatar prenom={collegue.prenom} couleur={collegue.couleur} photo={collegue.photo} taille={22} />
      Confier à {collegue.prenom} <span className="text-neutral-400">· {collegue.metier}</span> <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

/** Formulaire d'un super-pouvoir : la mission est cadrée par des champs, la consigne détaillée reste côté serveur. */
function FormulairePouvoir({ pouvoir, enCours, onSubmit }: {
  pouvoir: SuperPouvoir; enCours: boolean; onSubmit: (valeurs: Record<string, string>) => void;
}) {
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(pouvoir.champs.map((c) => [c.nom, c.type === 'choix' && c.requis ? c.options?.[0] ?? '' : ''])));
  const incomplet = pouvoir.champs.some((c) => c.requis && !v[c.nom]?.trim());
  const champ = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:bg-white';
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!incomplet) onSubmit(v); }}
      className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
      <div>
        <p className="flex items-center gap-2 text-lg font-semibold"><Zap className="h-4 w-4 text-orange-500" />{pouvoir.titre}</p>
        {pouvoir.description && <p className="mt-1 text-sm text-neutral-500">{pouvoir.description}</p>}
      </div>
      {pouvoir.champs.map((c, i) => (
        <div key={c.nom}>
          <p className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[11px] text-white">{i + 1}</span>
            {c.label}{c.requis && <span className="text-orange-600">*</span>}
          </p>
          {c.type === 'long' ? (
            <textarea rows={4} className={champ} value={v[c.nom]} placeholder={c.aide} onChange={(e) => setV({ ...v, [c.nom]: e.target.value })} />
          ) : c.type === 'choix' ? (
            <div className="flex flex-wrap gap-2">
              {(c.options ?? []).map((o) => (
                <button key={o} type="button" onClick={() => setV({ ...v, [c.nom]: v[c.nom] === o && !c.requis ? '' : o })}
                  className={cx('rounded-xl border px-3 py-2 text-sm', v[c.nom] === o ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 hover:bg-neutral-50')}>
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <input className={champ} value={v[c.nom]} placeholder={c.aide} onChange={(e) => setV({ ...v, [c.nom]: e.target.value })} />
          )}
        </div>
      ))}
      <button type="submit" disabled={incomplet || enCours}
        className="w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:bg-neutral-300">
        {enCours ? 'En cours…' : 'Lancer la mission'}
      </button>
    </form>
  );
}
