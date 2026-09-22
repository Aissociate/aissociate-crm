import { useState, type FormEvent } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO, { SITE_URL } from '../components/SEO';
import { supabase } from '@/lib/supabase';
import './agents-ia.css';

/**
 * Page « Agents IA » : les employés virtuels d'Aissociate (reprise de la
 * landing v7 « conversion », + section canaux de la v8). Le formulaire de rappel garde le design de la
 * maquette ; il n'envoie plus vers Formspree mais au CRM, comme les autres
 * formulaires du site : la demande devient un prospect (trigger lead_to_contact).
 */

const IMG = '/agents-ia';
const allerAuFormulaire = () => document.getElementById('capture')?.scrollIntoView({ behavior: 'smooth' });

const EMPLOYES = [
  {
    formule: 'SOLO', nom: 'Nathalie', role: 'Secrétaire Administrative', photo: `${IMG}/nathalie-secretaire.jpg`,
    taches: ['Traite vos messages en < 30 s, 24/7', 'Qualifie les demandes et transfère aux bons contacts', 'Prend les rendez-vous (Google Agenda)'],
    inclus: 'Incluse dans la formule SOLO — 99 €/mois',
  },
  {
    formule: 'DUO', nom: 'Jonathan', role: 'Responsable Commercial', photo: `${IMG}/jonathan-commercial.jpg`,
    taches: ['Relance les devis non signés', 'Suivi des factures impayées, rappels gradués', 'Compte-rendu commercial hebdomadaire'],
    inclus: 'Inclus dans la formule DUO — 170 €/mois',
  },
  {
    formule: 'TRIO', nom: 'Emeline', role: 'Responsable Marketing', photo: `${IMG}/emeline-marketing.jpg`,
    taches: ['Rédige et planifie vos posts (LinkedIn, Insta)', 'Propose des visuels et du contenu SEO', 'Suivi éditorial et de visibilité'],
    inclus: 'Incluse dans la formule TRIO — 249 €/mois',
  },
];

const FORMULES = [
  { nom: 'SOLO', qui: 'Secrétaire Administrative', prix: '99 €', points: ['1 employé Virtuel', 'Réponse client, qualification, RDV', 'Installé & maintenu', 'Monitoring 24/7'] },
  { nom: 'DUO', qui: 'Secrétaire + Responsable Commercial', prix: '170 €', pop: "L'équilibre idéal", points: ['2 employés Virtuels', '+ relance devis & suivi impayés', 'Installé & maintenu', 'Monitoring 24/7'] },
  { nom: 'TRIO', qui: 'Secrétaire + Commercial + Marketing', prix: '249 €', points: ['3 employés Virtuels', '+ réseaux sociaux & contenu', 'Installé & maintenu', 'Monitoring 24/7'] },
];

const GARANTIES: [string, string][] = [
  ['15 jours ouvrés', 'ou installation remboursée'],
  ['Garantie 30 jours', 'après mise en service'],
  ['Monitoring 24/7', 'par notre équipe'],
  ['Intervention < 4 h', 'ouvrées en cas de souci'],
  ['Zéro marge', 'sur vos coûts IA (BYOK)'],
  ['Données hébergées', 'en Europe, conforme RGPD'],
];

const FAQ_AGENTS = [
  { question: "Qu'est-ce qu'un employé virtuel ?", answer: "Un agent IA installé sur un poste précis (secrétariat, relance commerciale, marketing) : il traite vos messages, qualifie les demandes, prend les rendez-vous ou publie vos contenus, 24h/24, selon vos règles." },
  { question: 'Combien coûte un employé virtuel ?', answer: "À partir de 99 € par mois (formule SOLO), 170 € (DUO) ou 249 € (TRIO), plus une installation unique de 499 €. En modèle BYOK, vos coûts d'API IA sont facturés directement par votre fournisseur, sans marge." },
  { question: 'En combien de temps est-il opérationnel ?', answer: "En production en 15 jours ouvrés, ou l'installation est remboursée. Une garantie de 30 jours suit la mise en service." },
];

