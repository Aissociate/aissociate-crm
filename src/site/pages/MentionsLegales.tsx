// @ts-nocheck
import LegalLayout, { H2, P, UL } from '../components/LegalLayout';

export default function MentionsLegales() {
  return (
    <LegalLayout
      title="Mentions légales"
      description="Mentions légales d'Aissociate, organisme de formation en intelligence artificielle certifié Qualiopi à La Réunion : éditeur, hébergeur, propriété intellectuelle."
      path="/mentions-legales"
      updated="04/06/2026"
    >
      <H2>Éditeur du site</H2>
      <P>Le présent site est édité par :</P>
      <UL>
        <li><strong>Aissociate</strong> — SARL au capital de 100 €</li>
        <li>Siège social : 36 chemin de l'État Major, 97417 Saint-Denis (La Réunion)</li>
        <li>SIRET : 995 220 407 00010 — RCS de Saint-Denis de La Réunion</li>
        <li>Numéro de déclaration d'activité (NDA) : 04 97 37547 97. Cet enregistrement ne vaut pas agrément de l'État.</li>
        <li>Téléphone : 06 92 24 68 60 — Courriel : contact@aissociate.re</li>
      </UL>

      <H2>Directeur de la publication</H2>
      <P>Le représentant légal d'Aissociate.</P>

      <H2>Hébergement</H2>
      <P>Le site est hébergé par son prestataire d'hébergement web. Pour toute question relative à l'hébergement, contactez-nous à contact@aissociate.re.</P>

      <H2>Certification Qualiopi</H2>
      <P>Aissociate est un organisme de formation certifié Qualiopi au titre de la catégorie « Actions de formation ». Le certificat est vérifiable publiquement via le lien présent en pied de page.</P>

      <H2>Propriété intellectuelle</H2>
      <P>L'ensemble des contenus présents sur ce site (textes, visuels, logos, supports pédagogiques) est protégé par le droit de la propriété intellectuelle et demeure la propriété exclusive d'Aissociate, sauf mention contraire. Toute reproduction, représentation ou diffusion, totale ou partielle, sans autorisation préalable écrite est interdite.</P>

      <H2>Responsabilité</H2>
      <P>Aissociate s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur ce site, mais ne saurait être tenue responsable des erreurs, omissions ou d'une indisponibilité temporaire du service.</P>
    </LegalLayout>
  );
}
