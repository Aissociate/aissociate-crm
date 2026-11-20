import { describe, expect, it } from 'vitest';
import { colonneSensibleAbsente, detecterSensible, ibanValide, messageSensible, nirValide } from './sensible';

const type = (titre: string, contenu = '') => detecterSensible(titre, contenu)?.type ?? null;

describe('ressources sensibles', () => {
  it('reconnaît un IBAN par sa clé, quelle que soit la mise en forme', () => {
    expect(ibanValide('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
    expect(ibanValide('FR7630006000011234567890188')).toBe(false); // clé fausse
    expect(ibanValide('FR76 3000 6000 0112 3456 7890')).toBe(false); // trop court
    expect(type('Conditions de règlement.pdf', 'Virement sur le compte IBAN : FR76 3000 6000 0112 3456 7890 189 BIC AGRIFRPP')).toBe('rib');
    expect(type('Coordonnées', 'iban fr1420041010050500013m02606')).toBe('rib');
    expect(type('Fournisseur', 'Compte DE89 3704 0044 0532 0130 00, merci.')).toBe('rib');
  });

  it('reconnaît un RIB à son titre ou à sa mention, même sans texte lisible (PDF scanné)', () => {
    expect(type('RIB Menuiserie Hoarau.pdf', ' ')).toBe('rib');
    expect(type('scan0001.pdf', "RELEVÉ D'IDENTITÉ BANCAIRE — Titulaire du compte")).toBe('rib');
  });

  it('reconnaît un bulletin de paie', () => {
    expect(type('Bulletin de paie octobre.pdf')).toBe('paie');
    expect(type('fiches-paye-2026.zip')).toBe('paie');
    expect(type('Document RH', 'BULLETIN DE SALAIRE\nSalaire de base 2 100,00\nNet à payer 1 652,30')).toBe('paie');
  });

  it("reconnaît une pièce d'identité", () => {
    expect(type('CNI gérant.jpg')).toBe('identite');
    expect(type('Passeport_M_Hoarau.pdf')).toBe('identite');
    expect(type('scan.pdf', 'IDFRAHOARAU<<<<<<<<<<<<<<<<<<<<<974123\n8801234567890JEAN<<PAUL<8501012M5')).toBe('identite');
    expect(type('Dossier salarié', "Carte nationale d'identité n° 880197412345 — Né le 01/01/1985 à Saint-Denis")).toBe('identite');
  });

  it('reconnaît un numéro de sécurité sociale valide, Corse comprise', () => {
    expect(nirValide('1 85 05 78 006 084 91')).toBe(true);
    expect(nirValide('1 85 05 78 006 084 90')).toBe(false);
    expect(nirValide('185022A00401222')).toBe(true);
    expect(type('Liste du personnel', 'Jean Hoarau — 1 85 05 78 006 084 91 — menuisier')).toBe('securite_sociale');
  });

  it('laisse passer les documents ordinaires', () => {
    expect(type('Plaquette 2026.pdf', 'Menuiserie Hoarau, 12 rue des Flamboyants. Tél. 0262 12 34 56. SIRET 123 456 789 00012.')).toBeNull();
    expect(type('Tarifs', 'Pose de fenêtre : 480 € HT. Devis gratuit. Référence FR76-FENETRE-2026.')).toBeNull();
    expect(type('Procédure de paie', 'Chaque mois, le cabinet établit les bulletins de paie et nous les envoie.')).toBeNull();
    expect(type('Offre voyage', 'Pensez à vérifier la validité de votre passeport avant le départ.')).toBeNull();
    expect(type('Tribune.txt', 'Notre contribution au débat.')).toBeNull();
    expect(type('Numéros utiles', 'Commande 1 85 05 78 006 084 90')).toBeNull();
  });

  it('explique au client pourquoi la ressource est désactivée', () => {
    const s = detecterSensible('RIB.pdf', '')!;
    expect(messageSensible(s)).toContain('coordonnées bancaires');
    expect(messageSensible(s)).toContain('vos agents ne le lisent pas');
  });

  it('distingue la colonne absente des autres erreurs', () => {
    expect(colonneSensibleAbsente({ message: 'column studio_documents.sensible does not exist' })).toBe(true);
    expect(colonneSensibleAbsente({ message: "Could not find the 'sensible' column of 'studio_documents'" })).toBe(true);
    expect(colonneSensibleAbsente({ message: 'duplicate key value' })).toBe(false);
    expect(colonneSensibleAbsente(null)).toBe(false);
  });
});