export default function AgentsIA() {
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'ok' | 'erreur'>('saisie');
  const [erreur, setErreur] = useState('');
  // Anti-spam : champ piège invisible + temps minimal de saisie (trigger base en renfort).
  const [piege, setPiege] = useState('');
  const [ouvertLe] = useState(() => Date.now());

  const envoyer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (piege || Date.now() - ouvertLe < 3000) { setEtat('ok'); return; }
    const nom = String(f.get('nom') ?? '').trim().replace(/\s+/g, ' ');
    const societe = String(f.get('societe') ?? '').trim();
    const tel = String(f.get('tel') ?? '').trim();
    const email = String(f.get('email') ?? '').trim().toLowerCase();
    // « Marie Dupont » → prénom Marie, nom Dupont ; un seul mot → nom seul.
    const [premier, ...reste] = nom.split(' ');
    setEtat('envoi'); setErreur('');
    const { error } = await supabase.from('contact_requests').insert([{
      first_name: reste.length ? premier : null,
      last_name: reste.length ? reste.join(' ') : premier,
      email: email || null, phone: tel, company: societe || null,
      request_type: 'Employés virtuels (Agents IA)',
      message: `Demande d'appel gratuit de 20 min — Employés virtuels, entreprise : ${societe}`,
      source: window.location.pathname, status: 'new',
    }]);
    if (error) { setErreur(error.message); setEtat('erreur'); return; }
    setEtat('ok');
  };

  return (
    <>
      <SEO
        title="Employés virtuels IA pour PME à La Réunion — dès 99 €/mois | Aissociate"
        description="Des agents IA qui traitent vos messages clients en moins de 30 secondes, 24h/24 : secrétariat, relance commerciale, marketing. Installés et surveillés à La Réunion, en production en 15 jours ouvrés. Dès 99 €/mois."
        keywords="employé virtuel, agent IA PME, agent IA La Réunion, secrétaire virtuelle IA, automatisation relance devis, assistant IA entreprise 974"
        url={`${SITE_URL}/agents-ia`}
        image={`${SITE_URL}${IMG}/tableau-de-bord.jpg`}
        imageAlt="Tableau de bord des employés virtuels Aissociate"
        breadcrumbs={[{ name: 'Accueil', url: SITE_URL }, { name: 'Agents IA', url: `${SITE_URL}/agents-ia` }]}
        faqData={FAQ_AGENTS}
      />
      <Header />
      <main id="contenu" className="lp-agents">
        <header className="hero">
          <div className="wrap">
            <span className="kicker">Disponibles 24/7 · Saint-Denis, La Réunion</span>
            <h1>Votre employé <small>Virtuel</small> traite vos messages clients<br />en <small>moins de 30 secondes</small>, 24h/24.</h1>
            <p className="lead">
              Qualifier les demandes, prendre les rendez-vous, relancer les devis, publier sur vos réseaux : des collaborateurs
              qui travaillent 24h/24, installés, maintenus et surveillés pour vous — sans salaire, sans recrutement.{' '}
              <b>À partir de 99 €/mois.</b>
            </p>
            <p className="mono-tag"><code>//</code> en production en 15 jours ouvrés, ou installation remboursée</p>
            <div className="points">
              {['24/7', 'Sur mesure', 'RGPD & hébergé en Europe', 'Support réactif sur place'].map((p) => (
                <div key={p} className="pt">✓ <b>{p}</b></div>
              ))}
            </div>
          </div>
          <div className="hero-img">
            <img src={`${IMG}/tableau-de-bord.jpg`} alt="Employés Virtuels Aissociate - tableau de bord" width={1280} height={698} />
          </div>
        </header>

        <div className="wrap">
          <div className="dialogue">
            <div className="dialogue-head">
              <span className="dot">EV</span> Nathalie, Secrétaire Administrative
              <small>Démo — conversation d'exemple, personnages fictifs</small>
            </div>
            <p className="msg user"><b>Louise :</b> « J'étais en déplacement, il y a eu des demandes ? »</p>
            <p className="msg ai"><b>Nathalie :</b> « Oui, 7 demandes traitées. J'ai filtré 3 démarchages, qualifié 4 leads et bloqué 2 rendez-vous dans votre agenda Google. Compte-rendu envoyé par mail. »</p>
            <p className="impact">Résultat : 2 rendez-vous pris, 0 message resté sans réponse.</p>
          </div>
        </div>

        <section className="garanties">
          <h2>Des garanties écrites, pas des promesses en l'air</h2>
          <p>Chaque point est une capacité que nous livrons — rien à inventer, rien à espérer.</p>
          <div className="liste">
            {GARANTIES.map(([fort, suite]) => <div key={fort}>✓ <b>{fort}</b> {suite}</div>)}
          </div>
        </section>

        <section id="equipe">
          <div className="wrap">
            <h2>Trois employés Virtuels, chacun sur son poste</h2>
            <p className="sous">Choisissez un collaborateur : nous l'installons, le maintenons et le surveillons pour vous — vous n'avez rien à gérer.</p>
            <div className="employes">
              {EMPLOYES.map((e) => (
                <div key={e.nom} className="employe">
                  <div className="photo"><img src={e.photo} alt={e.role} loading="lazy" width={640} height={640} /></div>
                  <div className="body">
                    <span className="role-tag">{e.formule}</span>
                    <h3>{e.nom}</h3>
                    <div className="role">{e.role}</div>
                    <ul>{e.taches.map((t) => <li key={t}>{t}</li>)}</ul>
                    <div className="inclus">{e.inclus}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* v8 : les canaux par lesquels on parle à son employé virtuel */}
        <section id="canaux">
          <div className="wrap">
            <h2>Interagissez par mail, WhatsApp ou Telegram</h2>
            <p className="sous">Votre employé Virtuel reste joignable comme un collègue — sur le canal que vous préférez, 24h/24.</p>
            <div className="canaux-grid">
              <div className="canal-cards">
                <div className="canal">
                  <div className="icone">
                    <svg className="logo-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                  </div>
                  <div className="txt"><h4>Par e-mail</h4><p>Vos messages et leurs réponses, centralisés et tracés.</p></div>
                </div>
                <div className="canal">
                  <div className="icone">
                    <svg className="logo-wa" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                  </div>
                  <div className="txt"><h4>WhatsApp Business</h4><p>Discutez comme avec un collègue, depuis votre mobile.</p></div>
                </div>
                <div className="canal">
                  <div className="icone">
                    <svg className="logo-tg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                  </div>
                  <div className="txt"><h4>Telegram</h4><p>Messages sécurisés, réponses rapides, agenda à jour.</p></div>
                </div>
              </div>
              <div className="phone" role="img" aria-label="Exemple de conversation WhatsApp avec Nathalie, secrétaire virtuelle">
                <div className="wa">
                  <div className="wa-head"><span className="avatar">EV</span><span>Nathalie · Secrétaire Virtuelle<small>en ligne ●</small></span></div>
                  <div className="wa-haut">Aujourd'hui</div>
                  <div className="wa-body">
                    <div className="wa-ai"><b>Nathalie :</b> Bonjour Louise 👋 Votre demande est reçue : 3 messages clients à traiter et 1 rendez-vous à planifier.</div>
                    <div className="wa-time">07:45</div>
                    <div className="wa-user">Parfait, merci. Tu peux aussi vérifier le devis en attente ?</div>
                    <div className="wa-time">07:46</div>
                    <div className="wa-ai"><b>Nathalie :</b> C'est fait ✔ J'ai qualifié la demande, relancé le prospect et posé le RDV à 14h dans votre agenda Google.</div>
                    <div className="wa-time">07:46</div>
                    <div className="wa-typing"><span className="dots">•••</span>&nbsp;Nathalie écrit…</div>
                  </div>
                  <div className="wa-input"><span className="fld" /><span className="mic" /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="tarifs">
          <div className="wrap">
            <h2>Une formule par situation d'équipe</h2>
            <div className="pricing">
              {FORMULES.map((f) => (
                <div key={f.nom} className={`formule${f.pop ? ' pop' : ''}`}>
                  {f.pop && <span className="tag">{f.pop}</span>}
                  <h3>{f.nom}</h3>
                  <div className="qui">{f.qui}</div>
                  <div className="prix">{f.prix}<span className="par">/mois</span></div>
                  <ul>{f.points.map((p) => <li key={p}>{p}</li>)}</ul>
                  <button type="button" className="btn" onClick={allerAuFormulaire}>Commencer</button>
                </div>
              ))}
            </div>
            <p className="mentions-tarifs">
              Installation unique <strong>499 €</strong> (audit, configuration, formation, recette). <strong>Modèle BYOK</strong> :
              vos coûts d'API IA sont facturés directement par votre fournisseur — aucune marge par-dessus.
            </p>
          </div>
        </section>

        <div id="capture" style={{ backgroundImage: `url('${IMG}/fond-rappel.jpg')` }}>
          <h2>Votre employé <span className="mono">Virtuel</span> en production en 15 jours ouvrés.</h2>
          <p className="reass">
            Sinon, l'installation est remboursée. Laissez vos coordonnées : un conseiller Aissociate vous rappelle sous 24h
            ouvrées pour un appel gratuit de 20 minutes. On examine votre cas — et si un employé Virtuel n'est pas le bon
            outil pour vous, on vous le dit franchement.
          </p>

          {etat === 'ok' ? (
            <div className="form-ok" role="status">
              ✔ Merci ! Votre demande a bien été reçue. Un conseiller Aissociate vous rappelle sous 24h ouvrées.
            </div>
          ) : (
            <form className="form-capture" onSubmit={(e) => void envoyer(e)}>
              <label htmlFor="ag-nom">Votre nom / prénom</label>
              <input className="champ" type="text" id="ag-nom" name="nom" placeholder="Marie Dupont" autoComplete="name" required />
              <label htmlFor="ag-societe">Nom de votre entreprise</label>
              <input className="champ" type="text" id="ag-societe" name="societe" placeholder="Votre PME" autoComplete="organization" required />
              <label htmlFor="ag-email">Votre e-mail</label>
              <input className="champ" type="email" id="ag-email" name="email" placeholder="marie.dupont@votre-pme.re" autoComplete="email" required />
              <label htmlFor="ag-tel">Votre téléphone</label>
              <input className="champ" type="tel" id="ag-tel" name="tel" placeholder="06 92 00 00 00" autoComplete="tel" required />
              {/* Piège à robots : invisible pour un humain. */}
              <div className="piege" aria-hidden="true">
                <label htmlFor="ag-site">Site web</label>
                <input id="ag-site" name="site" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
              </div>
              <button type="submit" disabled={etat === 'envoi'}>
                {etat === 'envoi' ? 'Envoi en cours…' : 'Réserver mon appel gratuit de 20 min'}
              </button>
              <div className="note">Réponse sous 24h ouvrées · sans engagement</div>
            </form>
          )}
          {etat === 'erreur' && (
            <div className="form-err" role="alert">
              Une erreur est survenue{erreur ? ` (${erreur})` : ''}. Merci de réessayer, ou appelez-nous au 06 92 24 68 60.
            </div>
          )}
          <p className="confiance">🔒 Vos coordonnées restent confidentielles — données hébergées en Union européenne, conforme RGPD · Aissociate, Saint-Denis de La Réunion</p>
        </div>

        <section className="promesse">
          <p className="promise">En production en <em>15 jours ouvrés</em> ou installation remboursée.</p>
          <small>Aissociate.re · Saint-Denis, La Réunion · Employés Virtuels installés et entretenus pour les PME · Conforme RGPD &amp; IA Act</small>
        </section>
      </main>
      <Footer />
    </>
  );
}
