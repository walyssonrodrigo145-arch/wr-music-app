// ─── MetronomeEngine (PRD 03) ────────────────────────────────────────────────
// Engine singleton de metrônomo com Web Audio API e scheduler lookahead
// (preciso e leve — sem setInterval por batida). Garante UMA única instância
// de loop de áudio em toda a aplicação (§52).
// Estado observável via subscribe/getState (compatível com useSyncExternalStore).
//
// iOS FIX (Caça-Bug): Web Audio no iPhone/iPad falhava por:
//   1) chave de silencioso muta a categoria "ambient" → usamos audioSession=playback;
//   2) AudioContext preso em "interrupted" (tela bloqueada/ligação/Siri) → resume
//      com await/retry e recriação do contexto quando necessário;
//   3) sem tratamento de background → pausa o scheduler ao esconder e reagenda ao voltar;
//   4) falha silenciosa → estado `error` para a UI avisar o usuário.

export type TimeSignature = "2/4" | "3/4" | "4/4" | "6/8";

export const TIME_SIGNATURES: Array<{ value: TimeSignature; label: string; beats: number; subdivision: 1 | 2 }> = [
  { value: "2/4", label: "2/4", beats: 2, subdivision: 1 },
  { value: "3/4", label: "3/4", beats: 3, subdivision: 1 },
  { value: "4/4", label: "4/4", beats: 4, subdivision: 1 },
  { value: "6/8", label: "6/8", beats: 6, subdivision: 2 }, // cliques = colcheias (2 grupos de 3)
];

export const MIN_BPM = 40;
export const MAX_BPM = 208;

export interface MetronomeState {
  playing: boolean;
  bpm: number;
  /** Índice do pulso atual dentro do compasso (0-based, atualizado no tempo do áudio) */
  beat: number;
  timeSignature: TimeSignature;
  /** Total de pulsos por compasso conforme a assinatura */
  beatsPerBar: number;
  /** Último erro de áudio (ex.: iOS não conseguiu iniciar) — a UI exibe aviso. */
  error: string | null;
}

type Accent = "strong" | "medium" | "normal";

const LOOKAHEAD_MS = 25;       // tick do scheduler
const SCHEDULE_AHEAD = 0.18;   // segundos agendados à frente (iOS tolera timers atrasados)
// WAV silencioso 1 frame — usado para "acordar" a sessão de áudio do iOS no 1º toque.
const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touchMac = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || touchMac;
}

class MetronomeEngine {
  private audioCtx: AudioContext | null = null;
  private schedulerId: number | null = null;
  private nextNoteTime = 0;
  private internalBeat = 0;
  private visualTimeouts = new Set<number>();
  private activeOscillators = new Set<OscillatorNode>();
  private unlockAudioEl: HTMLAudioElement | null = null;
  private listeningVisibility = false;
  private unlockInstalled = false;

  private state: MetronomeState = {
    playing: false,
    bpm: 80,
    beat: 0,
    timeSignature: "4/4",
    beatsPerBar: 4,
    error: null,
  };

  private listeners = new Set<() => void>();

