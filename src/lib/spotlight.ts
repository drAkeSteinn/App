import { useCallback, useEffect, useRef, useState } from "react";
import type { Bracket, Modality, TournamentStatus } from "./types";
import { matchTag } from "./bracket";
import { pcsForSide } from "./pcs";
import type { BankPickInfo } from "./arenaState";

/* ============================================================
   DRAMA CUTS — detección compartida de los "cortes" del visor
   ============================================================
   La misma lógica alimenta DOS vistas:
     · SpectatorView  (/?v=show)      — visor de espectadores
     · AnimOverlay    (/?obs=anims)   — overlay de SOLO animaciones p/ OBS
   Así ambas muestran EXACTAMENTE las mismas animaciones (las que
   se optimizaron) sin duplicar código ni desincronizarse.

   · SpotlightData — corte VS (match en juego) o GANADOR definido.
   · SubEnterData  — corte de reserva que entra al match desde el
     banco (el admin confirmó el reemplazo).

   El hook NO reproduce sonidos: cada vista decide si los reproduce
   (el visor sí; el overlay de OBS NO, para no duplicar el audio). */

export interface SpotlightPlayer {
  name: string;
  score: number;
  pcs: string[]; // PCs del lado (ej. ["PC1"])
}

export interface SpotlightData {
  id: string; // clave única del evento (para re-disparar animaciones)
  kind: "win" | "live";
  tag: string; // "SEMI · M2" | "GRAN FINAL"
  players: SpotlightPlayer[];
  winner: number | null; // índice del slot ganador (kind "win")
  winsNeeded: number;
}

export interface SubEnterData {
  id: string; // clave única — para re-disparar animaciones
  nick: string;
  matchTag: string;
}

/* Gracia para dejar llegar la actualización del bracket por si el
   orden de onSnapshot se invierte (mismo valor que usaba el visor). */
const SUB_ENTER_GRACE_MS = 500;
export const SPOTLIGHT_HOLD_MS = 10_000;
export const SUB_ENTER_HOLD_MS = 4_500;

/* Detecta el primer evento "dramático" entre dos versiones del bracket:
   match que pasa a DONE (ganador marcado o cambiado) o a LIVE (en juego).
   Las PCs del match se leen del match actual (al poner en juego ya tienen
   PCs asignadas) o del snapshot anterior (al definir ganador ya se liberaron). */
export function findSpotlightEvent(
  cur: Bracket,
  prev: Bracket,
  winsNeeded: number,
  modality: Modality
): SpotlightData | null {
  for (let r = 0; r < cur.rounds.length; r++) {
    const round = cur.rounds[r];
    for (let m = 0; m < round.length; m++) {
      const match = round[m];
      const old = prev.rounds[r]?.[m];
      if (!match || !old || match.bye) continue;
      const becameDone = match.status === "done" && old.status !== "done";
      const winnerChanged = match.status === "done" && old.status === "done" && match.w !== old.w;
      const becameLive = match.status === "live" && old.status !== "live";
      if (becameDone || winnerChanged || becameLive) {
        const pcs = match.pcs?.length ? match.pcs : old.pcs;
        return {
          id: `${match.id}-${match.status}-${match.w}-${Date.now()}`,
          kind: match.status === "live" ? "live" : "win",
          tag: matchTag(cur, r, m),
          players: match.slots.map((s, i) => ({
            name: s.label || "—",
            score: s.score ?? 0,
            pcs: pcsForSide(modality, pcs, i),
          })),
          winner: match.w,
          winsNeeded,
        };
      }
    }
  }
  // verificar también el match de 3er lugar
  if (cur.thirdPlace && prev.thirdPlace) {
    const tp = cur.thirdPlace;
    const oldTp = prev.thirdPlace;
    const becameDone = tp.status === "done" && oldTp.status !== "done";
    const becameLive = tp.status === "live" && oldTp.status !== "live";
    if (becameDone || becameLive) {
      const pcs = tp.pcs?.length ? tp.pcs : oldTp.pcs;
      return {
        id: `${tp.id}-${tp.status}-${tp.w}-${Date.now()}`,
        kind: tp.status === "live" ? "live" : "win",
        tag: "3ER LUGAR",
        players: tp.slots.map((s, i) => ({
          name: s.label || "—",
          score: s.score ?? 0,
          pcs: pcsForSide(modality, pcs, i),
        })),
        winner: tp.w,
        winsNeeded,
      };
    }
  }
  return null;
}

