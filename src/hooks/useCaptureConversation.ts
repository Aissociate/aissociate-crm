import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { EnregistreurSegmente, micSupporte, versWav16k, type SegmentAudio } from '@/lib/audioRecorder';
import type { ConversationSegment } from '@/lib/database.types';

/**
 * Enregistrement d'une conversation (micro, par segments) ou import d'un
 * fichier audio, jusqu'au téléversement dans le bucket « conversations ».
 * Partagé par la capture mobile et le poste de commande du mode avancé ; la
 * transcription se lance ensuite avec `traiterConversation`.
 */

export type EtatSegment = ConversationSegment & { statut: 'envoi' | 'ok' | 'erreur' };
export type OuvertureConversation = { contactId: string | null; telephone: string; titre: string };

/** Au-delà, l'endpoint de transcription refuse le fichier (limite Whisper : 25 Mo). */
export const IMPORT_TAILLE_MAX = 24 * 1024 * 1024;

const extensionDe = (mime: string, nom = ''): string => {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return nom.split('.').pop()?.toLowerCase() || 'bin';
};

/** Durée d'un fichier audio (métadonnées), 0 si illisible par le navigateur. */
function dureeFichier(fichier: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(fichier);
    const audio = new Audio();
    const fin = (s: number) => { URL.revokeObjectURL(url); resolve(Number.isFinite(s) ? Math.round(s) : 0); };
    audio.onloadedmetadata = () => fin(audio.duration);
    audio.onerror = () => fin(0);
    audio.preload = 'metadata';
    audio.src = url;
  });
}

