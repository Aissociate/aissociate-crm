// Contrôle du parcours client : partie pure (testée par vitest), sans accès réseau.
// Données du client fictif, fusion des deux passages, bilan et rédaction de l'e-mail d'alerte.
import { AGENTS_CATALOGUE, SECTIONS, type Reponses } from "./questionnaire.ts";

export const ENTREPRISE = "Contrôle automatique du parcours (à supprimer)";

export type Niveau = "ok" | "alerte" | "erreur" | "ignore";
export type Resultat = {
  id: string; etape: string; titre: string; niveau: Niveau; detail: string;
  diagnostic?: string; solution?: string; duree_ms: number;
  verification?: "confirme" | "intermittent";
};

/** Réponses valides au questionnaire (une valeur par question obligatoire). */
export function reponsesFactices(): Reponses {
  const r: Reponses = {};
  for (const s of SECTIONS) for (const q of s.questions) {
    if (!q.requis) continue;
    r[q.id] = q.id === "agents" ? [AGENTS_CATALOGUE[0].id]
      : q.type === "choix" ? q.options![0]
      : q.type === "multi" ? [q.options![0]]
      : q.type === "ouinon" ? "oui"
      : q.type === "nombre" || q.type === "montant" ? "5"
      : q.type === "date" ? "2027-01-15"
      : "Contrôle automatique du parcours client";
  }
  r.A1 = ENTREPRISE;
  return r;
}

/** Mot de passe provisoire lu dans l'e-mail d'identifiants. */
export function motDePasseDuMail(texte: string): string | null {
  return /Mot de passe provisoire : (\S+)/.exec(texte)?.[1] ?? null;
}

export const enEchec = (r: Resultat) => r.niveau === "erreur" || r.niveau === "alerte";

/** Rejoue une fois les contrôles en échec pour distinguer un problème confirmé d'un incident passager. */
export function fusionner(premier: Resultat[], second: Resultat[]): Resultat[] {
  return premier.map((r) => {
    if (!enEchec(r)) return r;
    const s = second.find((x) => x.id === r.id);
    if (s && enEchec(s)) return { ...s, verification: "confirme" as const };
    return { ...r, verification: "intermittent" as const };
  });
}

export function bilan(res: Resultat[]) {
  const confirmes = res.filter((r) => enEchec(r) && r.verification !== "intermittent");
  return {
    erreurs: confirmes.filter((r) => r.niveau === "erreur").length,
    alertes: confirmes.filter((r) => r.niveau === "alerte").length,
    intermittents: res.filter((r) => r.verification === "intermittent").length,
    ok: res.filter((r) => r.niveau === "ok").length,
  };
}

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function mailAlerte(res: Resultat[], quand: Date) {
  const b = bilan(res);
  const date = quand.toLocaleString("fr-FR", { timeZone: "Indian/Reunion", dateStyle: "full", timeStyle: "short" });
  const problemes = res.filter((r) => enEchec(r));
  const objet = b.erreurs
    ? `🔴 Studio IA : ${b.erreurs} problème(s) dans le parcours client`
    : b.alertes ? `🟠 Studio IA : ${b.alertes} point(s) à surveiller dans le parcours client` : "🟢 Studio IA : parcours client rétabli";
  const bloc = (r: Resultat) => {
    const verif = r.verification === "intermittent" ? "Intermittent : échec au 1er passage, réussi au 2e (20 s plus tard)."
      : r.verification === "confirme" ? "Confirmé : échec reproduit au 2e passage (20 s plus tard)." : "";
    const couleur = r.niveau === "erreur" && r.verification !== "intermittent" ? "#b91c1c" : "#b45309";
    return {
      html: `<div style="border-left:4px solid ${couleur};padding:8px 14px;margin:14px 0;background:#fafaf9">
<p style="margin:0 0 6px"><b>${echapper(r.titre)}</b> <span style="color:#6b7280">· ${echapper(r.etape)}</span></p>
<p style="margin:4px 0"><b>Constat :</b> ${echapper(r.detail)}</p>
${verif ? `<p style="margin:4px 0"><b>Vérification :</b> ${echapper(verif)}</p>` : ""}
${r.diagnostic ? `<p style="margin:4px 0"><b>Cause probable :</b> ${echapper(r.diagnostic)}</p>` : ""}
${r.solution ? `<p style="margin:4px 0"><b>Solution préconisée :</b> ${echapper(r.solution)}</p>` : ""}</div>`,
      texte: [`■ ${r.titre} (${r.etape})`, `  Constat : ${r.detail}`, verif && `  Vérification : ${verif}`, r.diagnostic && `  Cause probable : ${r.diagnostic}`, r.solution && `  Solution préconisée : ${r.solution}`].filter(Boolean).join("\n"),
    };
  };
  const blocs = problemes.map(bloc);
  const reussis = res.filter((r) => r.niveau === "ok").map((r) => r.titre);
  const ignores = res.filter((r) => r.niveau === "ignore").map((r) => `${r.titre} : ${r.detail}`);
  const intro = problemes.length
    ? `Le contrôle automatique du ${date} a relevé ${b.erreurs} problème(s) et ${b.alertes} point(s) à surveiller${b.intermittents ? ` (${b.intermittents} incident(s) passager(s))` : ""}.`
    : `Le contrôle automatique du ${date} ne relève plus aucun problème : tout le parcours client fonctionne.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;max-width:680px">
<p>${echapper(intro)}</p>${blocs.map((x) => x.html).join("")}
<p style="margin-top:18px"><b>Contrôles réussis (${reussis.length}) :</b> ${echapper(reussis.join(" · ") || "aucun")}</p>
${ignores.length ? `<p style="color:#6b7280"><b>Non testés :</b><br>${ignores.map(echapper).join("<br>")}</p>` : ""}
<p style="color:#6b7280;font-size:12px">Contrôle quotidien du Studio IA (client fictif supprimé après le test). Historique : CRM › Administration › Santé des jobs (studio-controle). Relancer à la demande : CRM › Studio IA clients.</p></div>`;
  const texte = [intro, "", ...blocs.map((x) => x.texte), "", `Contrôles réussis (${reussis.length}) : ${reussis.join(" · ")}`,
    ...(ignores.length ? ["", "Non testés :", ...ignores] : [])].join("\n");
  return { objet, html, texte };
}

