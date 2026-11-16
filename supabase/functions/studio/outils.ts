// Outils des agents (appel de fonctions OpenRouter).
//
// Toujours disponibles : les compétences et ressources de l'espace.
// - competence_enregistrer : l'agent écrit une fiche « Compétence — … » dans Notes
//   (méthode réutilisable) ; elle rejoint les ressources de l'espace.
// - ressource_lire : l'agent relit en entier une note, une compétence ou un fichier.
// Selon les connexions Nango de l'espace : Google Drive.
// - Lecture : exécutée pendant la conversation, tracée au journal.
// - Écriture : l'agent PROPOSE ; la proposition devient un livrable « à valider »
//   portant l'action à exécuter. Le dépôt a lieu au « VALIDÉ » du propriétaire.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { creerDocument, lire, lister, rechercher, type FichierDrive } from "./drive.ts";
import { jetonAcces } from "./nango.ts";
import { journaliser } from "./journal.ts";
import { refLivrable } from "./liaison.ts";

export type DefinitionOutil = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};
export type ActionLivrable = { type: "drive_creer_document"; titre: string; contenu: string; dossier_id?: string | null };

const DRIVE = "google-drive";
export const PREFIXE_COMPETENCE = "Compétence — ";
const COMPETENCE_MAX = 20_000;

const DEFINITIONS_BASE: DefinitionOutil[] = [
  {
    type: "function", function: {
      name: "ressource_lire",
      description: "Lit en entier une ressource de l'entreprise (note, compétence ou fichier importé) à partir de son titre exact, tel qu'il figure dans l'index des ressources.",
      parameters: { type: "object", properties: { titre: { type: "string" } }, required: ["titre"] },
    },
  },
  {
    type: "function", function: {
      name: "competence_enregistrer",
      description: "Enregistre (ou met à jour) une fiche de compétence dans les Notes de l'entreprise : une méthode, une procédure ou des règles réutilisables pour les prochaines missions. Contenu en Markdown : quand l'utiliser, étapes, règles, exemple.",
      parameters: {
        type: "object",
        properties: {
          titre: { type: "string", description: "Nom court de la compétence, ex. « Relance devis non signé »" },
          contenu: { type: "string", description: "La fiche complète, en Markdown" },
        },
        required: ["titre", "contenu"],
      },
    },
  },
];

/** Consigne des outils de base, avec l'index des ressources actives (titres). */
export function consigneBase(index: string[]): string {
  const competences = index.filter((t) => t.startsWith(PREFIXE_COMPETENCE));
  const autres = index.filter((t) => !t.startsWith(PREFIXE_COMPETENCE));
  return [
    "## Outils : compétences et ressources de l'entreprise",
    competences.length ? `Compétences enregistrées :\n${competences.map((t) => `- ${t}`).join("\n")}` : "Aucune compétence enregistrée pour l'instant.",
    autres.length ? `Autres ressources (notes et fichiers) :\n${autres.map((t) => `- ${t}`).join("\n")}` : "",
    "- Avant une mission, si une compétence ou une ressource de cet index s'y rapporte, lis-la avec ressource_lire (titre exact) et applique-la. Les extraits donnés plus haut peuvent être tronqués.",
    "- Quand l'utilisateur te donne une méthode, des règles ou une façon de faire réutilisable, ou te demande de « retenir » quelque chose, enregistre-la avec competence_enregistrer et signale-le en une ligne. Ne l'utilise pas pour une information ponctuelle.",
  ].filter(Boolean).join("\n");
}

/** Titre normalisé d'une compétence (préfixe unique, sans doublon « Compétence : »). */
export function titreCompetence(brut: string): string {
  const t = brut.replace(/^\s*Comp[ée]tence\s*[—:–-]\s*/i, "").trim().slice(0, 150);
  return t ? PREFIXE_COMPETENCE + t : "";
}

const DEFINITIONS_DRIVE: DefinitionOutil[] = [
  {
    type: "function", function: {
      name: "drive_rechercher",
      description: "Cherche des fichiers dans le Google Drive de l'entreprise, par nom ou par contenu. Renvoie id, nom, type, date et lien.",
      parameters: { type: "object", properties: { requete: { type: "string", description: "Mots à chercher" } }, required: ["requete"] },
    },
  },
  {
    type: "function", function: {
      name: "drive_lister",
      description: "Liste les fichiers les plus récents du Drive, ou le contenu d'un dossier si son id est donné.",
      parameters: { type: "object", properties: { dossier_id: { type: "string", description: "Id du dossier (facultatif)" } } },
    },
  },
  {
    type: "function", function: {
      name: "drive_lire",
      description: "Lit le contenu texte d'un fichier du Drive (Google Docs, Sheets en CSV, Slides, fichiers texte). Utilise l'id renvoyé par drive_rechercher ou drive_lister.",
      parameters: { type: "object", properties: { fichier_id: { type: "string" } }, required: ["fichier_id"] },
    },
  },
  {
    type: "function", function: {
      name: "drive_creer_document",
      description: "Propose de créer un Google Doc dans le Drive. Le document n'est PAS créé tout de suite : il est soumis à la validation du propriétaire de l'espace, puis déposé automatiquement s'il est validé. Le contenu est en Markdown simple (titres #, listes -, **gras**).",
      parameters: {
        type: "object",
        properties: {
          titre: { type: "string", description: "Nom du document" },
          contenu: { type: "string", description: "Contenu complet du document, en Markdown" },
          dossier_id: { type: "string", description: "Id du dossier de destination (facultatif)" },
        },
        required: ["titre", "contenu"],
      },
    },
  },
];

