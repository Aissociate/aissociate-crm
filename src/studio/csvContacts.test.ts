import { describe, expect, it } from 'vitest';
import { lireCsvContacts } from './csvContacts';

describe('lireCsvContacts', () => {
  it('reconnaît les colonnes et le séparateur', () => {
    const csv = '﻿Prénom;Nom;E-mail\nLéa;Martin;lea@x.fr\n"Jean; fils";"Du ""Pont""";jean@y.fr\n';
    expect(lireCsvContacts(csv)).toEqual([
      { email: 'lea@x.fr', prenom: 'Léa', nom: 'Martin' },
      { email: 'jean@y.fr', prenom: 'Jean; fils', nom: 'Du "Pont"' },
    ]);
  });
  it('accepte une liste sans en-tête', () => {
    expect(lireCsvContacts('a@b.fr\nc@d.fr')).toEqual([{ email: 'a@b.fr' }, { email: 'c@d.fr' }]);
    expect(lireCsvContacts('first name,email\nAna,ana@z.io')).toEqual([{ email: 'ana@z.io', prenom: 'Ana' }]);
    expect(lireCsvContacts('rien ici')).toEqual([]);
  });
});
