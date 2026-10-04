"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Crown, Trophy, X } from "lucide-react";
import type { Bracket, MatchSlot, Tournament } from "@/lib/types";
import { getPodium } from "@/lib/bracket";
import { Btn } from "./ui";
import { FitLine } from "./MatchSpotlight";

/* ============================================================
   Podio de campeones — overlay para el visor de espectadores
   ============================================================ */

const COLORS = ["#ff2440", "#ffffff", "#ffb830"];

function Step({
  height,
  place,
  entries,
  tone,
  delay,
}: {
  height: number;
  place: string;
  entries: (MatchSlot | null)[];
  tone: "gold" | "silver" | "bronze";
  delay: number;
}) {
  const tones = {
    gold: "bg-[linear-gradient(180deg,#ffe9b0,#ffc94d_45%,#d99312)] text-[#241500] shadow-[0_0_60px_rgba(255,184,48,0.45)]",
    silver: "bg-[linear-gradient(180deg,#fdfdfe,#d4d6dc_45%,#9ea2ad)] text-[#141519] shadow-[0_0_40px_rgba(255,255,255,0.18)]",
    bronze: "bg-[linear-gradient(180deg,#f0b48c,#cd7f45_45%,#94502a)] text-[#2a1206] shadow-[0_0_40px_rgba(205,127,69,0.3)]",
  } as const;
  const valid = entries.filter(Boolean) as MatchSlot[];
  if (valid.length === 0) return null;
  return (
    <motion.div
      initial={{ y: 140, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 20, delay }}
      className="flex flex-col items-center"
    >
      {place === "1" ? (
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 12, delay: delay + 0.2 }}
          className="mb-2"
        >
          <Crown size={38} className="text-[#ffb830]" fill="#ffb830" />
        </motion.div>
      ) : null}
      {/* placas con nicks — siempre completos en una línea (auto-escala) */}
      <div className="flex flex-col gap-1.5 mb-2 items-center">
        {valid.map((s, i) => (
          <div key={i} className="flex flex-col items-center">
            <div style={{ width: place === "1" ? "min(420px, 88vw)" : place === "2" ? "min(320px, 80vw)" : "min(260px, 72vw)" }}>
              <FitLine>
                <span
                  className={`font-display italic uppercase leading-none whitespace-nowrap text-white drop-shadow-[0_4px_18px_rgba(255,36,64,0.45)] text-center`}
                  style={{ fontSize: place === "1" ? "clamp(30px, 3.2vw, 42px)" : place === "2" ? "clamp(22px, 2.3vw, 30px)" : "clamp(17px, 1.8vw, 22px)" }}
                >
                  {s.label}
                </span>
              </FitLine>
            </div>
            {s.members.length > 1 ? (
              <span className="text-[9px] font-bold text-[#c9cbd3] mt-1 max-w-[280px] truncate">
                {s.members.map((m) => m.nick).join(" · ")}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {/* bloque del podio */}
      <div
        className={`relative w-[110px] sm:w-[170px] clip-card flex flex-col items-center justify-center gap-0.5 ${tones[tone]}`}
        style={{ height }}
      >
        <span className="font-display italic text-[26px] sm:text-[38px] leading-none">{place}</span>
        <span className="text-[8px] sm:text-[9px] font-extrabold tracking-[0.3em] uppercase opacity-75">
          {place === "1" ? "Campeón" : place === "2" ? "Subcampeón" : "3er lugar"}
        </span>
        <span className="absolute top-0 left-0 right-0 h-[3px] bg-white/40" aria-hidden />
      </div>
    </motion.div>
  );
}

export function Podium({
  bracket,
  tournament,
  onClose,
}: {
  bracket: Bracket;
  tournament: Tournament;
  onClose: () => void;
}) {
  const { champion, second, thirds } = getPodium(bracket);

  useEffect(() => {
    const fire = (ratio: number, opts: confetti.Options) =>
      confetti({ colors: COLORS, disableForReducedMotion: true, ...opts, particleCount: Math.floor(220 * ratio) });
    fire(0.25, { spread: 26, startVelocity: 55, origin: { y: 0.62 } });
    fire(0.2, { spread: 60, origin: { y: 0.62 } });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.85, origin: { y: 0.62 } });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, origin: { y: 0.62 } });
    fire(0.1, { spread: 120, startVelocity: 45, origin: { y: 0.62 } });
    const iv = setInterval(() => {
      confetti({
        particleCount: 36,
        spread: 85,
        startVelocity: 38,
        colors: COLORS,
        disableForReducedMotion: true,
        origin: { x: 0.12 + Math.random() * 0.76, y: Math.random() * 0.35 },
      });
    }, 2600);
    return () => clearInterval(iv);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto bg-[radial-gradient(85%_70%_at_50%_30%,rgba(232,16,46,0.22),rgba(7,7,8,0.96)_70%)] backdrop-blur-[2px] px-4 py-8"
    >
      {/* destellos verticales */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {[18, 38, 50, 62, 82].map((x, i) => (
          <div
            key={x}
            className="absolute top-0 h-[70%] w-[90px] opacity-25"
            style={{
              left: `${x}%`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.5), transparent 80%)",
              clipPath: "polygon(35% 0, 65% 0, 100% 100%, 0 100%)",
              transform: `translateX(-50%)`,
              animation: `floatY ${3.2 + i * 0.4}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center gap-2 mb-2">
        <span className="text-[11px] font-extrabold tracking-[0.5em] uppercase text-[#ff8095] flex items-center gap-3">
          <span className="slashes w-8 h-3.5 inline-block" aria-hidden />
          {tournament.name}
          <span className="slashes w-8 h-3.5 inline-block" aria-hidden />
        </span>
        <div className="flex items-center gap-3">
          <Trophy size={30} className="text-[#ffb830]" />
          <h2 className="font-display italic text-[40px] sm:text-[64px] uppercase leading-none text-silver-grad">
            Campeón del torneo
          </h2>
          <Trophy size={30} className="text-[#ffb830]" />
        </div>
      </div>

      <div className="relative flex items-end justify-center gap-4 sm:gap-8 mt-6 mb-4">
        <Step height={130} place="2" entries={[second]} tone="silver" delay={0.25} />
        <Step height={195} place="1" entries={[champion]} tone="gold" delay={0.05} />
        <Step height={100} place="3" entries={thirds.slice(0, 2)} tone="bronze" delay={0.45} />
      </div>

      <div className="relative mt-2">
        <Btn variant="dark" small onClick={onClose}>
          <X size={12} />
          Ver brackets
        </Btn>
      </div>
    </motion.div>
  );
}