export const CONSIGNE_DRIVE = `## Outils : Google Drive de l'entreprise
Tu as accès au Google Drive de l'entreprise par des outils :
- drive_rechercher, drive_lister, drive_lire : pour retrouver et lire des documents. Utilise-les dès que la demande porte sur un document existant, au lieu de demander à l'utilisateur de le coller.
- drive_creer_document : pour déposer un document dans le Drive. Il n'est créé qu'après validation du propriétaire : dis-le clairement dans ta réponse, avec la référence renvoyée par l'outil.
Tu ne peux ni modifier, ni déplacer, ni supprimer, ni partager un fichier existant. Cite le nom des fichiers consultés.`;

type Ctx = {
  sb: SupabaseClient; wsId: string; acteur: string; agentId: string; conversationId: string;
  agentPrenom?: string; userId?: string | null;
};
export type Outils = {
  definitions: DefinitionOutil[];
  consigne: string;
  executer: (nom: string, argsJson: string) => Promise<{ resultat: string; libelle: string; fichiers?: string[] }>;
};

const resume = (f: FichierDrive) => ({ id: f.id, nom: f.name, type: f.mimeType.replace("application/vnd.google-apps.", "google-"), modifie: f.modifiedTime?.slice(0, 10), lien: f.webViewLink });

