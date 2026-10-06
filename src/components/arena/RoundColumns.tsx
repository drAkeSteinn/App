"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Monitor, Trophy } from "lucide-react";
import type { Bracket, Match, Modality } from "@/lib/types";
import { fmtTime, matchTag, roundLabel, teamsInRound } from "@/lib/bracket";
import { matchPlayable } from "@/lib/types";
import { pcsCompact, pcsForSide, plannedPcs, pcsLabel } from "@/lib/pcs";

/* ============================================================
   RoundColumns — vista de rondas en columnas de cards.
   Segunda forma de administrar/ver el torneo sin recorrer
   el bracket completo de izquierda a derecha.
   ============================================================ */

function SlotLine({
  match,
  slotIdx,
  pcTag,
  onPickWinner,
}: {
  match: Match;
  slotIdx: number;
  pcTag?: string;
  onPickWinner?: (slotIdx: number) => void;
}) {
  const slot = match.slots[slotIdx];
  const done = match.status === "done";
  const isWinner = done && match.w === slotIdx && !!slot.pid;
  const isLoser = done && match.w !== slotIdx && !!slot.pid;

  if (!slot.pid) {
    return (
      <div className="h-[34px] mb-[3px] border border-dashed border-white/12 bg-black/30 flex items-center gap-1.5 px-2">
        <span className="w-1.5 h-1.5 bg-white/15" aria-hidden />
        <span className="text-[9px] font-extrabold tracking-[0.18em] text-white/25 uppercase">Por definir</span>
      </div>
    );
  }

  return (
    <div
      className={`slot-wrap plate relative h-[34px] mb-[3px] flex items-stretch overflow-hidden ${
        slot.st === "dq" ? "slot-dq" : ""
      } ${slot.st === "rep" ? "slot-sub" : ""} ${isWinner ? "slot-winner" : ""} ${isLoser ? "slot-loser" : ""}`}
    >
      <div className="red-badge clip-badge w-[34px] shrink-0 flex items-center justify-center">
        <span className="font-display italic text-[15px] leading-none pt-[1px]">{slot.score}</span>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center px-2 leading-none">
        <span
          className={`text-[11px] font-extrabold uppercase tracking-wide truncate ${
            slot.st === "dq" ? "text-[#ff9aa8] line-through" : ""
          }`}
        >
          {slot.label}
        </span>
        {slot.members.length > 1 ? (
          <span className="text-[8.5px] font-bold truncate mt-[2px] text-[#5a5d68]">
            {slot.members.map((mm) => (mm.dq ? `✗${mm.nick}` : mm.nick)).join(" · ")}
          </span>
        ) : null}
      </div>
      {/* botón ganador inline */}
      {onPickWinner && !done ? (
        <button
          type="button"
          title={`Marcar ganador: ${slot.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onPickWinner(slotIdx);
          }}
          className="btn-press shrink-0 self-center mr-1.5 p-1 border border-white/15 text-[#8e919c] hover:text-[#ffb830] hover:border-[#ffb830]/60"
        >
          <Check size={11} />
        </button>
      ) : null}
      {isWinner ? <Trophy size={12} className="text-[#ffb830] shrink-0 self-center mr-1.5" /> : null}
      {pcTag ? (
        <span
          title={match.status === "live" ? "PC del escenario — match en juego" : "PC asignada a este lado"}
          className={`chip clip-tag self-center mr-1.5 shrink-0 flex items-center gap-[3px] text-[8px] px-1 py-[2px] font-extrabold tracking-[0.06em] tabular-nums border ${
            match.status === "live" ? "bg-[#e8102e]/15 text-[#ff2440] border-[#e8102e]/45" : "bg-black/45 text-[#a9adb8] border-white/15"
          }`}
        >
          <Monitor size={8} />
          {pcTag}
        </span>
      ) : null}
      {slot.st === "dq" ? (
        <span className="chip clip-tag self-center mr-1.5 text-[8px] px-1.5 py-[2px] bg-[#e8102e] text-white tracking-[0.1em]">DQ</span>
      ) : null}
      <div className="dq-stamp">
        <span>DQ</span>
      </div>
    </div>
  );
}

export function RoundColumns({
  bracket,
  modality,
  times,
  selectedId,
  onSelectMatch,
  onPickWinner,
  showTimes = true,
}: {
  bracket: Bracket;
  modality: Modality;
  times?: Map<string, number>;
  selectedId?: string | null;
  onSelectMatch?: (r: number, m: number) => void;
  onPickWinner?: (r: number, m: number, slotIdx: number) => void;
  showTimes?: boolean;
}) {
  const R = bracket.rounds.length;
  /* PCs por match: guardadas si está en juego, plan derivada si está listo */
  const pcsMap = useMemo(() => plannedPcs(bracket, modality), [bracket, modality]);

  return (
    <div className="flex-1 min-h-0 overflow-auto border border-white/8 bg-black/30 clip-card-sm">
      <div className="flex gap-3 p-3 items-start w-max min-w-full">
        {bracket.rounds.map((round, r) => {
          const playable = round.filter((mm) => !mm.bye);
          const doneCount = playable.filter((mm) => mm.status === "done").length;
          const isFinal = r === R - 1;
          return (
            <React.Fragment key={r}>
            {/* el match de 3er lugar se juega ANTES de la Gran Final:
                su columna va justo antes de la columna de la final */}
            {isFinal && bracket.thirdPlace ? (
              <ThirdPlaceColumn
                bracket={bracket}
                modality={modality}
                times={times}
                selectedId={selectedId}
                onSelectMatch={onSelectMatch}
                onPickWinner={onPickWinner}
                showTimes={showTimes}
                pcsMap={pcsMap}
              />
            ) : null}
            <section className="w-[264px] shrink-0 flex flex-col">
              {/* encabezado de ronda */}
              <div
                className={`flex items-center justify-between px-3 py-2 mb-2 clip-tag border ${
                  isFinal
                    ? "bg-[linear-gradient(90deg,rgba(232,16,46,0.35),rgba(232,16,46,0.08))] border-[#e8102e]/50"
                    : "bg-white/[0.04] border-white/10"
                }`}
              >
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${
                    isFinal ? "text-[#ff8095]" : "text-[#c9cbd3]"
                  }`}
                >
                  {roundLabel(bracket, r)}
                </span>
                <span className="text-[9px] font-extrabold tabular-nums text-[#8e919c]">
                  {doneCount}/{playable.length}
                </span>
              </div>

              {/* cards de match */}
              <div className="flex flex-col gap-2 pb-1">
                {round.map((match, m) => {
                  const selected = selectedId === match.id;
                  const time = times?.get(match.id);
                  const pcs = pcsMap.get(match.id);
                  const pcsStr = pcsLabel(pcs);
                  const sidePcs = match.slots.map((_, i) => (pcs && pcs.length ? pcsCompact(pcsForSide(modality, pcs, i)) : ""));
                  return (
                    <motion.div
                      key={match.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onSelectMatch?.(r, m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectMatch?.(r, m);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      className={`relative text-left clip-card-sm p-[3px] transition-all cursor-pointer ${
                        selected
                          ? "bg-[linear-gradient(160deg,#ff2440,#8f0a1e)] shadow-[0_0_0_2px_rgba(255,36,64,0.35),0_10px_30px_rgba(232,16,46,0.3)]"
                          : "bg-transparent hover:bg-white/[0.06]"
                      } ${match.status === "live" ? "live-glow" : ""} ${match.bye ? "opacity-55" : ""}`}
                    >
                      <div className="bg-[#121216] clip-card-sm px-2.5 pt-2 pb-1.5">
                        {/* fila tag + estado */}
                        <div className="flex items-center justify-between mb-1.5 h-[16px]">
                          <span
                            className={`text-[8.5px] font-extrabold uppercase tracking-[0.16em] whitespace-nowrap ${
                              isFinal ? "text-[#ff2440]" : "text-[#8e919c]"
                            }`}
                          >
                            {match.bye ? "BYE DIRECTO" : matchTag(bracket, r, m)}
                          </span>
                          <span className="flex items-center gap-1.5 min-w-0">
                            {pcsStr && !match.bye ? (
                              <span
                                title={
                                  match.status === "live"
                                    ? "PCs del escenario — match en juego"
                                    : "PCs planificadas para este match"
                                }
                                className={`flex items-center gap-[3px] text-[9px] font-extrabold tracking-[0.06em] uppercase tabular-nums whitespace-nowrap ${
                                  match.status === "live" ? "text-[#ff2440]" : "text-[#a9adb8]"
                                }`}
                              >
                                <Monitor size={9} />
                                {pcsStr.replace(/\s·\s/g, "·")}
                              </span>
                            ) : null}
                            {match.status === "live" ? (
                              <span className="text-[8px] font-extrabold tracking-[0.16em] text-[#ff2440] blink uppercase">
                                ● EN JUEGO
                              </span>
                            ) : match.status === "done" ? (
                              <span className="text-[8px] font-extrabold tracking-[0.16em] text-[#ffb830]/90 uppercase">✓ FIN</span>
                            ) : showTimes && time ? (
                              <span className="flex items-center gap-1 text-[8.5px] font-bold text-[#a9adb8] tabular-nums">
                                <Clock size={8} />
                                {fmtTime(time)}
                              </span>
                            ) : null}
                          </span>
                        </div>

                        {/* slots */}
                        {match.slots.map((_, i) => (
                          <SlotLine
                            key={i}
                            match={match}
                            slotIdx={i}
                            pcTag={match.slots[i]?.pid ? sidePcs[i] || undefined : undefined}
                            onPickWinner={
                              !match.bye && matchPlayable(match)
                                ? (slotIdx) => onPickWinner?.(r, m, slotIdx)
                                : undefined
                            }
                          />
                        ))}
                      </div>
                      {/* borde inferior por estado */}
                      <span
                        aria-hidden
                        className={`absolute inset-x-[3px] bottom-[3px] h-[2px] ${
                          match.status === "live"
                            ? "bg-[#ff2440]"
                            : match.status === "done"
                              ? "bg-[#ffb830]/70"
                              : "bg-white/8"
                        }`}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </section>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* Columna del match de 3er lugar — se renderiza ANTES de la Gran Final */
function ThirdPlaceColumn({
  bracket,
  modality,
  times,
  selectedId,
  onSelectMatch,
  onPickWinner,
  showTimes,
  pcsMap,
}: {
  bracket: Bracket;
  modality: Modality;
  times?: Map<string, number>;
  selectedId?: string | null;
  onSelectMatch?: (r: number, m: number) => void;
  onPickWinner?: (r: number, m: number, slotIdx: number) => void;
  showTimes?: boolean;
  pcsMap: Map<string, string[]>;
}) {
  if (!bracket.thirdPlace) return null;
  const tp = bracket.thirdPlace;
  const tpDone = tp.status === "done";
  const tpLive = tp.status === "live";
  const tpTime = times?.get(tp.id);
  const tpPcs = pcsMap.get(tp.id);

  return (
    <section className="w-[264px] shrink-0 flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-2 mb-2 clip-tag border bg-[rgba(205,127,69,0.12)] border-[#cd7f45]/40"
      >
        <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#cd7f45]">
          3er Lugar
        </span>
        <span className="text-[9px] font-extrabold tabular-nums text-[#8e919c]">
          {tpDone ? "1/1" : "0/1"}
        </span>
      </div>
      <div className="flex flex-col gap-2 pb-1">
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSelectMatch?.(-1, 0)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectMatch?.(-1, 0);
            }
          }}
          role="button"
          tabIndex={0}
          aria-pressed={selectedId === tp.id}
          className={`relative text-left clip-card-sm p-[3px] transition-all cursor-pointer ${
            selectedId === tp.id
              ? "bg-[linear-gradient(160deg,#cd7f45,#94502a)] shadow-[0_0_0_2px_rgba(205,127,69,0.35)]"
              : "bg-transparent hover:bg-white/[0.06]"
          } ${tpLive ? "live-glow" : ""}`}
        >
          <div className="bg-[#121216] clip-card-sm px-2.5 pt-2 pb-1.5">
            <div className="flex items-center justify-between mb-1.5 h-[16px]">
              <span className="text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-[#cd7f45]">
                3ER LUGAR
              </span>
              <span className="flex items-center gap-1.5 min-w-0">
                {tpLive ? (
                  <span className="text-[8px] font-extrabold tracking-[0.16em] text-[#ff2440] blink uppercase">● EN JUEGO</span>
                ) : tpDone ? (
                  <span className="text-[8px] font-extrabold tracking-[0.16em] text-[#ffb830]/90 uppercase">✓ FIN</span>
                ) : showTimes && tpTime ? (
                  <span className="flex items-center gap-1 text-[8.5px] font-bold text-[#a9adb8] tabular-nums">
                    <Clock size={8} />
                    {fmtTime(tpTime)}
                  </span>
                ) : null}
              </span>
            </div>
            {tp.slots.map((_, i) => (
              <SlotLine
                key={i}
                match={tp}
                slotIdx={i}
                pcTag={tp.slots[i]?.pid ? pcsCompact(pcsForSide(modality, tpPcs, i)) || undefined : undefined}
                onPickWinner={
                  matchPlayable(tp)
                    ? (slotIdx) => onPickWinner?.(-1, 0, slotIdx)
                    : undefined
                }
              />
            ))}
          </div>
          <span
            aria-hidden
            className={`absolute inset-x-[3px] bottom-[3px] h-[2px] ${
              tpLive ? "bg-[#ff2440]" : tpDone ? "bg-[#cd7f45]" : "bg-white/8"
            }`}
          />
        </motion.div>
      </div>
    </section>
  );
}
