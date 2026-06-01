import { supabase } from './supabase';
import { uploadFile } from './storage';

interface Section { titre: string; contenu: string }
interface GenInput {
  planId: string | null;
  contexte: Record<string, unknown>; // données envoyées à l'IA
  apprenant: string;
  organismePartenaire: string;
  userId: string | null;
}

function parseContent(content: string): { titre: string; sections: Section[] } {
  const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
  let obj = tryParse(content);
  if (!obj) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]);
  }
  if (obj && Array.isArray(obj.sections)) {
    return { titre: obj.titre ?? 'Plan de formation', sections: obj.sections };
  }
  // Repli : texte brut en une section
  return { titre: 'Plan de formation', sections: [{ titre: 'Plan de formation', contenu: content }] };
}

/**
 * Génère le plan via l'IA (Edge Function), produit un PDF structuré,
 * le téléverse dans le bucket privé `plans` et l'enregistre.
 */
export async function generatePlanPdf(input: GenInput): Promise<{ titre: string }> {
  // 1) Génération du contenu côté serveur (clé API jamais exposée au navigateur)
  const { data, error } = await supabase.functions.invoke('generate-plan', {
    body: { plan: input.contexte },
  });
  if (error) {
    const msg = (error as { message?: string }).message ?? '';
    throw new Error(
      "Génération indisponible : déployez l'Edge Function « generate-plan » et configurez la clé OpenRouter (Paramètres > IA). " + msg,
    );
  }
  const res = data as { content: string; organisme?: Record<string, string> };
  const { titre, sections } = parseContent(res.content ?? '');
  const org = res.organisme ?? {};

  // 2) Rendu PDF (jsPDF chargé dynamiquement)
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  const ensure = (h: number) => { if (y + h > pageH - M) { doc.addPage(); y = M; } };

  // En-tête organisme
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(234, 106, 30);
  doc.text(String(org.nom ?? 'Organisme de formation'), M, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
  const sub = [org.qualiopi ? `Qualiopi ${org.qualiopi}` : '', org.email ?? '', org.telephone ?? '']
    .filter(Boolean).join('  ·  ');
  if (sub) { doc.text(sub, M, y); y += 14; }
  doc.setDrawColor(234, 106, 30); doc.setLineWidth(1.5); doc.line(M, y, pageW - M, y); y += 24;

  // Titre
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20, 20, 30);
  doc.splitTextToSize(titre, pageW - 2 * M).forEach((l: string) => { ensure(22); doc.text(l, M, y); y += 22; });
  y += 6;

  // Métadonnées
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
  const meta = [
    input.apprenant ? `Apprenant : ${input.apprenant}` : '',
    input.organismePartenaire ? `Organisme / partenaire : ${input.organismePartenaire}` : '',
    `Date : ${new Date().toLocaleDateString('fr-FR')}`,
  ].filter(Boolean);
  meta.forEach((m) => { ensure(14); doc.text(m, M, y); y += 14; });
  y += 10;

  // Sections
  for (const s of sections) {
    ensure(26);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(234, 106, 30);
    doc.text(String(s.titre ?? ''), M, y); y += 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(40, 40, 50);
    const lines = doc.splitTextToSize(String(s.contenu ?? ''), pageW - 2 * M);
    for (const l of lines) { ensure(15); doc.text(l, M, y); y += 15; }
    y += 12;
  }

  // Pied de page (numéros)
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`${org.nom ?? ''} — page ${i}/${pages}`, pageW / 2, pageH - 20, { align: 'center' });
  }

  // 3) Upload + enregistrement
  const blob = doc.output('blob');
  const safe = titre.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40).toLowerCase();
  const file = new File([blob], `plan-${safe}.pdf`, { type: 'application/pdf' });
  const { value, error: upErr } = await uploadFile('plans', file);
  if (upErr || !value) throw new Error(upErr ?? 'Échec du téléversement du PDF');

  const { error: insErr } = await supabase.from('plan_pdfs').insert({
    plan_id: input.planId,
    titre,
    apprenant: input.apprenant || null,
    organisme: input.organismePartenaire || (org.nom as string) || null,
    fichier_url: value,
    created_by: input.userId,
  });
  if (insErr) throw new Error(insErr.message);

  return { titre };
}
