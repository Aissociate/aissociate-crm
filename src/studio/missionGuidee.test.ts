import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SuperPouvoir } from './api';
import { autonomie, champManquant, etatAgent, guider, recoit, valeursInitiales } from './missionGuidee';

const email: SuperPouvoir = {
  id: 'email', titre: 'Rédiger un e-mail', description: 'Un e-mail prêt à envoyer, au bon ton.',
  champs: [
    { nom: 'destinataire', label: 'À qui ?', type: 'texte', requis: true },
    { nom: 'objectif', label: "Objectif de l'e-mail", type: 'long', requis: true },
    { nom: 'ton', label: 'Ton', type: 'choix', options: ['Cordial', 'Formel', 'Direct', 'Chaleureux'] },
  ],
};
const noteFrais: SuperPouvoir = {
  id: 'note_frais', titre: 'Enregistrer une note de frais',
  champs: [
    { nom: 'date', label: 'Date de la dépense', type: 'texte', requis: true },
    { nom: 'categorie', label: 'Catégorie', type: 'choix', options: ['Repas', 'Carburant'], requis: true },
    { nom: 'montant', label: 'Montant TTC payé', type: 'texte', requis: true },
    { nom: 'tva', label: 'TVA sur le justificatif', type: 'choix', options: ['8,5 %', '20 %'], requis: true },
  ],
};
const rgpd: SuperPouvoir = { id: 'rgpd', titre: 'Check-list RGPD', description: 'Les actions prioritaires pour votre entreprise.', champs: [{ nom: 'donnees', label: 'Données que vous traitez', type: 'long', requis: true }] };
const inconnu: SuperPouvoir = {
  id: 'devis_chantier', titre: 'Devis de chantier', description: 'Un devis détaillé, poste par poste.',
  champs: [
    { nom: 'delai', label: 'Délai souhaité', type: 'choix', options: ['Urgent', 'Dans le mois'], requis: true },
    { nom: 'notes', label: 'Notes', type: 'long' },
  ],
};

describe('mission guidée', () => {
  it('fait du premier champ à choix une question en un clic, et du texte obligatoire la précision', () => {
    const g = guider(email);
    expect(g.choix?.nom).toBe('ton');
    expect(g.question).toBe('Sur quel ton ?');
    expect(g.precision?.nom).toBe('destinataire');
    expect(g.autres.map((c) => c.nom)).toEqual(['objectif']);
  });

  it('garde sous la précision les champs que la question ne couvre pas', () => {
    const g = guider(noteFrais);
    expect(g.choix?.nom).toBe('categorie');
    expect(g.question).toBe('Quelle catégorie de dépense ?');
    expect(g.precision?.nom).toBe('date');
    expect(g.autres.map((c) => c.nom)).toEqual(['montant', 'tva']);
  });

  it("se passe de question quand le pouvoir n'a aucun choix", () => {
    const g = guider(rgpd);
    expect(g.choix).toBeNull();
    expect(g.question).toBe('');
    expect(g.precision?.nom).toBe('donnees');
    expect(g.autres).toEqual([]);
  });

  it('guide aussi un pouvoir ajouté depuis le CRM, et laisse le catalogue reformuler', () => {
    expect(guider(inconnu)).toMatchObject({ question: 'Délai souhaité ?' });
    expect(guider(inconnu).precision?.nom).toBe('notes');
    const reformule = { ...inconnu, champs: [{ ...inconnu.champs[0], question: 'Pour quand ?' }, inconnu.champs[1]] };
    expect(guider(reformule).question).toBe('Pour quand ?');
    expect(guider({ ...email, champs: [{ ...email.champs[2], question: 'Quel ton adopter ?' }] }).question).toBe('Quel ton adopter ?');
  });

  it('dit ce qu\'on reçoit, pas ce que l\'agent fait', () => {
    expect(recoit(email)).toBe('Vous recevez : un e-mail prêt à envoyer, au bon ton.');
    expect(recoit(inconnu)).toBe('Vous recevez : un devis détaillé, poste par poste.');
    expect(recoit({ ...email, recoit: 'Un brouillon dans votre messagerie' })).toBe('Vous recevez : un brouillon dans votre messagerie.');
    expect(recoit({ id: 'x', titre: 'X', champs: [] })).toBe('');
  });

  it('ne présélectionne rien et bloque tant qu\'un champ obligatoire manque', () => {
    const v = valeursInitiales(noteFrais);
    expect(Object.values(v).every((x) => x === '')).toBe(true);
    expect(champManquant(noteFrais, v)?.nom).toBe('date');
    expect(champManquant(noteFrais, { date: '12/11/2026', categorie: 'Repas', montant: '18', tva: 'autre' })?.nom).toBe('tva');
    expect(champManquant(noteFrais, { date: '12/11/2026', categorie: 'Repas', montant: '18', tva: '8,5 %' })).toBeNull();
    // Le ton est facultatif : l'e-mail peut partir sans.
    expect(champManquant(email, { destinataire: 'M. Técher', objectif: 'Relancer son devis', ton: '' })).toBeNull();
  });
});

