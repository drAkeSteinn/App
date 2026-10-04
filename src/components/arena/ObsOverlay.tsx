"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Bracket, Match, Modality } from "@/lib/types";
import { useBracket, useTournaments } from "@/lib/hooks";
import { pcForPlayer, pcGroups, pcsKey } from "@/lib/pcs";

/* ============================================================
   OBS OVERLAY — fuente de navegador (Browser Source) para OBS Studio
   URL: /?obs=1   (GENERAL para todos los torneos: solo corre un
   torneo a la vez, así que la URL nunca cambia y se configura una
   sola vez en OBS. Opcional: /?obs=1&t=<id> fuerza un torneo.)

   · Fondo TRANSPARENTE y cards MÍNIMAS: únicamente la barra de cada
     jugador con su PC + nick + marcador (OBS compone el alfa sobre la
     escena). Sin recuadros de video, sin VS, sin adornos.
   · Barras GRANDES (listas para OBS sin escalar) y siempre en el
     mismo lugar según la modalidad:
       1v1 → 2 zonas fijas (PC1·PC2 arriba, PC3·PC4 abajo), 1 barra por lado
       2v2 → 1 zona fija, 2 barras por lado (PC1·PC2 vs PC3·PC4)
       3v3 → 1 zona fija, 3 barras por lado (estaciones hasta PC3)
       4v4 → 1 zona fija, 4 barras por lado (las 4 PCs)
       1v1v1v1 (FFA) → 1 zona fija, cuadrícula 2×2 (mismo tamaño de card que 1v1)
   · Solo se muestran los matches EN JUEGO. Al definirse un ganador, su
     barra lo resalta en dorado ~8 s y después la zona pasa a
     "ESPERANDO MATCH" hasta que otro match se marque en vivo.
   ============================================================ */

const WIN_HOLD_MS = 8000;

interface ZoneState {
  match: Match;
  pcs: string[];
}

interface WinSnap {
  id: string;
  matchId: string;
  match: Match; // snapshot con ganador definido
  pcs: string[]; // PCs que tenía el match cuando estaba en juego
  winner: number;
  until: number;
}

/** Mapa "grupo de PCs" → match en juego que lo ocupa. */
function liveZoneMap(bracket: Bracket, modality: Modality): Map<string, ZoneState> {
  const map = new Map<string, ZoneState>();
  const used = new Set<string>();
  for (const round of bracket.rounds) {
    for (const match of round) {
      if (match.status !== "live") continue;
      let pcs = match.pcs?.length ? match.pcs : null;
      if (!pcs) {
        // compatibilidad: match en juego sin PCs guardadas → primer grupo libre
        pcs = pcGroups(modality).find((g) => !used.has(g.join("|"))) ?? null;
      }
      if (!pcs) continue;
      map.set(pcsKey(pcs), { match, pcs });
      used.add(pcsKey(pcs));
    }
  }
  return map;
}

/* nick con auto-ajuste: si el texto no cabe, baja su font-size en vez de
   truncarlo con “…” — así el nombre siempre se lee completo.
   Se mide SIEMPRE al tamaño base (se resetea antes de medir) para evitar
   bucles, y se re-mide cuando termina de cargar la fuente (FOUT). */
function ObsNick({ nick }: { nick: string }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const txtRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      const txt = txtRef.current;
      if (!box || !txt) return;
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const base = parseFloat(cs.fontSize);
      if (avail <= 0 || !(base > 0)) return;
      // itera: aplica → mide → re-escala, hasta que quepa (2-3 vueltas;
      // cubre la no-linealidad del render de fuentes y la carga async)
      let fs = base;
      for (let i = 0; i < 5; i++) {
        txt.style.fontSize = `${fs}px`;
        const w = txt.scrollWidth;
        if (w <= avail) break;
        const next = fs * (avail / w) * 0.995;
        fs = Math.max(0.5 * base, next);
        if (next <= 0.5 * base) break; // piso alcanzado: CSS aplica "…"
      }
    };
    measure();
    // la carga async de la fuente cambia el ancho del texto: re-medir
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => measure()).catch(() => {});
    }
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [nick]);

  return (
    <span ref={boxRef} className="obs-nick">
      <span ref={txtRef}>{nick}</span>
    </span>
  );
}

/* ---------------- Card individual (barra: PC + nick + marcador) ---------------- */

