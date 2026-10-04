"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Monitor, Swords, Trophy, Zap } from "lucide-react";

/* ============================================================
   MatchSpotlight — corte dramático del visor (transmisión).
   Se dispara cuando el admin marca un ganador (kind "win") o
   pone un match en juego (kind "live"): el visor tiembla con un
   glitch sutil y este overlay ocupa la pantalla 10 s mostrando
   el enfrentamiento con vs.png y las PCs de cada lado, resaltando
   al ganador, y luego regresa solo a los brackets.

   · Los nicks SIEMPRE se muestran completos en UNA sola línea:
     pueden usar el espacio a izquierda/derecha y, si aún no caben,
     se escalan automáticamente sin partirse en dos renglones.
   · FFA (1v1v1v1): los 4 jugadores se presentan en una cuadrícula 2×2.
   ============================================================ */

export interface SpotlightPlayer {
  name: string;
  score: number;
  pcs: string[]; // PCs del lado (ej. ["PC1"])
}

export interface SpotlightData {
  id: string; // clave única del evento (para re-disparar animaciones)
  kind: "win" | "live";
  tag: string; // "SEMI · M2" | "GRAN FINAL"
  players: SpotlightPlayer[];
  winner: number | null; // índice del slot ganador (kind "win")
  winsNeeded: number;
}

/** Escala su contenido (nowrap) para que SIEMPRE quepa en una línea. */
export function FitLine({
  children,
  origin = "center",
  align = "center",
  minScale = 0.3,
  className = "",
}: {
  children: React.ReactNode;
  origin?: "center" | "left" | "right";
  align?: "start" | "center" | "end";
  minScale?: number;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const measure = () => {
      const o = outerRef.current;
      const i = innerRef.current;
      if (!o || !i) return;
      const avail = o.clientWidth;
      const natural = i.scrollWidth;
      if (avail > 0 && natural > avail) setScale(Math.max(minScale, avail / natural));
      else setScale(1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [minScale, children]);

  const tfOrigin = origin === "left" ? "left center" : origin === "right" ? "right center" : "center center";
  const justify = align === "start" ? "justify-start" : align === "end" ? "justify-end" : "justify-center";
  return (
    <div ref={outerRef} className={`min-w-0 max-w-full flex ${justify} ${className}`}>
      <div
        style={{
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: tfOrigin,
          whiteSpace: "nowrap",
        }}
      >
        <div ref={innerRef} className="inline-block whitespace-nowrap">
          {children}
        </div>
      </div>
    </div>
  );
}

function PcTag({ pcs }: { pcs: string[] }) {
  if (pcs.length === 0) return null;
  return (
    <span
      className="chip clip-tag bg-[#e8102e]/15 border border-[#e8102e]/45 text-[#ff8095] text-[9px] px-2 py-1 tracking-[0.18em]"
      title="PCs del escenario donde juega este lado"
    >
      <Monitor size={10} />
      {pcs.join(" · ")}
    </span>
  );
}

function Side({
  player,
  state,
  side,
  showScore,
  compact,
}: {
  player: SpotlightPlayer;
  state: "win" | "lose" | "neutral";
  side: "left" | "right";
  showScore: boolean;
  compact?: boolean;
}) {
  const isWin = state === "win";
  const isLose = state === "lose";
  const left = side === "left";
  return (
    <motion.div
      initial={{ x: left ? -110 : 110, opacity: 0 }}
      animate={{ x: 0, opacity: isLose ? 0.3 : 1 }}
      transition={{ type: "spring", stiffness: 190, damping: 21, delay: left ? 0.08 : 0.14 }}
      className={`flex-1 min-w-0 flex flex-col ${left ? "items-end text-right" : "items-start text-left"} gap-2.5`}
    >
      {/* nick: una sola línea garantizada — usa el espacio disponible y se
          auto-escala si es demasiado largo (nunca se parte en 2 renglones) */}
      <FitLine origin={left ? "right" : "left"} align={left ? "end" : "start"}>
        <span
          className={`font-display italic uppercase leading-[0.95] whitespace-nowrap glitch-in ${
            isWin
              ? "text-silver-grad drop-shadow-[0_0_26px_rgba(232,16,46,0.6)]"
              : isLose
                ? "text-[#5a5d66]"
                : "text-silver-grad"
          }`}
          style={{ fontSize: compact ? "clamp(20px, 3.2vw, 44px)" : "clamp(26px, 4.4vw, 60px)" }}
        >
          {player.name || "—"}
        </span>
      </FitLine>
      <PcTag pcs={player.pcs} />
      {isWin ? (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.45, type: "spring", stiffness: 320, damping: 18 }}
          className="chip clip-tag bg-[#ffb830] text-[#241500] text-[10px] font-extrabold tracking-[0.22em] uppercase px-3 py-1"
        >
          <Trophy size={11} />
          Ganador
        </motion.span>
      ) : null}
      {showScore ? (
        <div
          className={`font-display italic tabular-nums leading-none ${isWin ? "text-red-grad" : "text-[#5a5d66]"}`}
          style={{ fontSize: compact ? "clamp(20px, 2.6vw, 36px)" : "clamp(24px, 3.2vw, 46px)" }}
        >
          {player.score}
        </div>
      ) : null}
    </motion.div>
  );
}

