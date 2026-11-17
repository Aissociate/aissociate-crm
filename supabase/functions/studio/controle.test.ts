import { describe, expect, it } from 'vitest';
import { bilan, fusionner, mailAlerte, motDePasseDuMail, reponsesFactices, type Resultat } from './controle_rapport';
import { validerReponses } from './questionnaire';

const r = (id: string, niveau: Resultat['niveau'], extra: Partial<Resultat> = {}): Resultat =>
  ({ id, etape: 'Parcours', titre: `Contrôle ${id}`, niveau, detail: `détail ${id}`, duree_ms: 10, ...extra });

describe('contrôle du parcours client', () => {
  it('produit des réponses que le questionnaire accepte', () => {
    expect(validerReponses(reponsesFactices())).toBeNull();
  });

  it('retrouve le mot de passe provisoire dans l\'e-mail d\'identifiants', () => {
    // Même ligne que mailIdentifiants (courriel.ts).
    expect(motDePasseDuMail('Identifiant : a@b.re\nMot de passe provisoire : abcd-EFGH-23\n')).toBe('abcd-EFGH-23');
    expect(motDePasseDuMail('sans mot de passe')).toBeNull();
  });

  it('distingue un problème confirmé d\'un incident passager', () => {
    const premier = [r('a', 'ok'), r('b', 'erreur'), r('c', 'erreur'), r('d', 'alerte')];
    const second = [r('a', 'ok'), r('b', 'erreur', { detail: 'toujours' }), r('c', 'ok'), r('d', 'alerte')];
    const f = fusionner(premier, second);
    expect(f.find((x) => x.id === 'b')).toMatchObject({ verification: 'confirme', detail: 'toujours' });
    expect(f.find((x) => x.id === 'c')).toMatchObject({ verification: 'intermittent', niveau: 'erreur' });
    expect(bilan(f)).toEqual({ erreurs: 1, alertes: 1, intermittents: 1, ok: 1 });
  });

  it('rédige une alerte avec constat, cause et solution', () => {
    const m = mailAlerte([r('a', 'ok'), r('b', 'erreur', { diagnostic: 'Secret faux', solution: 'Recopier le secret', verification: 'confirme' })], new Date('2026-11-18T02:00:00Z'));
    expect(m.objet).toContain('1 problème');
    expect(m.texte).toContain('Cause probable : Secret faux');
    expect(m.texte).toContain('Solution préconisée : Recopier le secret');
    expect(m.html).toContain('Confirmé');
    expect(mailAlerte([r('a', 'ok')], new Date()).objet).toContain('rétabli');
  });
});