/** Outils de l'espace : compétences et ressources toujours, Drive s'il est connecté. */
export async function outilsEspace(ctx: Ctx): Promise<Outils> {
  const [{ data: cnx }, { data: docs }] = await Promise.all([
    ctx.sb.from("studio_nango_connexions").select("integration_id")
      .eq("workspace_id", ctx.wsId).eq("integration_id", DRIVE).eq("statut", "connecte").maybeSingle(),
    ctx.sb.from("studio_documents").select("titre").eq("workspace_id", ctx.wsId).eq("actif", true)
      .order("created_at", { ascending: false }).limit(80),
  ]);
  const drive = Boolean(cnx);
  const index = (docs ?? []).map((d) => String(d.titre));

  let jeton: string | null = null;
  const acces = async () => (jeton ??= await jetonAcces(ctx.sb, ctx.wsId, DRIVE));

  return {
    definitions: drive ? [...DEFINITIONS_BASE, ...DEFINITIONS_DRIVE] : DEFINITIONS_BASE,
    consigne: drive ? `${consigneBase(index)}\n\n${CONSIGNE_DRIVE}` : consigneBase(index),
    async executer(nom, argsJson) {
      let a: Record<string, string> = {};
      try { a = JSON.parse(argsJson || "{}"); } catch { return { resultat: "Arguments illisibles.", libelle: "Outil" }; }
      try {
        if (nom === "ressource_lire") {
          const titre = String(a.titre ?? "").trim();
          const base = () => ctx.sb.from("studio_documents").select("titre, contenu").eq("workspace_id", ctx.wsId).eq("actif", true);
          const exact = (await base().eq("titre", titre).limit(1).maybeSingle()).data;
          const doc = exact ?? (titre ? (await base().ilike("titre", `%${titre.replace(/[%_\\]/g, "")}%`).limit(1).maybeSingle()).data : null);
          if (!doc) return { resultat: `Aucune ressource active intitulée « ${titre} ».`, libelle: `Ressource introuvable : « ${titre} »` };
          return { resultat: `# ${doc.titre}\n${String(doc.contenu).slice(0, 30_000)}`, libelle: `Lecture de « ${doc.titre} »` };
        }
        if (nom === "competence_enregistrer") {
          const titre = titreCompetence(String(a.titre ?? ""));
          const contenu = String(a.contenu ?? "").trim().slice(0, COMPETENCE_MAX);
          if (!titre || !contenu) return { resultat: "Titre et contenu requis.", libelle: "Compétence" };
          const signe = `${contenu}\n\n_Fiche rédigée par ${ctx.agentPrenom ?? "un agent"} le ${new Date().toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion" })}._`;
          const { data: existe } = await ctx.sb.from("studio_documents").select("id")
            .eq("workspace_id", ctx.wsId).eq("titre", titre).limit(1).maybeSingle();
          const { error } = existe
            ? await ctx.sb.from("studio_documents").update({ contenu: signe, actif: true }).eq("id", existe.id)
            : await ctx.sb.from("studio_documents").insert({ workspace_id: ctx.wsId, titre, contenu: signe, type: "note", created_by: ctx.userId ?? null });
          if (error) return { resultat: `Enregistrement impossible : ${error.message}`, libelle: "Compétence non enregistrée" };
          await journaliser(ctx.sb, { wsId: ctx.wsId, acteur: ctx.acteur, agentId: ctx.agentId, action: "competence_enregistree", detail: { titre, mise_a_jour: Boolean(existe) } });
          return {
            resultat: `Compétence « ${titre} » ${existe ? "mise à jour" : "enregistrée"} dans les Notes de l'entreprise (rubrique Mes ressources). Elle sera relue lors des prochaines missions.`,
            libelle: `${existe ? "Compétence mise à jour" : "Nouvelle compétence"} : « ${titre.slice(PREFIXE_COMPETENCE.length)} »`,
          };
        }
        if (nom.startsWith("drive_") && !drive) return { resultat: "Le Google Drive n'est pas connecté à cet espace.", libelle: "Drive non connecté" };
        if (nom === "drive_rechercher") {
          const f = await rechercher(await acces(), String(a.requete ?? ""));
          await journaliser(ctx.sb, { wsId: ctx.wsId, acteur: ctx.acteur, agentId: ctx.agentId, action: "drive_recherche", detail: { requete: a.requete, resultats: f.length } });
          return { resultat: JSON.stringify(f.map(resume)), libelle: `Recherche dans le Drive : « ${a.requete} »` };
        }
        if (nom === "drive_lister") {
          const f = await lister(await acces(), a.dossier_id || null);
          return { resultat: JSON.stringify(f.map(resume)), libelle: "Parcours du Drive" };
        }
        if (nom === "drive_lire") {
          const r = await lire(await acces(), String(a.fichier_id ?? ""));
          await journaliser(ctx.sb, { wsId: ctx.wsId, acteur: ctx.acteur, agentId: ctx.agentId, action: "drive_lecture", detail: { fichier: r.fichier.id, titre: r.fichier.name } });
          return {
            resultat: `# ${r.fichier.name}\n${r.texte}${r.tronque ? "\n(… document tronqué)" : ""}`,
            libelle: `Lecture de « ${r.fichier.name} »`, fichiers: [r.fichier.name],
          };
        }
        if (nom === "drive_creer_document") {
          const titre = String(a.titre ?? "").trim().slice(0, 200), contenu = String(a.contenu ?? "").trim().slice(0, 100_000);
          if (!titre || !contenu) return { resultat: "Titre et contenu requis.", libelle: "Proposition de document" };
          const action: ActionLivrable = { type: "drive_creer_document", titre, contenu, dossier_id: a.dossier_id || null };
          const { data: l, error } = await ctx.sb.from("studio_livrables").insert({
            workspace_id: ctx.wsId, conversation_id: ctx.conversationId, agent_id: ctx.agentId,
            titre: `Drive — ${titre}`, contenu, soumis_par: ctx.acteur, action,
          }).select("id").single();
          if (error) return { resultat: `Proposition impossible : ${error.message}`, libelle: "Proposition de document" };
          await journaliser(ctx.sb, { wsId: ctx.wsId, acteur: ctx.acteur, agentId: ctx.agentId, action: "livrable_soumis", detail: { livrable: l.id, titre: `Drive — ${titre}` } });
          return {
            resultat: `Proposition enregistrée sous la référence ${refLivrable(l.id)}. Le document « ${titre} » sera créé dans le Drive dès que le propriétaire l'aura validé (rubrique Livrables, ou réponse « VALIDÉ ${refLivrable(l.id)} » par e-mail).`,
            libelle: `Proposition de document « ${titre} » (à valider)`,
          };
        }
        return { resultat: `Outil inconnu : ${nom}`, libelle: nom };
      } catch (e) {
        return { resultat: `Erreur : ${e instanceof Error ? e.message : String(e)}`, libelle: nom.startsWith("drive_") ? "Drive indisponible" : "Outil indisponible" };
      }
    },
  };
}

/** Exécute l'action d'un livrable validé. Renvoie le résultat à enregistrer. */
export async function executerAction(sb: SupabaseClient, wsId: string, action: ActionLivrable): Promise<{ ok: true; lien: string | null; id: string } | { ok: false; erreur: string }> {
  try {
    if (action.type === "drive_creer_document") {
      const f = await creerDocument(await jetonAcces(sb, wsId, DRIVE), { titre: action.titre, contenu: action.contenu, dossierId: action.dossier_id });
      return { ok: true, id: f.id, lien: f.webViewLink ?? null };
    }
    return { ok: false, erreur: "Action inconnue" };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) };
  }
}
