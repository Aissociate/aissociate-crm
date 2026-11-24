import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Contact } from '@/lib/database.types';

/**
 * Champs éditables de la fiche et leur enregistrement : miroir optimiste, écriture après une pause
 * de frappe, à la sortie du champ et à la fermeture de la fiche.
 */
export function useEditionContact(c: Contact, onUpdated: () => void) {
  // ── Champs de suivi éditables ───────────────────────────────────────────────
  const [form, setForm] = useState({
    statut_entreprise: c.statut_entreprise ?? '', ville: c.ville ?? '', effectif: c.effectif ?? '',
    siret: c.siret ?? '', autres: c.autres ?? '', notes: c.notes ?? '',
    email2: c.email2 ?? '', email2_libelle: c.email2_libelle ?? '',
    email3: c.email3 ?? '', email3_libelle: c.email3_libelle ?? '',
    besoin_resume: c.besoin_resume ?? '', formation_envisagee: c.formation_envisagee ?? '',
    financement_envisage: c.financement_envisage ?? '', interet: c.interet ?? '',
    responsable_id: c.responsable_id ?? '', date_formation: c.date_formation ?? '',
    assiette_commission: c.assiette_commission ?? '',
  });
  const setFf = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const [savingSec, setSavingSec] = useState<string | null>(null);
  // Miroir local optimiste (la prop `c` reste figée tant que la liste n'est pas rechargée)
  const [over, setOver] = useState<Partial<Contact>>({});
  useEffect(() => { setOver({}); }, [c.id]);
  const cc = { ...c, ...over } as Contact;

  // `onUpdated` change d'identité à chaque rendu du parent : on le lit via une ref
  // pour garder `flushSave` stable (sinon l'effet de démontage se relancerait sans cesse).
  const updatedRef = useRef(onUpdated);
  updatedRef.current = onUpdated;

  // Un UPDATE refusé par les droits (RLS) ne renvoie PAS d'erreur : il ne touche
  // simplement aucune ligne. On demande donc l'id en retour pour le détecter.
  const writeContact = async (fields: Partial<Contact>, id: string): Promise<boolean> => {
    const { data, error } = await supabase.from('contacts').update(fields).eq('id', id).select('id');
    if (error) { alert(`Enregistrement impossible : ${error.message}`); return false; }
    if (!data || data.length === 0) { alert("Enregistrement refusé : ce contact ne vous est pas attribué."); return false; }
    return true;
  };

  const saveSection = async (key: string, fields: Partial<Contact>) => {
    setSavingSec(key);
    const ok = await writeContact(fields, c.id);
    setSavingSec(null);
    if (ok) onUpdated();
  };
  const patch = async (fields: Partial<Contact>) => {
    setOver((o) => ({ ...o, ...fields }));
    if (await writeContact(fields, c.id)) onUpdated();
  };

  // ── Enregistrement des champs libres ────────────────────────────────────────
  // Écriture à la sortie du champ, MAIS aussi après une pause de frappe et à la
  // fermeture de la fiche : se fier au seul `onBlur` perdait la saisie dès que la
  // fiche disparaissait alors que le champ avait encore le focus (clic sur un lien
  // interne, navigation, onglet fermé) — ticket « qualification non enregistrée ».
  const [savedField, setSavedField] = useState<string | null>(null);
  const pending = useRef<Partial<Contact>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactId = c.id;

  const flushSave = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const fields = pending.current;
    const keys = Object.keys(fields);
    if (!keys.length) return;
    pending.current = {};
    if (!(await writeContact(fields, contactId))) return;
    setSavedField(keys[keys.length - 1]);
    setTimeout(() => setSavedField((s) => (s && keys.includes(s) ? null : s)), 1500);
    updatedRef.current();
  }, [contactId]);

  const queueSave = useCallback((field: keyof Contact, value: string) => {
    setOver((o) => ({ ...o, [field]: value || null }));
    (pending.current as Record<string, unknown>)[field as string] = value || null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flushSave(); }, 1200);
  }, [flushSave]);

  // Saisie : met à jour le champ affiché et programme l'écriture.
  const editField = (field: keyof Contact, value: string) => {
    setFf(field as string, value);
    queueSave(field, value);
  };
  const blurSave = (field: keyof Contact, value: string) => {
    // La comparaison porte sur le miroir `cc` (et non sur la prop `c`, figée) sans quoi
    // un retour à la valeur d'origine était considéré « inchangé » et n'était pas réécrit.
    if ((cc[field] ?? '') !== value) queueSave(field, value);
    void flushSave();
  };
  // Dernier filet : ce qui reste en attente part au démontage de la fiche.
  useEffect(() => () => { void flushSave(); }, [flushSave]);

  return { form, setFf, savingSec, cc, saveSection, patch, savedField, editField, blurSave };
}
export type EditionContact = ReturnType<typeof useEditionContact>;
