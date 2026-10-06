"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { fdb } from "./firebase";
import type { Contest, ContestState, Participant, SoundItem } from "./contests";

/* ============================================================
   Hooks de tiempo real para concursos (onSnapshot).
   ============================================================ */

export function useContests() {
  const [state, setState] = useState<{ data: Contest[]; loading: boolean }>({
    data: [],
    loading: true,
  });
  useEffect(() => {
    const q = query(collection(fdb, "contests"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contest, "id">) })),
          loading: false,
        }),
      () => setState({ data: [], loading: false })
    );
    return () => unsub();
  }, []);
  return state;
}

export function useParticipants(cid: string | null) {
  const [state, setState] = useState<{
    cid: string | null;
    data: Participant[];
    loading: boolean;
  }>({ cid: null, data: [], loading: false });
  useEffect(() => {
    if (!cid) return;
    const q = query(collection(fdb, "contests", cid, "participants"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) =>
        setState({
          cid,
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Participant, "id">) })),
          loading: false,
        }),
      () => setState({ cid, data: [], loading: false })
    );
    return () => unsub();
  }, [cid]);
  const fresh = state.cid === cid;
  return {
    data: fresh ? state.data : [],
    loading: fresh ? state.loading : !!cid,
  };
}

export function useContestState(cid: string | null): ContestState | null {
  const [state, setState] = useState<{ cid: string | null; data: ContestState | null }>({
    cid: null,
    data: null,
  });
  useEffect(() => {
    if (!cid) return;
    const unsub = onSnapshot(
      doc(fdb, "contests", cid, "state", "main"),
      (snap) =>
        setState({
          cid,
          data: snap.exists() ? (snap.data() as ContestState) : null,
        }),
      () => setState({ cid, data: null })
    );
    return () => unsub();
  }, [cid]);
  const fresh = state.cid === cid;
  return fresh ? state.data : null;
}

export function useSounds(cid: string | null) {
  const [state, setState] = useState<{
    cid: string | null;
    data: SoundItem[];
    loading: boolean;
  }>({ cid: null, data: [], loading: false });
  useEffect(() => {
    if (!cid) return;
    const q = query(collection(fdb, "contests", cid, "sounds"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) =>
        setState({
          cid,
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SoundItem, "id">) })),
          loading: false,
        }),
      () => setState({ cid, data: [], loading: false })
    );
    return () => unsub();
  }, [cid]);
  const fresh = state.cid === cid;
  return {
    data: fresh ? state.data : [],
    loading: fresh ? state.loading : !!cid,
  };
}