export function MatchSpotlight({ data, onDone }: { data: SpotlightData; onDone: () => void }) {
  const win = data.kind === "win";
  const ffa = data.players.length > 2;
  const stateOf = (i: number): "win" | "lose" | "neutral" =>
    win ? (data.winner === i ? "win" : "lose") : "neutral";
  const showScores = win && data.players.some((p) => p.score > 0);
  const winnerName = data.winner !== null ? data.players[data.winner]?.name : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.3 }}
      onClick={onDone}
      role="presentation"
      aria-label={win ? "Ganador del match" : "Match en juego"}
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-7 sm:gap-10 px-5 sm:px-10 overflow-hidden cursor-pointer select-none"
      style={{
        background:
          "radial-gradient(95% 75% at 50% 45%, rgba(9,9,11,0.78) 0%, rgba(9,9,11,0.93) 58%, rgba(7,7,8,0.98) 100%)",
      }}
    >
      {/* líneas de energía arriba/abajo */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,transparent,#e8102e,transparent)]" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[linear-gradient(90deg,transparent,#e8102e,transparent)]" aria-hidden />

      {/* tag del match */}
      <motion.div
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, type: "spring", stiffness: 220, damping: 20 }}
        className="flex items-center gap-3 max-w-full"
      >
        <span className="slashes w-10 h-4 inline-block" aria-hidden />
        <span className="red-badge clip-badge px-4 py-1.5 text-[11px] sm:text-[12px] font-extrabold tracking-[0.3em] uppercase">
          {data.tag}
        </span>
        <span className="chip clip-tag bg-white/[0.07] border border-white/15 text-[#d9dbe1] text-[10px] px-3 py-1.5 hidden sm:flex whitespace-nowrap">
          <Zap size={11} />
          {ffa ? "FFA · a" : "A"} {data.winsNeeded} wins
        </span>
        <span className="slashes w-10 h-4 inline-block" aria-hidden />
      </motion.div>

      {/* enfrentamiento */}
      {!ffa ? (
        <div className="w-full max-w-[1250px] flex items-center justify-center gap-4 sm:gap-8 lg:gap-12">
          <Side player={data.players[0]} state={stateOf(0)} side="left" showScore={showScores} />
          <motion.img
            src="/vs.png"
            alt="VS"
            draggable={false}
            initial={{ scale: 2.8, opacity: 0, rotate: -16 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.18 }}
            className="w-[110px] sm:w-[180px] lg:w-[225px] shrink-0"
            style={{ filter: "drop-shadow(0 14px 44px rgba(232,16,46,0.45))" }}
          />
          <Side player={data.players[1]} state={stateOf(1)} side="right" showScore={showScores} />
        </div>
      ) : (
        <div className="w-full max-w-[1250px] grid grid-cols-2 gap-x-6 sm:gap-x-14 lg:gap-x-24 gap-y-10 sm:gap-y-14 items-center justify-items-stretch">
          {data.players.map((p, i) => (
            <Side
              key={i}
              player={p}
              state={stateOf(i)}
              side={i % 2 === 0 ? "left" : "right"}
              showScore={showScores}
              compact
            />
          ))}
        </div>
      )}

      {/* banner inferior */}
      {win ? (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 20 }}
          className="live-glow flex items-center gap-3 bg-[linear-gradient(90deg,rgba(110,10,26,0.85),rgba(232,16,46,0.92),rgba(110,10,26,0.85))] px-6 sm:px-8 py-2.5 clip-tag max-w-[92vw]"
        >
          <Trophy size={16} className="text-white shrink-0" />
          <FitLine>
            <span className="text-[12px] sm:text-[15px] font-extrabold tracking-[0.26em] uppercase text-white text-center whitespace-nowrap">
              Ganador · {winnerName || "—"}
            </span>
          </FitLine>
          <Trophy size={16} className="text-white shrink-0" />
        </motion.div>
      ) : (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 20 }}
          className="flex items-center gap-3 border border-[#e8102e]/50 bg-[#e8102e]/10 px-6 sm:px-8 py-2.5 clip-tag"
        >
          <span className="w-2.5 h-2.5 bg-white rounded-full blink shrink-0" aria-hidden />
          <span className="flex items-center gap-2 text-[12px] sm:text-[15px] font-extrabold tracking-[0.26em] uppercase text-[#ff8095] text-center">
            <Swords size={15} className="shrink-0" />
            ¡El match está en juego!
          </span>
          <span className="w-2.5 h-2.5 bg-white rounded-full blink shrink-0" aria-hidden />
        </motion.div>
      )}
    </motion.div>
  );
}
