"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Monitor } from "lucide-react";
import type { Bracket, Match, MatchSlot, Modality } from "@/lib/types";
import { fmtTime, matchTag } from "@/lib/bracket";
import { pcsCompact, pcsForSide, plannedPcs, pcsLabel } from "@/lib/pcs";

export type RevealState = "hidden" | "rolling" | "locked";

/* ============================================================
   MatchCard — placa plateada estilo broadcast con marcador
   ============================================================ */

function RollingName({ pool }: { pool: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % Math.max(1, pool.length)), 95);
    return () => clearInterval(t);
  }, [pool.length]);
  return <span className="rolling">{pool[i % Math.max(1, pool.length)] || "???"}</span>;
}

function SlotView({
  slot,
  modality,
  isWinner,
  isLoser,
  isDq,
  isLive,
  reveal,
  pool,
  showMembers,
  pcTag,
  big = false,
  place,
  tone,
}: {
  slot: MatchSlot;
  modality: number;
  isWinner: boolean;
  isLoser: boolean;
  isDq: boolean;
  isLive: boolean;
  reveal: RevealState;
  pool: string[];
  showMembers: boolean;
  pcTag?: string;
  /** card GRANDE (Gran Final) */
  big?: boolean;
  /** etiqueta de posición cuando el match define lugares: "CAMPEÓN" | "2°" */
  place?: string | null;
  /** metal del lugar: ORO (1°) · PLATA (2°) · BRONCE (3°) — pinta la card
      completa con el metal y anula el sombreado de perdedor */
  tone?: "gold" | "silver" | "bronze" | null;
}) {
  const prevReveal = useRef<RevealState>("hidden");
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prevReveal.current !== "locked" && reveal === "locked" && prevReveal.current !== "hidden") {
      const r = requestAnimationFrame(() => setFlash(true));
      const t = setTimeout(() => setFlash(false), 600);
      prevReveal.current = reveal;
      return () => {
        cancelAnimationFrame(r);
        clearTimeout(t);
      };
    }
    prevReveal.current = reveal;
  }, [reveal]);

  if (reveal === "hidden") {
    return (
      <div className={`slot-wrap ${big ? "h-[40px]" : "h-[30px]"} mb-[3px] border border-dashed border-white/10 bg-black/30 flex items-center px-2`}>
        <span className="text-[9px] font-bold tracking-[0.3em] text-white/20 uppercase">·····</span>
      </div>
    );
  }

  if (!slot.pid) {
    return (
      <div className={`slot-wrap ${big ? "h-[40px]" : "h-[30px]"} mb-[3px] border border-dashed border-white/15 bg-black/35 flex items-center gap-1.5 px-2`}>
        <span className="w-1.5 h-1.5 bg-white/15" aria-hidden />
        <span className="text-[9px] font-extrabold tracking-[0.22em] text-white/30 uppercase">Por definir</span>
      </div>
    );
  }

  const cls = [
    "slot-wrap plate relative mb-[3px] flex items-stretch overflow-hidden",
    big ? "h-[40px]" : "h-[30px]",
    isDq ? "slot-dq" : "",
    slot.st === "rep" ? "slot-sub" : "",
    tone === "gold" ? "slot-gold" : tone === "silver" ? "slot-silver" : tone === "bronze" ? "slot-bronze" : "",
    isWinner && !tone ? "slot-winner" : "",
    isLoser && !isDq && !tone ? "slot-loser" : "",
    isLive && !isWinner && !isLoser && !tone ? "slot-live" : "",
    flash ? "lock-pop" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      {/* marcador */}
      <div className={`red-badge clip-badge shrink-0 flex items-center justify-center ${big ? "w-[44px]" : "w-[34px]"}`}>
        <span className={`font-display italic leading-none pt-[1px] ${big ? "text-[20px]" : "text-[15px]"}`}>{slot.score}</span>
      </div>
      {/* nombre + miembros */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-2 leading-none">
        {reveal === "rolling" ? (
          <span className={`font-extrabold uppercase tracking-wide text-[#e8102e] truncate ${big ? "text-[15px]" : "text-[11px]"}`}>
            <RollingName pool={pool} />
          </span>
        ) : (
          <span
            className={`font-extrabold uppercase tracking-wide truncate ${big ? "text-[14px]" : "text-[11px]"} ${
              isDq ? "text-[#ff9aa8] line-through" : tone ? "metal-name" : ""
            }`}
          >
            {slot.label}
          </span>
        )}
        {showMembers && slot.members.length > 1 ? (
          <span className={`font-bold truncate mt-[2px] ${big ? "text-[10px]" : "text-[8.5px]"} ${isDq ? "text-[#ff8095]/70" : tone ? "metal-sub" : "text-[#5a5d68]"}`}>
            {slot.members.map((mm) => (mm.dq ? `✗${mm.nick}` : mm.nick)).join(" · ")}
          </span>
        ) : null}
      </div>
      {/* chip de posición/avance: en la final se muestran los LUGARES
          (CAMPEÓN / 2°) con su metal; el resto de rondas mantiene "PASA" */}
      {isWinner ? (
        place === "CAMPEÓN" ? (
          <span
            title="Campeón del torneo"
            className={`chip clip-tag self-center mr-1.5 shrink-0 font-extrabold tracking-[0.1em] uppercase ${
              tone === "gold"
                ? "metal-chip metal-chip-gold"
                : "bg-[linear-gradient(160deg,#ffe9b0,#ffc94d_55%,#d99312)] text-[#241500] shadow-[0_0_16px_rgba(255,184,48,0.5)]"
            } ${big ? "text-[10px] px-2 py-[3px]" : "text-[8px] px-1.5 py-[2px]"}`}
          >
            🏆 Campeón
          </span>
        ) : (
          <span className={`plate-gold chip clip-tag self-center mr-1.5 font-extrabold tracking-[0.1em] ${big ? "text-[9px] px-2 py-[3px]" : "text-[8px] px-1.5 py-[2px]"}`}>PASA</span>
        )
      ) : isLoser && place === "2°" && !isDq ? (
        <span
          title="Subcampeón"
          className={`chip clip-tag self-center mr-1.5 shrink-0 font-extrabold tracking-[0.1em] uppercase ${
            tone === "silver"
              ? "metal-chip metal-chip-silver"
              : "bg-[linear-gradient(160deg,#fdfdfe,#d4d6dc_55%,#9ea2ad)] text-[#141519]"
          } ${big ? "text-[10px] px-2 py-[3px]" : "text-[8px] px-1.5 py-[2px]"}`}
        >
          2°
        </span>
      ) : null}
      {pcTag ? (
        <span
          title={isLive ? "PC del escenario — match en juego" : "PC asignada a este lado"}
          className={`chip clip-tag self-center mr-1.5 shrink-0 flex items-center gap-[3px] text-[7.5px] px-1 py-[2px] font-extrabold tracking-[0.06em] tabular-nums border ${
            isLive ? "bg-[#e8102e]/15 text-[#ff2440] border-[#e8102e]/45" : "bg-black/45 text-[#a9adb8] border-white/15"
          }`}
        >
          <Monitor size={7} />
          {pcTag}
        </span>
      ) : null}
      <div className="dq-stamp">
        <span>DQ</span>
      </div>
      {flash ? (
        <>
          <div className="absolute inset-0 bg-white flash-in pointer-events-none" />
          <div className="absolute inset-0 ring-burst pointer-events-none outline outline-2 outline-[#ff2440]" />
        </>
      ) : null}
    </div>
  );
}

