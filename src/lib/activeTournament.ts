"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { fdb } from "./firebase";
import { useTournaments } from "./hooks";
import { useContests } from "./contestHooks";
import type { Tournament } from "./types";
import type { Contest } from "./contests";

/* ============================================================
   Transmisión ACTIVA — lo que se muestra en el visor y las
   cards de OBS. Solo puede haber UNO activo a la vez: un torneo
   O un concurso.
   Documento global: arena/active = { tid?, contestId?, openedAt }
   ============================================================ */

const activeRef = () => doc(fdb, "arena", "active");

export interface ActiveInfo {
  tid: string | null;
  contestId: string | null;
  openedAt: number | null;
}

/** Hook de tiempo real sobre la transmisión activa.
    Devuelve { tid, tournament, contestId, contest, loading }.
    tournament se resuelve si tid está activo; contest si contestId. */
export function useActiveTournament(): {
  tid: string | null;
  tournament: Tournament | null;
  contestId: string | null;
  contest: Contest | null;
  loading: boolean;
} {
  const [active, setActive] = useState<ActiveInfo>({
    tid: null,
    contestId: null,
    openedAt: null,
  });
  const { data: tournaments, loading: tournamentsLoading } = useTournaments();
  const { data: contests, loading: contestsLoading } = useContests();
  useEffect(() => {
    const unsub = onSnapshot(
      activeRef(),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as ActiveInfo;
          setActive({
            tid: d.tid ?? null,
            contestId: d.contestId ?? null,
            openedAt: d.openedAt ?? null,
          });
        } else {
          setActive({ tid: null, contestId: null, openedAt: null });
        }
      },
      () => setActive({ tid: null, contestId: null, openedAt: null })
    );
    return () => unsub();
  }, []);
  const tournament = active.tid
    ? tournaments.find((t) => t.id === active.tid) ?? null
    : null;
  const contest = active.contestId
    ? contests.find((c) => c.id === active.contestId) ?? null
    : null;
  return {
    tid: active.tid,
    tournament,
    contestId: active.contestId,
    contest,
    loading: tournamentsLoading || contestsLoading,
  };
}

/** Abre un torneo para transmisión (lo marca como activo).
    Si hay otra transmisión activa y force=false, devuelve false.
    Si force=true, sobreescribe sin importar qué haya activo. */
export async function openTournament(
  tid: string,
  tournamentName: string,
  force = false
): Promise<{ ok: true } | { ok: false; blockingName: string }> {
  if (!force) {
    const snap = await getDoc(activeRef());
    if (snap.exists()) {
      const cur = snap.data() as ActiveInfo;
      if ((cur.tid && cur.tid !== tid) || cur.contestId) {
        return { ok: false, blockingName: "" };
      }
    }
  }
  await setDoc(activeRef(), { tid, contestId: null, openedAt: Date.now() } as ActiveInfo);
  return { ok: true };
}

/** Abre un concurso para transmisión.
    Si hay otra transmisión activa y force=false, devuelve false.
    Si force=true, sobreescribe sin importar qué haya activo. */
export async function openContest(
  contestId: string,
  force = false
): Promise<{ ok: true } | { ok: false; blockingName: string }> {
  if (!force) {
    const snap = await getDoc(activeRef());
    if (snap.exists()) {
      const cur = snap.data() as ActiveInfo;
      if (cur.tid || (cur.contestId && cur.contestId !== contestId)) {
        return { ok: false, blockingName: "" };
      }
    }
  }
  await setDoc(activeRef(), { tid: null, contestId, openedAt: Date.now() } as ActiveInfo);
  return { ok: true };
}

/** Consulta one-shot: ¿qué está activo ahora? Devuelve toda la info. */
export async function getActiveInfo(): Promise<ActiveInfo> {
  const snap = await getDoc(activeRef());
  if (!snap.exists()) return { tid: null, contestId: null, openedAt: null };
  return snap.data() as ActiveInfo;
}

/** Consulta one-shot: ¿qué está activo ahora? */
export async function getActiveTid(): Promise<string | null> {
  const snap = await getDoc(activeRef());
  if (!snap.exists()) return null;
  return (snap.data() as ActiveInfo).tid ?? null;
}

/** Consulta one-shot: ¿hay algún concurso activo? */
export async function getActiveContestId(): Promise<string | null> {
  const snap = await getDoc(activeRef());
  if (!snap.exists()) return null;
  return (snap.data() as ActiveInfo).contestId ?? null;
}

/** Cierra la transmisión activa (torneo o concurso). */
export async function closeTournament(): Promise<void> {
  await deleteDoc(activeRef());
}
