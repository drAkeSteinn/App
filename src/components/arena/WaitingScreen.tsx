"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Clock3, Loader2, Radio, Volume2, VolumeX } from "lucide-react";
import type { VideoMeta } from "@/lib/videos";
import { useWaitingPlaylist, videoFileUrl } from "@/lib/videos";
import {
  fmtTimeParts,
  localDateKey,
  useAgenda,
  type AgendaEvent,
} from "@/lib/agenda";
import { Backdrop } from "./ui";

/* ============================================================
   PANTALLA DE ESPERA DEL VISOR ("Esperando transmisión").
   Aparece cuando NO hay un torneo/concurso abierto.

   · PLAYLIST DE VIDEOS: reproduce en LOOP los videos marcados
     en la sección "Videos" de Configuración (carpeta videos/
     del servidor). Uno tras otro, y al terminar el último
     vuelve al primero. Mute por defecto (autoplay permitido)
     con botón para activar el sonido.
   · AGENDA DEL DÍA: barra inferior con fondo negro semi
     transparente donde desfilan (derecha → izquierda) las
     cards de los eventos de HOY, al estilo de las cards de
     los brackets.
   · Si no hay videos marcados → pantalla estática clásica.
   ============================================================ */

/* ---------------- reloj por minuto (para el cambio de día) ---------------- */
function useMinuteTick() {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const t = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 15_000);
    return () => clearInterval(t);
  }, []);
  return minute;
}

/* ---------------- escenario de videos en loop ----------------
   El padre lo monta con key = firma de la playlist: cuando la lista
   cambia (subida/borrado/checkbox) se remonta y TODO el estado interno
   (índice, fallos) se reinicia solo — patrón de "reset con key". */
