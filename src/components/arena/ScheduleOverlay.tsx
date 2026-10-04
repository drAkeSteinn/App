"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Search, X } from "lucide-react";
import type { Bracket, Tournament } from "@/lib/types";
import { fmtTime, matchTag, roundLabel } from "@/lib/bracket";

/* ============================================================
   ScheduleOverlay — cartelera completa de horarios estimados.
   Los participantes buscan su nick/equipo y ven a qué hora
   está considerado su match.
   ============================================================ */

type Row = {
  id: string;
  r: number;
  m: number;
  tag: string;
  round: string;
  parts: { name: string; score: number }[]; // participantes (2 · 4 en FFA)
  time: number | null;
  status: "ready" | "live" | "done";
};

export function ScheduleOverlay({
  bracket,
  schedule,
  tournament,
  open,
  onClose,
}: {
  bracket: Bracket;
  schedule: Map<string, number>;
  tournament: Tournament;
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    bracket.rounds.forEach((round, r) =>
      round.forEach((match, m) => {
        if (match.bye || match.slots.every((s) => !s.pid)) return;
        out.push({
          id: match.id,
          r,
          m,
          tag: matchTag(bracket, r, m),
          round: roundLabel(bracket, r),
          parts: match.slots.map((s) => ({ name: s.label || "—", score: s.score })),
          time: schedule.get(match.id) ?? null,
          status: match.status,
        });
      })
    );
    return out;
  }, [bracket, schedule]);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    if (!needle) return rows;
    return rows.filter(
      (x) =>
        x.parts.some((p) => p.name.toUpperCase().includes(needle)) ||
        x.tag.includes(needle) ||
        x.round.includes(needle)
    );
  }, [rows, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of filtered) {
      if (!map.has(row.round)) map.set(row.round, []);
      map.get(row.round)!.push(row);
    }
    return [...map.entries()];
  }, [filtered]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Cartelera de horarios"
    >
      {/* encabezado */}
      <div className="shrink-0 border-b border-white/10 bg-[linear-gradient(90deg,rgba(232,16,46,0.2),transparent_45%)] px-5 sm:px-8 py-4 flex items-center gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold tracking-[0.4em] uppercase text-[#ff8095] flex items-center gap-2">
            <Clock size={12} />
            Cartelera de horarios estimados
          </div>
          <h2 className="font-display italic text-[22px] sm:text-[30px] uppercase leading-none mt-1 truncate">
            <span className="text-silver-grad">{tournament.name}</span>
          </h2>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8e919c]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="BUSCA TU NICK O EQUIPO…"
              aria-label="Buscar nick o equipo"
              className="field-input clip-tag pl-8 pr-3 py-2 text-[11px] w-[220px] uppercase tracking-wider"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cartelera"
            className="btn-press p-2 border border-white/12 text-[#8e919c] hover:text-white hover:border-[#e8102e]/60"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* búsqueda móvil */}
      <div className="sm:hidden px-4 pt-3">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8e919c]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="BUSCA TU NICK O EQUIPO…"
            className="field-input clip-tag pl-8 pr-3 py-2 text-[11px] w-full uppercase tracking-wider"
          />
        </div>
      </div>

      {/* listado */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <Search size={24} className="text-[#6b6e78]" />
            <p className="text-[12px] font-bold text-[#8e919c] uppercase tracking-wider">
              {rows.length === 0 ? "Aún no hay horarios calculados" : "Sin resultados para tu búsqueda"}
            </p>
            <p className="text-[10px] font-semibold text-[#6b6e78]">
              {rows.length === 0
                ? "El administrador debe configurar la hora de inicio y la duración de los matches"
                : "Intenta con otro nick, equipo o ronda"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {grouped.map(([roundNameStr, list]) => (
              <section key={roundNameStr} className="panel clip-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="slashes w-6 h-3.5 inline-block" aria-hidden />
                  <h3 className="text-[11px] font-extrabold tracking-[0.24em] uppercase text-[#c9cbd3]">{roundNameStr}</h3>
                  <span className="h-[1px] flex-1 bg-white/8" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  {list.map((row) => (
                    <div
                      key={row.id}
                      className={`flex items-center gap-3 px-3 py-2 border clip-card-sm ${
                        row.status === "live"
                          ? "border-[#e8102e]/70 bg-[#e8102e]/10 live-glow"
                          : row.status === "done"
                            ? "border-white/8 bg-white/[0.02] opacity-70"
                            : "border-white/10 bg-black/30"
                      }`}
                    >
                      {/* hora */}
                      <div className="w-[64px] shrink-0 text-center">
                        {row.status === "live" ? (
                          <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#ff2440] blink uppercase">Ahora</span>
                        ) : row.time ? (
                          <span className="rail-time text-[17px] leading-none tabular-nums">{fmtTime(row.time)}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-[#6b6e78] uppercase">Por definir</span>
                        )}
                      </div>
                      <span className="w-[1px] self-stretch bg-white/10" aria-hidden />
                      {/* nombres */}
                      <div className="flex-1 min-w-0">
                        {(() => {
                          const max = Math.max(...row.parts.map((p) => p.score));
                          return row.parts.map((p, i) => (
                            <div key={i} className={`flex items-center gap-1.5 ${i > 0 ? "mt-[3px]" : ""}`}>
                              <span className="red-badge clip-badge w-[20px] h-[14px] shrink-0 flex items-center justify-center">
                                <span className="font-display italic text-[10px] leading-none pt-[1px]">{p.score}</span>
                              </span>
                              <span
                                className={`text-[12px] font-extrabold uppercase truncate ${
                                  row.status === "done" && p.score === max && max > 0 ? "text-white" : "text-[#d9dbe1]"
                                }`}
                              >
                                {p.name}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                      <span className="shrink-0 text-[8.5px] font-extrabold tracking-[0.16em] uppercase text-[#6b6e78]">{row.tag}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/60 px-6 py-2.5 text-center">
        <span className="text-[9px] font-extrabold tracking-[0.3em] uppercase text-[#6b6e78]">
          Horarios estimados · sujetos a cambios por el administrador del torneo
        </span>
      </div>
    </motion.div>
  );
}
