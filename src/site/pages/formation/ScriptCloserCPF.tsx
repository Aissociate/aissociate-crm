// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Brain, CheckCircle, Users, Calendar, AlertCircle, FileText, Target, Zap } from 'lucide-react';
import AdminLogo from '../../components/AdminLogo';

export default function ScriptCloserCPF() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/formation')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <AdminLogo />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Script Closer CPF</h1>
            <p className="text-sm text-slate-600">Formation IA - Particuliers</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Script Complet - Closer CPF</h2>
              <p className="text-slate-600 mt-2">Demande de renseignements Formation IA - CPF (Particulier)</p>
            </div>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-600 p-6 rounded-r-lg mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="w-6 h-6 text-emerald-700" />
                  <p className="font-bold text-emerald-900 text-lg">Ouverture</p>
                </div>
                <div className="space-y-3 text-slate-800">
                  <p>
                    <strong>Bonjour [Prénom], c'est [Ton prénom].</strong><br />
                    Je vous appelle suite à votre demande de renseignements concernant notre formation en intelligence artificielle.
                  </p>
                  <p className="font-semibold text-emerald-900">
                    Est-ce que c'est toujours un bon moment pour vous ?
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-600 p-6 rounded-r-lg mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-6 h-6 text-blue-700" />
                  <p className="font-bold text-blue-900 text-lg">Cadre de l'échange</p>
                </div>
                <div className="space-y-3 text-slate-800">
                  <p>Super, l'objectif de cet échange est simple :</p>
                  <ul className="list-none space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">–</span>
                      <span>comprendre votre situation,</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">–</span>
                      <span>vérifier que vous êtes bien éligible au CPF,</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">–</span>
                      <span>et voir si la formation est adaptée pour vous.</span>
                    </li>
                  </ul>
                  <p>Si c'est pas le cas, je préfère vous le dire tout de suite.</p>
                  <p className="font-semibold text-blue-900">Ça vous va ?</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-600" />
                Phase 1 - Besoin & Motivation
              </h3>

              <div className="bg-slate-50 rounded-xl p-6 mb-4">
                <div className="space-y-4 text-slate-800">
                  <p className="font-semibold text-slate-900">
                    Pour commencer, qu'est-ce qui vous a donné envie de vous renseigner sur une formation en IA ?
                  </p>
                  <p className="text-sm text-slate-600 italic">
                    [Curiosité / travail / reconversion / productivité / évolution pro]
                  </p>

                  <p className="font-semibold text-slate-900">
                    Ok, je vois... dites moi, aujourd'hui, vous utilisez déjà un peu des outils comme ChatGPT ou d'autres IA, ou pas vraiment ?
                  </p>

                  <p className="font-semibold text-slate-900">
                    Vous vous situez plutôt dans un objectif :
                  </p>
                  <ul className="list-none space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">–</span>
                      <span>professionnel,</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">–</span>
                      <span>reconversion,</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">–</span>
                      <span>ou montée en compétences personnelle ?</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-600 p-6 rounded-r-lg">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-6 h-6 text-amber-700" />
                  <p className="font-bold text-amber-900 text-lg">Reformulation</p>
                </div>
                <div className="space-y-3 text-slate-800">
                  <p>Si je résume :</p>
                  <ul className="list-none space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">✓</span>
                      <span>vous cherchez à mieux comprendre l'IA,</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">✓</span>
                      <span>à l'utiliser de façon concrète,</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">✓</span>
                      <span>et surtout à structurer vos usages.</span>
                    </li>
                  </ul>
                  <p className="font-semibold text-amber-900">C'est bien ça ?</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                Phase 2 - Qualification CPF (OBLIGATOIRE)
              </h3>

              <p className="text-slate-700 mb-6">
                Je vais vous poser quelques questions rapides, uniquement pour vérifier la faisabilité du financement CPF.
              </p>

              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <h4 className="font-bold text-blue-900 text-lg">Solde CPF</h4>
                  </div>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p className="font-semibold">
                      Est-ce que vous connaissez approximativement le solde de votre CPF actuellement ?
                    </p>
                    <p className="text-slate-600 italic">[Oui / Non]</p>

                    <div className="bg-blue-100 rounded-lg p-4 mt-3">
                      <p className="font-semibold text-blue-900 mb-2">👉 Si NON :</p>
                      <p className="mb-2">Ce n'est pas un souci.</p>
                      <p>Vous avez déjà créé votre compte sur le site ou l'application Mon Compte Formation ?</p>
                    </div>

                    <p>Pour vous situer, la formation nécessite un solde CPF d'au moins <strong>1 600 €</strong>, ou bien un financement complémentaire, par exemple via France Travail.</p>
                    <p className="font-semibold">Est-ce que vous pensez être dans ce cas de figure ?</p>
                    <p className="text-slate-600 italic">[Oui / Peut-être / Non]</p>
                  </div>
                </div>

                <div className="bg-emerald-50 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-1" />
                    <h4 className="font-bold text-emerald-900 text-lg">Financement complémentaire (si besoin)</h4>
                  </div>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>
                      Si jamais votre solde est insuffisant, est-ce que vous êtes actuellement inscrit à France Travail ou accompagné par un organisme d'aide à l'emploi ?
                    </p>
                    <p className="text-slate-600 italic">[Oui / Non]</p>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />
                    <h4 className="font-bold text-orange-900 text-lg">Identité numérique</h4>
                  </div>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>Autre point important :</p>
                    <p>
                      Pour mobiliser le CPF, il est nécessaire d'avoir créé son identité numérique (via France Identité ou équivalent).
                    </p>
                    <p className="font-semibold">Est-ce que vous l'avez déjà réalisée ?</p>
                    <p className="text-slate-600 italic">[Oui / Non / Je ne sais pas]</p>

                    <div className="bg-orange-100 rounded-lg p-4 mt-3">
                      <p className="font-semibold text-orange-900 mb-2">👉 Si NON :</p>
                      <p>Pas d'inquiétude, on vous explique la démarche si besoin.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                    <h4 className="font-bold text-purple-900 text-lg">Inscription en groupe (option)</h4>
                  </div>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>Dernière question :</p>
                    <p>
                      Est-ce que vous envisagez de suivre la formation seul, ou bien avec des amis ou des collègues ?
                    </p>
                    <p className="text-slate-600 italic">[Seul / En groupe / Je ne sais pas encore]</p>

                    <div className="bg-purple-100 rounded-lg p-4 mt-3">
                      <p className="font-semibold text-purple-900 mb-2">👉 Si GROUPE :</p>
                      <p>Très bien à savoir, il existe des modalités adaptées pour les inscriptions groupées.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Target className="w-6 h-6 text-emerald-600" />
                Phase 3 - Positionnement de la formation
              </h3>

              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 mb-6">
                <div className="space-y-3 text-slate-800">
                  <p>La formation est une formation d'initiation à l'intelligence artificielle, pensée pour des personnes non techniques.</p>
                  <p>L'objectif est de :</p>
                  <ul className="list-none space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">–</span>
                      <span>comprendre comment fonctionne l'IA,</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">–</span>
                      <span>savoir l'utiliser concrètement au quotidien,</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">–</span>
                      <span>et éviter les erreurs ou les usages inefficaces.</span>
                    </li>
                  </ul>
                  <p className="font-semibold text-emerald-900">Elle est très pratique et adaptée à votre profil.</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-600 p-6 rounded-r-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Brain className="w-6 h-6 text-blue-700" />
                  <p className="font-bold text-blue-900 text-lg">Test d'adhésion</p>
                </div>
                <div className="space-y-3 text-slate-800">
                  <p>À ce stade, est-ce que cette formation correspond à ce que vous recherchiez ?</p>
                  <p className="text-slate-600 italic">[Oui / Plutôt oui / J'ai encore des questions]</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Zap className="w-6 h-6 text-amber-600" />
                Prochaine étape
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h4 className="font-bold text-green-900">SI CPF OK / POTENTIEL OK</h4>
                  </div>
                  <div className="space-y-2 text-slate-800 text-sm">
                    <p>Parfait.</p>
                    <p>La prochaine étape, c'est un rendez-vous plus détaillé pour :</p>
                    <ul className="list-none space-y-1 ml-4">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600">–</span>
                        <span>vous présenter le programme,</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600">–</span>
                        <span>vérifier précisément votre financement CPF,</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600">–</span>
                        <span>et vous accompagner dans les démarches si besoin.</span>
                      </li>
                    </ul>
                    <p className="font-semibold text-green-900 mt-3">
                      Vous seriez plutôt disponible en début ou en fin de semaine ?
                    </p>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <h4 className="font-bold text-orange-900">SI CPF BLOQUANT</h4>
                  </div>
                  <div className="space-y-2 text-slate-800 text-sm">
                    <p>Dans ce cas, je vous propose qu'on fasse le point tranquillement sur les solutions possibles</p>
                    <p className="text-slate-600">(complément France Travail, groupe, ou autre).</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Processus d'inscription
              </h3>

              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-6">
                  <h4 className="font-bold text-blue-900 text-lg mb-3">Transition</h4>
                  <p className="text-slate-800">Parfait, dans ce cas on peut avancer concrètement.</p>
                </div>

                <div className="bg-emerald-50 rounded-xl p-6">
                  <h4 className="font-bold text-emerald-900 text-lg mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Choix de la date de formation
                  </h4>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>Nous avons actuellement plusieurs sessions de formation planifiées.</p>
                    <p>Les prochaines dates disponibles sont :</p>
                    <ul className="list-none space-y-1 ml-4">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">–</span>
                        <span>[date 1]</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">–</span>
                        <span>[date 2]</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">–</span>
                        <span>[date 3]</span>
                      </li>
                    </ul>
                    <p className="font-semibold text-emerald-900 mt-3">
                      Est-ce qu'il y a une date qui vous conviendrait mieux que les autres ?
                    </p>
                    <p className="text-slate-600 italic">[Réponse du prospect : date choisie / hésitation]</p>

                    <div className="bg-emerald-100 rounded-lg p-4 mt-3">
                      <p className="font-semibold text-emerald-900 mb-2">👉 Si hésitation :</p>
                      <p>Pour vous aider à choisir, l'important est surtout d'avoir une date sur laquelle vous pouvez vous projeter sereinement.</p>
                      <p className="font-semibold mt-2">Laquelle vous semble la plus réaliste ?</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-xl p-6">
                  <h4 className="font-bold text-amber-900 text-lg mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Verrouillage d'intention
                  </h4>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>Très bien.</p>
                    <p>Donc si je résume, on partirait sur la session du <strong>[date choisie]</strong>.</p>
                    <p className="text-slate-600 italic">[Oui]</p>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-xl p-6">
                  <h4 className="font-bold text-purple-900 text-lg mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Inscription CPF (guidage simple)
                  </h4>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>La prochaine étape, c'est l'inscription directement via votre compte CPF.</p>
                    <p>Je vais vous envoyer le lien de la formation sur Mon Compte Formation.</p>
                    <p>L'inscription se fait en quelques minutes, et si besoin je peux vous guider pas à pas.</p>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-xl p-6">
                  <h4 className="font-bold text-orange-900 text-lg mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Rappel identité numérique
                  </h4>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>Juste pour être sûr :</p>
                    <p>Votre identité numérique est bien activée, ou vous aurez besoin d'un petit accompagnement pour cette étape ?</p>
                    <p className="text-slate-600 italic">[Oui c'est fait / Non / Je ne sais pas]</p>

                    <div className="bg-orange-100 rounded-lg p-4 mt-3">
                      <p className="font-semibold text-orange-900 mb-2">👉 Si NON / incertain :</p>
                      <p>Aucun souci, je vous enverrai aussi un guide très simple pour le faire.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 rounded-xl p-6 border-2 border-red-300">
                  <h4 className="font-bold text-red-900 text-lg mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Fixation de la relance (CLÉ)
                  </h4>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>Pour éviter qu'on laisse ça de côté, je vous propose qu'on fasse comme ça :</p>
                    <ul className="list-none space-y-2 ml-4">
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 font-bold">👉</span>
                        <span>je vous laisse effectuer l'inscription CPF tranquillement,</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 font-bold">👉</span>
                        <span>et je vous rappelle pour vérifier que tout s'est bien passé.</span>
                      </li>
                    </ul>
                    <p className="font-semibold text-red-900 mt-3">
                      Est-ce que [jour + heure précise] vous conviendrait pour ce point rapide ?
                    </p>
                    <p className="text-slate-600 italic">[Oui / Autre créneau]</p>
                    <p className="mt-3">Parfait.</p>
                    <p>Je note donc un rappel le <strong>[date + heure]</strong>, uniquement pour vérifier l'inscription et répondre aux dernières questions si besoin.</p>
                  </div>
                </div>

                <div className="bg-teal-50 rounded-xl p-6">
                  <h4 className="font-bold text-teal-900 text-lg mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Réduction de la friction
                  </h4>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>De votre côté, le plus simple est vraiment de faire l'inscription dès que possible, comme ça votre place est réservée sur la session du <strong>[date]</strong>.</p>
                  </div>
                </div>

                <div className="bg-cyan-50 rounded-xl p-6">
                  <h4 className="font-bold text-cyan-900 text-lg mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Confirmation écrite
                  </h4>
                  <div className="space-y-3 text-slate-800 text-sm">
                    <p>Je vous envoie tout de suite après notre échange :</p>
                    <ul className="list-none space-y-1 ml-4">
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-600 font-bold">–</span>
                        <span>le lien CPF de la formation,</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-600 font-bold">–</span>
                        <span>la date choisie,</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-600 font-bold">–</span>
                        <span>et le rendez-vous de relance.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-600 p-6 rounded-r-lg">
                  <h4 className="font-bold text-emerald-900 text-lg mb-3 flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    Closing
                  </h4>
                  <div className="space-y-3 text-slate-800">
                    <p>Parfait.</p>
                    <p>Merci pour votre disponibilité, <strong>[Prénom]</strong>.</p>
                    <p>On se reparle le <strong>[date de relance]</strong>, et d'ici là je reste disponible si vous avez la moindre question.</p>
                    <p className="font-semibold">Très bonne journée.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-600" />
                Règles internes (IMPORTANTES)
              </h3>

              <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-xl p-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">❌</span>
                      <p className="text-slate-800 font-semibold">
                        Ne jamais laisser un prospect CPF sans date de formation
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">❌</span>
                      <p className="text-slate-800 font-semibold">
                        Ne jamais raccrocher sans date de relance
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✅</span>
                      <p className="text-slate-800 font-semibold">
                        Toujours envoyer le lien CPF immédiatement
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✅</span>
                      <p className="text-slate-800 font-semibold">
                        Toujours reformuler la date choisie
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200">
            <button
              onClick={() => navigate('/formation')}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Retour à la formation
            </button>
          </div>
        </article>
      </main>
    </div>
  );
}
