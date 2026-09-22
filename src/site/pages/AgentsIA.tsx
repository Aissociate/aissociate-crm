import { useState, type FormEvent } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO, { SITE_URL } from '../components/SEO';
import { supabase } from '@/lib/supabase';
import './agents-ia.css';

/**
 * Page « Agents IA » : les employés virtuels d'Aissociate (reprise de la
 * landing v7 « conversion »). Le formulaire de rappel garde le design de la
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
    // « Marie Dupont » → prénom Marie, nom Dupont ; un seul mot → nom seul.
    const [premier, ...reste] = nom.split(' ');
    setEtat('envoi'); setErreur('');
    const { error } = await supabase.from('contact_requests').insert([{
      first_name: reste.length ? premier : null,
      last_name: reste.length ? reste.join(' ') : premier,
      phone: tel, company: societe || null,
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
