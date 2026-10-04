"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy } from "lucide-react";
import type { Bracket } from "@/lib/types";
import { roundLabel } from "@/lib/bracket";
import { MatchCard, type RevealState } from "./MatchCard";

/* ============================================================
   BracketTree — layout del bracket.
   · S = 2 (1v1..4v4): GRAN FINAL al centro, mitades espejo.
   · S = 4 (1v1v1v1 / FFA): MISMO ESPEJO — final al centro, mitad
     izquierda y mitad derecha; cada match recibe S ganadores de la
     ronda anterior (los slots son adaptativos según clasados reales).
   ============================================================ */

interface TreeCtx {
  bracket: Bracket;
  modality: number;
  slots: number; // slots (participantes) por match: 2 clásico · 4 FFA
  mode: "viewer" | "admin";
  selectedId?: string | null;
  onSelectMatch?: (r: number, m: number) => void;
  schedule: Map<string, number>;
  showTimes: boolean;
  revealFor?: (r: number, m: number) => RevealState[] | undefined;
  pool?: string[];
}

function matchDone(m: Bracket["rounds"][number][number] | undefined): boolean {
  return !!m && m.status === "done" && m.w !== null && !!m.slots[m.w].pid;
}

/** Match fantasma: bye estructural sin participantes ni hijos reales —
    nunca producirá ganador, así que no se dibuja (solo en FFA). */
function isPhantom(m: Bracket["rounds"][number][number] | undefined): boolean {
  return !!m && !!m.bye && m.w === null;
}

function Node({ r, m, mirror, bare, ctx }: { r: number; m: number; mirror?: boolean; bare?: boolean; ctx: TreeCtx }) {
  const { bracket, slots: S } = ctx;
  const match = bracket.rounds[r]?.[m];
  if (!match) return null;

  if (r === 0) {
    return <MatchCard bracket={bracket} r={r} m={m} modality={ctx.modality} mode={ctx.mode} selected={ctx.selectedId === match.id} onSelect={() => ctx.onSelectMatch?.(r, m)} scheduledStart={ctx.schedule.get(match.id)} showTimes={ctx.showTimes} reveal={ctx.revealFor?.(r, m)} pool={ctx.pool} />;
  }

  // hijos: los matches de la ronda anterior que alimentan cada slot
  // (en FFA se ocultan los matches fantasma: nunca producirán ganador)
  const kids = Array.from({ length: S }, (_, i) => ({ i, c: bracket.rounds[r - 1]?.[S * m + i] })).filter(
    (x): x is { i: number; c: NonNullable<typeof x.c> } => !!x.c && (S === 2 || !isPhantom(x.c))
  );
  const allDone = kids.length > 0 && kids.every((k) => matchDone(k.c));

  return (
    <div className={`bnode ${mirror ? "mirror" : ""}`}>
      <div className={`bkids ${allDone ? "lit" : ""}`} style={{ "--k": kids.length } as React.CSSProperties}>
        {kids.map(({ i, c }) => (
          <div key={i} className={`bkid ${matchDone(c) ? "won" : ""}`}>
            <Node r={r - 1} m={S * m + i} mirror={mirror} ctx={ctx} />
          </div>
        ))}
      </div>
      {bare ? (
        <MatchCard bracket={bracket} r={r} m={m} modality={ctx.modality} mode={ctx.mode} selected={ctx.selectedId === match.id} onSelect={() => ctx.onSelectMatch?.(r, m)} scheduledStart={ctx.schedule.get(match.id)} showTimes={ctx.showTimes} reveal={ctx.revealFor?.(r, m)} pool={ctx.pool} />
      ) : (
        <div className={`bcard-wrap ${match.status === "done" && match.w !== null ? "won" : ""}`}>
          <MatchCard bracket={bracket} r={r} m={m} modality={ctx.modality} mode={ctx.mode} selected={ctx.selectedId === match.id} onSelect={() => ctx.onSelectMatch?.(r, m)} scheduledStart={ctx.schedule.get(match.id)} showTimes={ctx.showTimes} reveal={ctx.revealFor?.(r, m)} pool={ctx.pool} />
        </div>
      )}
    </div>
  );
}

function RoundHeaders({ bracket, levels, mirror, pitch }: { bracket: Bracket; levels: number; mirror?: boolean; pitch: number }) {
  return (
    <>
      {Array.from({ length: levels }).map((_, i) => {
        const roundIdx = mirror ? levels - 1 - i : i;
        return (
          <div
            key={i}
            className="absolute top-0 flex items-start justify-center"
            style={{ left: i * pitch, width: pitch - 44 }}
          >
            <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#c9cbd3] whitespace-nowrap red-underline">
              {roundLabel(bracket, roundIdx)}
            </span>
          </div>
        );
      })}
    </>
  );
}

