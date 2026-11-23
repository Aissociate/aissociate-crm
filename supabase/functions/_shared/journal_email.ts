// Trace d'un e-mail sortant dans la Messagerie du CRM (table `emails`).
//
// `send-email` ne fait qu'expédier en SMTP : sans ligne `emails`, un envoi est
// invisible dans la Messagerie et l'historique de la fiche. Tous les envois
// faits par une IA ou un automate passent par ici, pour :
//   - dire QUI a envoyé (`origine` + `origine_libelle`) ;
//   - rattacher au contact quand l'adresse est connue ;
//   - ne jamais avaler une erreur d'écriture en silence (console.error).
// La trace ne fait jamais échouer l'envoi : le mail est déjà parti.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type OrigineEmail = "utilisateur" | "ia_assistant" | "ia_studio" | "automatique";

export type LigneEmail = {
  destinataires: string[];
  copie?: string[];
  sujet: string;
  corps: string | null;
  statut?: string;
  contact_id?: string | null;
  dossier_id?: string | null;
  owner_id?: string | null;
  attachments?: unknown[];
  sent_at?: string;
  lu?: boolean;
};

const adresse = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();

/** Contact dont l'e-mail correspond au premier destinataire (lu avec les droits du client passé). */
export async function contactParAdresse(db: SupabaseClient, destinataire: string | undefined): Promise<string | null> {
  const a = destinataire ? adresse(destinataire) : "";
  if (!a || !a.includes("@")) return null;
  try {
    const { data } = await db.from("contacts").select("id").ilike("email", a).limit(1).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Colonne absente (migration pas encore appliquée, ou cache de schéma de l'API pas rechargé). */
const colonneInconnue = (e: { code?: string; message?: string }) =>
  e.code === "PGRST204" || e.code === "42703" || /origine/i.test(e.message ?? "");

/**
 * Insère la ligne `emails` d'un envoi déjà parti. Renvoie son id, ou null si
 * l'écriture a échoué (l'erreur est journalisée côté serveur).
 */
export async function journaliserEmail(
  db: SupabaseClient,
  ligne: LigneEmail,
  origine: { origine: OrigineEmail; libelle: string },
): Promise<string | null> {
  const contactId = ligne.contact_id ?? await contactParAdresse(db, ligne.destinataires[0]);
  const base = {
    destinataires: ligne.destinataires,
    copie: ligne.copie ?? [],
    sujet: ligne.sujet || "(sans objet)",
    corps: ligne.corps,
    statut: ligne.statut ?? "envoye",
    canal: "email",
    direction: "sortant",
    lu: ligne.lu ?? true,
    contact_id: contactId,
    dossier_id: ligne.dossier_id ?? null,
    owner_id: ligne.owner_id ?? null,
    attachments: ligne.attachments ?? [],
    sent_at: ligne.sent_at ?? new Date().toISOString(),
  };
  try {
    let r = await db.from("emails").insert({ ...base, origine: origine.origine, origine_libelle: origine.libelle }).select("id").maybeSingle();
    // Avant la migration `emails_origine` : on garde au moins la trace.
    if (r.error && colonneInconnue(r.error)) r = await db.from("emails").insert(base).select("id").maybeSingle();
    if (r.error) {
      console.error(`[journal_email] trace Messagerie impossible (${origine.libelle} → ${ligne.destinataires.join(", ")}) :`, r.error.message);
      return null;
    }
    return (r.data?.id as string | undefined) ?? null;
  } catch (e) {
    console.error("[journal_email] trace Messagerie impossible :", e instanceof Error ? e.message : e);
    return null;
  }
}
