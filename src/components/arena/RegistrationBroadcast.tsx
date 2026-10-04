"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Lock, Timer, Trophy, UserPlus, Users, Zap } from "lucide-react";
import type { Player, Tournament } from "@/lib/types";
import { playersCapacity } from "@/lib/types";
import { fmtDateLong, fmtTime, groupParticipants } from "@/lib/bracket";
import { ModalityChip, StatusChip } from "./ui";
import { Countdown } from "./Countdown";

/* ============================================================
   RegistrationBroadcast — MODO REGISTRO para el visor.
   Muestra en vivo cómo se llenan los lugares del torneo,
   los lugares disponibles y el contador del banco de reservas.
   ============================================================ */

function SeatCell({
  index,
  label,
  members,
  filled,
  idxInOrder,
  closed,
}: {
  index: number;
  label: string;
  members: number;
  filled: boolean;
  idxInOrder: number;
  closed: boolean;
}) {
  if (!filled) {
    return (
      <div
        className={`clip-tag h-[54px] flex items-center gap-2.5 px-2.5 border border-white/8 bg-white/[0.02] ${closed ? "" : "seat-empty"}`}
        aria-label={`Asiento ${index + 1} ${closed ? "cerrado" : "disponible"}`}
      >
        <span className="w-7 h-7 shrink-0 clip-badge bg-white/[0.05] border border-white/10 flex items-center justify-center">
          <span className="font-display italic text-[12px] text-white/25">{index + 1}</span>
        </span>
        <span className="text-[9px] font-extrabold tracking-[0.22em] text-white/25 uppercase">
          {closed ? "Cerrado" : "Disponible"}
        </span>
      </div>
    );
  }
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.6, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 320, damping: 24, delay: Math.min(0.02 * idxInOrder, 0.8) }}
      className="seat-pop plate clip-tag relative h-[54px] flex items-center gap-2.5 px-2.5 overflow-hidden"
      aria-label={`Asiento ${index + 1}: ${label}`}
    >
      <span className="red-badge clip-badge w-7 h-7 shrink-0 flex items-center justify-center">
        <span className="font-display italic text-[12px] leading-none pt-[1px]">{index + 1}</span>
      </span>
      <div className="min-w-0 flex-1 leading-none">
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[#141519] truncate">{label}</div>
        {members > 1 ? (
          <div className="text-[8.5px] font-extrabold tracking-[0.14em] text-[#4a4d57] uppercase mt-[3px]">
            {members} integrantes
          </div>
        ) : null}
      </div>
      <UserPlus size={12} className="text-[#e8102e] shrink-0" />
    </motion.div>
  );
}

