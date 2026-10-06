"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Shuffle } from "lucide-react";

/* ============================================================
   MixOverlay — animación de randomización para el visor
   Fases: shuffle (frenesí) -> fill (progreso) -> done (listo)
   ============================================================ */

function RollingBig({ pool }: { pool: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    /* 130ms: sigue frenético pero con ~25% menos renders que 110ms */
    const t = setInterval(() => setI((v) => (v + 1) % Math.max(1, pool.length)), 130);
    return () => clearInterval(t);
  }, [pool.length]);
  return (
    <span key={i} className="rolling block font-display italic text-[34px] sm:text-[52px] uppercase leading-none text-white truncate max-w-[80vw]">
      {pool[i % Math.max(1, pool.length)] || "???"}
    </span>
  );
}

export function MixOverlay({
  locked,
  total,
  pool,
  done,
}: {
  locked: number;
  total: number;
  pool: string[];
  done: boolean;
}) {
  const pct = total ? Math.min(100, Math.round((locked / total) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
    >
      {/* panel central — OPTIMIZADO: sin backdrop-blur (el fondo del panel
          ya es 94% opaco; el blur de pantalla completa costaba caro durante
          TODO el shuffle y no se apreciaba) */}
      <motion.div
        layout
        className="relative clip-card border border-[#e8102e]/40 bg-[linear-gradient(165deg,rgba(232,16,46,0.16),rgba(7,7,8,0.94)_45%)] px-8 sm:px-14 py-8 sm:py-10 shadow-[0_40px_120px_rgba(0,0,0,0.8),0_0_80px_rgba(232,16,46,0.25)] max-w-[92vw] overflow-hidden"
      >
        {/* franjas hazard esquinas */}
        <div className="absolute top-0 left-0 w-24 h-3 hazard opacity-80" aria-hidden />
        <div className="absolute bottom-0 right-0 w-24 h-3 hazard opacity-80" aria-hidden />

        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div
              key="shuffling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -14 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex items-center gap-3">
                <span className="slashes w-10 h-4 inline-block" aria-hidden />
                <span className="text-[11px] font-extrabold tracking-[0.5em] uppercase text-[#ff8095]">
                  Mix Match
                </span>
                <span className="slashes w-10 h-4 inline-block" aria-hidden />
              </div>

              <h2 className="font-display italic text-[30px] sm:text-[46px] uppercase leading-none text-silver-grad glitch text-center">
                Randomizando participantes
              </h2>

              <div className="h-[72px] sm:h-[84px] flex items-center">
                <RollingBig pool={pool} />
              </div>

              <div className="w-[min(440px,72vw)]">
                <div className="flex justify-between text-[9px] font-extrabold tracking-[0.24em] uppercase text-[#c9cbd3] mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Shuffle size={10} className="text-[#ff2440]" />
                    Asignando brackets
                  </span>
                  <span className="tabular-nums">
                    {Math.min(locked, total)}/{total}
                  </span>
                </div>
                <div className="h-[8px] bg-black/60 border border-white/10 overflow-hidden">
                  <motion.div
                    className="h-full bg-[linear-gradient(90deg,#ff2440,#e8102e,#ff8095)]"
                    animate={{ width: `${pct}%` }}
                    transition={{ ease: "easeOut", duration: 0.2 }}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 18 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 clip-card bg-[linear-gradient(160deg,#ff2440,#8f0a1e)] flex items-center justify-center shadow-[0_0_40px_rgba(232,16,46,0.5)]">
                <Check size={24} className="text-white" strokeWidth={3} />
              </div>
              <h2 className="font-display italic text-[30px] sm:text-[44px] uppercase leading-none text-silver-grad text-center">
                ¡Brackets listos!
              </h2>
              <p className="text-[10px] font-extrabold tracking-[0.3em] uppercase text-[#8e919c] text-center">
                Esperando al administrador para iniciar el torneo
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
