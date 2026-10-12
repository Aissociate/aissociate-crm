import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appliquerAnnulation, instantane, planAnnulation } from '../../../supabase/functions/agent/annulation';
import { decrireMetier, executerMetier, type CtxMetier } from '../../../supabase/functions/agent/outils_metier';
import { MODELE_STT_DEFAUT, MODELE_STT_SECOURS, transcrire } from '../../../supabase/functions/_shared/stt';
import { fauxDb, type FauxDb } from './fauxSupabase';

const client = (db: FauxDb) => db as unknown as SupabaseClient;
const ctx = (db: FauxDb, extra: Partial<CtxMetier> = {}): CtxMetier => ({
  db: client(db), user: { id: 'moi' }, isDirection: true, finances: true, droits: {}, ...extra,
});
const exec = (db: FauxDb) => ({ db: client(db), authHeader: 'Bearer x', supabaseUrl: 'http://local', origin: 'http://crm' });

describe('planAnnulation', () => {
  it('refuse les envois, qui ne se rappellent pas', () => {
    const p = planAnnulation('proposer_envoi_email', {}, { entite: 'emails', entite_id: 'e1' }, []);
    expect(p.possible).toBe(false);
  });

  it('supprime le devis puis le dossier ouvert pour lui', () => {
    const p = planAnnulation('proposer_creation_devis', {}, {
      entite: 'devis', entite_id: 'd1', resultat: { dossier_id: 'dos1', dossier_cree: true },
    }, []);
    expect(p).toEqual({ possible: true, etapes: [
      { op: 'delete', table: 'devis', id: 'd1' },
      { op: 'delete', table: 'dossiers', id: 'dos1' },
    ] });
  });

  it('garde le dossier quand il existait déjà', () => {
    const p = planAnnulation('proposer_creation_devis', {}, {
      entite: 'devis', entite_id: 'd1', resultat: { dossier_id: 'dos1', dossier_cree: false },
    }, []);
    expect(p).toEqual({ possible: true, etapes: [{ op: 'delete', table: 'devis', id: 'd1' }] });
  });

  it("ne défait rien quand le dossier était réutilisé ou l'inscription déjà faite", () => {
    expect(planAnnulation('proposer_creation_dossier', {}, { entite: 'dossiers', entite_id: 'x', resultat: { existait_deja: true } }, []).possible).toBe(false);
    expect(planAnnulation('proposer_inscription_session', {}, { entite: 'session_participants', entite_id: 'x', resultat: { deja_inscrit: true } }, []).possible).toBe(false);
  });

  it("rétablit l'entreprise du contact AVANT de supprimer la nouvelle", () => {
    const avant = [{ op: 'update' as const, table: 'contacts', id: 'c1', valeurs: { entreprise_id: null } }];
    const p = planAnnulation('proposer_creation_entreprise', { contact_id: 'c1' }, { entite: 'entreprises', entite_id: 'e1' }, avant);
    expect(p.possible && p.etapes.map((e) => e.op)).toEqual(['update', 'delete']);
  });
});

describe('instantane', () => {
  it('ne relit que les champs que la mise à jour va écraser', async () => {
    const db = fauxDb({ contacts: [{ id: 'c1', telephone: '0692', ville: 'Saint-Denis', email: 'a@b.re' }] });
    const etapes = await instantane(client(db), 'proposer_maj_contact', { contact_id: 'c1', ville: 'Le Port' });
    expect(etapes).toHaveLength(1);
    expect(etapes[0]).toMatchObject({ op: 'update', table: 'contacts', id: 'c1' });
  });
});

describe('appliquerAnnulation', () => {
  it('refuse de supprimer une fiche déjà utilisée ailleurs', async () => {
    const db = fauxDb({ contacts: [{ id: 'c1' }], devis: [{ id: 'd1', contact_id: 'c1' }] });
    const r = await appliquerAnnulation(client(db), [{ op: 'delete', table: 'contacts', id: 'c1' }]);
    expect(r.ok).toBe(false);
    expect(db.tables.contacts).toHaveLength(1);
  });

  it('restaure puis supprime, dans l’ordre', async () => {
    const db = fauxDb({ contacts: [{ id: 'c1', entreprise_id: 'e1' }], entreprises: [{ id: 'e1' }] });
    const r = await appliquerAnnulation(client(db), [
      { op: 'update', table: 'contacts', id: 'c1', valeurs: { entreprise_id: null } },
      { op: 'delete', table: 'entreprises', id: 'e1' },
    ]);
    expect(r.ok).toBe(true);
    expect(db.tables.contacts[0].entreprise_id).toBeNull();
    expect(db.tables.entreprises).toHaveLength(0);
  });
});

