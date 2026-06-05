// @ts-nocheck
import LegalLayout, { H2, P, UL } from '../components/LegalLayout';

export default function Confidentialite() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      description="Politique de confidentialité et protection des données (RGPD) d'Aissociate : données collectées, finalités, durée de conservation et exercice de vos droits."
      path="/confidentialite"
      updated="04/06/2026"
    >
      <H2>Responsable du traitement</H2>
      <P>Le responsable du traitement des données est Aissociate (SARL), 36 chemin de l'État Major, 97417 Saint-Denis. Contact : contact@aissociate.re.</P>

      <H2>Données collectées</H2>
      <P>Nous collectons les données que vous nous transmettez volontairement via nos formulaires de contact et de demande de devis :</P>
      <UL>
        <li>Identité : nom, prénom</li>
        <li>Coordonnées : adresse e-mail, numéro de téléphone, entreprise</li>
        <li>Contenu de votre demande (message, besoin de formation)</li>
      </UL>

      <H2>Finalités et base légale</H2>
      <UL>
        <li>Répondre à vos demandes d'information et établir des devis — base légale : mesures précontractuelles / consentement</li>
        <li>Gérer la relation commerciale et le suivi des inscriptions — base légale : exécution du contrat</li>
        <li>Respecter nos obligations en tant qu'organisme de formation (Qualiopi) — base légale : obligation légale</li>
      </UL>

      <H2>Destinataires</H2>
      <P>Vos données sont destinées exclusivement aux équipes d'Aissociate et sont gérées dans notre outil interne (CRM). Elles ne sont ni vendues ni cédées à des tiers à des fins commerciales.</P>

      <H2>Durée de conservation</H2>
      <P>Les données des prospects sont conservées 3 ans à compter du dernier contact. Les données liées à une formation sont conservées conformément à nos obligations légales et Qualiopi.</P>

      <H2>Vos droits</H2>
      <P>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données. Pour les exercer, écrivez à contact@aissociate.re. Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).</P>

      <H2>Cookies</H2>
      <P>Le site utilise uniquement des cookies techniques nécessaires à son bon fonctionnement (gestion de session). Aucun cookie de traçage publicitaire n'est déposé sans votre consentement.</P>
    </LegalLayout>
  );
}