export function RegistrationBroadcast({
  t,
  players,
  onCountdownClick,
}: {
  t: Tournament;
  players: Player[];
  onCountdownClick?: () => void;
}) {
  const participants = useMemo(() => groupParticipants(players, t.modality), [players, t.modality]);
  const officials = players.filter((p) => p.seat === "off");
  const bank = players.filter((p) => p.seat === "bank");
  const capSeats = t.seats; // asientos del bracket
  const capPlayers = playersCapacity(t);
  const hasCountdown = !!t.startAt && t.startAt > Date.now();
  const pct = Math.min(100, Math.round((participants.length / Math.max(1, capSeats)) * 100));
  const bankPct = Math.min(100, Math.round((bank.length / Math.max(1, t.bankSeats)) * 100));
  const closed = t.status === "closed";

  const marquee = officials.length
    ? officials.map((p) => p.nick.toUpperCase())
    : closed
      ? ["REGISTROS CERRADOS", "ESPERANDO INICIO"]
      : ["REGISTRO ABIERTO", "ESPERANDO JUGADORES"];

  return (
    <motion.div
      key="reg"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="absolute inset-0 flex flex-col overflow-y-auto px-5 sm:px-10 py-5 gap-5"
    >
      {/* ===== encabezado de estado ===== */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <span className="slashes w-9 h-4 inline-block" aria-hidden />
        <span className="text-[11px] font-extrabold tracking-[0.4em] uppercase text-[#ff8095]">Modo registro</span>
        <StatusChip status={t.status} />
        <ModalityChip modality={t.modality} big />
        {closed ? (
          <span className="chip clip-tag bg-[#ffb830] text-[#241500] text-[10px] font-extrabold tracking-[0.18em] uppercase">
            <Lock size={10} />
            Inscripción cerrada
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2 text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#8e919c]">
          <Timer size={12} className="text-[#e8102e]" />
          Matches de {t.matchMins} min · a {t.winsNeeded} wins
        </span>
      </div>

      {/* ===== contadores grandes ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 shrink-0">
        {/* lugares principales */}
        <div className="panel clip-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-20 h-2.5 hazard opacity-70" aria-hidden />
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="label-cap mb-1">Lugares del torneo</div>
              <div className="font-display italic leading-none tabular-nums">
                <span className="text-silver-grad text-[54px] sm:text-[68px]">{participants.length}</span>
                <span className="text-[#6b6e78] text-[26px] sm:text-[32px]"> /{capSeats}</span>
              </div>
            </div>
            <div className="min-w-[180px] flex-1">
              <div className="flex justify-between text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#c9cbd3] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Users size={11} className="text-[#ff2440]" />
                  Ocupación
                </span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="h-[12px] bg-black/60 border border-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-[linear-gradient(90deg,#ff2440,#e8102e,#ff8095)]"
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 90, damping: 20 }}
                />
              </div>
              <div className="text-[9px] font-bold text-[#8e919c] tracking-[0.14em] uppercase mt-2">
                {closed
                  ? `Inscripción cerrada · ${officials.length}/${capPlayers} jugadores`
                  : `${Math.max(0, capSeats - participants.length)} lugares disponibles · ${officials.length}/${capPlayers} jugadores registrados`}
              </div>
            </div>
          </div>
        </div>

        {/* banco de reservas */}
        <div className="panel clip-card p-5 relative overflow-hidden border-[#ffb830]/25">
          <div className="absolute top-0 right-0 w-20 h-2.5 hazard opacity-40" aria-hidden />
          <div className="label-cap mb-1 flex items-center gap-1.5">
            <Zap size={11} className="text-[#ffb830]" />
            Banco de reservas
          </div>
          <div className="font-display italic leading-none tabular-nums mb-3">
            <span className="rail-time text-[44px] sm:text-[54px]">{bank.length}</span>
            <span className="text-[#6b6e78] text-[22px]"> /{t.bankSeats}</span>
          </div>
          <div className="h-[8px] bg-black/60 border border-white/10 overflow-hidden mb-3">
            <motion.div
              className="h-full bg-[linear-gradient(90deg,#d99312,#ffb830,#ffe9b0)]"
              animate={{ width: `${bankPct}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 20 }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[54px] overflow-hidden">
            {bank.length === 0 ? (
              <span className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#6b6e78]">Sin reservas aún</span>
            ) : (
              bank.map((p, i) => (
                <motion.span
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  className="chip clip-tag bg-[#ffb830]/12 text-[#ffb830] border border-[#ffb830]/35 !text-[9px]"
                  title={p.name}
                >
                  {p.nick}
                </motion.span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ===== grid de asientos ===== */}
      <div className="panel clip-card p-5 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Trophy size={13} className="text-[#e8102e]" />
          <span className="label-cap">Cuadro de lugares</span>
          <span className="h-[1px] flex-1 bg-white/8" aria-hidden />
          <span className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#6b6e78]">
            {t.modality === 1 || t.modality === 5 ? "1 asiento = 1 jugador" : `1 asiento = 1 equipo de ${t.modality}`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 overflow-y-auto pr-1 max-h-[420px]">
          <AnimatePresence initial={false}>
            {Array.from({ length: capSeats }).map((_, i) => {
              const p = participants[i];
              return (
                <SeatCell
                  key={i}
                  index={i}
                  filled={!!p}
                  idxInOrder={i}
                  label={p?.label ?? ""}
                  members={p?.members.length ?? 0}
                  closed={closed}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ===== countdown + marquee ===== */}
      <div className="shrink-0 flex flex-col items-center gap-4 pb-2">
        {hasCountdown ? (
          onCountdownClick ? (
            <button
              type="button"
              onClick={onCountdownClick}
              title="Ver el cronómetro de inicio en grande (pestaña de brackets)"
              aria-label="Cambiar a la pestaña de brackets para ver el cronómetro de inicio en grande"
              className="group btn-press flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase text-[#ff8095] flex items-center gap-2">
                <CalendarClock size={12} />
                Inicio del torneo
              </span>
              <Countdown target={t.startAt!} compact />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8e919c]">
                {fmtDateLong(t.startAt!)} · {fmtTime(t.startAt!)}
              </span>
              <span className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#ff8095] underline underline-offset-2 opacity-80 group-hover:opacity-100">
                Ver cronómetro en grande →
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase text-[#ff8095] flex items-center gap-2">
                <CalendarClock size={12} />
                Inicio del torneo
              </span>
              <Countdown target={t.startAt!} compact />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8e919c]">
                {fmtDateLong(t.startAt!)} · {fmtTime(t.startAt!)}
              </span>
            </div>
          )
        ) : null}

        <div className="w-full max-w-4xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="red-badge clip-badge px-2 py-[3px] text-[9px] font-extrabold tracking-[0.2em] uppercase">
              Registrados
            </span>
            <span className="h-[1px] flex-1 bg-white/10" aria-hidden />
          </div>
          <div className="overflow-hidden border-y border-white/8 py-2">
            <div className="marquee-track">
              {[0, 1].map((dup) => (
                <span key={dup} className="flex gap-8 pr-8 whitespace-nowrap" aria-hidden={dup === 1}>
                  {marquee.map((n, i) => (
                    <span key={i} className="font-display italic text-[15px] uppercase text-[#c9cbd3]">
                      {n}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
