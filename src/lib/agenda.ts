"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { fdb } from "./firebase";

/* ============================================================
   AGENDA DE EVENTOS — cartelera con fecha y hora.
   · Colección `agenda` en Firestore (tiempo real, como todo).
   · Cada evento: { title, date: "YYYY-MM-DD", time: "HH:mm",
     note?, createdAt }.
   · En la pantalla de espera del visor SOLO se muestran los del
     día en curso (la agenda puede tener días pasados/futuros).
   ============================================================ */

export interface AgendaEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (local)
  time: string; // HH:mm (24h)
  note?: string;
  createdAt: number;
}

export interface AgendaInput {
  title: string;
  date: string;
  time: string;
  note?: string;
}

/** Clave local YYYY-MM-DD del día (la "fecha de hoy" de la máquina). */
export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Hook en tiempo real: toda la agenda, ordenada por fecha y hora. */
export function useAgenda() {
  const [state, setState] = useState<{ data: AgendaEvent[]; loading: boolean; error: string | null }>({
    data: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    const unsub = onSnapshot(
      collection(fdb, "agenda"),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgendaEvent, "id">) }));
        data.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
        setState({ data, loading: false, error: null });
      },
      (err) => setState({ data: [], loading: false, error: err.message })
    );
    return () => unsub();
  }, []);
  return state;
}

export async function addAgendaEvent(input: AgendaInput): Promise<void> {
  await addDoc(collection(fdb, "agenda"), {
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    note: input.note?.trim() ?? "",
    createdAt: Date.now(),
  });
}

export async function updateAgendaEvent(id: string, input: AgendaInput): Promise<void> {
  await updateDoc(doc(fdb, "agenda", id), {
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    note: input.note?.trim() ?? "",
    updatedAt: Date.now(),
  });
}

export async function deleteAgendaEvent(id: string): Promise<void> {
  await deleteDoc(doc(fdb, "agenda", id));
}

/** "14:30" → "2:30" + "PM" (para mostrar en dos partes). */
export function fmtTimeParts(hhmm: string): { hhmm12: string; ampm: string } {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return { hhmm12: hhmm, ampm: "" };
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return { hhmm12: `${hh}:${String(Number.isNaN(m) ? 0 : m).padStart(2, "0")}`, ampm };
}

/** Etiqueta larga del día: "lunes, 16 de febrero". */
export function fmtDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Día corto para chips: "LUN 16". */
export function fmtDayShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
  });
}

export type DayRelation = "past" | "today" | "future";

export function dayRelation(dateStr: string, today = localDateKey()): DayRelation {
  return dateStr < today ? "past" : dateStr === today ? "today" : "future";
}
