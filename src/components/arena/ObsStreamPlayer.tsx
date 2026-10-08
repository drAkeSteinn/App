"use client";

import { useEffect, useRef, useState } from "react";
import { useObsDisplaySettings } from "@/lib/obsStream";

/* ============================================================
   TRANSMISIÓN OBS — reproductor del visor
   URL de ingestión (OBS → Servidor personalizado):
     rtmp://<host>:1935  ·  clave de stream: "arena"
   Alternativa HTTP (sin puertos extra, misma URL en cualquier PC):
     http://<host-de-la-app>/api/stream/ingest  (mpegts)
   La señal llega al navegador como HLS a través del proxy de la
   propia app (/api/stream/proxy/*), sin puertos extra ni CORS.
   - SOLO se muestra cuando el admin activa "Mostrar transmicion"
     (arenaState.transmissionVisible) Y hay señal en vivo.
   - En el visor la transmisión es un OVERLAY: flota ENCIMA de los
     brackets (centrada, con marco rojo brillante) sin empujarlos
     ni encogerlos. El marco del video usa el tamaño en píxeles
     configurado en Configuración → Transmisión OBS (settings/obs);
     el video se ajusta dentro sin deformarse (object-contain).
   - El contador de espectadores del título es SIMULADO (ver
     useFakeViewers): la señal real solo la consume el OBS de la PC.
   ============================================================ */

export type ObsStreamStatus = { live: boolean; viewers: number; lan?: string[] };

const OFFLINE: ObsStreamStatus = { live: false, viewers: 0, lan: [] };

/** Polling del estado de la transmisión (aislado: quien lo usa no re-renderiza papás). */
export function useObsStreamStatus(intervalMs = 5000): ObsStreamStatus {
  const [status, setStatus] = useState<ObsStreamStatus>(OFFLINE);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch("/api/stream/status", { cache: "no-store" });
        const data = (await res.json()) as ObsStreamStatus;
        if (alive) setStatus(data);
      } catch {
        if (alive) setStatus(OFFLINE);
      } finally {
        if (alive) timer = setTimeout(tick, intervalMs);
      }
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);
  return status;
}

/** Punto de estado reutilizable (botón del header, chips, etc.). */
export function ObsStreamDot({ pollMs = 10000 }: { pollMs?: number }) {
  const { live } = useObsStreamStatus(pollMs);
  return <span className="obs-stream-dot" data-live={live} aria-hidden />;
}

/* ---------------- contador de espectadores simulado ----------------
   El título de la transmisión NO muestra los "viewers" reales (sería 1:
   solo el OBS de la PC consume la señal). Muestra una audiencia grande
   y creíble que deriva entre 8.000 y 8.500 con cambios MUY sutiles:
   pasos chicos con sesgo a lo mínimo, pausas naturales de 2.5–9 s
   entre cambios y rebote suave en los extremos del rango. */
export function useFakeViewers(min = 8000, max = 8500): number {
  const [n, setN] = useState(() => Math.floor(min + (max - min) * (0.3 + Math.random() * 0.4)));
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      // pausa natural entre cambios: 2.5 – 9 s (sutil, nunca mecánico)
      timer = setTimeout(() => {
        if (!alive) return;
        setN((v) => {
          const r = Math.random();
          const step = 1 + Math.floor(r * r * 20); // 1–20, sesgo a pasos chicos
          const dir = Math.random() < 0.5 ? -1 : 1;
          let nv = v + dir * step;
          if (nv < min || nv > max) nv = v - dir * step; // rebote en los bordes
          return Math.max(min, Math.min(max, nv));
        });
        schedule();
      }, 2500 + Math.random() * 6500);
    };
    schedule();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [min, max]);
  return n;
}

type HlsInstance = {
  destroy: () => void;
  startLoad: () => void;
  recoverMediaError: () => void;
  loadSource: (url: string) => void;
  attachMedia: (video: HTMLMediaElement) => void;
  on: (evt: string, cb: (...args: unknown[]) => void) => void;
};
type HlsStatic = {
  new (config?: Record<string, unknown>): HlsInstance;
  isSupported: () => boolean;
  Events: Record<string, string>;
  ErrorTypes: Record<string, string>;
};

