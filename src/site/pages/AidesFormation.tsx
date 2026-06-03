// @ts-nocheck
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { TrendingUp, Euro, ShieldCheck, Rocket, Users, Building2, Globe as Globe2, Award, Star, GraduationCap, MessageCircle, LifeBuoy, ArrowRight, CheckCircle2, ChevronRight, Wallet, Briefcase, UserCheck, MapPin } from 'lucide-react';

const BLEU_FRANCE = '#000091';
const ROUGE_MARIANNE = '#E1000F';

export default function AidesFormation() {
  const initiatives = [
    { title: 'Plan France 2030', amount: '2,5 Mds €', description: "Investissement de l'État pour l'intelligence artificielle dans les entreprises françaises.", icon: Rocket },
    { title: 'BPI France', amount: "jusqu'à 90 000 €", description: "Financement public pour la transformation numérique et l'adoption de l'IA par les PME, porté par la Banque Publique d'Investissement.", icon: Globe2 },
    { title: 'OPCO & Plan de développement des compétences', amount: "jusqu'à 100 %", description: "Prise en charge de la formation IA pour vos salariés par votre opérateur de compétences.", icon: ShieldCheck },
    { title: 'CPF de transition & FNE-Formation', amount: '3 000 € min.', description: "Dispositifs activables immédiatement pour former chaque collaborateur à l'IA.", icon: Euro },
    { title: "Crédit d'impôt formation dirigeant", amount: '+ 522 € / an', description: "Avantage fiscal cumulable pour chaque journée de formation du chef d'entreprise.", icon: Award },
    { title: 'Aide unique apprentissage IA', amount: '6 000 €', description: "Prime pour l'embauche d'un alternant formé aux métiers de l'intelligence artificielle.", icon: TrendingUp },
  ];

  const reunionCompanies = ['Groupe Bourbon', 'Run Market', 'Groupe Caillé', 'Cilam', 'Vindemia', 'Groupe GBH', 'Groupe Adrien Bellier', 'Edena', 'Royal Bourbon Industries', 'Groupe Quartier Français', 'Téréos Océan Indien', 'Groupe Ravate'];

  const testimonials = [
    { name: 'Jean-Marc Hoarau', role: 'Dirigeant, BTP & Construction', company: '34 salariés — Saint-Denis', avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "Je pensais que l'IA c'était pour les grands groupes. Avec 7 200 € d'aides cumulées, j'ai pu former toute mon équipe de chantier. On gagne 12 h par semaine sur la planification.", highlight: "7 200 € d'aides obtenues" },
    { name: 'Marie-Christine Payet', role: "Fondatrice, Cabinet d'expertise comptable", company: '18 collaborateurs — Saint-Pierre', avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "Mes séniors refusaient le digital, mes juniors partaient à Paris. Avec la formation IA financée à 100 % par notre OPCO, toute l'équipe parle le même langage. Turnover divisé par 3 en 8 mois.", highlight: 'Turnover divisé par 3' },
    { name: 'Laurent Vienne', role: 'PDG, Distribution alimentaire', company: '52 salariés — Le Port', avatar: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "Mon concurrent direct a lancé l'IA avant moi. J'ai monté un dossier, obtenu 18 400 € d'aides. 6 mois plus tard, j'ai repris 2 points de part de marché.", highlight: '+2 pts de part de marché' },
    { name: 'Sandrine Ramassamy', role: 'Directrice, Agence de communication', company: '9 salariés — Saint-Gilles', avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "Je ne connaissais ni le FNE, ni le FEDER Réunion. En 1 h de rendez-vous, 4 dispositifs cumulables identifiés. 9 800 €, formation IA intégrale payée, zéro avance de trésorerie.", highlight: '9 800 € sans avance' },
    { name: 'Frédéric Grondin', role: 'Gérant, Société de transport', company: '28 chauffeurs — Saint-André', avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "Marges écrasées, gasoil qui explose, j'étais à 2 doigts de fermer. L'IA m'a permis d'optimiser les tournées : -23 % de km parcourus. L'aide France 2030 a payé 83 % du projet.", highlight: '-23 % de kilomètres' },
    { name: 'Véronique Technau', role: 'Directrice RH, Industrie agroalimentaire', company: '76 salariés — Le Tampon', avatar: 'https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "On avait 4 générations dans l'usine. L'IA est devenue le langage commun. Mes ouvriers séniors forment les jeunes sur les outils IA. Ambiance transformée.", highlight: '4 générations réunies' },
    { name: 'Patrick Fontaine', role: "PDG, Cabinet d'architecture", company: '12 architectes — Saint-Paul', avatar: 'https://images.pexels.com/photos/769745/pexels-photo-769745.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "J'attendais que l'IA soit « prête ». Elle l'est depuis 18 mois. 5 cas concrets présentés qui tournent chez mes confrères réunionnais. J'ai signé le jour même.", highlight: 'ROI en 4 mois' },
    { name: 'Nadia Boyer', role: 'Fondatrice, E-commerce local', company: '6 salariés — Saint-Denis', avatar: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "On m'avait dit 3 000 € grand maximum. Avec leur expertise, on est monté à 11 250 €. Mon CA a bondi de +38 % en un trimestre.", highlight: '+38 % de CA' },
    { name: 'Olivier Bertil', role: "Gérant, Entreprise du bâtiment", company: '41 salariés — Sainte-Marie', avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "Mon père disait en 1999 : « Internet c'est un gadget ». Il a fermé en 2008. Je ne referai pas la même erreur avec l'IA. 22 400 € d'aides obtenues, 90 k€ de projet.", highlight: "22 400 € d'aides" },
    { name: 'Christine Hoareau', role: 'Directrice, Centre de santé', company: '24 soignants — Saint-Benoît', avatar: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=200', quote: "15 heures récupérées par semaine sur l'administratif. Mes soignants sont enfin dispos pour les patients. Le meilleur investissement de ma carrière.", highlight: '15 h/semaine récupérées' },
  ];

  const benefits = [
    'Automatiser 30 à 60 % des tâches répétitives de vos équipes',
    'Récupérer 8 à 15 heures par semaine et par collaborateur',
    "Réduire vos coûts opérationnels jusqu'à -42 %",
    'Gagner des parts de marché pendant que vos concurrents hésitent',
    'Transformer vos juniors en profils hybrides IA en moins de 90 jours',
    'Valoriser vos séniors plutôt que de les remplacer',
    "Financer l'intégralité de la formation avec les aides publiques",
    'Devenir la référence IA de votre secteur sur le territoire',
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-[#161616]">
      <Header />

      <div className="w-full h-1 flex" aria-hidden="true">
        <div className="flex-1" style={{ backgroundColor: BLEU_FRANCE }}></div>
        <div className="flex-1 bg-white"></div>
        <div className="flex-1" style={{ backgroundColor: ROUGE_MARIANNE }}></div>
      </div>

      <section className="bg-white border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex flex-col items-center border-2 border-[#161616] px-3 py-2 leading-none">
                <span className="text-[11px] font-bold tracking-tighter text-[#161616]">RÉPUBLIQUE</span>
                <span className="text-[11px] font-bold tracking-tighter text-[#161616]">FRANÇAISE</span>
                <span className="text-[10px] italic text-[#3A3A3A] mt-1">Liberté</span>
                <span className="text-[10px] italic text-[#3A3A3A]">Égalité</span>
                <span className="text-[10px] italic text-[#3A3A3A]">Fraternité</span>
              </div>
              <span className="inline-flex h-8 w-12 overflow-hidden border border-[#DDDDDD]" aria-label="Drapeau français">
                <span className="flex-1" style={{ backgroundColor: BLEU_FRANCE }}></span>
                <span className="flex-1 bg-white"></span>
                <span className="flex-1" style={{ backgroundColor: ROUGE_MARIANNE }}></span>
              </span>
            </div>

            <p className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: BLEU_FRANCE }}>
              Dispositif public — Transformation IA des PME
            </p>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight text-[#161616]">
              L'État finance jusqu'à <span style={{ color: BLEU_FRANCE }}>90 000 €</span> pour intégrer l'intelligence artificielle dans votre entreprise à La Réunion.
            </h1>

            <p className="text-lg text-[#3A3A3A] mb-4 leading-relaxed">
              Dans le cadre du <strong>Plan France 2030</strong> et des fonds européens <strong>FEDER Réunion</strong>, les PME réunionnaises peuvent cumuler plusieurs dispositifs publics pour financer leur transformation par l'intelligence artificielle.
            </p>

            <p className="text-base text-[#666666] mb-8 leading-relaxed">
              Ce programme est opéré par un organisme de formation certifié Qualiopi, référencé auprès des OPCO et agréé pour le FNE-Formation.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/formulaire"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold text-base transition-colors"
                style={{ backgroundColor: BLEU_FRANCE }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1212FF')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BLEU_FRANCE)}
              >
                Vérifier mon éligibilité
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#dispositifs"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-base border-2 transition-colors"
                style={{ color: BLEU_FRANCE, borderColor: BLEU_FRANCE }}
              >
                Consulter les dispositifs
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative">
              <img
                src="https://images.rtl.fr/~c/770v513/rtl/www/1181076-une-vue-du-palais-de-l-elysee.jpg"
                alt="Palais de l'Élysée — République française"
                className="w-full h-[340px] object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-[#161616]/85 text-white px-4 py-3 text-xs">
                <span className="font-semibold">Palais de l'Élysée</span>
                <span className="text-[#CCCCCC]"> — Siège de la Présidence de la République</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F6F6F6] border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#DDDDDD]">
          {[
            { value: '3 000 €', label: 'Montant minimum garanti' },
            { value: '5 693 €', label: 'Aide moyenne constatée' },
            { value: '90 000 €', label: 'Plafond projets ambitieux' },
            { value: '-42 %', label: 'Coûts opérationnels (moy.)' },
          ].map((s, i) => (
            <div key={i} className="bg-white p-6">
              <div className="text-3xl sm:text-4xl font-bold mb-1" style={{ color: BLEU_FRANCE }}>{s.value}</div>
              <div className="text-sm text-[#3A3A3A]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl mb-12">
            <div className="w-12 h-1 mb-5" style={{ backgroundColor: BLEU_FRANCE }}></div>
            <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: BLEU_FRANCE }}>Contexte économique</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#161616] mb-5 leading-tight">
              Un plan national, une urgence locale.
            </h2>
            <p className="text-lg text-[#3A3A3A] leading-relaxed">
              Le retard numérique coûte chaque année 1,8 point de PIB aux PME ultra-marines. Le Gouvernement a débloqué 2,5 milliards d'euros au titre du Plan France 2030 pour accélérer l'adoption de l'IA par les entreprises françaises, dont une enveloppe spécifique pour les territoires d'Outre-mer.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-[#DDDDDD] border border-[#DDDDDD]">
            {[
              { title: 'Concurrence sectorielle', description: "68 % des PME du top 100 réunionnais ont lancé un projet IA en 2025. Les entreprises qui n'ont pas encore commencé accumulent en moyenne 12 mois de retard opérationnel." },
              { title: 'Transmission des savoirs', description: "L'écart générationnel entre séniors et juniors paralyse les équipes. L'IA constitue un langage commun permettant de préserver le savoir-faire tout en adoptant les nouveaux outils." },
              { title: 'Pression sur les marges', description: "1 entreprise sur 3 à La Réunion a constaté une baisse de marge en 2025. La productivité n'est plus un levier accessoire, c'est un facteur de résilience." },
              { title: 'Calendrier des aides', description: "Les enveloppes 2026 sont plafonnées. Les dossiers sont instruits selon un principe de premier arrivé, premier servi, jusqu'à épuisement des crédits ouverts." },
            ].map((f, i) => (
              <div key={i} className="bg-white p-8">
                <h3 className="text-xl font-bold text-[#161616] mb-3">{f.title}</h3>
                <p className="text-[#3A3A3A] leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="dispositifs" className="bg-[#F6F6F6] border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl mb-12">
            <div className="w-12 h-1 mb-5" style={{ backgroundColor: BLEU_FRANCE }}></div>
            <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: BLEU_FRANCE }}>Dispositifs publics mobilisables</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#161616] mb-5 leading-tight">
              Six dispositifs cumulables pour financer votre transformation IA.
            </h2>
            <p className="text-lg text-[#3A3A3A] leading-relaxed">
              Tous les dispositifs ci-dessous sont établis par décret ou convention. Leur combinaison est rendue possible par l'article L.6313-1 du Code du travail et les règlements du FEDER 2021-2027.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#DDDDDD] border border-[#DDDDDD]">
            {initiatives.map((init, i) => {
              const Icon = init.icon;
              return (
                <article key={i} className="bg-white p-7">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 flex items-center justify-center" style={{ backgroundColor: BLEU_FRANCE }}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-lg font-bold" style={{ color: BLEU_FRANCE }}>{init.amount}</div>
                  </div>
                  <h3 className="text-lg font-bold text-[#161616] mb-2 leading-snug">{init.title}</h3>
                  <p className="text-sm text-[#3A3A3A] leading-relaxed">{init.description}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-14">
            <div className="max-w-3xl mb-10">
              <div className="w-12 h-1 mb-5" style={{ backgroundColor: ROUGE_MARIANNE }}></div>
              <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: ROUGE_MARIANNE }}>En complément de France 2030</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#161616] mb-4 leading-tight">
                Quatre dispositifs supplémentaires cumulables selon votre statut.
              </h3>
              <p className="text-base text-[#3A3A3A] leading-relaxed">
                Former votre entreprise à l'intelligence artificielle n'est pas un coût, c'est un investissement souvent pris en charge. Selon votre statut, plusieurs dispositifs peuvent financer tout ou partie de votre formation.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-px bg-[#DDDDDD] border border-[#DDDDDD]">
              {[
                {
                  icon: Wallet,
                  name: 'CPF',
                  title: 'Compte Personnel de Formation',
                  description: 'Mobilisez vos droits acquis pour financer votre montée en compétence sur les outils et méthodes IA.',
                  target: 'Salariés, indépendants, demandeurs d\'emploi',
                },
                {
                  icon: Briefcase,
                  name: 'FAF',
                  title: 'Fonds d\'assurance formation',
                  description: 'Prise en charge dédiée aux chefs d\'entreprise et professions libérales via AGEFICE, FIF-PL ou FAFCEA.',
                  target: 'Dirigeants, indépendants, professions libérales',
                },
                {
                  icon: UserCheck,
                  name: 'France Travail',
                  title: 'Financement projet & transition',
                  description: 'Financement possible dans le cadre d\'un projet de création d\'entreprise ou d\'une transition professionnelle.',
                  target: 'Demandeurs d\'emploi, porteurs de projet',
                },
                {
                  icon: MapPin,
                  name: 'FEDER & Région',
                  title: 'Aides régionales & européennes',
                  description: 'Pour aller plus loin et déployer l\'IA à l\'échelle de votre activité, avec un cofinancement européen FEDER.',
                  target: 'PME, TPE, projets structurants',
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <article key={i} className="bg-white p-7">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: ROUGE_MARIANNE }}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-sm font-bold" style={{ color: ROUGE_MARIANNE }}>{item.name}</span>
                          <span className="text-xs text-[#666666]">·</span>
                          <span className="text-sm font-semibold text-[#161616]">{item.title}</span>
                        </div>
                        <p className="text-sm text-[#3A3A3A] leading-relaxed mb-3">{item.description}</p>
                        <div className="inline-flex items-center gap-1.5 text-xs text-[#666666]">
                          <Users className="w-3.5 h-3.5" />
                          <span>{item.target}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-10 bg-white border-l-4 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6" style={{ borderColor: BLEU_FRANCE }}>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#161616] mb-2">Simulation gratuite de vos droits</h3>
              <p className="text-[#3A3A3A]">En moyenne, les dirigeants accompagnés activent 2,4 dispositifs simultanément et obtiennent 5 693 € de financement public.</p>
            </div>
            <Link
              to="/formulaire"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold whitespace-nowrap"
              style={{ backgroundColor: BLEU_FRANCE }}
            >
              Simuler mes aides
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl mb-12">
            <div className="w-12 h-1 mb-5" style={{ backgroundColor: BLEU_FRANCE }}></div>
            <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: BLEU_FRANCE }}>Acteurs économiques engagés</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#161616] mb-5 leading-tight">
              Les entreprises de référence du territoire ont intégré l'IA.
            </h2>
            <p className="text-lg text-[#3A3A3A] leading-relaxed">
              Les principaux groupes de l'économie réunionnaise ont initié leur transformation IA en 2024-2025. Cette dynamique s'étend désormais aux PME à travers les dispositifs publics de cofinancement.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-[#DDDDDD] border border-[#DDDDDD] mb-10">
            {reunionCompanies.map((company, i) => (
              <div key={i} className="bg-white p-5 flex items-center gap-3">
                <Building2 className="w-5 h-5 flex-shrink-0" style={{ color: BLEU_FRANCE }} />
                <div>
                  <div className="font-semibold text-[#161616] text-sm leading-tight">{company}</div>
                  <div className="text-xs text-[#666666] mt-1">IA intégrée</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-[#DDDDDD] border border-[#DDDDDD]">
            <div className="bg-[#F6F6F6] p-8">
              <div className="text-4xl font-bold mb-2" style={{ color: BLEU_FRANCE }}>68 %</div>
              <div className="text-sm text-[#3A3A3A]">des PME du top 100 réunionnais ont lancé un projet IA en 2025.</div>
            </div>
            <div className="bg-[#F6F6F6] p-8">
              <div className="text-4xl font-bold mb-2" style={{ color: BLEU_FRANCE }}>+ 34 %</div>
              <div className="text-sm text-[#3A3A3A]">de productivité moyenne constatée après 6 mois d'accompagnement.</div>
            </div>
            <div className="bg-[#F6F6F6] p-8">
              <div className="text-4xl font-bold mb-2" style={{ color: BLEU_FRANCE }}>12 mois</div>
              <div className="text-sm text-[#3A3A3A]">de retard cumulé pour les entreprises qui n'ont pas encore initié leur projet.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F6F6F6] border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl mb-10">
            <div className="w-12 h-1 mb-5" style={{ backgroundColor: BLEU_FRANCE }}></div>
            <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: BLEU_FRANCE }}>Organisme de formation de référence</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#161616] mb-5 leading-tight">
              Plus qu'une formation, un accompagnement dans la durée.
            </h2>
            <p className="text-lg text-[#3A3A3A] leading-relaxed">
              Notre programme est certifié Qualiopi et suivi au-delà de la session initiale. Les stagiaires conservent un accès permanent à nos ressources et à la communauté professionnelle.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#DDDDDD] border border-[#DDDDDD]">
            <div className="bg-white p-6">
              <GraduationCap className="w-8 h-8 mb-3" style={{ color: BLEU_FRANCE }} />
              <div className="text-3xl font-bold text-[#161616] mb-1">+ 300</div>
              <div className="text-sm text-[#3A3A3A]">stagiaires formés à La Réunion</div>
            </div>
            <div className="bg-white p-6">
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < 4 ? 'fill-[#FFC107] text-[#FFC107]' : 'fill-[#FFC107]/40 text-[#FFC107]/40'}`} />
                ))}
              </div>
              <div className="text-3xl font-bold text-[#161616] mb-1">4,5 / 5</div>
              <div className="text-sm text-[#3A3A3A]">note moyenne des stagiaires</div>
            </div>
            <div className="bg-white p-6">
              <MessageCircle className="w-8 h-8 mb-3" style={{ color: BLEU_FRANCE }} />
              <div className="text-xl font-bold text-[#161616] mb-1">Groupe WhatsApp</div>
              <div className="text-sm text-[#3A3A3A]">entraide entre stagiaires, 7 j/7</div>
            </div>
            <div className="bg-white p-6">
              <LifeBuoy className="w-8 h-8 mb-3" style={{ color: BLEU_FRANCE }} />
              <div className="text-xl font-bold text-[#161616] mb-1">Suivi à vie</div>
              <div className="text-sm text-[#3A3A3A]">accompagnement au-delà de la formation</div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl mb-12">
            <div className="w-12 h-1 mb-5" style={{ backgroundColor: BLEU_FRANCE }}></div>
            <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: BLEU_FRANCE }}>Retours d'expérience</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#161616] mb-5 leading-tight">
              Dix dirigeants réunionnais témoignent.
            </h2>
            <p className="text-lg text-[#3A3A3A] leading-relaxed">
              Les témoignages ci-dessous sont publiés avec l'accord des intéressés. Les montants et indicateurs mentionnés correspondent aux résultats effectivement constatés.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-[#DDDDDD] border border-[#DDDDDD]">
            {testimonials.map((t, i) => (
              <article key={i} className="bg-white p-7">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-[#FFC107] text-[#FFC107]" />
                  ))}
                </div>

                <p className="text-[#161616] leading-relaxed mb-5">« {t.quote} »</p>

                <div className="inline-flex items-center gap-2 border px-3 py-1 text-xs font-semibold mb-5" style={{ borderColor: BLEU_FRANCE, color: BLEU_FRANCE }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t.highlight}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-[#DDDDDD]">
                  <img src={t.avatar} alt={t.name} className="w-11 h-11 rounded-full object-cover" />
                  <div>
                    <div className="font-bold text-[#161616] text-sm">{t.name}</div>
                    <div className="text-xs text-[#3A3A3A]">{t.role}</div>
                    <div className="text-xs text-[#666666]">{t.company}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F6F6F6] border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl mb-10">
            <div className="w-12 h-1 mb-5" style={{ backgroundColor: BLEU_FRANCE }}></div>
            <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: BLEU_FRANCE }}>Résultats attendus</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#161616] mb-5 leading-tight">
              Ce que nos clients constatent à 90 jours.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-[#DDDDDD] border border-[#DDDDDD]">
            {benefits.map((benefit, i) => (
              <div key={i} className="bg-white p-6 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: BLEU_FRANCE }} />
                <span className="text-[#161616]">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="border-2 border-[#161616]">
            <div className="p-8 sm:p-10 text-white" style={{ backgroundColor: BLEU_FRANCE }}>
              <p className="text-sm font-bold uppercase tracking-wider mb-3 text-white/80">Prise de rendez-vous</p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-tight">
                Audit IA et simulation personnalisée de vos aides
              </h2>
              <p className="text-white/90 leading-relaxed">
                Entretien téléphonique de 30 minutes avec un expert certifié Qualiopi, référencé auprès des OPCO et agréé France 2030. Sans engagement.
              </p>
            </div>

            <div className="p-8 sm:p-10 bg-white">
              <p className="text-[#161616] font-semibold mb-5">À l'issue de l'entretien, vous disposez des documents suivants :</p>

              <ul className="space-y-3 mb-8">
                {[
                  'Cartographie des tâches automatisables dans votre structure',
                  'Montant prévisionnel des aides publiques mobilisables',
                  "Plan d'action opérationnel sur 90 jours",
                  'Estimation du retour sur investissement à 12 mois',
                  'Analyse concurrentielle sectorielle à La Réunion',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: BLEU_FRANCE }} />
                    <span className="text-[#3A3A3A]">{item}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/formulaire"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 text-white font-semibold text-base"
                style={{ backgroundColor: BLEU_FRANCE }}
              >
                Réserver mon audit gratuit
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="flex flex-wrap items-center gap-6 mt-8 pt-6 border-t border-[#DDDDDD] text-sm text-[#3A3A3A]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" style={{ color: BLEU_FRANCE }} />
                  <span>Certifié Qualiopi</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: BLEU_FRANCE }} />
                  <span>100 % La Réunion</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" style={{ color: BLEU_FRANCE }} />
                  <span>Réponse sous 24 h ouvrées</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="w-full h-1 flex" aria-hidden="true">
        <div className="flex-1" style={{ backgroundColor: BLEU_FRANCE }}></div>
        <div className="flex-1 bg-white"></div>
        <div className="flex-1" style={{ backgroundColor: ROUGE_MARIANNE }}></div>
      </div>

      <Footer />
    </div>
  );
}
