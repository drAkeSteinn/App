"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { fdb } from "./firebase";
import { deserializeBracket, type BracketDoc } from "./bracket";
import type { Bracket, Player, Tournament } from "./types";

/* Hooks de tiempo real sobre Firestore (onSnapshot).
   Patrón: el estado guarda a qué `tid` pertenece; si el tid pedido
   no coincide, se devuelven valores derivados vacíos sin setState síncrono. */

export function useTournaments() {
  const [state, setState] = useState<{ data: Tournament[]; loading: boolean; error: string | null }>({
    data: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    const q = query(collection(fdb, "tournaments"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Tournament, "id">) })),
          loading: false,
          error: null,
        }),
      (err) => setState({ data: [], loading: false, error: err.message })
    );
    return () => unsub();
  }, []);
  return state;
}

export function usePlayers(tid: string | null) {
  const [state, setState] = useState<{ tid: string | null; data: Player[]; loading: boolean; error: string | null }>({
    tid: null,
    data: [],
    loading: false,
    error: null,
  });
  useEffect(() => {
    if (!tid) return;
    const q = query(collection(fdb, "tournaments", tid, "players"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) =>
        setState({
          tid,
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Player, "id">) })),
          loading: false,
          error: null,
        }),
      (err) => setState({ tid, data: [], loading: false, error: err.message })
    );
    return () => unsub();
  }, [tid]);
  const fresh = state.tid === tid;
  return {
    data: fresh ? state.data : [],
    loading: fresh ? state.loading : !!tid,
    error: fresh ? state.error : null,
  };
}

export function useBracket(tid: string | null) {
  const [state, setState] = useState<{ tid: string | null; data: Bracket | null; loading: boolean; error: string | null }>({
    tid: null,
    data: null,
    loading: false,
    error: null,
  });
  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      doc(fdb, "tournaments", tid, "bracket", "main"),
      (snap) =>
        setState({
          tid,
          data: snap.exists() ? deserializeBracket(snap.data() as BracketDoc) : null,
          loading: false,
          error: null,
        }),
      (err) => setState({ tid, data: null, loading: false, error: err.message })
    );
    return () => unsub();
  }, [tid]);
  const fresh = state.tid === tid;
  return {
    data: fresh ? state.data : null,
    loading: fresh ? state.loading : !!tid,
    error: fresh ? state.error : null,
  };
}
