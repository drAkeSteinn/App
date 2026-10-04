"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Expand,
  LayoutPanelLeft,
  Loader2,
  MonitorPlay,
  Radio,
  Timer,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { Bracket, Modality, Player, Tournament } from "@/lib/types";
import { MODALITY_LABEL, playersCapacity } from "@/lib/types";
import { computeSchedule, matchTag, totalMatches } from "@/lib/bracket";
import { computeBank } from "@/lib/bank";
import { pcsForSide } from "@/lib/pcs";
import { useBracket, usePlayers, useTournaments } from "@/lib/hooks";
import { BracketTree, FitStage } from "@/components/bracket/BracketTree";
import { Backdrop, Btn, EmptyState, ModalityChip, StatusChip } from "./ui";
import { Countdown } from "./Countdown";
import { MixOverlay } from "./MixOverlay";
import { Podium } from "./Podium";
import { MatchRail, hasRailMatches } from "./MatchRail";
import { ScheduleOverlay } from "./ScheduleOverlay";
import { RegistrationBroadcast } from "./RegistrationBroadcast";
import { MatchSpotlight, type SpotlightData } from "./MatchSpotlight";

/* ============================================================
   VISOR DE ESPECTADORES — transmisión del torneo
   URL: /?v=show&t=<id>            → brackets en vivo
   URL: /?v=show&t=<id>&mode=reg   → modo registro (lugares)
   El modo inicial viene de la URL; después se auto-gestiona
   según la fase del torneo (registro ↔ brackets).
   ============================================================ */

export type ViewerMode = "brackets" | "reg";

/* Detecta el primer evento "dramático" entre dos versiones del bracket:
   match que pasa a DONE (ganador marcado o cambiado) o a LIVE (en juego).
   Las PCs del match se leen del match actual (al poner en juego ya tienen
   PCs asignadas) o del snapshot anterior (al definir ganador ya se liberaron). */
function findSpotlightEvent(
  cur: Bracket,
  prev: Bracket,
  winsNeeded: number,
  modality: Modality
): SpotlightData | null {
  for (let r = 0; r < cur.rounds.length; r++) {
    const round = cur.rounds[r];
    for (let m = 0; m < round.length; m++) {
      const match = round[m];
      const old = prev.rounds[r]?.[m];
      if (!match || !old || match.bye) continue;
      const becameDone = match.status === "done" && old.status !== "done";
      const winnerChanged = match.status === "done" && old.status === "done" && match.w !== old.w;
      const becameLive = match.status === "live" && old.status !== "live";
      if (becameDone || winnerChanged || becameLive) {
        const pcs = match.pcs?.length ? match.pcs : old.pcs;
        return {
          id: `${match.id}-${match.status}-${match.w}-${Date.now()}`,
          kind: match.status === "live" ? "live" : "win",
          tag: matchTag(cur, r, m),
          players: match.slots.map((s, i) => ({
            name: s.label || "—",
            score: s.score ?? 0,
            pcs: pcsForSide(modality, pcs, i),
          })),
          winner: match.w,
          winsNeeded,
        };
      }
    }
  }
  return null;
}

