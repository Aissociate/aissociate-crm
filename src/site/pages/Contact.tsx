// @ts-nocheck
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO, { SITE_URL } from '../components/SEO';
import { Mail, Phone, MapPin, Send, CheckCircle, Clock, MessageSquare, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // Enregistre le lead -> contact CRM (via contact_requests + trigger).
    const parts = (formData.name || '').trim().split(/\s+/);
    const firstName = parts.shift() || formData.name;
    const lastName = parts.join(' ') || null;
    try {
      const { error: submitError } = await supabase.from('contact_requests').insert([{
        first_name: firstName,
        last_name: lastName,
        email: formData.email,
        phone: formData.phone,
        company: null,
        request_type: formData.subject || 'Contact',
        message: formData.message,
        source: '/contact',
        status: 'new',
      }]);
      if (submitError) throw submitError;
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      setTimeout(() => setSubmitted(false), 5000);
    } catch {
      setError("L'envoi a échoué. Veuillez réessayer, ou contactez-nous directement par email ou téléphone.");
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

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Contact — Aissociate, formation IA à La Réunion (Qualiopi)"
        description="Contactez Aissociate, organisme de formation en intelligence artificielle certifié Qualiopi à La Réunion. Devis, financement CPF / OPCO, inscriptions et accompagnement."
        keywords="contact Aissociate, formation IA Réunion contact, devis formation IA, organisme formation IA La Réunion, inscription formation IA"
        url={`${SITE_URL}/contact`}
        breadcrumbs={[{ name: 'Accueil', url: SITE_URL }, { name: 'Contact', url: `${SITE_URL}/contact` }]}
      />
      <Header />

      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">Contactez-nous</h1>
            <p className="text-xl text-slate-300">
              Une question ? Un projet ? Notre équipe est à votre écoute pour vous accompagner
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-b from-white via-slate-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8 mb-12">
            <div className="bg-white border-2 border-slate-200 rounded-xl p-6 text-center hover:border-orange-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Téléphone</h3>
              <a href="tel:+262692246860" className="text-orange-600 hover:underline">
                0692-24-68-60
              </a>
              <p className="text-sm text-slate-600 mt-2">Lun-Ven 9h-18h</p>
            </div>

            <div className="bg-white border-2 border-slate-200 rounded-xl p-6 text-center hover:border-orange-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Email</h3>
              <a href="mailto:contact@aissociate.re" className="text-emerald-600 hover:underline">
                contact@aissociate.re
              </a>
              <p className="text-sm text-slate-600 mt-2">Réponse sous 24h</p>
            </div>

            <div className="bg-white border-2 border-slate-200 rounded-xl p-6 text-center hover:border-orange-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Localisation</h3>
              <p className="text-slate-700">
                La Réunion<br />
                Océan Indien
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Envoyez-nous un message</h2>

              {submitted && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <p className="text-emerald-800">Votre message a été envoyé avec succès !</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-slate-900 mb-2">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-orange-400 focus:outline-none transition-colors"
                    placeholder="Jean Dupont"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-900 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-orange-400 focus:outline-none transition-colors"
                      placeholder="jean@exemple.fr"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-slate-900 mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-orange-400 focus:outline-none transition-colors"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-semibold text-slate-900 mb-2">
                    Sujet *
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-orange-400 focus:outline-none transition-colors"
                  >
                    <option value="">Sélectionnez un sujet</option>

                    <optgroup label="Formations CPF">
                      <option value="formation-contenus-ia-cpf">Création de contenus rédactionnels et visuels par l'IA générative (CPF)</option>
                    </optgroup>

                    <optgroup label="Formations OPCO">
                      <option value="formation-introduction-ia-pme">Introduction aux IA pour les PME</option>
                      <option value="formation-automatisation-process">Automatisation des process des PME</option>
                      <option value="formation-ia-relation-client">L'IA pour optimiser la relation client</option>
                      <option value="formation-ia-marketing">L'IA pour optimiser le marketing et la communication</option>
                      <option value="formation-ia-prospection">L'IA pour optimiser la prospection commerciale</option>
                      <option value="formation-ia-rh">L'IA pour optimiser les ressources humaines</option>
                      <option value="formation-ia-manager">L'IA au service du manager</option>
                    </optgroup>

                    <optgroup label="Autres services">
                      <option value="assistance">Assistance IA</option>
                      <option value="developpement">Développement</option>
                      <option value="autre">Autre demande</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-slate-900 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-orange-400 focus:outline-none transition-colors resize-none"
                    placeholder="Décrivez votre demande..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:scale-100"
                >
                  <Send className="w-5 h-5" />
                  {loading ? 'Envoi en cours…' : 'Envoyer le message'}
                </button>

                <p className="text-sm text-slate-600 text-center">
                  * Champs obligatoires
                </p>
              </form>
            </div>

            <div className="space-y-8">
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-8">
                <Clock className="w-12 h-12 text-orange-600 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Horaires d'ouverture
                </h3>
                <div className="space-y-2 text-slate-700">
                  <div className="flex justify-between">
                    <span className="font-semibold">Lundi - Vendredi</span>
                    <span>9h00 - 18h00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Samedi</span>
                    <span>10h00 - 13h00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Dimanche</span>
                    <span className="text-slate-500">Fermé</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-8">
                <MessageSquare className="w-12 h-12 text-emerald-600 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Questions fréquentes
                </h3>
                <p className="text-slate-700 mb-4">
                  Consultez notre FAQ pour trouver rapidement des réponses à vos questions les plus courantes.
                </p>
                <Link
                  to="/#faq"
                  className="inline-block text-emerald-600 hover:text-emerald-700 font-semibold hover:underline"
                >
                  Voir la FAQ →
                </Link>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-8">
                <CheckCircle className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Engagement qualité
                </h3>
                <ul className="space-y-2 text-slate-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                    <span>Réponse sous 24h maximum</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                    <span>Devis gratuit et sans engagement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                    <span>Accompagnement personnalisé</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
