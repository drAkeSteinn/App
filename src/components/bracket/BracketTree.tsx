"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Crown, Trophy } from "lucide-react";
import type { Bracket } from "@/lib/types";
import { roundLabel, fmtTime } from "@/lib/bracket";
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

/* BANNER DE CAMPEÓN — LA pieza estelar de los brackets: vive ARRIBA de
   todo el árbol (no en el centro) y en tamaño mucho mayor, para darle al
   campeón el protagonismo que se merece. Solo aparece con campeón real. */
function ChampionBanner({ bracket }: { bracket: Bracket }) {
  const R = bracket.rounds.length;
  const finalMatch = bracket.rounds[R - 1]?.[0];
  const champ = finalMatch && finalMatch.w !== null ? finalMatch.slots[finalMatch.w] : null;
  return (
    <AnimatePresence>
      {champ?.pid ? (
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 210, damping: 17 }}
          className="relative z-20 mx-auto mb-4 w-max max-w-[94vw]"
          aria-label="Campeón del torneo"
        >
          <div className="clip-card p-[3px] bg-[linear-gradient(160deg,#fff3c4,#ffc94d_30%,#d99312_62%,#ffe9b0)] shadow-[0_0_80px_rgba(255,184,48,0.55),0_18px_50px_rgba(0,0,0,0.55)]">
            <div className="clip-card bg-[radial-gradient(130%_160%_at_50%_0%,rgba(255,184,48,0.2),rgba(12,9,2,0.98)_62%)] px-5 sm:px-10 py-3.5 sm:py-5 flex items-center gap-4 sm:gap-7">
              <motion.span
                initial={{ rotate: -24, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 11, delay: 0.18 }}
                className="shrink-0"
              >
                <Crown className="text-[#ffb830] drop-shadow-[0_0_16px_rgba(255,184,48,0.65)]" size={46} fill="#ffb830" />
              </motion.span>
              <div className="min-w-0 text-center">
                <div className="text-[10px] sm:text-[12px] font-extrabold tracking-[0.5em] uppercase text-[#ffd977] leading-none">
                  Campeón del torneo
                </div>
                <div
                  className="font-display italic uppercase leading-[1.05] mt-1.5 max-w-[62vw] sm:max-w-[640px] truncate"
                  style={{ fontSize: "clamp(30px, 4.8vw, 56px)" }}
                >
                  <span className="text-gold-grad drop-shadow-[0_3px_22px_rgba(255,184,48,0.35)]">{champ.label}</span>
                </div>
              </div>
              <Trophy className="text-[#ffb830] shrink-0 -scale-x-100 drop-shadow-[0_0_16px_rgba(255,184,48,0.65)]" size={46} fill="#ffb830" />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* Título de la Gran Final — EL match estelar: tipografía grande, trofeos y
   líneas rojas a los lados. Mucho más protagónico que cualquier otra ronda. */
function FinalTitle() {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-4" aria-label="Gran Final">
      <span className="h-[2px] w-8 sm:w-12 bg-[linear-gradient(90deg,transparent,#ff2440)]" aria-hidden />
      <Trophy size={17} className="text-[#ffb830] shrink-0" fill="#ffb830" />
      <span className="font-display italic text-[20px] uppercase tracking-[0.28em] text-silver-grad red-underline whitespace-nowrap leading-none pb-[6px] drop-shadow-[0_0_18px_rgba(255,184,48,0.35)]">
        Gran Final
      </span>
      <Trophy size={17} className="text-[#ffb830] shrink-0 -scale-x-100" fill="#ffb830" />
      <span className="h-[2px] w-8 sm:w-12 bg-[linear-gradient(270deg,transparent,#ff2440)]" aria-hidden />
    </div>
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
      <div className="flex flex-col items-center">
        <ChampionBanner bracket={bracket} />
        <div className="flex flex-col items-center pt-10">
          <FinalTitle />
          <MatchCard
            bracket={bracket}
            r={0}
            m={0}
            modality={modality}
            mode={mode}
            big
            selected={selectedId === bracket.rounds[0][0].id}
            onSelect={() => onSelectMatch?.(0, 0)}
            scheduledStart={schedule.get(bracket.rounds[0][0].id)}
            showTimes={showTimes}
            reveal={revealFor(0, 0)}
            pool={pool}
          />
        </div>
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
      <div className="flex flex-col items-center">
        <ChampionBanner bracket={bracket} />
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
              <FinalTitle />
              <MatchCard
                bracket={bracket}
                r={R - 1}
                m={0}
                modality={modality}
                mode={mode}
                big
                selected={selectedId === bracket.rounds[R - 1][0].id}
                onSelect={() => onSelectMatch?.(R - 1, 0)}
                scheduledStart={schedule.get(bracket.rounds[R - 1][0].id)}
                showTimes={showTimes}
                reveal={revealFor(R - 1, 0)}
                pool={pool}
              />
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
      </div>
    );
  }

  const levels = R - 1; // rondas por mitad (sin la final)
  const halfWidth = levels * pitch - 64;

  return (
    <div className="flex flex-col items-center">
      <ChampionBanner bracket={bracket} />
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
            <FinalTitle />
            <MatchCard
              bracket={bracket}
              r={R - 1}
              m={0}
              modality={modality}
              mode={mode}
              big
              selected={selectedId === bracket.rounds[R - 1][0].id}
              onSelect={() => onSelectMatch?.(R - 1, 0)}
              scheduledStart={schedule.get(bracket.rounds[R - 1][0].id)}
              showTimes={showTimes}
              reveal={revealFor(R - 1, 0)}
              pool={pool}
            />
            {/* match de 3er lugar debajo de la final (solo S=2) — discreto:
                el estelar es la Gran Final, este define SOLO el 3er puesto */}
            <ThirdPlaceSection
              bracket={bracket}
              modality={modality}
              mode={mode}
              selectedId={selectedId}
              onSelectMatch={onSelectMatch}
              schedule={schedule}
              showTimes={showTimes}
            />
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
    </div>
  );
}