describe('outils métier', () => {
  it('décrit un devis avec son total HT', async () => {
    const db = fauxDb({ contacts: [{ id: 'c1', nom: 'Martin', prenom: 'Cyril' }] });
    const d = await decrireMetier(ctx(db), 'proposer_creation_devis', {
      contact_id: 'c1', objet: 'Formation IA',
      lignes: [{ designation: 'Formation', quantite: 3, unite: 'jour', prix_unitaire_ht: 700 }],
    });
    expect(typeof d === 'string' && d).toContain('Cyril Martin');
    expect(typeof d === 'string' && d).toMatch(/2\s?100,00\s?€ HT/);
  });

  it("refuse un contact hors périmètre (introuvable avec la RLS de l'utilisateur)", async () => {
    const d = await decrireMetier(ctx(fauxDb()), 'proposer_maj_contact', { contact_id: 'inconnu', ville: 'X' });
    expect(d).toEqual({ erreur: expect.stringContaining('introuvable') });
  });

  it('exige au moins une demi-journée valide pour l’émargement', async () => {
    const db = fauxDb({ sessions_formation: [{ id: 's1', titre: 'IA' }] });
    const d = await decrireMetier(ctx(db), 'proposer_envoi_emargement', { session_id: 's1', date: '2026-11-02', demi_journees: ['soir'] });
    expect(d).toEqual({ erreur: expect.stringContaining('demi-journée') });
  });

  it("n'écrit sur le contact que les champs autorisés", async () => {
    const db = fauxDb({ contacts: [{ id: 'c1', nom: 'Martin', owner_id: 'quelqu-un' }] });
    const r = await executerMetier(exec(db), 'proposer_maj_contact', { contact_id: 'c1', ville: 'Le Port', owner_id: 'moi' });
    expect(r?.ok).toBe(true);
    expect(db.tables.contacts[0]).toMatchObject({ ville: 'Le Port', owner_id: 'quelqu-un' });
  });

  it("n'inscrit pas deux fois le même contact (même e-mail)", async () => {
    const db = fauxDb({
      contacts: [{ id: 'c1', nom: 'Martin', prenom: 'Cyril', email: 'Cyril@Exemple.re' }],
      session_participants: [{ id: 'p1', session_id: 's1', contact_id: null, email: 'cyril@exemple.re' }],
    });
    const r = await executerMetier(exec(db), 'proposer_inscription_session', { session_id: 's1', contact_id: 'c1' });
    expect(r).toMatchObject({ ok: true, entite_id: 'p1', resultat: { deja_inscrit: true } });
    expect(db.tables.session_participants).toHaveLength(1);
  });

  it('crée le devis, ses lignes et le dossier client manquant', async () => {
    const db = fauxDb({ contacts: [{ id: 'c1', nom: 'Martin', prenom: 'Cyril', entreprise_id: null }] });
    const r = await executerMetier(exec(db), 'proposer_creation_devis', {
      contact_id: 'c1', objet: 'Formation IA',
      lignes: [{ designation: 'Formation', quantite: 2, prix_unitaire_ht: 500 }, { designation: 'Support', quantite: 1, prix_unitaire_ht: 100 }],
    });
    expect(r).toMatchObject({ ok: true, entite: 'devis', resultat: { dossier_cree: true } });
    expect(db.tables.devis[0]).toMatchObject({ statut: 'brouillon', total_ht: 1100, tva_exoneree: true, contact_id: 'c1' });
    expect(db.tables.devis_lignes).toHaveLength(2);
    expect(db.tables.dossier_pieces.length).toBeGreaterThan(5);
  });

  it("laisse la main à index.ts pour les outils qu'il ne connaît pas", async () => {
    expect(await executerMetier(exec(fauxDb()), 'proposer_note_contact', {})).toBeNull();
    expect(await decrireMetier(ctx(fauxDb()), 'proposer_note_contact', {})).toBeNull();
  });
});

describe('transcription (stt)', () => {
  const appels: { url: string; corps: Record<string, unknown> }[] = [];
  const repondre = (reponses: Record<string, { ok: boolean; json: unknown }>) => {
    appels.length = 0;
    globalThis.fetch = (async (url: string, init: { body: string }) => {
      appels.push({ url, corps: JSON.parse(init.body) });
      const r = Object.entries(reponses).find(([cle]) => url.includes(cle))![1];
      return { ok: r.ok, status: r.ok ? 200 : 500, json: async () => r.json } as Response;
    }) as unknown as typeof fetch;
  };
  const demande = { apiKey: 'k', audio: 'AAA', format: 'wav', mode: 'dictee' as const };

  it('passe par Gemini en chat, avec le vocabulaire dans la consigne', async () => {
    repondre({ 'chat/completions': { ok: true, json: { choices: [{ message: { content: 'Relance Cyril Tartampion jeudi.' } }] } } });
    const r = await transcrire({ ...demande, vocabulaire: ['Cyril Tartampion'] });
    expect(r).toEqual({ ok: true, texte: 'Relance Cyril Tartampion jeudi.', modele: MODELE_STT_DEFAUT });
    expect(JSON.stringify(appels[0].corps)).toContain('Cyril Tartampion');
  });

  it('bascule sur le modèle de secours si Gemini échoue', async () => {
    repondre({ 'chat/completions': { ok: false, json: {} }, 'audio/transcriptions': { ok: true, json: { text: 'texte brut' } } });
    const r = await transcrire(demande);
    expect(r).toEqual({ ok: true, texte: 'texte brut', modele: MODELE_STT_SECOURS });
  });

  it("n'envoie pas de webm à Gemini : directement le secours", async () => {
    repondre({ 'audio/transcriptions': { ok: true, json: { text: 'ok' } } });
    await transcrire({ ...demande, format: 'webm' });
    expect(appels.map((a) => a.url)).toEqual(['https://openrouter.ai/api/v1/audio/transcriptions']);
  });

  it('un modèle « whisper » configuré utilise la transcription brute', async () => {
    repondre({ 'audio/transcriptions': { ok: true, json: { text: 'ok' } } });
    const r = await transcrire({ ...demande, modele: 'openai/whisper-1' });
    expect(r).toMatchObject({ ok: true, modele: 'openai/whisper-1' });
    expect(appels).toHaveLength(1);
  });
});