function ObsCard({
  barW,
  pc,
  nick,
  score,
  isWinner,
  isLoser,
  empty,
}: {
  barW: string;
  pc?: string | null;
  nick?: string;
  score?: number;
  isWinner?: boolean;
  isLoser?: boolean;
  empty?: boolean;
}) {
  return (
    <div
      className={`obs-card ${empty ? "" : "obs-enter"} ${isWinner ? "is-winner" : ""} ${isLoser ? "is-lose" : ""}`}
      style={{ width: barW }}
    >
      {/* barra única: PC + nombre + marcador (sólida, para legibilidad) */}
      <div className={`obs-bar ${empty ? "is-empty" : ""}`}>
        {empty ? (
          <span className="obs-wait">Esperando match</span>
        ) : (
          <>
            <span className="obs-pc" title="PC del escenario donde juega este jugador">
              {pc ?? "—"}
            </span>
            <ObsNick nick={nick ?? ""} />
            <span key={score} className="obs-score obs-score-pop">
              {score ?? 0}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Zona de enfrentamiento (grupo de PCs) ---------------- */

function ObsZone({
  group,
  state,
  modality,
}: {
  group: string[];
  state: ZoneState | null;
  modality: Modality;
}) {
  const match = state?.match ?? null;
  const pcs = state?.pcs ?? group;
  const winner = match && match.status === "done" ? match.w : null;
  const empty = !match;
  const ffa = modality === 5;
  /* lados del match: en FFA según los slots REALES del match en juego
     (R1 = 4 · Gran Final parcial = 2 o 3); sin match → forma estándar (4) */
  const slotCount = ffa ? Math.max(2, match?.slots.length || 4) : 2;
  const perSide = ffa ? 1 : modality; // barras por lado (1 en FFA, jugadores en equipos)

  /* ancho de cada barra según la modalidad (por lado se apila en columna si es por equipos).
     FFA en cuadrícula 2×2 → cada card tan grande como las de 1v1 */
  const barW = ffa || modality === 1 ? "40vw" : modality === 2 ? "34vw" : modality === 3 ? "30vw" : "28vw";

  const side = (slotIdx: number) => {
    const slot = match?.slots[slotIdx];
    if (!match || !slot?.pid) {
      // zona vacía: misma geometría exacta, con "ESPERANDO MATCH"
      return (
        <div className={`obs-zone-side ${perSide > 1 ? "is-col" : ""}`}>
          {Array.from({ length: perSide }).map((_, i) => (
            <ObsCard key={`ph${i}`} barW={barW} empty />
          ))}
        </div>
      );
    }
    const members = slot.members.length ? slot.members : [{ pid: slot.pid, nick: slot.label }];
    return (
      <div className={`obs-zone-side ${perSide > 1 ? "is-col" : ""}`}>
        {members.map((mm, i) => (
          <ObsCard
            key={`${mm.pid}-${i}`}
            barW={barW}
            pc={pcForPlayer(modality, pcs, slotIdx, i)}
            nick={mm.nick}
            score={slot.score}
            isWinner={winner === slotIdx}
            isLoser={winner !== null && winner !== slotIdx}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={`obs-zone ${ffa ? "is-ffa" : ""}`}>
      {Array.from({ length: slotCount }, (_, i) => (
        <React.Fragment key={i}>{side(i)}</React.Fragment>
      ))}
    </div>
  );
}

/* ============================================================ */

export function ObsOverlay({ tid }: { tid: string | null }) {
  const { data: tournaments } = useTournaments();

  /* Web GENERAL: si no viene ?t=, se resuelve el torneo ACTIVO solo —
     en vivo → mix match → el más reciente. La URL de OBS nunca cambia. */
  const resolvedTid = useMemo(() => {
    if (tid) return tid;
    const live = tournaments.find((t) => t.status === "live");
    if (live) return live.id;
    const mixing = tournaments.find((t) => t.status === "mixing");
    if (mixing) return mixing.id;
    return tournaments[tournaments.length - 1]?.id ?? null;
  }, [tid, tournaments]);

  const tournament = useMemo(() => tournaments.find((t) => t.id === resolvedTid) ?? null, [tournaments, resolvedTid]);
  const { data: bracket } = useBracket(resolvedTid);
  const modality: Modality = tournament?.modality ?? 1;

  /* fondo transparente para OBS: el alfa de la página se compone sobre la escena */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.background = "transparent";
    body.style.background = "transparent";
    body.classList.add("obs-mode");
    return () => {
      html.style.background = "";
      body.style.background = "";
      body.classList.remove("obs-mode");
    };
  }, []);

  /* snapshot del estado EN JUEGO (matchId → PCs) para detectar la victoria
     y mantener el resaltado unos segundos antes de "Esperando match" */
  const prevLiveRef = useRef<{ tid: string | null; live: Map<string, string[]> } | null>(null);
  const [wins, setWins] = useState<WinSnap[]>([]);

  useEffect(() => {
    const prev = prevLiveRef.current;
    const liveNow = new Map<string, string[]>();
    if (bracket) {
      for (const round of bracket.rounds) {
        for (const match of round) {
          if (match.status === "live" && match.pcs?.length) liveNow.set(match.id, match.pcs);
        }
      }
    }
    prevLiveRef.current = { tid: resolvedTid, live: liveNow };
    if (!bracket || !prev || prev.tid !== resolvedTid) return;
    // matches que estaban EN JUEGO y ahora tienen ganador definido
    const additions: WinSnap[] = [];
    for (const round of bracket.rounds) {
      for (const match of round) {
        if (match.status !== "done" || match.w === null || match.bye) continue;
        const pcs = prev.live.get(match.id);
        if (!pcs) continue;
        additions.push({
          id: `${match.id}-${match.w}-${Date.now()}`,
          matchId: match.id,
          match,
          pcs,
          winner: match.w,
          until: Date.now() + WIN_HOLD_MS,
        });
      }
    }
    if (additions.length === 0) return;
    // se difiere el setState (fuera del cuerpo síncrono del effect)
    const t = setTimeout(() => {
      setWins((ws) => {
        const alive = ws.filter((w) => w.until > Date.now());
        const fresh = additions.filter((a) => !alive.some((w) => w.matchId === a.matchId && w.winner === a.winner));
        if (fresh.length === 0) return alive.length === ws.length ? ws : alive;
        return [...alive, ...fresh];
      });
    }, 0);
    return () => clearTimeout(t);
  }, [bracket, resolvedTid]);

  /* limpieza de snapshots de victoria expirados (vuelven a "Esperando match") */
  useEffect(() => {
    if (wins.length === 0) return;
    const t = setInterval(() => {
      setWins((ws) => {
        const alive = ws.filter((w) => w.until > Date.now());
        return alive.length === ws.length ? ws : alive;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [wins.length]);

  /* zonas fijas según la modalidad: cada grupo de PCs es una zona */
  const zones = useMemo(() => {
    const groups = pcGroups(modality);
    const liveMap = bracket ? liveZoneMap(bracket, modality) : new Map<string, ZoneState>();
    return groups.map((g) => {
      const key = pcsKey(g);
      const live = liveMap.get(key) ?? null;
      const win = wins.find((w) => pcsKey(w.pcs) === key) ?? null;
      return {
        key,
        group: g,
        state: live ?? (win ? { match: win.match, pcs: win.pcs } : null),
      };
    });
  }, [bracket, modality, wins]);

  if (!resolvedTid) {
    return (
      <div className="obs-root obs-no-tournament" role="status">
        <span>Sin torneo activo</span>
      </div>
    );
  }

  /* tamaño de las barras según la modalidad (vars CSS en vw, listas para OBS sin escalar).
     El FFA (1v1v1v1) usa el MISMO tamaño de card que 1v1 — en cuadrícula 2×2 caben igual. */
  const sizeVars = {
    "--bar-h":
      modality === 1 || modality === 5
        ? "5vw"
        : modality === 2
          ? "4.4vw"
          : modality === 3
            ? "4.2vw"
            : "4vw",
    "--f-pc":
      modality === 1 || modality === 5
        ? "1.4vw"
        : modality === 2
          ? "1.25vw"
          : modality === 3
            ? "1.2vw"
            : "1.15vw",
    "--f-nick":
      modality === 1 || modality === 5
        ? "2.4vw"
        : modality === 2
          ? "2.1vw"
          : modality === 3
            ? "1.95vw"
            : "1.85vw",
    "--f-score":
      modality === 1 || modality === 5
        ? "3.4vw"
        : modality === 2
          ? "3vw"
          : modality === 3
            ? "2.8vw"
            : "2.6vw",
    "--score-w":
      modality === 1 || modality === 5
        ? "4.8vw"
        : modality === 2
          ? "4vw"
          : modality === 3
            ? "3.8vw"
            : "3.6vw",
  } as React.CSSProperties;

  return (
    <div
      className="obs-root"
      style={sizeVars}
      role="img"
      aria-label="Overlay OBS — barras con PC, nombre y marcador de los jugadores en juego"
    >
      {zones.map((z) => (
        <ObsZone key={z.key} group={z.group} state={z.state} modality={modality} />
      ))}
    </div>
  );
}
