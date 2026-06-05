// @ts-nocheck
import LegalLayout, { H2, P, UL } from '../components/LegalLayout';

export default function Reclamations() {
  return (
    <LegalLayout
      title="Réclamations"
      description="Procédure de réclamation et de traitement des litiges d'Aissociate, organisme de formation certifié Qualiopi : comment nous faire part d'une réclamation et délais de traitement."
      path="/reclamations"
      updated="04/06/2026"
    >
      <H2>Faire une réclamation</H2>
      <P>Dans une démarche d'amélioration continue (exigence Qualiopi), Aissociate met à votre disposition une procédure de recueil et de traitement des réclamations, ouverte aux apprenants, clients, financeurs et partenaires.</P>
      <P>Pour formuler une réclamation, contactez-nous :</P>
      <UL>
        <li>Par e-mail : contact@aissociate.re (objet : « Réclamation »)</li>
        <li>Par courrier : Aissociate — 36 chemin de l'État Major, 97417 Saint-Denis</li>
        <li>Par téléphone : 06 92 24 68 60</li>
      </UL>

      <H2>Délais de traitement</H2>
      <UL>
        <li>Accusé de réception de votre réclamation sous 5 jours ouvrés</li>
        <li>Réponse apportée sous 30 jours ouvrés maximum</li>
        <li>Mise en place, le cas échéant, d'actions correctives et suivi de leur efficacité</li>
      </UL>

      <H2>Médiation</H2>
      <P>Si aucune solution amiable n'est trouvée, et conformément au Code de la consommation, vous pouvez recourir gratuitement à un médiateur de la consommation. Les coordonnées du médiateur compétent vous seront communiquées sur simple demande à contact@aissociate.re.</P>

      <H2>Confidentialité</H2>
      <P>Toute réclamation est traitée avec confidentialité et ne peut donner lieu à aucune conséquence négative pour la personne qui en est à l'origine.</P>
    </LegalLayout>
  );
}
