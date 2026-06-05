// @ts-nocheck
import LegalLayout, { H2, P, UL } from '../components/LegalLayout';

export default function Accessibilite() {
  return (
    <LegalLayout
      title="Accessibilité"
      description="Déclaration d'accessibilité d'Aissociate et accueil des personnes en situation de handicap dans nos formations à l'intelligence artificielle (référent handicap)."
      path="/accessibilite"
      updated="04/06/2026"
    >
      <H2>Notre engagement</H2>
      <P>Aissociate s'engage à rendre ses formations et son site accessibles au plus grand nombre, conformément à son obligation Qualiopi d'accueil des publics en situation de handicap et dans l'esprit du Référentiel Général d'Amélioration de l'Accessibilité (RGAA).</P>

      <H2>Accueil des personnes en situation de handicap</H2>
      <P>Nous étudions chaque situation au cas par cas afin de proposer les adaptations nécessaires (pédagogiques, matérielles ou organisationnelles) et, le cas échéant, une orientation vers nos partenaires spécialisés.</P>
      <UL>
        <li>Adaptation des supports et du rythme de la formation</li>
        <li>Choix du format (présentiel accessible ou classe à distance)</li>
        <li>Mobilisation de partenaires et de financements dédiés</li>
      </UL>

      <H2>Référent handicap</H2>
      <P>Un référent handicap est à votre disposition pour préparer votre parcours dans les meilleures conditions. Contactez-le avant votre inscription :</P>
      <UL>
        <li>Courriel : contact@aissociate.re</li>
        <li>Téléphone : 06 92 24 68 60</li>
      </UL>

      <H2>Accessibilité du site</H2>
      <P>Nous travaillons à l'amélioration continue de l'accessibilité numérique de ce site (contrastes, navigation au clavier, structure des contenus). Si vous rencontrez une difficulté d'accès à une information, signalez-le nous à contact@aissociate.re : nous nous engageons à vous fournir l'information par un autre moyen.</P>
    </LegalLayout>
  );
}
