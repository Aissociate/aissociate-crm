// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, CircleCheck as CheckCircle2, ShieldCheck, Loader as Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import SEO from '../components/SEO';

// Comparaison insensible aux accents / à la casse (pré-sélection de formation).
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const Formulaire = () => {
  // Pré-remplissage depuis les CTA des pages formations : /formulaire?formation=<intitulé>
  const [searchParams] = useSearchParams();
  const formationParam = searchParams.get('formation') || '';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    requestType: '',
    message: formationParam ? `Je souhaite un devis pour la formation « ${formationParam} ».` : ''
  });

  // Si l'intitulé transmis correspond à une option du menu, on la pré-sélectionne.
  useEffect(() => {
    if (!formationParam) return;
    const select = document.getElementById('requestType');
    if (!select) return;
    const target = norm(formationParam);
    for (const opt of select.options) {
      if (!opt.value) continue;
      const v = norm(opt.value);
      if (v.includes(target) || target.includes(v)) {
        setFormData((f) => ({ ...f, requestType: opt.value }));
        break;
      }
    }
  }, [formationParam]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  // Anti-spam : honeypot invisible + temps minimal de saisie (trigger côté base en renfort).
  const [website, setWebsite] = useState('');
  const [openedAt] = useState(() => Date.now());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (website || Date.now() - openedAt < 3000) {
      setSubmitted(true);
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { error: submitError } = await supabase
        .from('contact_requests')
        .insert([
          {
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            company: formData.company || null,
            request_type: formData.requestType,
            message: formData.message,
            source: window.location.pathname,
            status: 'new'
          }
        ]);

      if (submitError) throw submitError;

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (submitted) {
    return (
      <>
        <SEO
          title="Demande envoyée - Aissociate"
          description="Votre demande a été envoyée avec succès"
        />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Demande envoyée !
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              Merci pour votre intérêt. Notre équipe vous contactera dans les plus brefs délais.
            </p>
            <a
              href="/"
              className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
            >
              Retour à l'accueil
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Demande de contact - Aissociate"
        description="Contactez-nous pour vos besoins en formation IA, assistance ou développement"
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Parlez-nous de votre projet
              </h1>
              <p className="text-lg text-slate-600">
                Remplissez ce formulaire et nous vous recontacterons rapidement pour discuter de vos besoins.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot : invisible pour les humains, rempli par les robots. */}
              <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
                <label htmlFor="website">Ne pas remplir</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-semibold text-slate-700 mb-2">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder="Jean"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-semibold text-slate-700 mb-2">
                    Nom *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                  placeholder="jean.dupont@example.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-2">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                  placeholder="06 12 34 56 78"
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-semibold text-slate-700 mb-2">
                  Entreprise
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                  placeholder="Nom de votre entreprise (optionnel)"
                />
              </div>

              <div>
                <label htmlFor="requestType" className="block text-sm font-semibold text-slate-700 mb-2">
                  Type de demande *
                </label>
                <select
                  id="requestType"
                  name="requestType"
                  required
                  value={formData.requestType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white text-slate-900"
                >
                  <option value="">Sélectionnez une formation ou un service</option>
                  <optgroup label="Formations CPF">
                    <option value="Création de contenus rédactionnels et visuels par l'IA générative">
                      Création de contenus par l'IA générative (CPF - 3 jours)
                    </option>
                  </optgroup>
                  <optgroup label="Formations OPCO">
                    <option value="Introduction aux IA pour les PME">
                      Introduction aux IA pour les PME (1 jour)
                    </option>
                    <option value="Automatisation des process des PME">
                      Automatisation des process des PME (2 jours)
                    </option>
                    <option value="L'IA pour optimiser la relation client">
                      L'IA pour optimiser la relation client (1 jour)
                    </option>
                    <option value="L'IA pour optimiser le marketing et la communication">
                      L'IA pour optimiser le marketing et la communication (2 jours)
                    </option>
                    <option value="L'IA pour optimiser la prospection commerciale">
                      L'IA pour optimiser la prospection commerciale (1 jour)
                    </option>
                    <option value="L'IA pour optimiser les ressources humaines">
                      L'IA pour optimiser les ressources humaines (2 jours)
                    </option>
                    <option value="Apprenez à maîtriser les marchés publics avec lemarchepublic.fr">
                      Marchés publics avec lemarchepublic.fr (1 jour)
                    </option>
                  </optgroup>
                  <optgroup label="Services">
                    <option value="Assistance IA">Assistance IA - Accompagnement personnalisé</option>
                    <option value="Développement sur mesure">Développement sur mesure - Solutions IA</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-slate-700 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none text-slate-900 placeholder:text-slate-400"
                  placeholder="Décrivez-nous votre projet ou vos besoins..."
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-4 rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Envoyer ma demande
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 mt-6 text-emerald-700 font-semibold">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              Réponse sous 24 h ouvrées
            </div>
            <p className="text-sm text-slate-600 text-center mt-2">
              Organisme certifié Qualiopi — formations finançables CPF, OPCO et France Travail. Sans engagement.
            </p>
            <p className="text-sm text-slate-500 text-center mt-4">
              En soumettant ce formulaire, vous acceptez d'être contacté par notre équipe concernant votre demande.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Formulaire;
