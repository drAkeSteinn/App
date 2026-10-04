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
      <div className="slot-wrap h-[30px] mb-[3px] border border-dashed border-white/10 bg-black/30 flex items-center px-2">
        <span className="text-[9px] font-bold tracking-[0.3em] text-white/20 uppercase">·····</span>
      </div>
    );
  }

  if (!slot.pid) {
    return (
      <div className="slot-wrap h-[30px] mb-[3px] border border-dashed border-white/15 bg-black/35 flex items-center gap-1.5 px-2">
        <span className="w-1.5 h-1.5 bg-white/15" aria-hidden />
        <span className="text-[9px] font-extrabold tracking-[0.22em] text-white/30 uppercase">Por definir</span>
      </div>
    );
  }

  const cls = [
    "slot-wrap plate relative h-[30px] mb-[3px] flex items-stretch overflow-hidden",
    isDq ? "slot-dq" : "",
    isWinner ? "slot-winner" : "",
    isLoser && !isDq ? "slot-loser" : "",
    isLive && !isWinner && !isLoser ? "slot-live" : "",
    flash ? "lock-pop" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      {/* marcador */}
      <div className="red-badge clip-badge w-[34px] shrink-0 flex items-center justify-center">
        <span className="font-display italic text-[15px] leading-none pt-[1px]">{slot.score}</span>
      </div>
      {/* nombre + miembros */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-2 leading-none">
        {reveal === "rolling" ? (
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#e8102e] truncate">
            <RollingName pool={pool} />
          </span>
        ) : (
          <span
            className={`text-[11px] font-extrabold uppercase tracking-wide truncate ${
              isDq ? "text-[#ff9aa8] line-through" : ""
            }`}
          >
            {slot.label}
          </span>
        )}
        {showMembers && slot.members.length > 1 ? (
          <span className={`text-[8.5px] font-bold truncate mt-[2px] ${isDq ? "text-[#ff8095]/70" : "text-[#5a5d68]"}`}>
            {slot.members.map((mm) => (mm.dq ? `✗${mm.nick}` : mm.nick)).join(" · ")}
          </span>
        ) : null}
      </div>
      {isWinner ? (
        <span className="plate-gold chip clip-tag self-center mr-1.5 text-[8px] px-1.5 py-[2px] tracking-[0.1em]">PASA</span>
      ) : null}
      {slot.st === "rep" && !isDq ? (
        <span className="chip clip-tag self-center mr-1.5 text-[8px] px-1.5 py-[2px] bg-[#1a1a21] text-[#8e919c] border border-white/15 tracking-[0.1em]">
          SUB
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
      style={{ width: "var(--cw)" }}
      role={mode === "admin" ? "button" : undefined}
      aria-label={mode === "admin" ? `Seleccionar ${matchTag(bracket, r, m)}` : undefined}
    >
      {/* fila superior: tag + PCs + hora */}
      <div className="flex items-center justify-between mb-[5px] px-[1px] h-[14px]">
        <span
          className={`text-[8.5px] font-extrabold uppercase tracking-[0.18em] whitespace-nowrap ${
            isFinal ? "text-[#ff2440]" : "text-[#8e919c]"
          }`}
        >
          {match.bye ? "BYE DIRECTO" : matchTag(bracket, r, m)}
        </span>
        <span className="flex items-center gap-1.5 min-w-0">
          {pcsStr && !match.bye && !bothEmpty ? (
            <span
              title={live ? "PCs del escenario — match en juego" : "PCs planificadas para este match"}
              className={`flex items-center gap-[3px] text-[9px] font-extrabold tracking-[0.06em] uppercase tabular-nums whitespace-nowrap ${
                live ? "text-[#ff2440]" : "text-[#a9adb8]"
              }`}
            >
              <Monitor size={9} />
              {pcsStr.replace(/\s·\s/g, "·")}
            </span>
          ) : null}
          {live ? (
            <span className="text-[8.5px] font-extrabold tracking-[0.2em] text-[#ff2440] blink uppercase">● En juego</span>
          ) : showTimes && scheduledStart && !match.bye && !bothEmpty ? (
            <span className="flex items-center gap-1 text-[8.5px] font-bold tracking-[0.08em] text-[#a9adb8] tabular-nums">
              <Clock size={8} />
              {fmtTime(scheduledStart)}
            </span>
          ) : null}
        </span>
      </div>

      {/* slots */}
      {match.slots.map((s, i) => (
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
        />
      ))}

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