function WaitingVideoStage({
  playlist,
  muted,
  onToggleMute,
}: {
  playlist: VideoMeta[];
  muted: boolean;
  onToggleMute: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const failedRef = useRef<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const safeIdx = playlist.length ? idx % playlist.length : 0;
  const current = playlist[safeIdx];

  const next = useCallback(() => {
    setIdx((i) => (playlist.length ? (i + 1) % playlist.length : 0));
  }, [playlist.length]);

  /* video que no se puede reproducir → saltar; si fallan todos → pantalla estática.
     IMPORTANTE: al cambiar de video (key swap) el elemento ANTERIOR se desmonta
     con la descarga a medias y el navegador le dispara un `error` de aborto.
     Ese error NO es del video actual → se ignora comparando contra videoRef
     (si no, se duplica el avance y la playlist salta videos a lo loco). */
  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (e.currentTarget !== videoRef.current) return;
      if (!current) return;
      failedRef.current.add(current.name);
      if (failedRef.current.size >= playlist.length) {
        setAllFailed(true);
      } else {
        next();
      }
    },
    [current, playlist.length, next]
  );

  /* un solo video → loop nativo (onEnded no cambiaría el índice) */
  const single = playlist.length === 1;

  /* Activar/silenciar el sonido de forma IMPERATIVA: se aplica el mute
     SINCRÓNICAMENTE en el elemento (no se espera el re-render) y luego se
     asegura play(). Si el navegador bloquea el audio (sin activación de
     usuario) se regresa a silencio y la reproducción continúa en loop. */
  const handleMuteToggle = useCallback(() => {
    const v = videoRef.current;
    const willBeMuted = muted; // muted=true → pasará a sonar; false → pasará a silencio
    onToggleMute();
    if (!v) return;
    if (willBeMuted) {
      v.muted = false; // aplicar ya: el play() debe reflejar la intención real
      v.play().then(
        () => {},
        () => {
          // play con sonido bloqueado → restaurar silencio y seguir
          onToggleMute();
          v.muted = true;
          v.play().catch(() => {});
        }
      );
    } else {
      v.muted = true;
      if (v.paused) v.play().catch(() => {});
    }
  }, [muted, onToggleMute]);

  if (!current || allFailed) return null;

  return (
    <>
      <video
        key={current.name}
        ref={videoRef}
        src={videoFileUrl(current.name, current.mtime)}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        autoPlay
        playsInline
        muted={muted}
        loop={single}
        onEnded={single ? undefined : next}
        onError={handleError}
        aria-label="Video de espera"
      />
      {/* velo superior sutil para legibilidad del chip */}
      <div
        className="absolute top-0 inset-x-0 h-20 bg-[linear-gradient(180deg,rgba(7,7,8,0.9),transparent)] pointer-events-none"
        aria-hidden
      />
      {/* identidad + progreso de la playlist */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <span className="chip clip-tag bg-black/75 border border-white/12 text-[#ff8095] text-[9px] font-extrabold uppercase tracking-[0.2em] px-3 py-1.5">
          <Radio size={11} className="text-[#e8102e]" />
          Esperando transmisión
        </span>
        {playlist.length > 1 ? (
          <span className="chip clip-tag bg-black/75 border border-white/12 text-[#8e919c] text-[9px] font-extrabold uppercase tracking-[0.16em] px-2.5 py-1.5 tabular-nums">
            {safeIdx + 1} / {playlist.length}
          </span>
        ) : null}
      </div>
      {/* sonido */}
      <button
        type="button"
        onClick={handleMuteToggle}
        title={muted ? "Activar sonido del video" : "Silenciar video"}
        aria-label={muted ? "Activar sonido del video" : "Silenciar video"}
        className="btn-press absolute right-4 bottom-[74px] z-10 p-2.5 border border-white/15 bg-black/70 text-[#c9cbd3] hover:text-white hover:border-[#e8102e]/60"
      >
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-[#ffb830]" />}
      </button>
    </>
  );
}

/* ---------------- card de evento de agenda (estilo brackets) ---------------- */
function AgendaTickerCard({ ev }: { ev: AgendaEvent }) {
  const t = fmtTimeParts(ev.time);
  return (
    <div className="rail-card clip-card-sm h-[44px] shrink-0 flex items-stretch">
      {/* hora */}
      <div className="px-2.5 flex items-center gap-1 bg-black/45 border-r border-white/8">
        <Clock3 size={10} className="text-[#e8102e]" />
        <span className="rail-time text-[15px] tabular-nums leading-none">{t.hhmm12}</span>
        <span className="text-[7px] font-extrabold tracking-[0.2em] text-[#8e919c] leading-none">{t.ampm}</span>
      </div>
      {/* título + nota */}
      <div className="px-3 flex flex-col justify-center min-w-0 max-w-[340px]">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-white truncate leading-tight">
          {ev.title}
        </span>
        {ev.note ? (
          <span className="text-[8px] font-semibold text-[#8e919c] truncate leading-tight">{ev.note}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- barra inferior: agenda de HOY desfilando ---------------- */
function AgendaTickerBar({ events }: { events: AgendaEvent[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dur, setDur] = useState(40);

  /* repite el set hasta llenar holgadamente una vuelta de la cinta */
  const set = useMemo(() => {
    const minPx = 1800; // ancho objetivo de una vuelta
    const estPerCard = 300; // estimación conservadora por card
    const reps = Math.max(1, Math.ceil(minPx / Math.max(1, events.length * estPerCard)));
    const out: AgendaEvent[] = [];
    for (let i = 0; i < reps; i++) out.push(...events);
    return out;
  }, [events]);

  /* duración real según el ancho medido: ~70 px/s, mín 24s */
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const half = el.scrollWidth / 2;
    if (half > 0) setDur(Math.min(240, Math.max(24, Math.round(half / 70))));
  }, [set]);

  return (
    <footer className="absolute bottom-0 inset-x-0 z-20 h-[62px] border-t border-white/10 bg-black/70 backdrop-blur-sm flex items-stretch overflow-hidden">
      {/* etiqueta lateral fija */}
      <div className="shrink-0 w-[46px] red-badge flex flex-col items-center justify-center gap-1 z-10">
        <CalendarClock size={13} />
        <span className="text-[7px] font-extrabold tracking-[0.18em] uppercase [writing-mode:vertical-rl] rotate-180">
          Agenda hoy
        </span>
      </div>
      {/* cinta: derecha → izquierda */}
      <div className="flex-1 min-w-0 flex items-center overflow-hidden" role="marquee" aria-label="Agenda del día">
        <div ref={trackRef} className="agenda-track flex w-max items-center pl-4" style={{ animationDuration: `${dur}s` }}>
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-2.5 pr-2.5" aria-hidden={dup === 1}>
              {set.map((ev, i) => (
                <AgendaTickerCard key={`${dup}-${i}-${ev.id}`} ev={ev} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   WaitingScreen — reemplaza el bloque estático "Esperando
   transmisión" del visor cuando no hay torneo activo.
   ============================================================ */
export function WaitingScreen({ loading, error }: { loading: boolean; error: string | null }) {
  const { ready, playlist } = useWaitingPlaylist();
  const { data: agenda } = useAgenda();
  const minute = useMinuteTick();
  const dayKey = useMemo(() => localDateKey(new Date(minute * 60_000)), [minute]);
  /* el sonido sobrevive a los cambios de playlist (vive en el padre) */
  const [muted, setMuted] = useState(true);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  /* solo los eventos del día en curso (la agenda ya viene ordenada) */
  const todayEvents = useMemo(() => agenda.filter((e) => e.date === dayKey), [agenda, dayKey]);

  const showVideos = ready && playlist.length > 0;
  /* firma de la playlist: al cambiar, la etapa se remonta limpia (key) */
  const playlistKey = useMemo(() => playlist.map((v) => v.name).join("|"), [playlist]);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#070708" }}>
      {showVideos ? (
        /* ===== videos en loop ===== */
        <WaitingVideoStage key={playlistKey} playlist={playlist} muted={muted} onToggleMute={toggleMute} />
      ) : (
        /* ===== pantalla estática clásica ===== */
        <>
          <Backdrop variant="show" />
          <div className="relative z-10 h-full flex items-center justify-center">
            <div className="max-w-xl mx-auto px-6 text-center">
              {loading ? (
                <div className="flex justify-center py-16 text-[#8e919c]">
                  <Loader2 size={26} className="animate-spin" />
                </div>
              ) : error ? (
                <div className="panel clip-card p-4 text-[12px] font-bold text-[#ff8095]">Error de Firebase: {error}</div>
              ) : (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 clip-card border border-white/15 bg-black/40 flex items-center justify-center">
                      <Radio size={28} className="text-[#e8102e]" />
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold tracking-[0.5em] uppercase text-[#ff8095]">
                    Visor de espectadores
                  </span>
                  <h1 className="font-display italic text-[34px] sm:text-[44px] uppercase leading-none mt-3">
                    <span className="text-silver-grad">Esperando</span> <span className="text-red-grad">transmisión</span>
                  </h1>
                  <p className="text-[12px] font-bold tracking-[0.16em] uppercase text-[#8e919c] mt-6 leading-relaxed">
                    No hay un torneo abierto para transmitir.
                    <br />
                    El administrador debe abrir un torneo desde
                    <br />
                    <span className="text-white">Torneo en vivo → Abrir torneo</span>.
                  </p>
                  <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-[#6b6e78] mt-8">
                    Esta pantalla se actualiza sola cuando se abra un torneo
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== agenda del día desfilando (fondo negro semi transparente) ===== */}
      {todayEvents.length > 0 ? <AgendaTickerBar events={todayEvents} /> : null}
    </div>
  );
}
