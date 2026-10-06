"use client";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  runTransaction,
} from "firebase/firestore";
import { fdb } from "./firebase";

/* ============================================================
   CONCURSOS — sistema de concursos express.
   Dos tipos por ahora:
   · cosplay: decidido por aplausos del público (eliminación + ganador)
   · sound: adivinar de qué videojuego es un sonido (score por acierto)
   ============================================================ */

export type ContestType = "cosplay" | "sound";
export type ContestStatus = "register" | "live" | "finished";

export interface Contest {
  id: string;
  type: ContestType;
  name: string;
  status: ContestStatus;
  winnerPid: string | null;
  createdAt: number;
}

export interface Participant {
  id: string;
  nick: string;
  name: string;
  score: number;
  eliminated: boolean;
  createdAt: number;
}

export interface ContestState {
  spotlightPid: string | null; // cosplayer being applauded
  currentSoundId: string | null; // sound being played (sound contest)
  soundPlaying: boolean;
  revealAnswer: boolean; // mostrar la respuesta + imagen en el visor
  revealQuestion: boolean; // mostrar la pregunta en el visor (botón Mostrar)
}

export interface SoundItem {
  id: string;
  data: string; // data URL del audio (base64)
  type: string; // mime type del audio
  question: string; // "¿De qué videojuego es este sonido?"
  answer: string; // respuesta correcta
  image: string | null; // data URL de la imagen 1:1 (opcional)
  solved: boolean; // esta pregunta ya fue respondida (visual: card sombreada)
  createdAt: number;
}

/* ---------------- Firestore refs ---------------- */

const cCol = () => collection(fdb, "contests");
const cDoc = (id: string) => doc(fdb, "contests", id);
const pCol = (cid: string) => collection(fdb, "contests", cid, "participants");
const pDoc = (cid: string, pid: string) => doc(fdb, "contests", cid, "participants", pid);
const sDoc = (cid: string) => doc(fdb, "contests", cid, "state", "main");
const soundsCol = (cid: string) => collection(fdb, "contests", cid, "sounds");

/* ---------------- Contest CRUD ---------------- */

export type ContestInput = Omit<Contest, "id" | "status" | "createdAt" | "winnerPid">;

export async function createContest(data: ContestInput): Promise<string> {
  const ref = await addDoc(cCol(), {
    ...data,
    status: "register" as ContestStatus,
    winnerPid: null,
    createdAt: Date.now(),
  });
  // init state doc
  await setDoc(sDoc(ref.id), {
    spotlightPid: null,
    currentSoundId: null,
    soundPlaying: false,
  } as ContestState);
  return ref.id;
}

export async function updateContest(id: string, partial: Partial<Contest>): Promise<void> {
  await updateDoc(cDoc(id), partial);
}

export async function deleteContest(id: string): Promise<void> {
  const batch = writeBatch(fdb);
  const parts = await getDocs(pCol(id));
  parts.forEach((d) => batch.delete(d.ref));
  const sounds = await getDocs(soundsCol(id));
  sounds.forEach((d) => batch.delete(d.ref));
  batch.delete(sDoc(id));
  batch.delete(cDoc(id));
  await batch.commit();
}

/* ---------------- Participants ---------------- */

export type ParticipantInput = Omit<Participant, "id" | "createdAt" | "score" | "eliminated">;

export async function addParticipant(cid: string, data: ParticipantInput): Promise<string> {
  const ref = await addDoc(pCol(cid), {
    ...data,
    score: 0,
    eliminated: false,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateParticipant(
  cid: string,
  pid: string,
  partial: Partial<Participant>
): Promise<void> {
  await updateDoc(pDoc(cid, pid), partial);
}

export async function deleteParticipant(cid: string, pid: string): Promise<void> {
  await deleteDoc(pDoc(cid, pid));
}

/** Elimina TODOS los participantes de un concurso (batch). */
export async function wipeParticipants(cid: string): Promise<void> {
  const snap = await getDocs(pCol(cid));
  const batch = writeBatch(fdb);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/** Suma/substract score atómicamente (sound contest). */
export async function addScore(cid: string, pid: string, delta: number): Promise<void> {
  await runTransaction(fdb, async (tx) => {
    const snap = await tx.get(pDoc(cid, pid));
    if (!snap.exists()) return;
    const cur = (snap.data() as Participant).score ?? 0;
    tx.update(pDoc(cid, pid), { score: Math.max(0, cur + delta) });
  });
}

/* ---------------- State (spotlight / sound) ---------------- */

export async function setSpotlight(cid: string, pid: string | null): Promise<void> {
  await setDoc(
    sDoc(cid),
    { spotlightPid: pid } as Partial<ContestState>,
    { merge: true }
  );
}

export async function setSoundPlaying(
  cid: string,
  soundId: string | null,
  playing: boolean
): Promise<void> {
  await setDoc(
    sDoc(cid),
    { currentSoundId: soundId, soundPlaying: playing } as Partial<ContestState>,
    { merge: true }
  );
}

export async function setWinner(cid: string, pid: string | null): Promise<void> {
  await updateDoc(cDoc(cid), { winnerPid: pid, status: pid ? "finished" : "live" } as Partial<Contest>);
}

/* ---------------- Sounds (sound contest) ---------------- */

export async function addSound(
  cid: string,
  data: string,
  type: string,
  question: string,
  answer: string,
  image: string | null
): Promise<string> {
  const ref = await addDoc(soundsCol(cid), {
    data,
    type,
    question,
    answer,
    image,
    solved: false,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteSound(cid: string, sid: string): Promise<void> {
  await deleteDoc(doc(fdb, "contests", cid, "sounds", sid));
}

/** Marca un sonido como resuelto (ya respondido) — la card se sombrea. */
export async function setSolved(cid: string, sid: string, solved: boolean): Promise<void> {
  await updateDoc(doc(fdb, "contests", cid, "sounds", sid), { solved });
}

/** Resetea el concurso: pone todos los scores a 0, marca todos los sonidos
    como no resueltos, limpia el state (spotlight/sonido/respuesta) y vuelve
    a estado "live" si estaba finalizado. No borra participantes ni sonidos. */
export async function resetContest(cid: string): Promise<void> {
  // 1. reset scores de todos los participantes
  const partsSnap = await getDocs(pCol(cid));
  const batch = writeBatch(fdb);
  partsSnap.docs.forEach((d) => batch.update(d.ref, { score: 0, eliminated: false }));
  // 2. marcar todos los sonidos como no resueltos
  const soundsSnap = await getDocs(soundsCol(cid));
  soundsSnap.docs.forEach((d) => batch.update(d.ref, { solved: false }));
  await batch.commit();
  // 3. limpiar state + deshacer ganador + volver a live
  await setDoc(sDoc(cid), {
    spotlightPid: null,
    currentSoundId: null,
    soundPlaying: false,
    revealAnswer: false,
    revealQuestion: false,
  } as ContestState);
  await updateDoc(cDoc(cid), { winnerPid: null, status: "live" } as Partial<Contest>);
}

/** Muestra/oculta la respuesta (+ imagen) en el visor (sound contest). */
export async function setRevealAnswer(cid: string, reveal: boolean): Promise<void> {
  await setDoc(
    sDoc(cid),
    { revealAnswer: reveal } as Partial<ContestState>,
    { merge: true }
  );
}

/** Muestra/oculta la pregunta en el visor (botón Mostrar). */
export async function setRevealQuestion(cid: string, reveal: boolean): Promise<void> {
  await setDoc(
    sDoc(cid),
    { revealQuestion: reveal } as Partial<ContestState>,
    { merge: true }
  );
}
