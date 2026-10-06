"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { ArrowDownToLine, Repeat } from "lucide-react";
import type { SubEnterData } from "@/lib/spotlight";
import { FitLine } from "./MatchSpotlight";

/* El tipo vive en lib/spotlight.ts (compartido con el overlay de OBS); se
   re-exporta por compatibilidad. */
export type { SubEnterData } from "@/lib/spotlight";

/* ============================================================
   SubEnterOverlay — corte del visor cuando una reserva del
   banco entra a un match. Muestra el nick del nuevo jugador
   con una animación de entrada (gold burst + glitch) y el
   tag del match donde entra. Se descarta sola (~4.5s) o al
   hacer click.

   OPTIMIZADO: el burst dorado bajó de 110 a 60 partículas —
   el confetti corre en su propio canvas + rAF y era el mayor
   consumidor de CPU de este corte. La esencia (lluvia dorada)
   se conserva.
   Modo `transparent`: variante para el overlay de OBS (/?obs=anims).
   ============================================================ */

export function SubEnterOverlay({
  data,
  onDone,
  transparent,
}: {
  data: SubEnterData;
  onDone: () => void;
  transparent?: boolean;
}) {
  useEffect(() => {
    // burst dorado al entrar (respeta prefers-reduced-motion)
    const colors = ["#ffb830", "#ffe9b0", "#ffffff"];
    confetti({
      particleCount: 40,
      spread: 70,
      startVelocity: 38,
      origin: { y: 0.42 },
      colors,
      disableForReducedMotion: true,
      scalar: 0.9,
    });
    confetti({
      particleCount: 20,
      spread: 110,
      decay: 0.92,
      scalar: 1.15,
      origin: { y: 0.42 },
      colors,
      disableForReducedMotion: true,
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.3 }}
      onClick={onDone}
      role="presentation"
      aria-label={`Reserva ${data.nick} entra al match`}
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-7 sm:gap-9 px-5 sm:px-10 overflow-hidden cursor-pointer select-none"
      style={{
        /* transparent: velo suave para OBS — se ve la escena detrás */
        background: transparent
          ? "radial-gradient(95% 75% at 50% 45%, rgba(20,16,4,0.55) 0%, rgba(12,10,4,0.3) 58%, rgba(7,7,8,0) 100%)"
          : "radial-gradient(95% 75% at 50% 45%, rgba(20,16,4,0.82) 0%, rgba(12,10,4,0.93) 58%, rgba(7,7,8,0.98) 100%)",
      }}
    >
      {/* líneas doradas arriba/abajo */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,transparent,#ffb830,transparent)]" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[linear-gradient(90deg,transparent,#ffb830,transparent)]" aria-hidden />

      {/* tag superior */}
      <motion.div
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, type: "spring", stiffness: 220, damping: 20 }}
        className="flex items-center gap-3 max-w-full"
      >
        <span className="slashes w-10 h-4 inline-block" aria-hidden />
        <span className="chip clip-tag bg-[#ffb830] text-[#241500] text-[11px] sm:text-[12px] font-extrabold tracking-[0.3em] uppercase flex items-center gap-2">
          <Repeat size={12} />
          Reserva entra al match
        </span>
        <span className="slashes w-10 h-4 inline-block" aria-hidden />
      </motion.div>

      {/* match tag */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="red-badge clip-badge px-4 py-1.5 text-[11px] sm:text-[12px] font-extrabold tracking-[0.3em] uppercase"
      >
        {data.matchTag}
      </motion.span>

      {/* nick del nuevo jugador — una sola línea, auto-escalado */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.22 }}
        className="w-full max-w-[1250px] flex flex-col items-center gap-4"
      >
        <FitLine>
          <span
            className="font-display italic uppercase leading-[0.95] whitespace-nowrap glitch-in text-silver-grad"
            style={{
              fontSize: "clamp(34px, 6vw, 80px)",
              filter: "drop-shadow(0 0 16px rgba(255,184,48,0.5))",
            }}
          >
            {data.nick || "—"}
          </span>
        </FitLine>
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 320, damping: 18 }}
          className="chip clip-tag bg-[#ffb830]/14 border border-[#ffb830]/40 text-[#ffb830] text-[10px] sm:text-[11px] font-extrabold tracking-[0.26em] uppercase px-4 py-1.5 flex items-center gap-2"
        >
          <ArrowDownToLine size={13} />
          Entra al bracket
        </motion.span>
      </motion.div>

      {/* hint de descarte */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-5 text-[9px] font-bold tracking-[0.3em] uppercase text-[#6b6e78]"
      >
        Toca para continuar
      </motion.span>
    </motion.div>
  );
}