/* Fondo fotográfico del visor (Background.jpg) con veladura para legibilidad */
function ShowBackground({ dim = 0 }: { dim?: number }) {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden>
      <img src="/Background.jpg" alt="" draggable={false} className="w-full h-full object-cover" />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(115% 85% at 50% 38%, rgba(7,7,8,${0.2 + dim}) 0%, rgba(7,7,8,${0.62 + dim}) 60%, rgba(7,7,8,${0.86 + dim}) 100%)`,
        }}
      />
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = requestAnimationFrame(() => setNow(new Date()));
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(t);
    };
  }, []);
  return now;
}

function ShowHeader({
  t,
  mode,
  onMode,
  onSchedule,
  showScheduleBtn,
}: {
  t: Tournament;
  mode: ViewerMode;
  onMode: (m: ViewerMode) => void;
  onSchedule: () => void;
  showScheduleBtn: boolean;
}) {
  const clock = useClock();
  return (
    <header className="relative z-20 shrink-0 h-[64px] border-b border-white/10 bg-black/55 backdrop-blur-md flex items-center gap-3 px-3 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 shrink-0 clip-card-sm border border-white/15 bg-black/50 flex items-center justify-center overflow-hidden">
          {t.logo ? (
             
            <img src={t.logo} alt={`Logo ${t.name}`} className="w-full h-full object-contain" />
          ) : (
            <Trophy size={16} className="text-[#e8102e]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-display italic text-[16px] sm:text-[19px] uppercase leading-none truncate">{t.name}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <ModalityChip modality={t.modality} />
            {t.venue ? (
              <span className="hidden sm:inline text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#8e919c] truncate">
                {t.venue}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto absolute left-1/2 -translate-x-1/2 hidden sm:block">
        <StatusChip status={t.status} big />
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        {/* selector de modo (brackets / registro) */}
        <div className="flex gap-1 p-0.5 bg-black/50 border border-white/10" role="radiogroup" aria-label="Modo del visor">
          <button
            type="button"
            role="radio"
            aria-checked={mode === "brackets"}
            title="Vista de brackets en vivo"
            onClick={() => onMode("brackets")}
            className={`btn-press clip-tag px-2.5 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] flex items-center gap-1.5 transition-colors ${
              mode === "brackets" ? "bg-[linear-gradient(160deg,#ff2440,#a30d24)] text-white" : "text-[#8e919c] hover:text-white"
            }`}
          >
            <LayoutPanelLeft size={13} />
            <span className="hidden md:inline">Brackets</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "reg"}
            title="Modo registro: lugares disponibles"
            onClick={() => onMode("reg")}
            className={`btn-press clip-tag px-2.5 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] flex items-center gap-1.5 transition-colors ${
              mode === "reg" ? "bg-[linear-gradient(160deg,#ff2440,#a30d24)] text-white" : "text-[#8e919c] hover:text-white"
            }`}
          >
            <UserPlus size={13} />
            <span className="hidden md:inline">Registro</span>
          </button>
        </div>

        {showScheduleBtn ? (
          <button
            type="button"
            onClick={onSchedule}
            title="Cartelera de horarios estimados"
            aria-label="Abrir cartelera de horarios"
            className="btn-press p-2 border border-white/12 text-[#8e919c] hover:text-white hover:border-[#e8102e]/60"
          >
            <CalendarClock size={15} />
          </button>
        ) : null}

        <span className="hidden sm:block font-display italic text-[15px] text-[#8e919c] tabular-nums">
          {clock ? clock.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            else document.documentElement.requestFullscreen().catch(() => toast.error("Pantalla completa no disponible"));
          }}
          title="Pantalla completa"
          aria-label="Pantalla completa"
          className="btn-press p-2 border border-white/12 text-[#8e919c] hover:text-white hover:border-[#e8102e]/60"
        >
          <Expand size={15} />
        </button>
      </div>
    </header>
  );
}

function Ticker({ items }: { items: string[] }) {
  const content = items.filter(Boolean).join("      ///      ");
  if (!content) return null;
  return (
    <footer className="relative z-20 shrink-0 h-10 border-t border-white/10 bg-black/70 flex items-center overflow-hidden">
      <span className="shrink-0 h-full flex items-center px-3 red-badge clip-badge text-[10px] font-extrabold tracking-[0.2em] uppercase z-10">
        En directo
      </span>
      <div className="flex-1 overflow-hidden">
        <div className="marquee-track">
          <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#c9cbd3] whitespace-nowrap px-6">
            {content}
          </span>
          <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#c9cbd3] whitespace-nowrap px-6" aria-hidden>
            {content}
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Fase: pregame (registro + countdown) ---------- */
function Pregame({ t, players }: { t: Tournament; players: Player[] }) {
  const officials = players.filter((p) => p.seat === "off");
  const cap = playersCapacity(t);
  const hasCountdown = !!t.startAt && t.startAt > Date.now();
  const marquee = officials.length
    ? officials.map((p) => p.nick.toUpperCase())
    : t.status === "closed"
      ? ["REGISTROS CERRADOS", "ESPERANDO INICIO"]
      : ["REGISTRO ABIERTO", "ESPERANDO JUGADORES"];

  return (
    <motion.div
      key="pregame"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-7 px-6"
    >
      <div className="flex items-center gap-3 text-[#c9cbd3]">
        <span className="slashes w-10 h-4 inline-block" aria-hidden />
        <span className="text-[11px] font-extrabold tracking-[0.5em] uppercase">
          {hasCountdown ? "El torneo comienza en" : "Esperando inicio"}
        </span>
        <span className="slashes w-10 h-4 inline-block" aria-hidden />
      </div>

      <h1 className="font-display italic uppercase text-center leading-[0.95] max-w-[90vw]">
        <span className="block text-[13px] sm:text-[15px] tracking-[0.4em] text-[#ff8095] mb-2">Torneo</span>
        <span className="text-silver-grad text-[40px] sm:text-[76px]">{t.name}</span>
      </h1>

      <div className="flex flex-wrap justify-center gap-2">
        <ModalityChip modality={t.modality} big />
        <span className="chip clip-tag bg-white/[0.07] border border-white/15 text-[#d9dbe1] text-[12px] px-4 py-1.5">
          <Users size={12} />
          {officials.length}/{cap} registrados
        </span>
        <span className="chip clip-tag bg-white/[0.07] border border-white/15 text-[#d9dbe1] text-[12px] px-4 py-1.5">
          <Zap size={12} />
          {t.bankSeats} en el banco
        </span>
        <span className="chip clip-tag bg-white/[0.07] border border-white/15 text-[#d9dbe1] text-[12px] px-4 py-1.5">
          <Timer size={12} />
          Matches de {t.matchMins} min · a {t.winsNeeded} wins
        </span>
      </div>

      {hasCountdown ? (
        <Countdown target={t.startAt!} />
      ) : (
        <div className="font-display italic text-[24px] sm:text-[34px] uppercase text-red-grad beat">Próximamente…</div>
      )}

      {/* marquee de jugadores */}
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="red-badge clip-badge px-2 py-[3px] text-[9px] font-extrabold tracking-[0.2em] uppercase">
            Jugadores
          </span>
          <span className="h-[1px] flex-1 bg-white/10" aria-hidden />
        </div>
        <div className="overflow-hidden border-y border-white/8 py-2">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <span key={dup} className="flex gap-8 pr-8 whitespace-nowrap" aria-hidden={dup === 1}>
                {marquee.map((n, i) => (
                  <span key={i} className="font-display italic text-[15px] uppercase text-[#c9cbd3]">
                    {n}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- Cuerpo principal ---------- */
export function SpectatorView({ tid }: { tid: string | null }) {
  const { data: tournaments, loading, error } = useTournaments();
  const tournament: Tournament | null = useMemo(
    () => tournaments.find((t) => t.id === tid) ?? null,
    [tournaments, tid]
  );
  const { data: players } = usePlayers(tournament ? tid : null);
  const { data: bracket } = useBracket(tournament ? tid : null);

  const status = tournament?.status ?? "open";
  const [override, setOverride] = useState<{ status: Tournament["status"]; mode: ViewerMode } | null>(null);
  const [schedOpen, setSchedOpen] = useState(false);
  const [revealCount, setRevealCount] = useState(0);
  const [showPodium, setShowPodium] = useState(true);
  const [spotlight, setSpotlight] = useState<SpotlightData | null>(null);
  const prevBracketRef = useRef<{ tid: string | null; bracket: Bracket } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* AUTO-MODO: el modo se deriva del status del torneo (cada fase del admin
     se refleja sola en el visor). El toggle manual gana hasta que el status
     vuelva a cambiar, porque la anulación queda atada al status vigente.
     CUENTA REGRESIVA: en cuanto el admin programa el inicio (startAt), el
     visor salta solo a la pestaña de brackets, donde el cronómetro de inicio
     se ve en grande; si cancela la cuenta regresiva regresa al modo registro. */
  const inRegisterPhase = status === "open" || status === "closed";
  const autoMode: ViewerMode = inRegisterPhase ? (tournament?.startAt ? "brackets" : "reg") : "brackets";
  const mode: ViewerMode = override && override.status === status ? override.mode : autoMode;

  /* sincroniza el modo en la URL para compartir la vista correcta */
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (mode === "reg") url.searchParams.set("mode", "reg");
      else url.searchParams.delete("mode");
      if (url.toString() !== window.location.href) window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }, [mode]);

  const changeMode = (m: ViewerMode) => {
    setOverride({ status, mode: m });
  };

  // animación de mix
  const totalSlots = bracket ? bracket.rounds[0].length * (bracket.s ?? 2) : 0;
  const pool = useMemo(() => {
    if (!bracket) return [];
    const labels = bracket.rounds[0].flatMap((m) => m.slots.map((s) => s.label || "TBD"));
    return Array.from(new Set(labels));
  }, [bracket]);

  useEffect(() => {
    if (status !== "mixing" || !bracket || mode !== "brackets") return;
    const r0 = requestAnimationFrame(() => {
      setRevealCount(0);
      setShowPodium(false);
    });
    toRef.current = setTimeout(() => {
      ivRef.current = setInterval(() => {
        setRevealCount((c) => {
          if (c >= totalSlots) {
            if (ivRef.current) clearInterval(ivRef.current);
            return c;
          }
          return c + 1;
        });
      }, 240);
    }, 2400);
    return () => {
      cancelAnimationFrame(r0);
      if (toRef.current) clearTimeout(toRef.current);
      if (ivRef.current) clearInterval(ivRef.current);
    };
  }, [status, bracket, totalSlots, mode]);

  useEffect(() => {
    if (status === "finished") {
      const r = requestAnimationFrame(() => setShowPodium(true));
      return () => cancelAnimationFrame(r);
    }
  }, [status]);

  /* ----- SPOTLIGHT: ganador marcado / match en juego → corte dramático.
     Compara cada snapshot del bracket con el anterior; al detectar un match
     que pasa a DONE (o cambia de ganador) o a LIVE, lanza el overlay. ----- */
  useEffect(() => {
    const prev = prevBracketRef.current;
    prevBracketRef.current = tid && bracket ? { tid, bracket } : null;
    if (!bracket || !prev || prev.tid !== tid || status !== "live") return;
    const event = findSpotlightEvent(bracket, prev.bracket, tournament?.winsNeeded ?? 1, tournament?.modality ?? 1);
    if (event) setSpotlight(event);
  }, [bracket, status, tid, tournament]);

  /* el corte se va solo tras 10 segundos (para ver bien quién ganó y qué
     match está en juego) y regresa a los brackets */
  useEffect(() => {
    if (!spotlight) return;
    const t = setTimeout(() => setSpotlight(null), 10_000);
    return () => clearTimeout(t);
  }, [spotlight]);

  /* glitch sutil de toda la pantalla al disparar el corte (Web Animations API:
     se re-dispara en cada evento sin renders extra; respeta prefers-reduced-motion) */
  useEffect(() => {
    if (!spotlight) return;
    const el = rootRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const anim = el.animate(
      [
        { transform: "translate3d(0,0,0)" },
        { transform: "translate3d(-3px,1px,0) skewX(-0.35deg)", offset: 0.08 },
        { transform: "translate3d(3px,-2px,0) skewX(0.3deg)", offset: 0.16 },
        { transform: "translate3d(-2px,2px,0)", offset: 0.24 },
        { transform: "translate3d(2px,1px,0) skewX(0.22deg)", offset: 0.32 },
        { transform: "translate3d(-1px,-1px,0)", offset: 0.4 },
        { transform: "translate3d(0,0,0)", offset: 0.52 },
        { transform: "translate3d(-2px,0,0) skewX(-0.18deg)", offset: 0.64 },
        { transform: "translate3d(1px,1px,0)", offset: 0.78 },
        { transform: "translate3d(-1px,0,0)", offset: 0.9 },
        { transform: "translate3d(0,0,0)" },
      ],
      { duration: 1900, easing: "linear" }
    );
    return () => {
      anim.cancel();
    };
  }, [spotlight]);

  const schedule = useMemo(
    () => (tournament && bracket ? computeSchedule(bracket, tournament.startAt, tournament.matchMins) : new Map<string, number>()),
    [bracket, tournament]
  );

  const liveMatches = useMemo(() => {
    if (!bracket) return [];
    const out: { tag: string; names: string }[] = [];
    bracket.rounds.forEach((round, r) =>
      round.forEach((match, m) => {
        if (match.status === "live") {
          out.push({
            tag: matchTag(bracket, r, m),
            names:
              match.slots
                .filter((s) => s.pid)
                .map((s) => s.label || "—")
                .join(" VS ") || "—",
          });
        }
      })
    );
    return out;
  }, [bracket]);

  const tickerItems = useMemo(() => {
    if (!tournament || !bracket) return [];
    const items: string[] = [];
    const upcoming: { time: number; text: string }[] = [];
    bracket.rounds.forEach((round, r) =>
      round.forEach((match, m) => {
        const st = schedule.get(match.id);
        if (st && match.status === "ready" && match.slots.every((s) => s.pid) && st > Date.now() - 60_000) {
          upcoming.push({
            time: st,
            text: `SIGUIENTE · ${matchTag(bracket, r, m)}: ${match.slots
              .map((s) => s.label || "—")
              .join(" VS ")} ≈ ${fmtTimeSafe(st)}`,
          });
        }
      })
    );
    upcoming.sort((a, b) => a.time - b.time);
    items.push(...upcoming.slice(0, 4).map((u) => u.text));
    /* banco efectivo: reservas del registro antes de la 1ª eliminatoria;
       después, los eliminados de la última ronda completada (rotativo) */
    const bankInfo = computeBank(bracket, players);
    items.push(
      bankInfo.fromRound === null
        ? `BANCO DE RESERVAS: ${bankInfo.entries.length} DISPONIBLES`
        : `BANCO · ELIMINADOS DE ${bankInfo.sourceLabel}: ${bankInfo.entries.length} RESERVAS`
    );
    items.push(`${MODALITY_LABEL[tournament.modality]} · ${totalMatches(bracket)} MATCHES · A ${tournament.winsNeeded} WINS`);
    items.push("JUEGA · COMpite · CONECTA — GAMING SIN LÍMITES");
    return items;
  }, [bracket, tournament, schedule, players]);

  /* ----- selector de transmisión ----- */
  if (!tid || (!loading && !tournament)) {
    return (
      <div className="fixed inset-0 overflow-hidden" style={{ background: "#070708" }}>
        <Backdrop variant="show" />
        <ShowBackground dim={0.14} />
        <div className="relative z-10 h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="text-center mb-10">
              <span className="text-[11px] font-extrabold tracking-[0.5em] uppercase text-[#ff8095]">Visor de espectadores</span>
              <h1 className="font-display italic text-[38px] sm:text-[52px] uppercase leading-none mt-2">
                <span className="text-silver-grad">Transmisiones</span> <span className="text-red-grad">en vivo</span>
              </h1>
            </div>
            {loading ? (
              <div className="flex justify-center py-16 text-[#8e919c]">
                <Loader2 size={26} className="animate-spin" />
              </div>
            ) : error ? (
              <div className="panel clip-card p-4 text-[12px] font-bold text-[#ff8095]">Error de Firebase: {error}</div>
            ) : tournaments.length === 0 ? (
              <div className="panel clip-card">
                <EmptyState
                  icon={<MonitorPlay size={26} />}
                  title="Sin torneos todavía"
                  message="Cuando el organizador cree un torneo aparecerá aquí para que lo veas en pantalla grande."
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...tournaments]
                  .sort((a, b) => {
                    const order = { live: 0, mixing: 1, closed: 2, open: 3, finished: 4 } as const;
                    return order[a.status] - order[b.status];
                  })
                  .map((t) => (
                    <a
                      key={t.id}
                      href={`/?v=show&t=${t.id}`}
                      className="panel clip-card hover-lift p-5 flex items-center gap-4"
                    >
                      <div className="w-14 h-14 shrink-0 clip-card-sm border border-white/12 bg-black/40 flex items-center justify-center overflow-hidden">
                        {t.logo ? (
                           
                          <img src={t.logo} alt={`Logo ${t.name}`} className="w-full h-full object-contain" />
                        ) : (
                          <Trophy size={20} className="text-[#e8102e]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-display italic text-[17px] uppercase truncate">{t.name}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <StatusChip status={t.status} />
                          <ModalityChip modality={t.modality} />
                        </div>
                      </div>
                      <Radio size={18} className="text-[#e8102e] shrink-0" />
                    </a>
                  ))}
              </div>
            )}
            <p className="text-center text-[10px] font-bold tracking-[0.24em] uppercase text-[#6b6e78] mt-10">
              Abre esta vista en otra pantalla para transmitir el torneo
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#070708" }}>
        <Loader2 size={28} className="animate-spin text-[#e8102e]" />
      </div>
    );
  }

  const mixing = status === "mixing";
  const mixDone = mixing && totalSlots > 0 && revealCount >= totalSlots;
  const railActive = status === "live" && mode === "brackets";

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#070708" }}
    >
      <Backdrop variant="show" />
      <ShowBackground />
      <ShowHeader
        t={tournament}
        mode={mode}
        onMode={changeMode}
        onSchedule={() => setSchedOpen(true)}
        showScheduleBtn={!!bracket && mode === "brackets"}
      />

      {/* spotlight de matches en juego */}
      <AnimatePresence>
        {status === "live" && mode === "brackets" && liveMatches.length > 0 ? (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="relative z-20 shrink-0 live-glow bg-[linear-gradient(90deg,rgba(110,10,26,0.85),rgba(232,16,46,0.9),rgba(110,10,26,0.85))] flex items-center justify-center gap-3 py-2 px-4"
          >
            <span className="w-2.5 h-2.5 bg-white rounded-full blink shrink-0" aria-hidden />
            <span className="text-[12px] sm:text-[14px] font-extrabold tracking-[0.2em] uppercase text-white truncate">
              {liveMatches
                .slice(0, 2)
                .map((l) => `${l.tag}: ${l.names}`)
                .join("  ///  ")}
            </span>
            <span className="w-2.5 h-2.5 bg-white rounded-full blink shrink-0" aria-hidden />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="relative flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {/* MODO REGISTRO */}
          {mode === "reg" ? (
            <RegistrationBroadcast
              key="reg"
              t={tournament}
              players={players}
              onCountdownClick={() => changeMode("brackets")}
            />
          ) : (
            <>
              {/* PREGAME (registro abierto o cerrado, vista brackets manual) */}
              {status === "open" || status === "closed" ? <Pregame key="pre" t={tournament} players={players} /> : null}

              {/* MIXING / LIVE / FINISHED: bracket */}
              {status !== "open" && status !== "closed" ? (
                <motion.div
                  key="bracket"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className={`absolute inset-0 ${mixing && !mixDone ? "opacity-30" : ""} transition-opacity duration-500`}
                >
                  {bracket ? (
                    <FitStage deps={[bracket, tournament.modality, status]} maxScale={1.05} minScale={0.3} className="w-full h-full">
                      <BracketTree
                        bracket={bracket}
                        modality={tournament.modality}
                        mode="viewer"
                        schedule={schedule}
                        showTimes={status === "live"}
                        revealCount={mixing ? revealCount : undefined}
                        pool={pool}
                      />
                    </FitStage>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#8e919c]">
                      <Loader2 size={24} className="animate-spin" />
                    </div>
                  )}
                </motion.div>
              ) : null}
            </>
          )}
        </AnimatePresence>

        {/* overlay de mix */}
        <AnimatePresence>
          {mixing && bracket && mode === "brackets" ? (
            <MixOverlay key="mix" locked={revealCount} total={totalSlots} pool={pool} done={mixDone} />
          ) : null}
        </AnimatePresence>

        {/* podio */}
        <AnimatePresence>
          {status === "finished" && bracket && showPodium && mode === "brackets" ? (
            <Podium key="podium" bracket={bracket} tournament={tournament} onClose={() => setShowPodium(false)} />
          ) : null}
        </AnimatePresence>

        {/* botón para volver al podio */}
        {status === "finished" && bracket && !showPodium && mode === "brackets" ? (
          <button
            type="button"
            onClick={() => setShowPodium(true)}
            className="btn-press absolute bottom-4 right-4 z-30 clip-btn red-badge px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] flex items-center gap-2"
          >
            <Trophy size={13} />
            Ver podio
          </button>
        ) : null}

        {/* cartelera de horarios */}
        <AnimatePresence>
          {schedOpen && bracket ? (
            <ScheduleOverlay
              key="sched"
              bracket={bracket}
              schedule={schedule}
              tournament={tournament}
              open
              onClose={() => setSchedOpen(false)}
            />
          ) : null}
        </AnimatePresence>
      </main>

      {/* corte dramático: ganador marcado / match en juego — 5 s y regresa a brackets */}
      <AnimatePresence>
        {spotlight ? <MatchSpotlight key={spotlight.id} data={spotlight} onDone={() => setSpotlight(null)} /> : null}
      </AnimatePresence>

      {/* banner de espera durante mixing */}
      <AnimatePresence>
        {mixDone && status === "mixing" && mode === "brackets" ? (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="relative z-20 shrink-0 border-t border-[#ffb830]/30 bg-[#171307]/90 flex items-center justify-center gap-2 py-2"
          >
            <span className="w-2 h-2 bg-[#ffb830] blink" aria-hidden />
            <span className="text-[10px] font-extrabold tracking-[0.28em] uppercase text-[#ffb830]">
              Brackets listos — el administrador iniciará el torneo
            </span>
            <span className="w-2 h-2 bg-[#ffb830] blink" aria-hidden />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* pie: rail de próximos matches / ticker / barra vacía */}
      {railActive && bracket ? (
        <MatchRailFallback bracket={bracket} schedule={schedule} tournament={tournament} tickerItems={tickerItems} />
      ) : status === "live" || status === "finished" ? (
        <Ticker items={tickerItems} />
      ) : (
        <div className="relative shrink-0 h-10 border-t border-white/10 bg-black/70" />
      )}
    </div>
  );
}

/* Si no hay matches programados con participantes definidos, cae al ticker */
function MatchRailFallback({
  bracket,
  schedule,
  tournament,
  tickerItems,
}: {
  bracket: Bracket;
  schedule: Map<string, number>;
  tournament: Tournament;
  tickerItems: string[];
}) {
  const hasAny = useMemo(() => hasRailMatches(bracket, schedule), [bracket, schedule]);

  if (hasAny) return <MatchRail bracket={bracket} schedule={schedule} tournament={tournament} />;
  return <Ticker items={tickerItems} />;
}

function fmtTimeSafe(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}
