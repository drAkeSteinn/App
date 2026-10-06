"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { fdb } from "./firebase";

/* ============================================================
   Estado de la arena (señal tiempo-real admin → visor).
   Documento: tournaments/{tid}/arena/state

   · bankPick: el admin abrió el selector de banco para sustituir
     un slot. El visor reacciona mostrando la vista de Banco
     (reservas disponibles) para que el caster llame a los
     jugadores. Se limpia al confirmar o cancelar.
   · schedOpen: el admin muestra/oculta la cartelera de horarios
     en el visor (pantalla proyectada, sin interacción).
   · sound: el admin disparó una acción que lleva sonido → el
     visor lo reproduce para el público. id = timestamp para
     re-disparar el mismo evento varias veces.
   ============================================================ */

export interface BankPickInfo {
  r: number;
  m: number;
  slotIdx: number;
  matchId: string;
  tag: string; // "SEMI · M2" | "GRAN FINAL"…
  id: number; // timestamp — para detectar reaperturas
}

export interface SoundSignal {
  event: string; // scoreUp | winner | matchLive | bankSwap | tournamentFinish | mixLaunch
  id: number; // timestamp — para re-disparar
}

export interface ArenaState {
  bankPick: BankPickInfo | null;
  schedOpen?: boolean;
  sound?: SoundSignal | null;
  showPodium?: boolean;
}

const arenaRef = (tid: string) => doc(fdb, "tournaments", tid, "arena", "state");

/** Hook de tiempo real sobre el estado de la arena. */
export function useArenaState(tid: string | null) {
  const [state, setState] = useState<{ tid: string | null; data: ArenaState | null }>({
    tid: null,
    data: null,
  });
  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      arenaRef(tid),
      (snap) =>
        setState({
          tid,
          data: snap.exists() ? (snap.data() as ArenaState) : null,
        }),
      () => setState({ tid, data: null })
    );
    return () => unsub();
  }, [tid]);
  const fresh = state.tid === tid;
  return fresh ? state.data : null;
}

/** El admin abre el selector de banco para un slot. */
export async function openBankPick(
  tid: string,
  info: { r: number; m: number; slotIdx: number; matchId: string; tag: string }
) {
  await setDoc(
    arenaRef(tid),
    { bankPick: { ...info, id: Date.now() } } as ArenaState,
    { merge: true }
  );
}

/** El admin cierra el selector de banco (confirmó o canceló). */
export async function closeBankPick(tid: string) {
  await setDoc(arenaRef(tid), { bankPick: null } as Partial<ArenaState>, { merge: true });
}

/** El admin muestra u oculta la cartelera de horarios en el visor. */
export async function setSchedOpen(tid: string, open: boolean) {
  await setDoc(arenaRef(tid), { schedOpen: open } as Partial<ArenaState>, { merge: true });
}

/** El admin muestra u oculta el podio en el visor. */
export async function setShowPodium(tid: string, show: boolean) {
  await setDoc(arenaRef(tid), { showPodium: show } as Partial<ArenaState>, { merge: true });
}

/** El admin disparó una acción con sonido → avisa al visor para reproducirlo. */
export async function emitSound(tid: string, event: string) {
  await setDoc(arenaRef(tid), { sound: { event, id: Date.now() } } as Partial<ArenaState>, {
    merge: true,
  });
}