/* Match de 3er lugar — se renderiza debajo de la Gran Final.
   Los perdedores de las semifinales se enfrentan por el 3er lugar. */
function ThirdPlaceSection({
  bracket,
  modality,
  mode,
  selectedId,
  onSelectMatch,
  schedule,
  showTimes,
}: {
  bracket: Bracket;
  modality: number;
  mode: "viewer" | "admin";
  selectedId?: string | null;
  onSelectMatch?: (r: number, m: number) => void;
  schedule: Map<string, number>;
  showTimes: boolean;
}) {
  if (!bracket.thirdPlace) return null;
  const tp = bracket.thirdPlace;
  const done = tp.status === "done";
  const live = tp.status === "live";
  const bothEmpty = tp.slots.every((s) => !s.pid);
  const selected = selectedId === tp.id;

  /* Card COMPACTA y discreta — el protagonismo del centro es de la Gran Final.
     Bronce tenue al terminar, glow rojo solo cuando está en juego. */
  const body = (
    <div className="select-none" style={{ width: 196 }}>
      <div
        className={`clip-card-sm transition-all border ${
          done
            ? "border-[#cd7f45]/45 bg-black/45"
            : live
              ? "border-[#e8102e]/60 bg-[#e8102e]/[0.05] live-glow"
              : selected
                ? "border-[#e8102e]/70 bg-black/45"
                : "border-white/10 bg-black/40"
        }`}
      >
        <div className="bg-[#101014]/85 clip-card-sm px-2 pt-1.5 pb-1">
          <div className="flex items-center justify-between mb-[4px] px-[1px] h-[12px]">
            <span className="text-[7.5px] font-extrabold uppercase tracking-[0.18em] text-[#cd7f45]/85">3ER LUGAR</span>
            <span className="flex items-center gap-1.5 min-w-0">
              {live ? (
                <span className="text-[7.5px] font-extrabold tracking-[0.2em] text-[#ff2440] blink uppercase">● En juego</span>
              ) : done ? (
                <span className="text-[7.5px] font-extrabold tracking-[0.2em] text-[#cd7f45]/80 uppercase">Finalizado</span>
              ) : showTimes && schedule.get(tp.id) && !bothEmpty ? (
                <span className="flex items-center gap-1 text-[7.5px] font-bold tracking-[0.08em] text-[#6b6e78] tabular-nums">
                  <Clock size={7} />
                  {fmtTime(schedule.get(tp.id)!)}
                </span>
              ) : null}
            </span>
          </div>
          {tp.slots.map((s, i) => {
            const isWinner = done && tp.w === i && !!s.pid;
            const isLoser = done && tp.w !== i && !!s.pid;
            const isDq = s.st === "dq";
            if (!s.pid) {
              return (
                <div key={i} className="slot-wrap h-[24px] mb-[2px] border border-dashed border-white/12 bg-black/35 flex items-center gap-1.5 px-1.5">
                  <span className="w-1 h-1 bg-white/15" aria-hidden />
                  <span className="text-[8px] font-extrabold tracking-[0.18em] text-white/25 uppercase">Por definir</span>
                </div>
              );
            }
            const cls = [
              "slot-wrap plate relative h-[24px] mb-[2px] flex items-stretch overflow-hidden",
              isDq ? "slot-dq" : "",
              s.st === "rep" ? "slot-sub" : "",
              /* BRONCE para el 3er lugar: el metal pinta la card completa.
                 El 4° se queda normal — sin sombreado. */
              isWinner && !isDq ? "slot-bronze" : "",
              live && !isWinner ? "slot-live" : "",
            ].filter(Boolean).join(" ");
            return (
              <div key={i} className={cls}>
                <div className="red-badge clip-badge w-[24px] shrink-0 flex items-center justify-center">
                  <span className="font-display italic text-[11px] leading-none pt-[1px]">{s.score}</span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center px-1.5 leading-none">
                  <span className={`text-[9.5px] font-extrabold uppercase tracking-wide truncate ${
                    isDq ? "text-[#ff9aa8] line-through" : isWinner && !isDq ? "metal-name" : ""
                  }`}>
                    {s.label}
                  </span>
                  {modality > 1 && s.members.length > 1 ? (
                    <span className={`text-[7.5px] font-bold truncate mt-[1px] ${
                      isDq ? "text-[#ff8095]/70" : isWinner && !isDq ? "metal-sub" : "text-[#5a5d68]"
                    }`}>
                      {s.members.map((mm) => (mm.dq ? `✗${mm.nick}` : mm.nick)).join(" · ")}
                    </span>
                  ) : null}
                </div>
                {isWinner && !isDq ? (
                  <span className="chip clip-tag metal-chip metal-chip-bronze self-center mr-1 text-[7px] px-1 py-[1px] font-extrabold tracking-[0.08em] uppercase">3°</span>
                ) : isLoser && !isDq ? (
                  <span className="chip clip-tag self-center mr-1 text-[7px] px-1 py-[1px] font-extrabold tracking-[0.08em] uppercase bg-white/[0.07] text-[#8e919c] border border-white/15">4°</span>
                ) : null}
                <div className="dq-stamp"><span>DQ</span></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-1.5 mt-5">
      <span className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#cd7f45]/80 whitespace-nowrap">
        Disputa por el 3er lugar
      </span>
      {mode === "admin" ? (
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSelectMatch?.(-1, 0)}
          role="button"
          tabIndex={0}
          aria-label="Seleccionar match de 3er lugar"
          className={`cursor-pointer ${selected ? "z-10" : ""}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectMatch?.(-1, 0);
            }
          }}
        >
          {body}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          {body}
        </motion.div>
      )}
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
