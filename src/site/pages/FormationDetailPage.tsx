// @ts-nocheck
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { GraduationCap, Clock, Users, Award, CircleCheck as CheckCircle, FileText, Target, BookOpen, ArrowLeft } from 'lucide-react';
import SEO, { SITE_URL } from '../components/SEO';
import { supabase } from '@/lib/supabase';
import { formationsData } from '../data/formationsCatalogue';
import CrmFormationDetail from './formation/CrmFormationDetail';

const fmtDuree = (h) => {
  if (!h) return null;
  const jours = h % 7 === 0 ? h / 7 : null;
  return jours ? `${h}h (${jours} jour${jours > 1 ? 's' : ''})` : `${h}h`;
};
export default function FormationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const staticFormation = id ? formationsData[id] : null;

  // Données live du CRM : surchargent la page statique (correspondance par
  // slug) ou servent de source unique pour une formation sans page statique.
  const [crmRow, setCrmRow] = useState(null);
  const [loading, setLoading] = useState(!staticFormation);
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let on = true;
    const isUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
    supabase
      .from('formations')
      .select('id, slug, intitule, objectifs, programme, prerequis, public_vise, duree_heures, modalite, prix, reference, certifiante, code_certification')
      .eq('actif', true)
      .eq(isUuid ? 'id' : 'slug', id)
      .maybeSingle()
      .then(
        ({ data, error }) => { if (on) { if (!error) setCrmRow(data ?? null); setLoading(false); } },
        () => { if (on) setLoading(false); },
      );
    return () => { on = false; };
  }, [id]);

  if (!staticFormation && loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-neutral-500">
          Chargement de la formation…
        </div>
        <Footer />
      </div>
    );
  }

  if (!staticFormation && crmRow) {
    return <CrmFormationDetail f={crmRow} />;
  }

  if (!staticFormation) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h1 className="tracking-tight text-3xl font-semibold text-neutral-950 mb-4">Formation non trouvée</h1>
          <Link to="/formations" className="text-orange-600 hover:text-orange-700">
            Retour aux formations
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Page statique, enrichie par les valeurs à jour du CRM si disponibles.
  const formation = crmRow ? {
    ...staticFormation,
    title: crmRow.intitule || staticFormation.title,
    // Libellé figé de la fiche statique prioritaire : le calcul heures→jours
    // ne reflète pas les parcours mixtes (présentiel + e-learning).
    duration: staticFormation.durationLabel ?? fmtDuree(crmRow.duree_heures) ?? staticFormation.duration,
    price: Number(crmRow.prix) > 0 ? `${Number(crmRow.prix).toLocaleString('fr-FR')} €` : staticFormation.price,
    participants: crmRow.public_vise || staticFormation.participants,
    prerequisites: crmRow.prerequis || staticFormation.prerequisites,
    ref: crmRow.reference || staticFormation.ref,
  } : staticFormation;

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={`${formation.title} — Formation IA | Aissociate`}
        description={`${formation.title}. ${formation.duration}, ${formation.price}. Financement ${formation.isEligibleCPF ? 'CPF, ' : ''}OPCO. Certifié Qualiopi. Présentiel ou distanciel.`}
        keywords={`${formation.title}, formation IA, Qualiopi, ${formation.isEligibleCPF ? 'CPF, ' : ''}OPCO, ${formation.level || 'professionnel'}`}
        image={formation.image}
        imageAlt={formation.title}
        url={`${SITE_URL}/formations/${formation.id}`}
        type="course"
        breadcrumbs={[
          { name: 'Formations', url: `${SITE_URL}/formations` },
          { name: formation.title, url: `${SITE_URL}/formations/${formation.id}` },
        ]}
        courseData={{
          name: formation.title,
          description: formation.objectives?.[0] || formation.title,
          provider: 'Aissociate',
          duration: formation.duration,
          price: String(formation.price || '').replace(/[^\d]/g, '') || '0',
          priceCurrency: 'EUR',
          educationalLevel: formation.level || 'Tous niveaux',
          courseMode: ['blended', 'onsite', 'online'],
        }}
      />
      <Header />
      <main id="contenu">

      <section className="relative h-96 overflow-hidden">
        <img
          src={formation.image}
          alt={formation.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent"></div>
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <Link
              to="/formations"
              className="inline-flex items-center gap-2 text-white hover:text-orange-400 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour aux formations
            </Link>
            {(formation.isCertifying || formation.isEligibleOPCO) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {formation.isCertifying && (
                  <>
                    <span className="bg-orange-500 text-neutral-950 px-4 py-2 rounded-full text-sm font-semibold">
                      Formation certifiante
                    </span>
                    <span className="bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      Éligible CPF
                    </span>
                    <span className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      {formation.rs}
                    </span>
                  </>
                )}
                {formation.isEligibleOPCO && (
                  <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    Financement OPCO
                  </span>
                )}
              </div>
            )}
            <h1 className="tracking-tight text-4xl sm:text-5xl font-semibold text-white mb-4 max-w-4xl">
              {formation.title}
            </h1>
            <div className="flex items-center gap-2 text-white/90">
              <Users className="w-5 h-5" />
              <span>{formation.participants}</span>
              <span className="mx-2">•</span>
              <Clock className="w-5 h-5" />
              <span>{formation.duration}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              <div>
                <h2 className="tracking-tight text-3xl font-semibold text-neutral-950 mb-6 flex items-center gap-3">
                  <Target className="w-8 h-8 text-orange-600" />
                  Objectifs de la formation
                </h2>
                <div className="bg-[#F2ECE4] rounded-2xl p-8 border border-neutral-200">
                  <p className="text-neutral-600 mb-6">À l’issue de la formation, le participant sera capable de :</p>
                  <ul className="space-y-3">
                    {formation.objectives.map((obj: string, index: number) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <span className="text-neutral-700">{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h2 className="tracking-tight text-3xl font-semibold text-neutral-950 mb-6 flex items-center gap-3">
                  <BookOpen className="w-8 h-8 text-orange-600" />
                  Programme de la formation
                </h2>
                <div className="space-y-6">
                  {formation.program.map((module: any, index: number) => (
                    <div key={index} className="bg-white border-2 border-neutral-200 rounded-2xl p-8 hover:border-orange-300 transition-colors">
                      <h3 className="text-xl font-semibold text-neutral-950 mb-4">{module.title}</h3>
                      <ul className="space-y-3">
                        {module.content.map((item: string, itemIndex: number) => (
                          <li key={itemIndex} className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-neutral-600">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {formation.formats?.length > 0 && (
                <div>
                  <h2 className="tracking-tight text-3xl font-semibold text-neutral-950 mb-6 flex items-center gap-3">
                    <Users className="w-8 h-8 text-orange-600" />
                    Deux formats au choix
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-6">
                    {formation.formats.map((fmt: any) => (
                      <div key={fmt.name} className="bg-white border-2 border-neutral-200 rounded-2xl p-8 flex flex-col hover:border-orange-300 transition-colors">
                        <h3 className="text-xl font-semibold text-neutral-950 mb-1">{fmt.name}</h3>
                        <div className="text-3xl font-semibold text-orange-600 mb-1">{fmt.price}</div>
                        <p className="text-sm text-neutral-600 mb-5">{fmt.duration}</p>
                        <ul className="space-y-3 mb-6 flex-1">
                          {fmt.details.map((detail: string, i: number) => (
                            <li key={i} className="flex items-start gap-3">
                              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-neutral-600">{detail}</span>
                            </li>
                          ))}
                        </ul>
                        {fmt.cpfUrl ? (
                          <a
                            href={fmt.cpfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-center bg-orange-500 hover:bg-orange-400 text-neutral-950 px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-sm"
                          >
                            S'inscrire via Mon Compte Formation
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-neutral-500 mt-4">
                    Tarifs par participant, passage de la certification RS 6776 inclus. Formation éligible au CPF ; financement OPCO, AGEFICE ou France Travail possible selon votre situation.
                  </p>
                </div>
              )}

              <div>
                <h2 className="tracking-tight text-3xl font-semibold text-neutral-950 mb-6 flex items-center gap-3">
                  <Award className="w-8 h-8 text-orange-600" />
                  Points forts de la formation
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {formation.strengths.map((strength: string, index: number) => (
                    <div key={index} className="bg-neutral-100 rounded-xl p-6 border border-neutral-200">
                      <CheckCircle className="w-6 h-6 text-emerald-600 mb-3" />
                      <p className="text-neutral-700">{strength}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-6">
                <div className="bg-orange-50 rounded-2xl p-8 border-2 border-orange-200">
                  <div className="text-center mb-6">
                    <div className="text-5xl font-semibold text-neutral-950 mb-2">{formation.price}</div>
                    <div className="text-sm text-neutral-600">{formation.priceNote || 'Par participant'}</div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-3 p-4 bg-white rounded-xl">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-sm text-neutral-600">Durée</div>
                        <div className="font-semibold text-neutral-950">{formation.duration}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-white rounded-xl">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-sm text-neutral-600">Public</div>
                        <div className="font-semibold text-neutral-950">{formation.participants}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-white rounded-xl">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-sm text-neutral-600">Niveau</div>
                        <div className="font-semibold text-neutral-950">{formation.level}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-white rounded-xl">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-sm text-neutral-600">Format</div>
                        <div className="font-semibold text-neutral-950">{formation.format}</div>
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/formulaire?formation=${encodeURIComponent(formation.title)}`}
                    className="block w-full text-center bg-orange-500 hover:bg-orange-400 text-neutral-950 px-8 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-sm"
                  >
                    Demander un devis
                  </Link>
                  <p className="text-center text-sm text-neutral-500 mt-3">Réponse sous 24 h ouvrées</p>
                </div>

                <div className="bg-white border-2 border-neutral-200 rounded-2xl p-6">
                  <h3 className="font-semibold text-neutral-950 mb-4">Prérequis</h3>
                  <p className="text-neutral-600 text-sm">{formation.prerequisites}</p>
                </div>

                <div className="bg-white border-2 border-neutral-200 rounded-2xl p-6">
                  <h3 className="font-semibold text-neutral-950 mb-4">Référence</h3>
                  <p className="text-neutral-600 font-mono">{formation.ref}</p>
                </div>

                {formation.isCertifying && (
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
                    <div className="flex items-start gap-3">
                      <Award className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-emerald-900 mb-2">Formation certifiante</div>
                        <p className="text-sm text-emerald-800">
                          Cette formation est éligible au CPF et délivre une certification reconnue {formation.rs}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {formation.isEligibleOPCO && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                    <div className="flex items-start gap-3">
                      <Award className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-blue-900 mb-2">Financement professionnel</div>
                        <p className="text-sm text-blue-800 mb-2">
                          Cette formation peut être financée par votre OPCO, AGEFICE, ou tout autre organisme de financement professionnel.
                        </p>
                        <p className="text-xs text-blue-700">
                          Contactez-nous pour connaître vos options de financement.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
}
