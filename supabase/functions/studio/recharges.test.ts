import { describe, expect, it } from 'vitest';
import { coutsEffectifs, messageEpuise, packsEffectifs, PACKS_DEFAUT, COUTS_DEFAUT } from './recharges';

describe('recharges', () => {
  it('prend les packs des Paramètres, puis ceux du client quand ils sont renseignés', () => {
    expect(packsEffectifs({}, null)).toEqual(PACKS_DEFAUT);
    const cfg = { recharge_petit_prix_ht: '12', recharge_petit_credits: '120', recharge_grand_prix_ht: '30', recharge_grand_credits: '400' };
    expect(packsEffectifs(cfg, null)).toEqual([{ prix: 12, credits: 120 }, { prix: 30, credits: 400 }]);
    // Pack client partiel : les champs vides retombent sur les Paramètres.
    expect(packsEffectifs(cfg, [{ prix: 9 }, { credits: 500 }])).toEqual([{ prix: 9, credits: 120 }, { prix: 30, credits: 500 }]);
    expect(packsEffectifs(cfg, [{ prix: -1, credits: 'x' }])).toEqual([{ prix: 12, credits: 120 }, { prix: 30, credits: 400 }]);
  });
  it('lit les coûts en crédits, avec les valeurs par défaut', () => {
    expect(coutsEffectifs({})).toEqual(COUTS_DEFAUT);
    expect(coutsEffectifs({ recharge_cout_video: '40', recharge_cout_image: '' })).toEqual({ demande: 1, image: 5, video: 40 });
  });
  it('oriente vers la recharge ou vers Aissociate selon le réglage du client', () => {
    expect(messageEpuise('demande', 300, true)).toContain('Mon périmètre');
    expect(messageEpuise('video', 5, false)).toContain('5 vidéos');
    expect(messageEpuise('video', 5, false)).toContain('Contactez Aissociate');
  });
});