export function useCaptureConversation() {
  const { session } = useAuth();
  const [secondes, setSecondes] = useState(0);
  const [niveau, setNiveau] = useState(0);
  const [enPause, setEnPause] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [segments, setSegments] = useState<EtatSegment[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistreur = useRef<EnregistreurSegmente | null>(null);
  const conversationId = useRef<string | null>(null);
  const segmentsRef = useRef<ConversationSegment[]>([]);
  const enversRef = useRef(0);          // téléversements en cours
  const arretRef = useRef(false);       // le micro a rendu son dernier segment
  const secondesRef = useRef(0);

  const ouvrir = useCallback(async (o: OuvertureConversation, source: 'micro' | 'import'): Promise<string | null> => {
    const { data: conv, error } = await supabase.from('conversations').insert({
      contact_id: o.contactId, telephone: o.telephone || 'inconnu', titre: o.titre,
      auteur_id: session?.user.id ?? null, source, statut: 'en_cours',
    }).select('id').maybeSingle();
    if (error || !conv) { setErreur(`Impossible d'ouvrir la conversation : ${error?.message ?? 'inconnu'}`); return null; }
    conversationId.current = conv.id;
    segmentsRef.current = [];
    secondesRef.current = 0;
    arretRef.current = false;
    setSegments([]); setSecondes(0);
    return conv.id;
  }, [session]);

  // ── Téléversement d'un segment ──────────────────────────────────────────────
  const envoyerSegment = useCallback(async (seg: SegmentAudio, nomFichier = ''): Promise<boolean> => {
    const convId = conversationId.current;
    if (!convId) return false;
    const path = `${convId}/${String(seg.index).padStart(3, '0')}.${extensionDe(seg.mime, nomFichier)}`;
    const entree: EtatSegment = {
      index: seg.index, path, duree: seg.duree, taille: seg.blob.size, mime: seg.mime, statut: 'envoi',
    };
    setSegments((prev) => [...prev, entree]);
    enversRef.current += 1;

    const { error } = await supabase.storage.from('conversations')
      .upload(path, seg.blob, { contentType: seg.mime, upsert: true });
    enversRef.current -= 1;

    if (error) {
      setSegments((prev) => prev.map((s) => (s.index === seg.index ? { ...s, statut: 'erreur' } : s)));
      setErreur(`Le morceau ${seg.index + 1} n'a pas pu être envoyé : ${error.message}`);
      return false;
    }
    setSegments((prev) => prev.map((s) => (s.index === seg.index ? { ...s, statut: 'ok' } : s)));

    // La ligne est mise à jour après chaque morceau : une coupure ne perd que
    // le morceau en cours.
    const { statut: _ignore, ...persiste } = entree;
    segmentsRef.current = [...segmentsRef.current, persiste];
    await supabase.from('conversations').update({
      segments: segmentsRef.current, duree_secondes: secondesRef.current,
    }).eq('id', convId);
    return true;
  }, []);

  // ── Micro ───────────────────────────────────────────────────────────────────
  /** Ouvre la conversation et démarre le micro ; renvoie son id, ou null. */
  const demarrer = useCallback(async (o: OuvertureConversation): Promise<string | null> => {
    setErreur(null);
    if (!micSupporte()) { setErreur("Ce navigateur ne sait pas enregistrer le micro. Utilisez Chrome ou Edge."); return null; }
    const id = await ouvrir(o, 'micro');
    if (!id) return null;

    const rec = new EnregistreurSegmente({
      // Chaque morceau part en WAV : la transcription (Gemini) refuse le webm.
      // Le compteur d'envois est pris tout de suite, pour que `terminer`
      // attende aussi les conversions en cours.
      onSegment: (seg) => {
        enversRef.current += 1;
        void versWav16k(seg.blob)
          .then((wav) => envoyerSegment(wav ? { ...seg, blob: wav, mime: 'audio/wav' } : seg))
          .finally(() => { enversRef.current -= 1; });
      },
      onTick: (s) => { secondesRef.current = s; setSecondes(s); },
      onLevel: setNiveau,
      onArret: () => { arretRef.current = true; },
      onError: (m) => setErreur(m),
    });
    try {
      await rec.demarrer();
    } catch {
      setErreur("Micro refusé. Autorisez l'accès au microphone dans les réglages du navigateur, puis réessayez.");
      await supabase.from('conversations').delete().eq('id', id);
      conversationId.current = null;
      return null;
    }
    enregistreur.current = rec;
    setEnPause(false);
    setEnregistre(true);
    return id;
  }, [ouvrir, envoyerSegment]);

  const basculerPause = useCallback(() => {
    const rec = enregistreur.current;
    if (!rec) return;
    if (rec.enPause) { rec.reprendre(); setEnPause(false); } else { rec.pause(); setEnPause(true); }
  }, []);

  /** Arrête le micro, attend le dernier morceau ; renvoie l'id prêt à traiter, ou null. */
  const terminer = useCallback(async (): Promise<string | null> => {
    enregistreur.current?.arreter();
    enregistreur.current = null;
    setEnregistre(false);
    setNiveau(0);

    const debut = Date.now();
    while ((!arretRef.current || enversRef.current > 0) && Date.now() - debut < 60000) {
      await new Promise((r) => setTimeout(r, 300));
    }
    const convId = conversationId.current;
    if (convId) {
      await supabase.from('conversations').update({
        statut: 'a_traiter', segments: segmentsRef.current, duree_secondes: secondesRef.current,
      }).eq('id', convId);
    }
    if (!segmentsRef.current.length) { setErreur("Aucun audio n'a été enregistré."); return null; }
    return convId;
  }, []);

  // ── Import d'un fichier (appel WhatsApp enregistré, mémo vocal…) ───────────
  const importer = useCallback(async (fichier: File, o: OuvertureConversation): Promise<string | null> => {
    setErreur(null);
    if (fichier.size > IMPORT_TAILLE_MAX) {
      setErreur(`Fichier trop lourd (${Math.round(fichier.size / 1048576)} Mo, maximum 24 Mo). Exportez-le en qualité réduite ou découpez-le.`);
      return null;
    }
    const duree = await dureeFichier(fichier);
    const id = await ouvrir(o, 'import');
    if (!id) return null;
    secondesRef.current = duree;
    setSecondes(duree);
    const mime = fichier.type || `audio/${extensionDe('', fichier.name)}`;
    const ok = await envoyerSegment({ index: 0, blob: fichier, mime, duree }, fichier.name);
    if (!ok) return null;
    await supabase.from('conversations').update({ statut: 'a_traiter', duree_secondes: duree }).eq('id', id);
    return id;
  }, [ouvrir, envoyerSegment]);

  const reinitialiser = useCallback(() => {
    conversationId.current = null;
    segmentsRef.current = [];
    setSegments([]); setSecondes(0); setErreur(null); setEnPause(false);
  }, []);

  // Quitter la page pendant l'enregistrement libère le micro.
  useEffect(() => () => { enregistreur.current?.arreter(); }, []);

  return {
    secondes, niveau, enPause, enregistre, segments, erreur, setErreur,
    demarrer, basculerPause, terminer, importer, reinitialiser,
  };
}
