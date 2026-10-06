export type Modality = 1 | 2 | 3 | 4 | 5; // 5 = "1v1v1v1" — FFA: 4 jugadores enfrentándose
export type TournamentStatus = "open" | "closed" | "mixing" | "live" | "finished";
export type SeatType = "off" | "bank";

export interface Tournament {
  id: string;
  name: string;
  logo: string | null;
  modality: Modality;
  seats: number; // asientos del bracket (potencia de 2) — participants = equipos/jugadores
  bankSeats: number; // capacidad del banco (jugadores de reserva)
  winsNeeded: number; // victorias para ganar un match
  matchMins: number; // duración estimada de un match (minutos)
  startAt: number | null; // hora de inicio configurada (epoch ms)
  venue: string;
  status: TournamentStatus;
  createdAt: number;
}

export interface Player {
  id: string;
  name: string;
  nick: string;
  phone: string;
  team: string; // nombre de equipo (modalidades 2..4)
  seat: SeatType;
  demo?: boolean; // generado con "Llenar lugares"
  createdAt: number;
}

export interface MatchMember {
  pid: string;
  nick: string;
  dq?: boolean;
  sub?: boolean;
}

export interface MatchSlot {
  pid: string | null;
  label: string;
  members: MatchMember[];
  score: number;
  st: "ok" | "dq" | "rep";
  src?: string; // id del match de donde avanzó
}

export type MatchStatus = "ready" | "live" | "done";

export interface Match {
  id: string; // r{round}m{index}
  slots: MatchSlot[]; // 2 en 1v1..4v4 · 4 en la modalidad 1v1v1v1 (FFA)
  w: number | null; // índice del slot ganador
  status: MatchStatus;
  bye?: boolean;
  pcs?: string[]; // PCs asignadas al match EN JUEGO (ej. ["PC1","PC2"])
}

export interface Bracket {
  rounds: Match[][];
  createdAt: number;
  s?: number; // slots (participantes) por match: 2 por defecto, 4 en FFA
  thirdPlace?: Match | null; // match de 3er lugar (solo S=2, 1v1..4v4)
}

export const MODALITY_LABEL: Record<number, string> = {
  1: "1v1",
  2: "2v2",
  3: "3v3",
  4: "4v4",
  5: "1v1v1v1",
};

/** Slots (participantes/lados) que tiene cada match según la modalidad. */
export const MODALITY_SLOTS: Record<Modality, number> = {
  1: 2,
  2: 2,
  3: 2,
  4: 2,
  5: 4,
};

/** Slots por match de una modalidad (con fallback seguro). */
export function slotsPerMatch(modality: Modality): number {
  return MODALITY_SLOTS[modality] ?? 2;
}

/** Slots por match de un bracket ya creado (fallback al documento). */
export function slotsOf(b: Pick<Bracket, "s"> | null | undefined): number {
  return b?.s ?? 2;
}

/** Tamaño de equipo (jugadores por participante). El FFA (5) es individual. */
export function teamSize(modality: Modality): number {
  return modality === 5 ? 1 : modality;
}

/** ¿La modalidad se juega por equipos (2v2/3v3/4v4)? */
export function isTeamModality(modality: Modality): boolean {
  return modality >= 2 && modality <= 4;
}

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  open: "REGISTRO ABIERTO",
  closed: "REGISTROS CERRADOS",
  mixing: "MIX MATCH",
  live: "EN VIVO",
  finished: "FINALIZADO",
};

/** Fases operativas del torneo (flujo del admin en "Torneo en vivo"). */
export const PHASES = [
  "REGISTRO ABIERTO",
  "REGISTROS CERRADOS",
  "CUENTA REGRESIVA",
  "MIX MATCH",
  "EN VIVO",
] as const;

export function playersCapacity(t: Pick<Tournament, "seats" | "modality">): number {
  return t.seats * teamSize(t.modality);
}

/** ¿Un match es jugable con sus slots actuales? (≥ 2 participantes reales:
    permite finales FFA parciales, p.ej. 2 clasados de 4 slots) */
export function matchPlayable(match: Pick<Match, "slots">): boolean {
  return match.slots.filter((s) => s.pid).length >= 2;
}
