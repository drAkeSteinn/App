"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Monitor, Trophy, Zap } from "lucide-react";
import type { Bracket, Tournament } from "@/lib/types";
import { fmtTime, matchTag, roundShortLabel } from "@/lib/bracket";
import { matchPlayable, MODALITY_LABEL } from "@/lib/types";
import { plannedPcs, pcsLabel } from "@/lib/pcs";

/* ============================================================
   MatchRail — barra inferior de transmisión:
   · Los 2 próximos matches ANCLADOS como cards grandes
   · El resto de matches PROGRAMADOS (participantes ya definidos,
     sin resultado) como mini-cards en una cinta con auto-avance
   · NO se muestran matches con slots "Por definir" ni matches
     ya completados con ganador
   ============================================================ */

function useMinute() {
  const [m, setM] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const t = setInterval(() => setM(Math.floor(Date.now() / 60_000)), 15_000);
    return () => clearInterval(t);
  }, []);
  return m;
}

interface UpcomingInfo {
  id: string;
  round: string; // CUARTOS / OCTAVOS / SEMI / FINAL…
  num: number; // match dentro de la ronda
  tag: string;
  parts: { name: string; score: number }[]; // participantes del match (2 o 4 en FFA)
  time: number;
  live: boolean;
  pcs: string; // PCs asignadas/planificadas, ej. "PC1 · PC2"
}

/** ¿Hay al menos un match elegible para el rail? (evita renderizarlo vacío) */
export function hasRailMatches(bracket: Bracket, schedule: Map<string, number>): boolean {
  for (const round of bracket.rounds) {
    for (const match of round) {
      if (match.bye || match.status === "done") continue;
      if (!schedule.get(match.id)) continue;
      if (!matchPlayable(match)) continue;
      return true;
    }
  }
  return false;
}

function relLabel(info: UpcomingInfo, minute: number): string {
  const relMins = Math.round((info.time - minute * 60_000) / 60_000);
  if (info.live) return "EN JUEGO";
  if (relMins <= 0) return "AHORA";
  if (relMins < 60) return `EN ${relMins} MIN`;
  return `EN ${Math.floor(relMins / 60)}H ${relMins % 60}M`;
}

function TeamLine({ name, score, compact }: { name: string; score: number; compact?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`red-badge clip-badge ${compact ? "w-[19px] h-[14px]" : "w-[22px] h-[16px]"} shrink-0 flex items-center justify-center`}
      >
        <span className={`font-display italic leading-none pt-[1px] ${compact ? "text-[10px]" : "text-[11px]"}`}>{score}</span>
      </span>
      <span
        className={`${compact ? "text-[10px]" : "text-[11px]"} font-extrabold uppercase tracking-wide truncate text-white`}
      >
        {name}
      </span>
    </div>
  );
}

function RoundChip({ round }: { round: string }) {
  const isFinal = round === "FINAL";
  return (
    <span
      className={`clip-tag px-1.5 py-[2px] text-[8px] font-extrabold tracking-[0.16em] uppercase ${
        isFinal ? "bg-[#ffb830] text-[#141519]" : "bg-white/[0.08] text-[#ffb830] border border-[#ffb830]/30"
      }`}
    >
      {round}
    </span>
  );
}