export function ObsStreamPlayer({
  status: statusProp,
  pollMs = 5000,
  maxBox = "max-h-[48vh]",
  showBadge = true,
  width,
  height,
  frame = "default",
}: {
  /** estado externo opcional (p. ej. el dialog ya está haciendo polling) */
  status?: ObsStreamStatus;
  pollMs?: number;
  maxBox?: string;
  showBadge?: boolean;
  /** tamaño del marco en píxeles (Configuración → Transmisión OBS);
      sin definir → tamaño nativo del video */
  width?: number;
  height?: number;
  /** estilo del marco: "glow" = marco rojo brillante para el visor */
  frame?: "default" | "glow";
}) {
  const polled = useObsStreamStatus(pollMs);
  const status = statusProp ?? polled;
  const fakeViewers = useFakeViewers();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [connected, setConnected] = useState(false);

  /* monta/desmonta hls.js según haya señal */
  useEffect(() => {
    if (!status.live) {
      setConnected(false);
      return;
    }
    let destroyed = false;
    let hls: HlsInstance | null = null;
    const netRetries = { n: 0 };

    const setup = async () => {
      const video = videoRef.current;
      if (!video) return;
      const src = "/api/stream/proxy/index.m3u8";
      try {
        const mod = await import("hls.js");
        const Hls = mod.default as unknown as HlsStatic;
        if (destroyed) return;

        if (Hls.isSupported()) {
          const inst = new Hls({ lowLatencyMode: true, backBufferLength: 20 });
          hls = inst;
          inst.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!destroyed) video.play().catch(() => {});
          });
          inst.on(Hls.Events.ERROR, (...args: unknown[]) => {
            const data = args[1] as { fatal?: boolean; type?: string; details?: string };
            if (!data?.fatal) return;
            console.warn("[obs-stream] error HLS fatal:", data.type, data.details);
            if (destroyed) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // la playlist puede tardar 1-2 s en existir tras publicar → reintentar
              netRetries.n += 1;
              if (netRetries.n <= 10) inst.startLoad();
              else inst.destroy();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              inst.recoverMediaError();
            } else {
              inst.destroy();
            }
          });
          inst.loadSource(src);
          inst.attachMedia(video);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Safari/iOS: HLS nativo
          video.src = src;
          video.play().catch(() => {});
        } else {
          console.warn("[obs-stream] MSE no disponible en este navegador");
        }
      } catch (err) {
        console.warn("[obs-stream] fallo al iniciar hls.js:", err);
      }
    };

    setup();
    return () => {
      destroyed = true;
      hls?.destroy();
      hls = null;
    };
  }, [status.live]);

  if (!status.live) return null;

  const fixed = typeof width === "number" && typeof height === "number";
  return (
    <figure
      className={`obs-stream relative inline-flex max-w-full ${frame === "glow" ? "obs-stream-frame" : ""}`}
      data-testid="obs-stream-player"
    >
      <video
        ref={videoRef}
        className={`block max-w-full object-contain ${fixed ? "" : maxBox}`}
        style={fixed ? { width: `${width}px`, height: `${height}px` } : undefined}
        autoPlay
        muted
        playsInline
        onPlaying={() => setConnected(true)}
        aria-label="Transmisión en vivo de OBS"
      />
      {showBadge ? (
        <figcaption className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-sm bg-black/75 px-2.5 py-1 border border-[#ff2440]/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff2440] blink" aria-hidden />
          <span className="text-[9px] font-extrabold tracking-[0.22em] uppercase text-white leading-none">En vivo</span>
          <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#ff8095] leading-none">Pantalla principal</span>
          <span className="text-[9px] font-extrabold tracking-[0.22em] uppercase text-white leading-none tabular-nums">
            {fakeViewers.toLocaleString("es-MX")} viendo
          </span>
        </figcaption>
      ) : null}
      {!connected ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85">
          <span className="text-[9px] font-extrabold tracking-[0.3em] uppercase text-[#8e919c] animate-pulse">
            Conectando a la señal…
          </span>
        </div>
      ) : null}
    </figure>
  );
}

/**
 * Overlay del visor: la transmisión del OBS FLOTA ENCIMA de los brackets
 * (no les quita espacio — el bracket sigue a tamaño completo detrás) y se
 * CENTRA en la zona del visor con marco rojo brillante. El marco mide
 * EXACTAMENTE el tamaño en píxeles configurado (Configuración → Transmisión
 * OBS); solo si no cabe en pantalla se reduce proporcionalmente (sin
 * deformar). Aparece SOLO cuando el admin activó "Mostrar transmicion"
 * (visible) y hay señal en vivo.
 */
export function ObsStreamStage({ visible = false }: { visible?: boolean }) {
  const status = useObsStreamStatus(6000);
  const { settings } = useObsDisplaySettings();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const live = visible && status.live;

  /* escala proporcional para que el marco configurado quepa en el visor:
     tamaño nativo si cabe, reducción proporcional si es más grande */
  useEffect(() => {
    if (!live) return;
    const el = hostRef.current;
    if (!el) return;
    const compute = () => {
      const availW = el.clientWidth - 20;
      const availH = el.clientHeight - 20;
      if (availW <= 0 || availH <= 0) return;
      setScale(Math.min(1, availW / settings.width, availH / settings.height));
    };
    const r0 = requestAnimationFrame(compute);
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(r0);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [live, settings.width, settings.height]);

  if (!live) return null;

  return (
    <div ref={hostRef} className="absolute inset-0 z-[29] pointer-events-none" data-testid="obs-stream-stage">
      {/* centrado absoluto + escala: mide exactamente lo configurado,
          reducido solo cuando no cabe en la pantalla del visor */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: settings.width,
          height: settings.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <ObsStreamPlayer status={status} width={settings.width} height={settings.height} frame="glow" />
      </div>
    </div>
  );
}
