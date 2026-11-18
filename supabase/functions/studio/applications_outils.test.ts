import { describe, expect, it } from 'vitest';
import {
  APPS_OUTILLEES, apercuActionApp, consigneApps, dateGa, definitionsApps, executerOutilApp, lignesRapport,
  markdownVersHtml, modifierActionApp, titreActionApp, type ActionApp,
} from './applications_outils';
import { APPLICATIONS } from './applications';
import { apercuAction, modifierAction, titreAction } from './outils';

const c = (id: string, app: string, a_reconnecter = false) => ({ id, app, nom: `Compte ${app}`, a_reconnecter });

describe('outils des applications reliées', () => {
  it('ne propose que les outils des applications connectées et valides', () => {
    expect(definitionsApps([])).toEqual([]);
    expect(definitionsApps([c('1', 'slack'), c('2', 'stripe')])).toEqual([]);
    expect(definitionsApps([c('1', 'hubspot', true)])).toEqual([]);
    const noms = (l: ReturnType<typeof definitionsApps>) => l.map((d) => d.function.name);
    expect(noms(definitionsApps([c('1', 'googleanalytics')]))).toEqual(['app_site_audience']);
    expect(noms(definitionsApps([c('1', 'wordpress')]))).toEqual(['app_blog_articles', 'app_blog_proposer_article']);
    expect(noms(definitionsApps([c('1', 'shopify')]))).toContain('app_boutique_commandes');
    expect(noms(definitionsApps([c('1', 'shopify')]))).toContain('app_blog_proposer_article');
    for (const a of APPS_OUTILLEES) expect(Object.keys(APPLICATIONS)).toContain(a);
  });
  it('indique à l\'agent quels outils vont avec quel compte', () => {
    const t = consigneApps([c('a1', 'hubspot'), c('a2', 'slack')]);
    expect(t).toContain('a1 : HubSpot');
    expect(t).toContain('app_crm_rechercher');
    expect(t).toMatch(/a2 : Slack.*aucun outil/);
    expect(consigneApps([])).toBe('');
  });
  it('refuse un compte inconnu, à reconnecter, ou un outil d\'une autre application', async () => {
    const comptes = [c('a1', 'hubspot'), c('a2', 'youtube', true)];
    expect(await executerOutilApp('app_crm_rechercher', { compte: 'zz' }, comptes)).toMatchObject({ libelle: 'Compte inconnu' });
    expect(await executerOutilApp('app_youtube_proposer_video', { compte: 'a2' }, comptes)).toMatchObject({ libelle: 'Compte à reconnecter' });
    expect(await executerOutilApp('app_site_audience', { compte: 'a1' }, comptes)).toMatchObject({ libelle: 'Outil inadapté' });
  });
  it('prépare un contact, une note et une vidéo sans rien envoyer', async () => {
    const comptes = [c('a1', 'hubspot'), c('a2', 'youtube')];
    const contact = await executerOutilApp('app_crm_proposer_contact', { compte: 'a1', prenom: 'Marie', nom: 'Payet', email: 'MARIE@x.re', note: 'Vue au salon' }, comptes);
    expect(contact).toMatchObject({ proposer: { type: 'app_crm_contact', email: 'marie@x.re', titre: 'Marie Payet', contenu: 'Vue au salon' } });
    expect(await executerOutilApp('app_crm_proposer_contact', { compte: 'a1', nom: 'X', email: 'pas-un-mail' }, comptes)).toMatchObject({ libelle: 'Contact non préparé' });
    expect(await executerOutilApp('app_crm_proposer_note', { compte: 'a1', contact_id: '../x', note: 'n' }, comptes)).toMatchObject({ libelle: 'Note non préparée' });
    const video = await executerOutilApp('app_youtube_proposer_video', { compte: 'a2', video: 'https://cdn.x.re/v.mp4', titre: 'Visite' }, comptes);
    expect(video).toMatchObject({ proposer: { type: 'app_youtube_video', visibilite: 'private' } });
    expect(await executerOutilApp('app_youtube_proposer_video', { compte: 'a2', video: 'http://x/v.mp4', titre: 'V' }, comptes)).toMatchObject({ libelle: 'Vidéo non préparée' });
  });
  it('convertit le Markdown d\'un article en HTML sûr', () => {
    const h = markdownVersHtml('## Titre\n\nUn **mot** et un [lien](https://x.re/a).\n\n- un\n- deux\n\n<script>alert(1)</script>');
    expect(h).toContain('<h2>Titre</h2>');
    expect(h).toContain('<strong>mot</strong>');
    expect(h).toContain('<a href="https://x.re/a">lien</a>');
    expect(h).toContain('<ul>\n<li>un</li>\n<li>deux</li>\n</ul>');
    expect(h).not.toContain('<script>');
  });
  it('lit un rapport Google Analytics et valide les dates', () => {
    expect(lignesRapport({
      dimensionHeaders: [{ name: 'sessionSource' }], metricHeaders: [{ name: 'sessions' }, { name: 'engagementRate' }],
      rows: [{ dimensionValues: [{ value: 'google' }], metricValues: [{ value: '1840' }, { value: '0.61234' }] }],
    })).toEqual([{ sessionSource: 'google', sessions: 1840, engagementRate: 0.61 }]);
    expect(dateGa('2026-11-01', 'x')).toBe('2026-11-01');
    expect(dateGa('7daysAgo', 'x')).toBe('7daysAgo');
    expect(dateGa('hier; drop', 'yesterday')).toBe('yesterday');
  });
  it('affiche et modifie un livrable d\'application comme les autres', () => {
    const a: ActionApp = { type: 'app_blog_article', compte: { id: 'a1', app: 'wordpress', nom: 'Mon site' }, blog_id: 'b1', blog_titre: 'Actus', titre: 'Noël', contenu: 'Texte', publier: false };
    expect(titreAction(a)).toBe(titreActionApp(a));
    expect(apercuAction(a)).toBe(apercuActionApp(a));
    expect(apercuAction(a)).toContain('en brouillon');
    expect(modifierAction(a, { titre: 'Noël 2026', contenu: 'Nouveau' })).toMatchObject({ titre: 'Noël 2026', contenu: 'Nouveau', blog_id: 'b1', compte: { id: 'a1' } });
    expect(modifierActionApp(a, { contenu: '' })).toEqual({ erreur: 'Le texte ne peut pas être vide.' });
  });
});