/* Card grande anclada (los 2 próximos) */
function RailCard({ info, big }: { info: UpcomingInfo; big?: boolean }) {
  const minute = useMinute();
  return (
    <div className={`rail-card clip-card-sm flex items-stretch h-full ${big ? "w-[300px]" : "w-[270px]"} shrink-0`}>
      {/* hora grande */}
      <div className="w-[86px] shrink-0 bg-black/45 flex flex-col items-center justify-center gap-0.5 border-r border-white/8">
        {info.live ? (
          <span className="text-[10px] font-extrabold tracking-[0.18em] text-[#ff2440] blink uppercase">● Vivo</span>
        ) : (
          <>
            <CalendarClock size={10} className="text-[#e8102e]" />
            <span className="rail-time text-[24px] leading-none tabular-nums">
              {fmtTime(info.time).replace(/\s?(a\.?m\.?|p\.?m\.?)/i, "")}
            </span>
            <span className="text-[8px] font-extrabold tracking-[0.3em] text-[#8e919c]">
              {/p\.?m/i.test(fmtTime(info.time)) ? "PM" : "AM"}
            </span>
          </>
        )}
      </div>
      {/* info del match */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-2 gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            <RoundChip round={info.round} />
            <span className="text-[8.5px] font-extrabold tracking-[0.14em] uppercase text-[#8e919c]">M{info.num}</span>
            {info.pcs ? (
              <span
                className={`flex items-center gap-[3px] text-[8px] font-extrabold tracking-[0.08em] uppercase tabular-nums whitespace-nowrap ${
                  info.live ? "text-[#ff2440]" : "text-[#6b6e78]"
                }`}
                title={info.live ? "PCs del escenario — match en juego" : "PCs planificadas para este match"}
              >
                <Monitor size={8} />
                {info.pcs.replace(/\s·\s/g, "·")}
              </span>
            ) : null}
          </span>
          <span
            className={`text-[8.5px] font-extrabold tracking-[0.14em] uppercase whitespace-nowrap ${
              info.live ? "text-[#ff2440] blink" : "text-[#ffb830]"
            }`}
          >
            {relLabel(info, minute)}
          </span>
        </div>
        <div className="space-y-[3px]">
          {info.parts.map((p, i) => (
            <TeamLine key={i} name={p.name} score={p.score} compact={info.parts.length > 2} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Mini card para la cinta del resto de matches */
function MiniRailCard({ info }: { info: UpcomingInfo }) {
  const minute = useMinute();
  return (
    <div className="rail-card clip-card-sm w-[214px] h-[64px] shrink-0 snap-start flex items-stretch">
      <div className="w-[54px] shrink-0 bg-black/45 flex flex-col items-center justify-center gap-0.5 border-r border-white/8">
        {info.live ? (
          <span className="text-[8px] font-extrabold tracking-[0.14em] text-[#ff2440] blink uppercase">● Vivo</span>
        ) : (
          <>
            <span className="rail-time text-[17px] leading-none tabular-nums">
              {fmtTime(info.time).replace(/\s?(a\.?m\.?|p\.?m\.?)/i, "")}
            </span>
            <span className="text-[7px] font-extrabold tracking-[0.26em] text-[#8e919c]">
              {/p\.?m/i.test(fmtTime(info.time)) ? "PM" : "AM"}
            </span>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center px-2.5 py-1.5 gap-[3px]">
        <div className="flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1 min-w-0">
            <RoundChip round={info.round} />
            <span className="text-[8px] font-extrabold text-[#8e919c]">M{info.num}</span>
          </span>
          <span
            className={`text-[8px] font-extrabold tracking-[0.1em] uppercase whitespace-nowrap ${
              info.live ? "text-[#ff2440] blink" : "text-[#ffb830]"
            }`}
          >
            {relLabel(info, minute)}
          </span>
        </div>
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-white truncate leading-tight">
          {info.parts.map((p) => p.name).join(" vs ")}
        </div>
        {info.parts.some((p) => p.score > 0) ? (
          <div className="text-[8.5px] font-extrabold text-[#8e919c] tabular-nums">
            {info.parts.map((p) => p.score).join(" – ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MatchRail({
  bracket,
  schedule,
  tournament,
}: {
  bracket: Bracket;
  schedule: Map<string, number>;
  tournament: Tournament;
}) {
  const minute = useMinute();

  /* PCs por match (en juego: guardadas; listos: plan con grupos libres) */
  const pcsMap = useMemo(() => plannedPcs(bracket, tournament.modality), [bracket, tournament.modality]);

  const all = useMemo<UpcomingInfo[]>(() => {
    const out: UpcomingInfo[] = [];
    bracket.rounds.forEach((round, r) =>
      round.forEach((match, m) => {
        if (match.bye) return;
        const t = schedule.get(match.id);
        // solo programados: con hora, SIN resultado y con participantes suficientes
        if (match.status === "done" || !t) return;
        if (!matchPlayable(match)) return;
        out.push({
          id: match.id,
          round: roundShortLabel(bracket, r),
          num: m + 1,
          tag: matchTag(bracket, r, m),
          parts: match.slots.map((s) => ({ name: s.label || "—", score: s.score })),
          time: t,
          live: match.status === "live",
          pcs: pcsLabel(pcsMap.get(match.id)),
        });
      })
    );
    // en juego primero, luego por hora
    out.sort((x, y) => (x.live === y.live ? x.time - y.time : x.live ? -1 : 1));
    return out;
  }, [bracket, schedule, pcsMap]);

  const anchored = all.slice(0, 2);
  const anchoredIds = new Set(anchored.map((x) => x.id));
  const rest = all.filter((x) => !anchoredIds.has(x.id));

  /* auto-avance de la cinta: cada 3.5s pasa a la siguiente mini-card,
     se pausa al pasar el mouse/foco y regresa al inicio al llegar al final */
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);
  const stepRef = useRef(0);
  useEffect(() => {
    if (paused || rest.length === 0) return;
    const el = stripRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 8) return; // todo cabe, no hay que desplazar
    const t = setInterval(() => {
      const cur = stripRef.current;
      if (!cur) return;
      const atEnd = cur.scrollLeft + cur.clientWidth >= cur.scrollWidth - 12;
      stepRef.current = atEnd ? 0 : stepRef.current + 1;
      const card = cur.querySelector<HTMLElement>(`[data-card-idx="${stepRef.current}"]`);
      if (card) {
        cur.scrollTo({ left: card.offsetLeft - cur.offsetLeft, behavior: "smooth" });
      } else {
        stepRef.current = 0;
        cur.scrollTo({ left: 0, behavior: "smooth" });
      }
    }, 3500);
    return () => clearInterval(t);
  }, [paused, rest.length]);

  if (anchored.length === 0) {
    return null; // el padre decide el fallback
  }

  return (
    <footer className="relative z-20 shrink-0 h-[86px] border-t border-white/10 bg-black/78 backdrop-blur-sm flex items-stretch overflow-hidden">
      {/* etiqueta lateral */}
      <div className="shrink-0 w-[46px] red-badge flex flex-col items-center justify-center gap-1.5 z-10">
        <Trophy size={14} />
        <span className="text-[8px] font-extrabold tracking-[0.22em] uppercase [writing-mode:vertical-rl] rotate-180">
          Próximos
        </span>
      </div>

      {/* cards ancladas */}
      {anchored.map((info) => (
        <div key={info.id} className="p-1.5 pl-2 flex items-stretch">
          <RailCard info={info} big />
        </div>
      ))}

      {/* cinta del resto de matches (todas las rondas pendientes) */}
      <div className="flex-1 min-w-0 relative overflow-hidden border-l border-white/8">
        <div className="absolute inset-x-0 top-1.5 px-3 flex items-center gap-2">
          <span className="text-[8px] font-extrabold tracking-[0.3em] uppercase text-[#6b6e78]">
            Próximos matches · {all.length} programados
          </span>
          <span className="h-[1px] flex-1 bg-white/8" aria-hidden />
          {rest.length > 0 ? (
            <span className="text-[8px] font-extrabold tracking-[0.2em] uppercase text-[#8e919c] hidden sm:inline">
              {rest.length} más →
            </span>
          ) : null}
        </div>
        {rest.length > 0 ? (
          <div
            ref={stripRef}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="absolute inset-x-0 bottom-0 top-[22px] flex items-center gap-2 overflow-x-auto px-3 pb-1.5 snap-x snap-mandatory rail-strip"
            aria-label="Cartelera de próximos matches"
          >
            {rest.map((info, i) => (
              <div key={info.id} data-card-idx={i}>
                <MiniRailCard info={info} />
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <Zap size={12} className="text-[#ffb830]" />
            <span className="text-[10px] font-extrabold tracking-[0.26em] uppercase text-[#8e919c]">
              Últimos matches de la jornada — consulta tu hora en la cartelera
            </span>
          </div>
        )}
      </div>

      {/* recordatorio de configuración */}
      <div className="hidden lg:flex shrink-0 flex-col justify-center px-4 border-l border-white/8 gap-1">
        <span className="text-[8.5px] font-extrabold tracking-[0.22em] uppercase text-[#8e919c]">
          {MODALITY_LABEL[tournament.modality]} · a {tournament.winsNeeded} wins
        </span>
        <span className="text-[8.5px] font-extrabold tracking-[0.22em] uppercase text-[#6b6e78]">
          matches de {tournament.matchMins} min aprox
        </span>
      </div>
    </footer>
  );
}