/* ============================================================
   useDramaCuts — hook único: spotlight + subEnter + auto-cierre.
   idéntico al comportamiento histórico del visor.
   ============================================================ */
export function useDramaCuts({
  tid,
  bracket,
  status,
  winsNeeded,
  modality,
  bankPick,
}: {
  tid: string | null;
  bracket: Bracket | null;
  status: TournamentStatus;
  winsNeeded: number;
  modality: Modality;
  bankPick: BankPickInfo | null;
}) {
  const [spotlight, setSpotlight] = useState<SpotlightData | null>(null);
  const [subEnter, setSubEnter] = useState<SubEnterData | null>(null);

  const prevBracketRef = useRef<{ tid: string | null; bracket: Bracket } | null>(null);
  const prevBankPickRef = useRef<{ id: number; r: number; m: number; slotIdx: number; slotPid: string | null } | null>(null);
  const bracketRef = useRef<Bracket | null>(null);

  /* ref siempre fresca del bracket (para leer el estado más reciente dentro
     de un setTimeout sin closure stalado) */
  useEffect(() => {
    bracketRef.current = bracket;
  }, [bracket]);

  /* ----- SPOTLIGHT: ganador marcado / match en juego → corte dramático.
     Compara cada snapshot del bracket con el anterior; al detectar un match
     que pasa a DONE (o cambia de ganador) o a LIVE, lanza el overlay.
     La ref se actualiza SIEMPRE (aun fuera de live) para no falsar la
     comparación al reactivar el torneo. ----- */
  useEffect(() => {
    const prev = prevBracketRef.current;
    prevBracketRef.current = tid && bracket ? { tid, bracket } : null;
    if (!bracket || !prev || prev.tid !== tid || status !== "live") return;
    const event = findSpotlightEvent(bracket, prev.bracket, winsNeeded, modality);
    if (event) setSpotlight(event);
  }, [bracket, status, tid, winsNeeded, modality]);

  /* el corte se va solo tras 10 s (para ver bien quién ganó y qué match
     está en juego) y regresa */
  useEffect(() => {
    if (!spotlight) return;
    const t = setTimeout(() => setSpotlight(null), SPOTLIGHT_HOLD_MS);
    return () => clearTimeout(t);
  }, [spotlight]);

  useEffect(() => {
    if (!subEnter) return;
    const t = setTimeout(() => setSubEnter(null), SUB_ENTER_HOLD_MS);
    return () => clearTimeout(t);
  }, [subEnter]);

  /* ----- SUB-ENTER: cuando el admin confirma un reemplazo desde el banco,
     se muestra la animación del reserva que entra al match.
     Detección: al abrir el bankPick se snapshot el pid del slot; al cerrar
     (bankPick → null) se compara. Si el pid cambió → confirmó (animación);
     si es el mismo → canceló (nada). Un grace deja llegar la actualización
     del bracket por si el orden de onSnapshot se invierte. ----- */
  useEffect(() => {
    const pick = bankPick;
    if (pick) {
      if (!prevBankPickRef.current || prevBankPickRef.current.id !== pick.id) {
        const slotPid =
          bracketRef.current?.rounds[pick.r]?.[pick.m]?.slots[pick.slotIdx]?.pid ?? null;
        prevBankPickRef.current = {
          r: pick.r,
          m: pick.m,
          slotIdx: pick.slotIdx,
          id: pick.id,
          slotPid,
        };
      }
      return;
    }
    const prev = prevBankPickRef.current;
    if (!prev) return;
    prevBankPickRef.current = null;
    const captured = prev;
    const t = setTimeout(() => {
      const b = bracketRef.current;
      const curSlot = b?.rounds[captured.r]?.[captured.m]?.slots[captured.slotIdx];
      const curPid = curSlot?.pid ?? null;
      if (curPid && curPid !== captured.slotPid) {
        const nick = curSlot?.label || curSlot?.members[0]?.nick || "—";
        const isFinal = b ? captured.r === b.rounds.length - 1 : false;
        const tag = isFinal ? "GRAN FINAL" : b ? matchTag(b, captured.r, captured.m) : "MATCH";
        setSubEnter({ id: `${captured.id}-${Date.now()}`, nick, matchTag: tag });
      }
    }, SUB_ENTER_GRACE_MS);
    return () => clearTimeout(t);
  }, [bankPick]);

  const dismissSpotlight = useCallback(() => setSpotlight(null), []);
  const dismissSubEnter = useCallback(() => setSubEnter(null), []);

  return { spotlight, subEnter, dismissSpotlight, dismissSubEnter };
}