  constructor() {
    this.installUnlockOnFirstGesture();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = (): MetronomeState => this.state;

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private setState(patch: Partial<MetronomeState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private signature() {
    return TIME_SIGNATURES.find((t) => t.value === this.state.timeSignature) || TIME_SIGNATURES[2];
  }

  /** Acentuação: primeiro tempo forte; em 6/8, o 4º clique (2º grupo) é médio. */
  private accentFor(beat: number): Accent {
    const sig = this.signature();
    if (beat === 0) return "strong";
    if (sig.value === "6/8" && beat === 3) return "medium";
    return "normal";
  }

  // ── iOS: categoria de áudio "playback" (toca mesmo com o silencioso ligado) ──
  private unlockAudioSession() {
    try {
      const nav: any = navigator;
      if (nav?.audioSession && nav.audioSession.type !== "playback") {
        nav.audioSession.type = "playback";
      }
    } catch {
      // Safari antigo sem Audio Session API — segue com o workaround do <audio>
    }
  }

  // ── iOS: toca um áudio silencioso no 1º toque para migrar a sessão p/ "playback" ──
  private primeSilentAudio() {
    if (!isIOSDevice() || typeof document === "undefined") return;
    try {
      if (!this.unlockAudioEl) {
        const audio = document.createElement("audio");
        audio.setAttribute("playsinline", "true");
        audio.setAttribute("aria-hidden", "true");
        audio.loop = true;
        audio.preload = "auto";
        audio.src = SILENT_WAV;
        audio.style.display = "none";
        document.body.appendChild(audio);
        this.unlockAudioEl = audio;
      }
      const p = this.unlockAudioEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      // sem o workaround, ao menos a Audio Session API pode resolver
    }
  }

  /** Instala um unlock no primeiro toque/click da página (antes mesmo do Play). */
  private installUnlockOnFirstGesture() {
    if (this.unlockInstalled || typeof document === "undefined") return;
    this.unlockInstalled = true;
    const handler = () => {
      this.unlockAudioSession();
      this.primeSilentAudio();
      document.removeEventListener("pointerdown", handler, true);
      document.removeEventListener("touchend", handler, true);
    };
    document.addEventListener("pointerdown", handler, true);
    document.addEventListener("touchend", handler, true);
  }

  /**
   * Cria/retoma o AudioContext. No iOS o estado pode ser "interrupted" (não só
   * "suspended") e o resume pode falhar; nesse caso recriamos o contexto.
   */
  private async ensureContext(): Promise<AudioContext | null> {
    this.unlockAudioSession();
    this.primeSilentAudio();
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) {
      this.setState({ error: "Áudio não suportado neste navegador." });
      return null;
    }
    try {
      let ctx: AudioContext;
      if (this.audioCtx && this.audioCtx.state !== "closed") {
        ctx = this.audioCtx;
      } else {
        ctx = new Ctor() as AudioContext;
        this.audioCtx = ctx;
      }
      // resume é chamado ainda dentro do gesto do usuário
      if ((ctx.state as string) !== "running") {
        try { await ctx.resume(); } catch { /* tenta recriar abaixo */ }
      }
      if ((ctx.state as string) !== "running") {
        // Workaround da regressão do iOS 17.5: contexto recém-criado às vezes
        // só sai de "interrupted" com uma instância nova.
        try {
          const fresh = new Ctor() as AudioContext;
          try { await fresh.resume(); } catch { /* ignore */ }
          if ((fresh.state as string) === "running") {
            try { await ctx.close(); } catch { /* ignore */ }
            this.audioCtx = fresh;
            ctx = fresh;
          } else {
            try { await fresh.close(); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
      if ((ctx.state as string) !== "running") {
        this.setState({ error: "Não foi possível iniciar o áudio. Verifique o modo silencioso e toque novamente." });
        return null;
      }
      if (this.state.error) this.setState({ error: null });
      return ctx;
    } catch {
      this.setState({ error: "Não foi possível iniciar o áudio no seu aparelho." });
      return null;
    }
  }

  /** Clique curto (oscilador + envelope) — eficiente e sem travamentos. */
  private scheduleClick(beat: number, time: number) {
    const ctx = this.audioCtx;
    if (!ctx) return;
    const accent = this.accentFor(beat);
    const freq = accent === "strong" ? 1760 : accent === "medium" ? 1320 : 1046;
    const gainValue = accent === "strong" ? 0.5 : accent === "medium" ? 0.35 : 0.25;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.08);
    this.activeOscillators.add(osc);
    osc.onended = () => {
      this.activeOscillators.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };

    // Indicador visual sincronizado com o tempo do áudio
    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    const timeoutId = window.setTimeout(() => {
      this.visualTimeouts.delete(timeoutId);
      this.setState({ beat });
    }, delay);
    this.visualTimeouts.add(timeoutId);
  }

  private schedulerLoop = () => {
    const ctx = this.audioCtx;
    if (!ctx || !this.state.playing) return;
    const sig = this.signature();
    const interval = 60 / this.state.bpm / sig.subdivision;
    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleClick(this.internalBeat % sig.beats, this.nextNoteTime);
      this.nextNoteTime += interval;
      this.internalBeat = (this.internalBeat + 1) % sig.beats;
    }
  };

  /** iOS: ao esconder a página pausa o agendador; ao voltar, resume e reagenda. */
  private attachVisibilityHandlers() {
    if (this.listeningVisibility || typeof document === "undefined") return;
    this.listeningVisibility = true;

    const resumeFromBackground = async () => {
      if (!this.state.playing) return;
      const ctx = await this.ensureContext();
      if (!ctx) return;
      this.internalBeat = 0;
      this.nextNoteTime = ctx.currentTime + 0.08;
      if (this.schedulerId === null) {
        this.schedulerId = window.setInterval(this.schedulerLoop, LOOKAHEAD_MS);
      }
      this.schedulerLoop();
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.stopScheduler(true);
      } else {
        void resumeFromBackground();
      }
    });
    window.addEventListener("pageshow", () => { void resumeFromBackground(); });
  }

  /** Inicia (ou retoma) o metrônomo. Se bpm informado, ajusta antes. */
  async start(bpm?: number): Promise<void> {
    if (bpm !== undefined) this.setBpm(bpm);
    if (this.state.playing) return;
    try {
      const ctx = await this.ensureContext();
      if (!ctx) {
        this.setState({ playing: false });
        return;
      }
      // Encerra QUALQUER loop anterior antes de iniciar novo (§52)
      this.stopScheduler(true);
      this.internalBeat = 0;
      this.nextNoteTime = ctx.currentTime + 0.08;
      this.attachVisibilityHandlers();
      this.setState({ playing: true, beat: 0 });
      this.schedulerId = window.setInterval(this.schedulerLoop, LOOKAHEAD_MS);
      this.schedulerLoop();
    } catch {
      this.setState({ playing: false, error: "Não foi possível iniciar o metrônomo." });
    }
  }

  pause() {
    if (!this.state.playing) return;
    this.stopScheduler(true);
    this.setState({ playing: false });
  }

  async toggle(bpm?: number): Promise<void> {
    if (this.state.playing) this.pause();
    else await this.start(bpm);
  }

  /** Para tudo e zera o pulso para o tempo 1 (limpa timeouts visuais pendentes). */
  reset() {
    this.stopScheduler(true);
    this.setState({ playing: false, beat: 0 });
  }

  setBpm(bpm: number) {
    const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm) || MIN_BPM));
    if (clamped === this.state.bpm) return;
    this.setState({ bpm: clamped });
  }

  setTimeSignature(sig: TimeSignature) {
    const conf = TIME_SIGNATURES.find((t) => t.value === sig);
    if (!conf) return;
    this.stopScheduler(true);
    this.internalBeat = 0;
    this.setState({ timeSignature: sig, beatsPerBar: conf.beats, beat: 0, playing: false });
  }

  private stopScheduler(clearVisuals: boolean) {
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    // Silencia cliques já agendados (até SCHEDULE_AHEAD à frente)
    this.activeOscillators.forEach((osc) => {
      try { osc.stop(); } catch { /* já parado */ }
      try { osc.disconnect(); } catch { /* já desconectado */ }
    });
    this.activeOscillators.clear();
    if (clearVisuals) {
      this.visualTimeouts.forEach((id) => window.clearTimeout(id));
      this.visualTimeouts.clear();
    }
  }
}

/** Instância única — usar SEMPRE esta em vez de criar novos engines (§52). */
export const metronome = new MetronomeEngine();
