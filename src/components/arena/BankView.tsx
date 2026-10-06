"use client";

import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, Repeat, Users, Zap } from "lucide-react";
import type { Bracket, Player, Tournament } from "@/lib/types";
import { MODALITY_LABEL } from "@/lib/types";
import { computeBank, type BankEntry } from "@/lib/bank";
import { ModalityChip } from "./ui";

/* ============================================================
   BankView — vista del BANCO para el visor (caster).
   Se activa cuando el admin abre el selector de banco para
   sustituir un participante. Muestra SOLO las reservas
   disponibles (las ya usadas desaparecen solas porque
   computeBank las excluye). El caster las lee en pantalla
   grande y llama al jugador que entra.
   ============================================================ */

function BankCard({ entry, index, origin }: { entry: BankEntry; index: number; origin: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, y: -10 }}
      transition={{ type: "spring", stiffness: 280, damping: 22, delay: Math.min(index * 0.04, 0.5) }}
      className="plate clip-card relative h-[110px] flex flex-col justify-center gap-1 px-4 overflow-hidden"
      aria-label={`Reserva ${index + 1}: ${entry.label}`}
    >
      <div className="absolute top-0 left-0 w-16 h-2 hazard opacity-60" aria-hidden />
      <div className="flex items-center gap-2">
        <span className="red-badge clip-badge w-8 h-7 shrink-0 flex items-center justify-center">
          <span className="font-display italic text-[14px] leading-none pt-[1px]">{index + 1}</span>
        </span>
        <span className="chip clip-tag bg-[#ffb830]/14 text-[#ffb830] border border-[#ffb830]/35 !text-[8px] tracking-[0.16em] uppercase shrink-0">
          {origin}
        </span>
        {entry.dq ? (
          <span className="chip clip-tag bg-[#e8102e] text-white !text-[8px] tracking-[0.12em] shrink-0">DQ</span>
        ) : null}
      </div>
      <div className="font-display italic uppercase leading-none text-[#141519] truncate" style={{ fontSize: "clamp(22px, 2.4vw, 34px)" }}>
        {entry.label}
      </div>
      {entry.detail ? (
        <div className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[#4a4d57] truncate">
          {entry.detail}
        </div>
      ) : null}
    </motion.div>
  );
}

export function BankView({
  t,
  bracket,
  players,
  matchTag,
}: {
  t: Tournament;
  bracket: Bracket | null;
  players: Player[];
  matchTag: string | null;
}) {
  const bankInfo = useMemo(() => computeBank(bracket, players), [bracket, players]);
  const count = bankInfo.entries.length;
  const originLabel =
    bankInfo.fromRound === null
      ? "RESERVAS DEL REGISTRO"
      : `ELIMINADOS · ${bankInfo.sourceLabel}`;

  return (
    <motion.div
      key="bank"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="absolute inset-0 flex flex-col overflow-y-auto px-5 sm:px-10 py-5 gap-5"
    >
      {/* encabezado */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <span className="slashes w-9 h-4 inline-block" aria-hidden />
        <span className="text-[11px] font-extrabold tracking-[0.4em] uppercase text-[#ffb830] flex items-center gap-2">
          <Repeat size={13} />
          Banco de reservas
        </span>
        <ModalityChip modality={t.modality} big />
        <span className="chip clip-tag bg-[#ffb830] text-[#241500] text-[10px] font-extrabold tracking-[0.18em] uppercase">
          <ArrowDownToLine size={11} />
          Reemplazo en {matchTag ?? "match"}
        </span>
        <span className="ml-auto flex items-center gap-2 text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#8e919c]">
          <Zap size={12} className="text-[#ffb830]" />
          {MODALITY_LABEL[t.modality]}
        </span>
      </div>

      {/* contador grande */}
      <div className="panel clip-card p-5 relative overflow-hidden border-[#ffb830]/25 shrink-0">
        <div className="absolute top-0 right-0 w-20 h-2.5 hazard opacity-40" aria-hidden />
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className="label-cap mb-1 flex items-center gap-1.5">
              <Users size={11} className="text-[#ffb830]" />
              Reservas disponibles
            </div>
            <div className="font-display italic leading-none tabular-nums">
              <span className="rail-time text-[54px] sm:text-[72px]">{count}</span>
            </div>
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#c9cbd3] mb-1.5">
              {originLabel}
            </div>
            <div className="text-[10px] font-bold text-[#8e919c] tracking-[0.12em] uppercase leading-relaxed">
              El administrador elegirá quién entra al match.
              <br />
              {count > 0
                ? "Llama a los reservas para tenerlos listos."
                : "No hay reservas — el administrador debe cancelar."}
            </div>
          </div>
        </div>
      </div>

      {/* grid de reservas */}
      <div className="panel clip-card p-5 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Zap size={13} className="text-[#ffb830]" />
          <span className="label-cap">Reservas listas para entrar</span>
          <span className="h-[1px] flex-1 bg-white/8" aria-hidden />
          <span className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#6b6e78]">
            {count} {count === 1 ? "reserva" : "reservas"}
          </span>
        </div>
        <AnimatePresence mode="popLayout">
          {count === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-3 py-10"
            >
              <span className="w-14 h-14 clip-card-sm border border-white/12 bg-black/40 flex items-center justify-center">
                <Users size={24} className="text-[#6b6e78]" />
              </span>
              <span className="text-[12px] font-extrabold tracking-[0.28em] uppercase text-[#6b6e78]">
                Banco vacío
              </span>
              <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#8e919c] text-center max-w-sm">
                {bankInfo.fromRound === null
                  ? "No hay reservas registradas todavía."
                  : "El banco se llena al terminar la ronda anterior."}
              </span>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1">
              {bankInfo.entries.map((e, i) => (
                <BankCard
                  key={e.key}
                  entry={e}
                  index={i}
                  origin={e.origin === "round" ? bankInfo.sourceShort : "REGISTRO"}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
