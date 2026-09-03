/**
 * Enregistreur micro segmenté, pour la capture mobile (/mobile).
 *
 * Pourquoi des segments plutôt qu'un seul fichier :
 *  - un segment terminé est téléversé immédiatement ; si le navigateur Android
 *    tue l'onglet (écran verrouillé, mémoire), tout ce qui précède est sauvé ;
 *  - la transcription serveur a un délai maximum par requête : des morceaux de
 *    quelques minutes passent, une heure d'entretien d'un bloc non.
 *
 * Un segment = un MediaRecorder complet (en-tête compris), donc décodable seul.
 * Le flux micro, lui, reste ouvert d'un segment à l'autre : la coupure dure
 * quelques millisecondes.
 */

export type SegmentAudio = {
  index: number;
  blob: Blob;
  mime: string;
  /** Durée du segment, en secondes. */
  duree: number;
};

type Options = {
  /** Durée visée d'un segment (défaut : 4 min). */
  segmentMs?: number;
  onSegment: (segment: SegmentAudio) => void;
  /** Durée totale enregistrée, en secondes (pauses exclues). */
  onTick?: (secondes: number) => void;
  /** Niveau sonore instantané, entre 0 et 1 — pour le vumètre. */
  onLevel?: (niveau: number) => void;
  /** Appelé après l'émission du dernier segment, micro relâché. */
  onArret?: () => void;
  onError?: (message: string) => void;
};

/** Premier conteneur supporté par le navigateur (Chrome Android : webm/opus). */
export function pickMime(): string {
  const candidats = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const m of candidats) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export function micSupporte(): boolean {
  return Boolean(
    typeof MediaRecorder !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia,
  );
}

export class EnregistreurSegmente {
  private opts: Required<Pick<Options, 'segmentMs'>> & Options;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private mime = '';
  private index = 0;
  private debutSegment = 0;
  private secondes = 0;
  private timerTick: number | null = null;
  private timerSegment: number | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafLevel = 0;
  private wakeLock: WakeLockSentinel | null = null;
  /** `true` entre deux segments : l'arrêt du recorder ne doit pas tout couper. */
  private rotation = false;
  private arrete = false;

  constructor(opts: Options) {
    this.opts = { segmentMs: 4 * 60 * 1000, ...opts };
  }

  get enCours(): boolean { return this.recorder?.state === 'recording'; }
  get enPause(): boolean { return this.recorder?.state === 'paused'; }
  get duree(): number { return this.secondes; }

  async demarrer(): Promise<void> {
    // Écho annulé = la voix de l'interlocuteur sortant du haut-parleur serait
    // filtrée. En capture d'appel en haut-parleur, c'est exactement ce qu'on
    // veut garder : on désactive donc les traitements « conférence ».
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    this.mime = pickMime();
    this.arrete = false;
    this.secondes = 0;
    this.index = 0;
    this.brancherVumetre();
    await this.demanderWakeLock();
    this.nouveauSegment();
    this.timerTick = window.setInterval(() => {
      if (this.recorder?.state === 'recording') {
        this.secondes += 1;
        this.opts.onTick?.(this.secondes);
      }
    }, 1000);
  }

  pause(): void {
    if (this.recorder?.state === 'recording') this.recorder.pause();
    if (this.timerSegment) { window.clearTimeout(this.timerSegment); this.timerSegment = null; }
  }

  reprendre(): void {
    if (this.recorder?.state !== 'paused') return;
    this.recorder.resume();
    void this.demanderWakeLock();
    this.armerRotation();
  }

  /** Clôt le segment courant (émis via onSegment) et libère micro et timers. */
  arreter(): void {
    if (this.arrete) return;
    this.arrete = true;
    this.rotation = false;
    if (this.timerTick) { window.clearInterval(this.timerTick); this.timerTick = null; }
    if (this.timerSegment) { window.clearTimeout(this.timerSegment); this.timerSegment = null; }
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    else this.liberer();
  }

  // ── interne ───────────────────────────────────────────────────────────────

  private nouveauSegment(): void {
    if (!this.stream) return;
    this.chunks = [];
    this.debutSegment = Date.now();
    const rec = new MediaRecorder(this.stream, {
      ...(this.mime ? { mimeType: this.mime } : {}),
      audioBitsPerSecond: 32000, // voix mono : ~1 Mo pour 4 min
    });
    rec.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    rec.onerror = () => this.opts.onError?.("L'enregistrement a été interrompu par le navigateur.");
    rec.onstop = () => {
      const mime = this.mime || rec.mimeType || 'audio/webm';
      const blob = new Blob(this.chunks, { type: mime });
      const duree = Math.round((Date.now() - this.debutSegment) / 1000);
      if (blob.size > 0) {
        this.opts.onSegment({ index: this.index, blob, mime, duree });
        this.index += 1;
      }
      if (this.rotation) { this.rotation = false; this.nouveauSegment(); }
      else this.liberer();
    };
    rec.start();
    this.recorder = rec;
    this.armerRotation();
  }

  private armerRotation(): void {
    if (this.timerSegment) window.clearTimeout(this.timerSegment);
    this.timerSegment = window.setTimeout(() => {
      if (this.recorder?.state !== 'recording') return;
      this.rotation = true;
      this.recorder.stop(); // onstop enchaîne sur le segment suivant
    }, this.opts.segmentMs);
  }

  private brancherVumetre(): void {
    if (!this.stream || !this.opts.onLevel) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctx();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      const buf = new Uint8Array(this.analyser.frequencyBinCount);
      const boucle = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(buf);
        let somme = 0;
        for (const v of buf) { const x = (v - 128) / 128; somme += x * x; }
        this.opts.onLevel?.(Math.min(1, Math.sqrt(somme / buf.length) * 4));
        this.rafLevel = requestAnimationFrame(boucle);
      };
      boucle();
    } catch { /* vumètre optionnel */ }
  }

  /** Empêche l'écran de s'éteindre : Android suspend l'onglet en arrière-plan. */
  private async demanderWakeLock(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch { /* non supporté ou refusé : l'enregistrement continue */ }
  }

  private liberer(): void {
    if (this.rafLevel) cancelAnimationFrame(this.rafLevel);
    this.analyser = null;
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
    this.opts.onArret?.();
  }
}

/** « 1:05:03 » / « 07:12 » à partir d'un nombre de secondes. */
export function formatDuree(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** Numéro comparable : chiffres seuls, indicatif français normalisé. */
export function normaliserTelephone(valeur: string): string {
  const brut = valeur.replace(/[^\d+]/g, '');
  const chiffres = brut.replace(/\D/g, '');
  if (brut.startsWith('+33') || chiffres.startsWith('33')) return `0${chiffres.slice(2)}`;
  if (brut.startsWith('+262') || chiffres.startsWith('262')) return `0${chiffres.slice(3)}`;
  return chiffres;
}
