import type { Bracket, MatchMember, Player } from "./types";
import { roundLabel, roundShortLabel } from "./bracket";

/* ============================================================
   BANCO DE RESERVAS ROTATIVO
   · Los registrados sólo entran a la PRIMERA eliminatoria.
   · Mientras ninguna ronda esté completa → banco = reservas del
     registro (jugadores con seat === "bank").
   · Cuando una ronda termina (octavos, cuartos, semis…) el banco
     se RENUEVA: los lugares anteriores desaparecen y entran TODOS
     los eliminados de esa ronda. Esas reservas cubren un no-show
     en la ronda siguiente; en cuanto entran a un match salen del
     banco automáticamente.
   · Funciona en cualquier modalidad: 1v1/FFA (individuos) y
     2v2/3v3/4v4 (el equipo eliminado completo como reserva).
   Es una vista DERIVADA del bracket (sin estado propio): si el
   admin reinicia resultados o deshace un reemplazo, el banco se
   recalcula solo y siempre queda consistente.
   ============================================================ */

export interface BankEntry {
  key: string; // id estable: p:{pid} (registro) · r{r}m{m}s{i} (eliminado)
  label: string; // nick o nombre del equipo
  detail: string; // línea secundaria (nombre real / integrantes)
  members: MatchMember[]; // integrantes (1 en modalidades individuales)
  origin: "register" | "round";
  fromRound: number | null; // ronda en la que fue eliminado (null = registro)
  dq: boolean; // fue descalificado en esa ronda
}

export interface BankInfo {
  entries: BankEntry[];
  fromRound: number | null; // ronda de la que proviene el banco (null = registro)
  sourceLabel: string; // "OCTAVOS DE FINAL" | "REGISTRO"
  sourceShort: string; // "OCTAVOS" | "REGISTRO"
}

/** ¿Todos los matches de la ronda (incluidos byes estructurales) terminaron? */
export function isRoundComplete(bracket: Bracket, r: number): boolean {
  const round = bracket.rounds[r];
  if (!round || round.length === 0) return false;
  return round.every((mt) => mt.status === "done");
}

/** Última ronda con TODOS sus matches terminados (-1 si ninguna). */
export function lastCompletedRound(bracket: Bracket): number {
  for (let r = bracket.rounds.length - 1; r >= 0; r--) {
    if (isRoundComplete(bracket, r)) return r;
  }
  return -1;
}

/** PIDs presentes en los slots desde `from` en adelante. Sirve para
    saber qué reservas ya entraron a un match (y salieron del banco). */
function pidsInRounds(bracket: Bracket, from: number): Set<string> {
  const set = new Set<string>();
  for (let r = from; r < bracket.rounds.length; r++) {
    for (const mt of bracket.rounds[r]) {
      for (const s of mt.slots) {
        if (s.pid) set.add(s.pid);
        for (const mm of s.members) if (mm.pid) set.add(mm.pid);
      }
    }
  }
  return set;
}

function registerEntries(players: Player[], exclude: Set<string> | null): BankEntry[] {
  return players
    .filter((p) => p.seat === "bank" && (!exclude || !exclude.has(p.id)))
    .map((p) => ({
      key: `p:${p.id}`,
      label: p.nick,
      detail: p.name,
      members: [{ pid: p.id, nick: p.nick }],
      origin: "register" as const,
      fromRound: null,
      dq: false,
    }));
}

const REGISTER_INFO: Pick<BankInfo, "fromRound" | "sourceLabel" | "sourceShort"> = {
  fromRound: null,
  sourceLabel: "REGISTRO",
  sourceShort: "REGISTRO",
};

/** Banco efectivo del torneo en este momento. */
export function computeBank(bracket: Bracket | null, players: Player[]): BankInfo {
  // sin bracket (registro / pre-mix): sólo reservas registradas
  if (!bracket) {
    return { entries: registerEntries(players, null), ...REGISTER_INFO };
  }

  const last = lastCompletedRound(bracket);

  // la primera eliminatoria aún no termina → banco del registro;
  // se excluyen las reservas que ya entraron a algún match
  if (last < 0) {
    const used = pidsInRounds(bracket, 0);
    return { entries: registerEntries(players, used), ...REGISTER_INFO };
  }

  // banco rotativo: eliminados de la última ronda completada.
  // Un eliminado que ya cubrió un no-show en una ronda posterior
  // sale del banco (sus pids aparecen en slots de rondas > last).
  const later = pidsInRounds(bracket, last + 1);
  // incluir también los pids del match de 3er lugar (para no duplicar)
  const tpPids = new Set<string>();
  if (bracket.thirdPlace) {
    for (const s of bracket.thirdPlace.slots) {
      if (s.pid) tpPids.add(s.pid);
      for (const mm of s.members) if (mm.pid) tpPids.add(mm.pid);
    }
  }
  const byId = new Map(players.map((p) => [p.id, p]));
  const entries: BankEntry[] = [];
  const round = bracket.rounds[last];
  for (let m = 0; m < round.length; m++) {
    const mt = round[m];
    if (mt.bye || mt.status !== "done" || mt.w === null) continue;
    const w = mt.w;
    mt.slots.forEach((slot, i) => {
      if (i === w || !slot.pid) return;
      const members: MatchMember[] = slot.members.length
        ? slot.members
        : [{ pid: slot.pid as string, nick: slot.label }];
      if (members.some((mm) => later.has(mm.pid))) return; // ya está jugando
      // si el participante ya está en el match de 3er lugar, no duplicarlo aquí
      if (members.some((mm) => tpPids.has(mm.pid))) return;
      const first = byId.get(members[0]?.pid ?? "");
      entries.push({
        key: `r${last}m${m}s${i}`,
        label: slot.label || members[0]?.nick || "—",
        detail:
          members.length > 1
            ? members.map((mm) => mm.nick).join(" · ")
            : first?.name ?? "",
        members: members.map((mm) => ({ pid: mm.pid, nick: mm.nick, dq: !!mm.dq, sub: !!mm.sub })),
        origin: "round",
        fromRound: last,
        dq: slot.st === "dq",
      });
    });
  }

  // añadir el perdedor del match de 3er lugar al banco
  // (el ganador tiene asegurado el 3er lugar, pero también está
  // disponible para sustituir a un finalista que no se presente)
  if (bracket.thirdPlace && bracket.thirdPlace.w !== null && bracket.thirdPlace.status === "done") {
    const tp = bracket.thirdPlace;
    tp.slots.forEach((slot, i) => {
      if (!slot.pid || i === tp.w) return; // skip winner (tiene 3er lugar)
      // skip si ya está jugando en una ronda posterior
      if (later.has(slot.pid)) return;
      const members: MatchMember[] = slot.members.length
        ? slot.members
        : [{ pid: slot.pid as string, nick: slot.label }];
      if (members.some((mm) => later.has(mm.pid))) return;
      const first = byId.get(members[0]?.pid ?? "");
      entries.push({
        key: `tp_loser`,
        label: slot.label || members[0]?.nick || "—",
        detail: members.length > 1
          ? members.map((mm) => mm.nick).join(" · ")
          : first?.name ?? "",
        members: members.map((mm) => ({ pid: mm.pid, nick: mm.nick, dq: !!mm.dq, sub: !!mm.sub })),
        origin: "round",
        fromRound: last,
        dq: slot.st === "dq",
      });
    });
  }

  return {
    entries,
    fromRound: last,
    sourceLabel: roundLabel(bracket, last),
    sourceShort: roundShortLabel(bracket, last),
  };
}