export function MatchCard({
  bracket,
  r,
  m,
  modality,
  mode,
  selected,
  onSelect,
  scheduledStart,
  reveal = [],
  pool = [],
  showTimes = true,
  big = false,
}: {
  bracket: Bracket;
  r: number;
  m: number;
  modality: number;
  mode: "viewer" | "admin";
  selected?: boolean;
  onSelect?: () => void;
  scheduledStart?: number | null;
  reveal?: RevealState[];
  pool?: string[];
  showTimes?: boolean;
  /** card GRANDE con protagonismo extra — usada en la Gran Final */
  big?: boolean;
}) {
  const match: Match = bracket.rounds[r][m];
  const isFinal = bracket.rounds.length === r + 1;
  const done = match.status === "done";
  const live = match.status === "live";
  const bothEmpty = match.slots.every((s) => !s.pid);
  /* PCs del match: guardadas si está en juego, o plan derivada si está listo
     (primeros grupos libres en orden de bracket; al terminar un match el
     siguiente hereda su grupo) */
  const pcs = useMemo(() => plannedPcs(bracket, modality as Modality).get(match.id), [bracket, match.id, modality]);
  const pcsStr = pcsLabel(pcs);
  /* PC por lado del match (badge dentro de cada slot) */
  const sidePcs = useMemo(
    () => match.slots.map((_, i) => (pcs && pcs.length ? pcsCompact(pcsForSide(modality as Modality, pcs, i)) : "")),
    [match.slots, pcs, modality]
  );
  const prevW = useRef<number | null>(match.w);
  const [winFlash, setWinFlash] = useState(false);
  useEffect(() => {
    if (match.w !== null && prevW.current !== match.w) {
      prevW.current = match.w;
      const r = requestAnimationFrame(() => setWinFlash(true));
      const t = setTimeout(() => setWinFlash(false), 900);
      return () => {
        cancelAnimationFrame(r);
        clearTimeout(t);
      };
    }
    prevW.current = match.w;
  }, [match.w]);

  const states: RevealState[] = reveal.length ? reveal : match.slots.map(() => "locked");
  const rv = (i: number): RevealState => states[i] ?? "locked";

  const body = (
    <div
      className="w-[var(--cw)] select-none"
      style={{ width: big ? 320 : "var(--cw)" }}
      role={mode === "admin" ? "button" : undefined}
      aria-label={mode === "admin" ? `Seleccionar ${matchTag(bracket, r, m)}` : undefined}
    >
      {/* fila superior: tag + PCs + hora */}
      <div className={`flex items-center justify-between mb-[5px] px-[1px] ${big ? "h-[18px]" : "h-[14px]"}`}>
        <span
          className={`font-extrabold uppercase whitespace-nowrap ${big ? "text-[11px] tracking-[0.22em]" : "text-[8.5px] tracking-[0.18em]"} ${
            isFinal ? "text-[#ff2440]" : "text-[#8e919c]"
          }`}
        >
          {match.bye ? "BYE DIRECTO" : matchTag(bracket, r, m)}
        </span>
        <span className="flex items-center gap-1.5 min-w-0">
          {pcsStr && !match.bye && !bothEmpty ? (
            <span
              title={live ? "PCs del escenario — match en juego" : "PCs planificadas para este match"}
              className={`flex items-center gap-[3px] font-extrabold tracking-[0.06em] uppercase tabular-nums whitespace-nowrap ${big ? "text-[10px]" : "text-[9px]"} ${
                live ? "text-[#ff2440]" : "text-[#a9adb8]"
              }`}
            >
              <Monitor size={big ? 11 : 9} />
              {pcsStr.replace(/\s·\s/g, "·")}
            </span>
          ) : null}
          {live ? (
            <span className={`font-extrabold tracking-[0.2em] text-[#ff2440] blink uppercase ${big ? "text-[10px]" : "text-[8.5px]"}`}>● En juego</span>
          ) : showTimes && scheduledStart && !match.bye && !bothEmpty ? (
            <span className={`flex items-center gap-1 font-bold tracking-[0.08em] text-[#a9adb8] tabular-nums ${big ? "text-[10px]" : "text-[8.5px]"}`}>
              <Clock size={big ? 10 : 8} />
              {fmtTime(scheduledStart)}
            </span>
          ) : null}
        </span>
      </div>

      {/* slots */}
      {match.slots.map((s, i) => {
        const wonFinal = isFinal && done && match.w !== null && s.pid;
        return (
          <SlotView
            key={i}
            slot={s}
            modality={modality}
            isWinner={done && match.w === i && !!s.pid}
            isLoser={done && match.w !== i && !!s.pid}
            isDq={s.st === "dq"}
            isLive={live}
            reveal={rv(i)}
            pool={pool}
            showMembers={modality > 1}
            pcTag={states[i] === "locked" && s.pid ? sidePcs[i] || undefined : undefined}
            big={big}
            /* LUGARES en la final: ganador = CAMPEÓN (ORO), perdedor = 2° (PLATA).
               El metal pinta la card completa — sin sombreado para el 2°. */
            place={wonFinal ? (match.w === i ? "CAMPEÓN" : "2°") : null}
            tone={wonFinal ? (match.w === i ? "gold" : "silver") : null}
          />
        );
      })}

      {/* flash al ganar */}
      {winFlash ? (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(60%_60%_at_50%_50%,rgba(255,184,48,0.35),transparent_70%)]" />
      ) : null}
    </div>
  );

  if (mode === "admin") {
    return (
      <motion.div
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.99 }}
        onClick={onSelect}
        className={`relative cursor-pointer ${selected ? "z-10" : ""}`}
      >
        <div
          className={`clip-card-sm p-[3px] transition-all ${
            selected
              ? "bg-[linear-gradient(160deg,#ff2440,#8f0a1e)] shadow-[0_0_0_2px_rgba(255,36,64,0.35),0_10px_30px_rgba(232,16,46,0.3)]"
              : "bg-transparent"
          }`}
        >
          {body}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(0.4, r * 0.06) }}
      className="relative"
    >
      {body}
    </motion.div>
  );
}
