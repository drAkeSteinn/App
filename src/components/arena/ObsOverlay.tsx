"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Bracket, Match, Modality } from "@/lib/types";
import { useBracket, useTournaments } from "@/lib/hooks";
import { useActiveTournament } from "@/lib/activeTournament";
import { useObsLayout, saveObsLayout, resetObsLayout, type ObsLayout, type CardPos } from "@/lib/obsLayout";
import { pcForPlayer, pcGroups, pcsKey } from "@/lib/pcs";

/* ============================================================
   OBS OVERLAY — fuente de navegador (Browser Source) para OBS Studio
   URL: /?obs=1   (GENERAL para todos los torneos: solo corre un
   torneo a la vez, así que la URL nunca cambia y se configura una
   sola vez en OBS. Opcional: /?obs=1&t=<id> fuerza un torneo.)

   · Fondo TRANSPARENTE y cards MÍNIMAS: únicamente la barra de cada
     jugador con su PC + nick + marcador (OBS compone el alfa sobre la
     escena). Sin recuadros de video, sin VS, sin adornos.
   · POSICIONES DRAGGABLES: el caster puede arrastrar cada card (PC1,
     PC2, PC3, PC4) a la posición que quiera. Las posiciones se guardan
     en Firestore (arena/obsLayout) y aplican a TODOS los torneos y
     modalidades. Se editan con /?obs=1&edit=1.
   · Si no hay posiciones guardadas, se usa el layout automático
     (flex/grid centrado según la modalidad).
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
   truncarlo con "…" — así el nombre siempre se lee completo.
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

interface ObsCardData {
  pc: string;
  nick: string;
  score: number;
  isWinner: boolean;
  isLoser: boolean;
  empty: boolean;
}

function ObsCard({
  data,
  barW,
  draggable,
  onDragStart,
}: {
  data: ObsCardData;
  barW: string;
  draggable?: boolean;
  onDragStart?: (pc: string) => void;
}) {
  return (
    <div
      className={`obs-card ${data.empty ? "" : "obs-enter"} ${data.isWinner ? "is-winner" : ""} ${data.isLoser ? "is-lose" : ""}`}
      style={{
        width: barW,
        cursor: draggable ? "grab" : undefined,
        pointerEvents: draggable ? "auto" : undefined,
      }}
      onPointerDown={draggable && !data.empty ? () => onDragStart?.(data.pc) : undefined}
    >
      {/* barra única: PC + nombre + marcador (sólida, para legibilidad) */}
      <div className={`obs-bar ${data.empty ? "is-empty" : ""}`}>
        {data.empty ? (
          <span className="obs-wait">Esperando match</span>
        ) : (
          <>
            <span className="obs-pc" title="PC del escenario donde juega este jugador">
              {data.pc ?? "—"}
            </span>
            <ObsNick nick={data.nick ?? ""} />
            <span key={data.score} className="obs-score obs-score-pop">
              {data.score ?? 0}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Zona de enfrentamiento (grupo de PCs) — layout automático ---------------- */

/** Ancho de cada barra según la modalidad (compartido entre layout
    automático, editor y transmisión con layout personalizado → mismo
    tamaño en todas partes). */
function barWidthFor(modality: Modality): string {
  return modality === 1 || modality === 5 ? "40vw" : modality === 2 ? "34vw" : modality === 3 ? "30vw" : "28vw";
}

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

  const barW = barWidthFor(modality);

  const buildCard = (slotIdx: number, memberIdx: number, mm: { pid: string; nick: string }): ObsCardData => {
    const slot = match?.slots[slotIdx];
    return {
      pc: pcForPlayer(modality, pcs, slotIdx, memberIdx),
      nick: mm.nick,
      score: slot?.score ?? 0,
      isWinner: winner === slotIdx,
      isLoser: winner !== null && winner !== slotIdx,
      empty: false,
    };
  };

  const buildEmpty = (): ObsCardData => ({
    pc: "",
    nick: "",
    score: 0,
    isWinner: false,
    isLoser: false,
    empty: true,
  });

  const side = (slotIdx: number) => {
    const slot = match?.slots[slotIdx];
    if (!match || !slot?.pid) {
      // zona vacía: misma geometría exacta, con "ESPERANDO MATCH"
      return (
        <div className={`obs-zone-side ${perSide > 1 ? "is-col" : ""}`}>
          {Array.from({ length: perSide }).map((_, i) => (
            <ObsCard key={`ph${i}`} data={buildEmpty()} barW={barW} />
          ))}
        </div>
      );
    }
    const members = slot.members.length ? slot.members : [{ pid: slot.pid, nick: slot.label }];
    return (
      <div className={`obs-zone-side ${perSide > 1 ? "is-col" : ""}`}>
        {members.map((mm, i) => (
          <ObsCard key={`${mm.pid}-${i}`} data={buildCard(slotIdx, i, mm)} barW={barW} />
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

/* ============================================================
   Hook de drag — pointer events nativos (sin dependencias).
   Devuelve la posición actual de la card que se está arrastrando.
   ============================================================ */
function useDragHandler() {
  const [draggingPc, setDraggingPc] = useState<string | null>(null);
  const [draftPos, setDraftPos] = useState<CardPos | null>(null);

  useEffect(() => {
    if (!draggingPc) return;
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setDraftPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    };
    const onUp = () => {
      setDraggingPc(null);
      setDraftPos(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingPc]);

  return { draggingPc, draftPos, startDrag: setDraggingPc };
}

/* ============================================================ */

export function ObsOverlay({ tid }: { tid: string | null }) {
  const { data: tournaments } = useTournaments();
  const active = useActiveTournament();
  const { layout: savedLayout } = useObsLayout();

  /* URL única (/?obs=1): si no viene ?t=, se resuelve el torneo ACTIVO
     desde Firestore (arena/active). Solo puede haber uno activo a la vez. */
  const resolvedTid = useMemo(() => {
    if (tid) return tid;
    return active.tid;
  }, [tid, active.tid]);

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

  /* todas las cards activas (PC + nick + score) aplanadas por PC,
     para poder posicionarlas individualmente cuando hay layout guardado. */
  const cardsByPc = useMemo(() => {
    const map = new Map<string, ObsCardData>();
    for (const z of zones) {
      if (!z.state) continue;
      const match = z.state.match;
      const pcs = z.state.pcs;
      const winner = match.status === "done" ? match.w : null;
      match.slots.forEach((slot, slotIdx) => {
        if (!slot.pid) return;
        const members = slot.members.length ? slot.members : [{ pid: slot.pid, nick: slot.label }];
        members.forEach((mm, memberIdx) => {
          const pc = pcForPlayer(modality, pcs, slotIdx, memberIdx);
          if (pc) {
            map.set(pc, {
              pc,
              nick: mm.nick,
              score: slot.score,
              isWinner: winner === slotIdx,
              isLoser: winner !== null && winner !== slotIdx,
              empty: false,
            });
          }
        });
      });
    }
    return map;
  }, [zones, modality]);

  /* todas las PCs que aparecen en cualquier modalidad (para edición) */
  const allPcs = useMemo(() => {
    const set = new Set<string>();
    pcGroups(modality).forEach((g) => g.forEach((pc) => set.add(pc)));
    // también las del otro grupo si es 1v1
    if (modality === 1) {
      ["PC1", "PC2", "PC3", "PC4"].forEach((pc) => set.add(pc));
    }
    return [...set];
  }, [modality]);

  /* ----- MODO EDICIÓN: ?edit=1 — las cards son draggable ----- */
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setEditMode(sp.get("edit") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  /* draft local de posiciones (mientras se arrastra, antes de guardar) */
  const [draftLayout, setDraftLayout] = useState<ObsLayout>(savedLayout);
  useEffect(() => {
    setDraftLayout(savedLayout);
  }, [savedLayout]);

  const { draggingPc, draftPos, startDrag } = useDragHandler();

  /* mientras se arrastra una card, actualiza su posición en el draft */
  useEffect(() => {
    if (draggingPc && draftPos) {
      setDraftLayout((prev) => ({ ...prev, [draggingPc]: draftPos }));
    }
  }, [draggingPc, draftPos]);

  const hasCustomLayout = Object.keys(draftLayout).length > 0;

  /* posiciones por defecto (layout automático) cuando no hay guardado */
  const defaultPos = (pc: string): CardPos => {
    const num = parseInt(pc.replace("PC", ""), 10);
    // 1v1: PC1·PC2 arriba (fila 1), PC3·PC4 abajo (fila 2)
    // equipos/FFA: las 4 PCs en columna izquierda
    if (modality === 1) {
      if (num === 1) return { x: 25, y: 38 };
      if (num === 2) return { x: 75, y: 38 };
      if (num === 3) return { x: 25, y: 62 };
      return { x: 75, y: 62 };
    }
    // FFA: cuadrícula 2×2
    if (modality === 5) {
      if (num === 1) return { x: 25, y: 38 };
      if (num === 2) return { x: 75, y: 38 };
      if (num === 3) return { x: 25, y: 62 };
      return { x: 75, y: 62 };
    }
    // equipos (2v2/3v3/4v4): columna izquierda, apiladas
    const total = modality === 2 ? 2 : modality === 3 ? 3 : 4;
    const idx = num - 1;
    const step = 80 / total;
    return { x: 30, y: 10 + step * idx + step / 2 };
  };

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

  /* ===== MODO EDICIÓN ===== */
  if (editMode) {
    return (
      <div
        className="obs-root"
        style={{ ...sizeVars, display: "block", pointerEvents: "auto", background: "#0d0d12" }}
        role="application"
        aria-label="Editor de posición de cards de OBS — arrastra las cards a la posición deseada"
      >
        {/* toolbar de edición */}
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "10px 16px",
          background: "rgba(7, 7, 8, 0.95)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
        }}>
          <span style={{
            flex: 1,
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#ffb830",
          }}>
            Editor de cards OBS — arrastra cada card a su posición
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setDraftLayout({})}
              title="Restablecer al layout automático (sin posiciones guardadas)"
              style={{
                padding: "8px 16px",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#c9cbd3",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={async () => {
                await saveObsLayout(draftLayout);
                toast.success("Posiciones guardadas — se aplican a todos los torneos");
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("edit");
                  window.location.href = url.toString();
                } catch {
                  window.location.href = "/?obs=1";
                }
              }}
              style={{
                padding: "8px 16px",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                border: "1px solid #ff2440",
                background: "linear-gradient(160deg, #ff2440, #a30d24)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Guardar posiciones
            </button>
          </div>
        </div>
        {/* cards editables — posición absoluta, draggable */}
        {allPcs.map((pc) => {
          const pos = draftLayout[pc] ?? defaultPos(pc);
          const card = cardsByPc.get(pc);
          const data: ObsCardData = card ?? {
            pc,
            nick: `Jugador ${pc}`,
            score: 0,
            isWinner: false,
            isLoser: false,
            empty: false,
          };
          return (
            <div
              key={pc}
              className={draggingPc === pc ? "is-dragging" : ""}
              style={{
                position: "absolute",
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: draggingPc === pc ? 90 : 50,
                filter: draggingPc === pc ? "brightness(1.2)" : undefined,
              }}
            >
              <ObsCard
                data={data}
                barW={barWidthFor(modality)}
                draggable
                onDragStart={startDrag}
              />
              <span style={{
                position: "absolute",
                top: "-18px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#ffb830",
                background: "rgba(7, 7, 8, 0.8)",
                padding: "2px 6px",
                border: "1px solid rgba(255, 184, 48, 0.4)",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}>
                {pc}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  /* ===== MODO TRANSMISIÓN — layout personalizado (cards posicionadas) ===== */
  if (hasCustomLayout) {
    return (
      <div
        className="obs-root"
        style={{ ...sizeVars, display: "block", pointerEvents: "none" }}
        role="img"
        aria-label="Overlay OBS — barras con PC, nombre y marcador de los jugadores en juego"
      >
        {allPcs.map((pc) => {
          /* si una PC no tiene posición guardada, usa la default para
             que las 4 cards siempre se muestren. */
          const pos = draftLayout[pc] ?? defaultPos(pc);
          const card = cardsByPc.get(pc);
          /* Si no hay match en juego para esta PC, mostramos la card
             vacía con "Esperando match" — las 4 cards siempre visibles. */
          const data: ObsCardData = card ?? {
            pc,
            nick: "",
            score: 0,
            isWinner: false,
            isLoser: false,
            empty: true,
          };
          return (
            <div
              key={pc}
              style={{
                position: "absolute",
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 10,
              }}
            >
              <ObsCard
                data={data}
                barW={barWidthFor(modality)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  /* ===== MODO TRANSMISIÓN — layout automático (sin posiciones guardadas) ===== */
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
