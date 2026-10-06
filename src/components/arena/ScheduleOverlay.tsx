"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Monitor } from "lucide-react";
import type { Bracket, Tournament } from "@/lib/types";
import { fmtTime, matchTag, roundLabel } from "@/lib/bracket";

/* ============================================================
   ScheduleOverlay — cartelera de horarios estimados.
   Optimizada para PROYECCIÓN (pantalla sin interacción/scroll):
   · Solo matches PENDIENTES (ready o live) — los finalizados
     y los que aún no tienen participantes definidos se ocultan.
   · Agrupados por RONDA con encabezado grande (OCTAVOS,
     CUARTOS, SEMIFINALES…). Cada grupo centrado.
   · Cards responsive según la cantidad de matches: menos
     matches → cards más grandes; más matches → se acomodan
     en más columnas. Todo cabe sin scroll (CSS grid + clamp).
   ============================================================ */

type Row = {
  id: string;
  num: number; // número de match dentro de la ronda (1-based)
  parts: { name: string; score: number }[];
  time: number | null;
  status: "ready" | "live";
};

function MatchCard({ row }: { row: Row }) {
  const live = row.status === "live";
  return (
    <div
      className={`clip-card-sm flex flex-col gap-2.5 px-5 py-4 border min-w-0 ${
        live
          ? "border-[#e8102e]/70 bg-[#e8102e]/10 live-glow"
          : "border-white/15 bg-black/40"
      }`}
    >
      {/* header: M# + hora */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold tracking-[0.18em] uppercase text-[#ffb830]">M{row.num}</span>
        {live ? (
          <span className="text-[12px] font-extrabold tracking-[0.14em] text-[#ff2440] blink uppercase">● Ahora</span>
        ) : row.time ? (
          <span className="rail-time text-[26px] leading-none tabular-nums">
            {fmtTime(row.time).replace(/\s?(a\.?m\.?|p\.?m\.?)/i, "")}
          </span>
        ) : (
          <span className="text-[12px] font-bold text-[#6b6e78] uppercase">—</span>
        )}
      </div>
      {/* participantes */}
      <div className="flex flex-col gap-[5px] min-w-0">
        {row.parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className="red-badge clip-badge w-[28px] h-[19px] shrink-0 flex items-center justify-center">
              <span className="font-display italic text-[12px] leading-none pt-[1px]">{p.score}</span>
            </span>
            <span className="text-[16px] font-extrabold uppercase truncate text-[#e8e8ec]">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundGroup({ name, rows }: { name: string; rows: Row[] }) {
  const count = rows.length;
  // ancho de columna responsivo según cantidad de matches en la ronda.
  // pocas matches → columnas más anchas; muchas → más columnas.
  const colMin = count <= 2 ? 380 : count <= 4 ? 300 : count <= 6 ? 240 : 190;
  const liveInGroup = rows.some((r) => r.status === "live");
  return (
    <section className="flex flex-col items-center gap-3 w-full">
      {/* encabezado de ronda */}
      <div className="flex items-center gap-3 w-full max-w-[1500px] px-1">
        <span className="slashes w-8 h-3.5 inline-block shrink-0" aria-hidden />
        <h3
          className={`font-display italic uppercase leading-none whitespace-nowrap ${
            liveInGroup ? "text-red-grad" : "text-silver-grad"
          }`}
          style={{ fontSize: "clamp(20px, 2.6vw, 30px)" }}
        >
          {name}
        </h3>
        <span className="h-[1px] flex-1 bg-white/12" aria-hidden />
        <span className="text-[11px] font-extrabold tracking-[0.2em] uppercase text-[#6b6e78] shrink-0">
          {count} {count === 1 ? "match" : "matches"}
        </span>
      </div>
      {/* grid de matches centrado */}
      <div
        className="grid gap-4 w-full justify-items-center"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${colMin}px), 1fr))`,
          maxWidth: "1500px",
        }}
      >
        {rows.map((row) => (
          <MatchCard key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

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
  /* Solo matches PENDIENTES (ready o live) con participantes
     definidos (al menos 2 slots reales). Los finalizados (done)
     y los que aún no tienen participantes definidos se ocultan. */
  const groups = useMemo<{ name: string; rows: Row[] }[]>(() => {
    const map = new Map<string, Row[]>();
    bracket.rounds.forEach((round, r) => {
      const list: Row[] = [];
      round.forEach((match, m) => {
        if (match.bye) return;
        if (match.status === "done") return; // ocultar finalizados
        const realSlots = match.slots.filter((s) => s.pid);
        if (realSlots.length < 2) return; // ocultar sin definir
        list.push({
          id: match.id,
          num: m + 1,
          parts: match.slots.map((s) => ({ name: s.label || "—", score: s.score })),
          time: schedule.get(match.id) ?? null,
          status: match.status === "live" ? "live" : "ready",
        });
      });
      if (list.length > 0) {
        map.set(roundLabel(bracket, r), list);
      }
    });
    return [...map.entries()].map(([name, rows]) => ({ name, rows }));
  }, [bracket, schedule]);

  if (!open) return null;

  const pendingCount = groups.reduce((acc, g) => acc + g.rows.length, 0);
  const liveCount = groups.reduce((acc, g) => acc + g.rows.filter((r) => r.status === "live").length, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 bg-black/92 backdrop-blur-md flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Cartelera de horarios"
    >
      {/* encabezado */}
      <div className="shrink-0 border-b border-white/10 bg-[linear-gradient(90deg,rgba(232,16,46,0.2),transparent_45%)] px-5 sm:px-8 py-3 flex items-center gap-4">
        <Clock size={18} className="text-[#e8102e] shrink-0" />
        <div className="min-w-0">
          <div className="text-[9px] font-extrabold tracking-[0.4em] uppercase text-[#ff8095]">Cartelera de horarios</div>
          <h2 className="font-display italic text-[18px] sm:text-[22px] uppercase leading-none mt-0.5 truncate">
            <span className="text-silver-grad">{tournament.name}</span>
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {liveCount > 0 ? (
            <span className="chip clip-tag bg-[#e8102e]/15 text-[#ff8095] border border-[#e8102e]/40 text-[8px]">
              <span className="w-1.5 h-1.5 bg-[#ff2440] blink" aria-hidden />
              {liveCount} en juego
            </span>
          ) : null}
          <span className="chip clip-tag bg-white/[0.06] text-[#c9cbd3] border border-white/10 text-[8px]">
            {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
          </span>
          <span className="hidden sm:flex items-center gap-1.5 text-[8px] font-extrabold tracking-[0.2em] uppercase text-[#6b6e78]">
            <Monitor size={10} />
            Vista proyectada
          </span>
        </div>
      </div>

      {/* grupos por ronda — scroll solo si hay muchas rondas */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <Clock size={28} className="text-[#6b6e78]" />
            <p className="text-[12px] font-bold text-[#8e919c] uppercase tracking-wider">No hay matches pendientes</p>
            <p className="text-[10px] font-semibold text-[#6b6e78]">
              Todos los matches definidos ya se jugaron — espera a que avance el torneo
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 items-center w-full">
            {groups.map((g) => (
              <RoundGroup key={g.name} name={g.name} rows={g.rows} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/60 px-6 py-2 text-center">
        <span className="text-[8px] font-extrabold tracking-[0.3em] uppercase text-[#6b6e78]">
          Horarios estimados · sujetos a cambios por el administrador del torneo
        </span>
      </div>
    </motion.div>
  );
}