describe('carte d\'un agent', () => {
  it("n'affiche un état que s'il est utile", () => {
    expect(etatAgent({ decisions: 1, au_travail: true })).toEqual({ texte: '1 décision vous attend', ton: 'attente' });
    expect(etatAgent({ decisions: 3, au_travail: false })).toEqual({ texte: '3 décisions vous attendent', ton: 'attente' });
    expect(etatAgent({ decisions: 0, au_travail: true })).toEqual({ texte: 'Au travail', ton: 'travail' });
    expect(etatAgent({ decisions: 0, au_travail: false })).toBeNull();
    expect(etatAgent(undefined)).toBeNull();
  });

  it('dit ce que chacun fait seul et ce qu\'il demande toujours', () => {
    expect(autonomie('theo').demande).toContain('expert-comptable');
    expect(autonomie('agent_inconnu')).toEqual({ seul: 'Lit, cherche et prépare ce que vous lui demandez.', demande: 'Tout envoi, toute publication, tout dépôt dans vos outils.' });
    for (const id of ['lea', 'hugo', 'sam', 'ines', 'mael', 'nora', 'theo']) expect(autonomie(id).seul.length, id).toBeGreaterThan(20);
  });
});

describe('pouvoirs livrés avec le Studio (migrations)', () => {
  const dossier = join(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');
  const pouvoirs: SuperPouvoir[] = [];
  for (const f of readdirSync(dossier).filter((x) => x.includes('studio'))) {
    const sql = readFileSync(join(dossier, f), 'utf8');
    const re = /super_pouvoirs = (?:super_pouvoirs \|\| )?\$j\$(\[[\s\S]*?\])\$j\$::jsonb\s+where id = '[a-z]+'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) pouvoirs.push(...(JSON.parse(m[1]) as SuperPouvoir[]));
  }

  it('sont tous retrouvés', () => {
    expect(pouvoirs.length).toBe(26);
    expect(new Set(pouvoirs.map((p) => p.id)).size).toBe(26);
  });

  it('ont chacun un résultat annoncé et une question formulée, sans champ perdu', () => {
    for (const p of pouvoirs) {
      // Formulation propre au pouvoir, pas la description reprise telle quelle.
      expect(recoit({ ...p, description: undefined }), p.id).toMatch(/^Vous recevez : \p{Ll}.+\.$/u);
      const g = guider(p);
      if (g.choix) expect(g.question, p.id).toMatch(/^\p{Lu}.+ \?$/u);
      expect(g.precision, p.id).not.toBeNull();
      const couverts = [g.choix, g.precision, ...g.autres].filter(Boolean).map((c) => c!.nom).sort();
      expect(couverts, p.id).toEqual(p.champs.map((c) => c.nom).sort());
    }
  });

  it('ne reprennent pas le libellé brut comme question', () => {
    const bruts = pouvoirs.filter((p) => { const g = guider(p); return g.choix && g.question === `${g.choix.label} ?`; }).map((p) => p.id);
    expect(bruts).toEqual([]);
  });
});