function ChampionPlate({ bracket }: { bracket: Bracket }) {
  const R = bracket.rounds.length;
  const finalMatch = bracket.rounds[R - 1]?.[0];
  const champ = finalMatch && finalMatch.w !== null ? finalMatch.slots[finalMatch.w] : null;
  return (
    <AnimatePresence>
      {champ?.pid ? (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mt-3 w-[var(--cw)] clip-card p-[2px] bg-[linear-gradient(160deg,#ffe9b0,#d99312)] shadow-[0_0_40px_rgba(255,184,48,0.4)]"
        >
          <div className="plate-gold clip-card-sm px-2 py-2 flex items-center gap-2">
            <Trophy size={18} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-[8px] font-extrabold tracking-[0.3em] uppercase opacity-70">Campeón</div>
              <div className="font-display italic text-[15px] uppercase leading-tight truncate">{champ.label}</div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function BracketTree({
  bracket,
  modality,
  mode,
  selectedId,
  onSelectMatch,
  schedule,
  showTimes = true,
  revealCount,
  pool,
}: {
  bracket: Bracket;
  modality: number;
  mode: "viewer" | "admin";
  selectedId?: string | null;
  onSelectMatch?: (r: number, m: number) => void;
  schedule: Map<string, number>;
  showTimes?: boolean;
  revealCount?: number;
  pool?: string[];
}) {
  const R = bracket.rounds.length;
  const S = bracket.s ?? 2;
  const cw = 232;
  const pitch = cw + 44 + 20; // --cw + --bgap + --stub

  // revelado (mix match): estado por slot
  const revealFor = (r2: number, m2: number): RevealState[] | undefined => {
    if (revealCount === undefined) return undefined;
    // índice global del match dentro de su ronda (solo ronda 0 se revela con animación de slots)
    if (r2 > 0) return Array.from({ length: S }, () => "locked" as RevealState);
    const base = m2 * S;
    const st = (idx: number): RevealState => (revealCount > idx ? "locked" : revealCount >= idx ? "rolling" : "hidden");
    return Array.from({ length: S }, (_, i) => st(base + i));
  };

  const ctx: TreeCtx = { bracket, modality, slots: S, mode, selectedId, onSelectMatch, schedule, showTimes, revealFor, pool };

  if (R === 1) {
    return (
      <div className="flex flex-col items-center pt-9">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#ff2440] red-underline mb-3">
          Gran Final
        </span>
        <MatchCard
          bracket={bracket}
          r={0}
          m={0}
          modality={modality}
          mode={mode}
          selected={selectedId === bracket.rounds[0][0].id}
          onSelect={() => onSelectMatch?.(0, 0)}
          scheduledStart={schedule.get(bracket.rounds[0][0].id)}
          showTimes={showTimes}
          reveal={revealFor(0, 0)}
          pool={pool}
        />
        <ChampionPlate bracket={bracket} />
      </div>
    );
  }

  /* ---------- FFA (S > 2): ESPEJO como el 1v1 — final al centro ---------- */
  if (S > 2) {
    const levels = R - 1; // rondas por mitad (sin la final)
    const halfWidth = levels * pitch - 64;

    // matches reales de la ronda previa (alimentan la final), sin fantasmas
    const prev = bracket.rounds[R - 2];
    const feeders = prev.map((match, i) => ({ i, match })).filter((x) => !isPhantom(x.match));
    const half = Math.ceil(feeders.length / 2);
    const leftKids = feeders.slice(0, half);
    const rightKids = feeders.slice(half);

    const kid = (x: { i: number; match: Bracket["rounds"][number][number] }, mirror: boolean) => (
      <div key={x.i} className={`bkid ${matchDone(x.match) ? "won" : ""}`}>
        <Node r={R - 2} m={x.i} mirror={mirror} bare ctx={ctx} />
      </div>
    );

    return (
      <div className="relative pt-9 w-max mx-auto">
        {/* encabezados de rondas */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 pointer-events-none" style={{ width: halfWidth * 2 + 312 }}>
          <div className="absolute top-0 left-0 h-full" style={{ width: halfWidth }}>
            <RoundHeaders bracket={bracket} levels={levels} pitch={pitch} />
          </div>
          <div className="absolute top-0 right-0 h-full" style={{ width: halfWidth }}>
            <RoundHeaders bracket={bracket} levels={levels} mirror pitch={pitch} />
          </div>
        </div>

        <div className="flex items-center justify-center">
          {/* mitad izquierda → slots superiores de la Gran Final */}
          {leftKids.length === 1 ? (
            <Node r={R - 2} m={leftKids[0].i} bare ctx={ctx} />
          ) : (
            <div className="bkids" style={{ "--k": leftKids.length } as React.CSSProperties}>
              {leftKids.map((x) => kid(x, false))}
            </div>
          )}
          {/* conector izquierda -> final */}
          <div className="w-10 flex items-center shrink-0">
            <FinalConn bracket={bracket} side="left" />
          </div>
          {/* centro: gran final */}
          <div className="flex flex-col items-center shrink-0 px-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#ff2440] red-underline mb-3 whitespace-nowrap">
              Gran Final
            </span>
            <MatchCard
              bracket={bracket}
              r={R - 1}
              m={0}
              modality={modality}
              mode={mode}
              selected={selectedId === bracket.rounds[R - 1][0].id}
              onSelect={() => onSelectMatch?.(R - 1, 0)}
              scheduledStart={schedule.get(bracket.rounds[R - 1][0].id)}
              showTimes={showTimes}
              reveal={revealFor(R - 1, 0)}
              pool={pool}
            />
            <ChampionPlate bracket={bracket} />
          </div>
          {/* conector derecha -> final */}
          <div className="w-10 flex items-center shrink-0">
            <FinalConn bracket={bracket} side="right" />
          </div>
          {/* mitad derecha (espejo) → slots restantes de la final */}
          {rightKids.length === 1 ? (
            <Node r={R - 2} m={rightKids[0].i} bare mirror ctx={ctx} />
          ) : (
            <div className="bkids rside" style={{ "--k": rightKids.length } as React.CSSProperties}>
              {rightKids.map((x) => kid(x, true))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const levels = R - 1; // rondas por mitad (sin la final)
  const halfWidth = levels * pitch - 64;

  return (
    <div className="relative pt-9 w-max mx-auto">
      {/* encabezados de rondas */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 pointer-events-none" style={{ width: halfWidth * 2 + 312 }}>
        <div className="absolute top-0 left-0 h-full" style={{ width: halfWidth }}>
          <RoundHeaders bracket={bracket} levels={levels} pitch={pitch} />
        </div>
        <div className="absolute top-0 right-0 h-full" style={{ width: halfWidth }}>
          <RoundHeaders bracket={bracket} levels={levels} mirror pitch={pitch} />
        </div>
      </div>

      <div className="flex items-center justify-center">
        {/* mitad izquierda */}
        <div className="flex items-center">
          <Node r={R - 2} m={0} bare ctx={ctx} />
        </div>
        {/* conector izquierda -> final */}
        <div className="w-10 flex items-center shrink-0">
          <FinalConn bracket={bracket} side="left" />
        </div>
        {/* centro: gran final */}
        <div className="flex flex-col items-center shrink-0 px-1">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#ff2440] red-underline mb-3 whitespace-nowrap">
            Gran Final
          </span>
          <MatchCard
            bracket={bracket}
            r={R - 1}
            m={0}
            modality={modality}
            mode={mode}
            selected={selectedId === bracket.rounds[R - 1][0].id}
            onSelect={() => onSelectMatch?.(R - 1, 0)}
            scheduledStart={schedule.get(bracket.rounds[R - 1][0].id)}
            showTimes={showTimes}
            reveal={revealFor(R - 1, 0)}
            pool={pool}
          />
          <ChampionPlate bracket={bracket} />
        </div>
        {/* conector derecha -> final */}
        <div className="w-10 flex items-center shrink-0">
          <FinalConn bracket={bracket} side="right" />
        </div>
        {/* mitad derecha (espejo) */}
        <div className="flex items-center">
          <Node r={R - 2} m={1} mirror bare ctx={ctx} />
        </div>
      </div>
    </div>
  );
}

function FinalConn({ bracket, side }: { bracket: Bracket; side: "left" | "right" }) {
  const R = bracket.rounds.length;
  const semi = bracket.rounds[R - 2]?.[side === "left" ? 0 : 1];
  const done = matchDone(semi);
  return (
    <div
      className="h-[2px] w-full transition-all duration-500"
      style={{
        background: done ? "var(--red-hot)" : "var(--connector)",
        boxShadow: done ? "0 0 9px rgba(255,36,64,0.85)" : "none",
      }}
    />
  );
}

/* ============================================================
   FitStage — escala el bracket para llenar la pantalla (broadcast)
   ============================================================ */
export function FitStage({
  children,
  deps,
  maxScale = 1,
  minScale = 0.32,
  className = "",
  zoom,
}: {
  children: React.ReactNode;
  deps?: unknown[];
  maxScale?: number;
  minScale?: number;
  className?: string;
  /** Zoom manual (null/undefined = auto-fit) */
  zoom?: number | null;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const compute = () => {
      const o = outerRef.current;
      const i = innerRef.current;
      if (!o || !i) return;
      const w = i.scrollWidth;
      const h = i.scrollHeight;
      if (!w || !h) return;
      const raw = Math.min((o.clientWidth - 32) / w, (o.clientHeight - 32) / h);
      const s = Math.max(minScale, Math.min(maxScale, raw));
      setScale(s);
      setClamped(raw < minScale);
    };
    const r0 = requestAnimationFrame(compute);
    const ro = new ResizeObserver(compute);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(r0);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
     
  }, deps ?? []);

  const manual = typeof zoom === "number" && zoom > 0;
  const effScale = manual ? (zoom as number) : scale;
  const effClamped = manual ? true : clamped;

  return (
    <div
      ref={outerRef}
      className={`relative flex ${effClamped ? "overflow-auto" : "overflow-hidden"} ${effClamped ? "items-start justify-start" : "items-center justify-center"} ${className}`}
    >
      <div
        style={{
          transform: `scale(${effScale})`,
          transformOrigin: effClamped ? "top left" : "center center",
          transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div ref={innerRef}>{children}</div>
      </div>
    </div>
  );
}
