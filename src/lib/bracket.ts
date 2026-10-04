import type { Bracket, Match, MatchMember, MatchSlot, Modality, Player } from "./types";
import { slotsPerMatch } from "./types";

/* ============================================================
   Lógica pura de brackets (eliminación directa, con byes).
   Estructura GENERALIZADA: cada match consume S participantes
   (S = 2 en 1v1..4v4, S = 4 en 1v1v1v1/FFA) y avanza 1 ganador.
   ============================================================ */

export interface Participant {
  pid: string;
  label: string;
  members: MatchMember[];
}

export function emptySlot(): MatchSlot {
  return { pid: null, label: "", members: [], score: 0, st: "ok" };
}

export function cloneSlot(s: MatchSlot): MatchSlot {
  return {
    pid: s.pid,
    label: s.label,
    members: s.members.map((m) => ({ pid: m.pid, nick: m.nick, dq: !!m.dq, sub: !!m.sub })),
    score: s.score,
    st: s.st,
    src: s.src,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Agrupa jugadores registrados (oficiales) en participantes del bracket.
    Modalidades individuales (1v1 y FFA 1v1v1v1): 1 jugador = 1 participante. */
export function groupParticipants(players: Player[], modality: Modality): Participant[] {
  const active = players.filter((p) => p.seat === "off");
  if (modality === 1 || modality === 5) {
    return active.map((p) => ({ pid: p.id, label: p.nick, members: [{ pid: p.id, nick: p.nick }] }));
  }
  const teams = new Map<string, Player[]>();
  const solos: Player[] = [];
  for (const p of active) {
    const tn = (p.team || "").trim();
    if (tn) {
      const k = tn.toUpperCase();
      if (!teams.has(k)) teams.set(k, []);
      teams.get(k)!.push(p);
    } else {
      solos.push(p);
    }
  }
  const parts: Participant[] = [];
  for (const [k, ms] of teams) {
    parts.push({ pid: ms[0].id, label: k, members: ms.map((m) => ({ pid: m.id, nick: m.nick })) });
  }
  // los jugadores sin equipo completan equipos incompletos en orden de registro
  for (const t of parts) {
    while (solos.length && t.members.length < modality) {
      const s = solos.shift()!;
      t.members.push({ pid: s.id, nick: s.nick });
    }
  }
  // los restantes forman equipos nuevos consecutivos
  while (solos.length) {
    const ms = solos.splice(0, modality);
    parts.push({
      pid: ms[0].id,
      label: ms.length > 1 ? `${ms[0].nick} TEAM` : ms[0].nick,
      members: ms.map((m) => ({ pid: m.id, nick: m.nick })),
    });
  }
  return parts;
}

function slotFrom(p: Participant): MatchSlot {
  return {
    pid: p.pid,
    label: p.label,
    members: p.members.map((m) => ({ pid: m.pid, nick: m.nick })),
    score: 0,
    st: "ok",
  };
}

/** Destino del ganador del match (r, m) en un bracket de S slots por match. */
export function nextOf(r: number, m: number, S = 2): { r: number; m: number; s: number } {
  return { r: r + 1, m: Math.floor(m / S), s: m % S };
}

function advanceSlot(rounds: Match[][], r: number, m: number, slotIdx: number, S: number) {
  const match = rounds[r][m];
  const src = match.slots[slotIdx];
  if (!src || !src.pid) return;
  const nx = nextOf(r, m, S);
  const nm = rounds[nx.r]?.[nx.m];
  if (!nm) return;
  nm.slots[nx.s] = { ...cloneSlot(src), score: 0, st: "ok", src: match.id };
  if (nm.slots.every((s) => s.pid)) nm.status = "ready";
}

/** Avanza automáticamente un match de UN sólo slot (un solo clasado real):
    no es jugable (matchPlayable exige ≥2 participantes) así que ese clasado
    pasa directo a la ronda siguiente. Se encadena hacia la final. */
function autoByeAdvance(rounds: Match[][], r: number, m: number, S: number) {
  const match = rounds[r]?.[m];
  if (!match || match.w !== null || match.slots.length !== 1 || !match.slots[0].pid) return;
  match.w = 0;
  match.status = "done";
  match.bye = true;
  advanceSlot(rounds, r, m, 0, S);
  const nx = nextOf(r, m, S);
  autoByeAdvance(rounds, nx.r, nx.m, S);
}

/** Crea el bracket para `parts` participantes con S slots por match.
    · S = 2 → árbol binario clásico (igual que siempre).
    · S = 4 (FFA) → cada match agrupa 4 participantes; SIN relleno a
      potencia de 4: la primera ronda tiene sólo los matches necesarios
      (32 jugadores → 8 matches = 32 slots, nunca 64) y las rondas
      intermedias se redondean a PAR para poder dibujar el bracket en
      ESPEJO (mitad izquierda + mitad derecha, final al centro).
    · Slots adaptativos: cada match recibe tantos slots como matches
      REALES de la ronda anterior lo alimentan — la Gran Final queda con
      los clasados reales (2 semis → final de 2, 4 semis → final de 4). */
export function buildBracket(parts: Participant[], slots: number = 2): Bracket {
  const S = Math.max(2, slots);
  const total = Math.max(2, parts.length);
  const shuffled = shuffle(parts);

  // matches por ronda hasta llegar a 1
  const even = (c: number) => (c > 1 && c % 2 !== 0 ? c + 1 : c);
  let first: number;
  if (S === 2) {
    let n = 2;
    while (n < total) n *= 2;
    first = n / 2;
  } else {
    first = even(Math.ceil(total / S));
  }
  const counts: number[] = [first];
  while (counts[counts.length - 1] > 1) {
    let next = Math.ceil(counts[counts.length - 1] / S);
    if (S > 2) next = even(next);
    counts.push(next);
  }

  // ronda 0: repartir participantes en grupos de S
  const padded: (Participant | null)[] = [...shuffled];
  while (padded.length < counts[0] * S) padded.push(null);

  // "real" = match que puede producir un ganador (ronda 0: tiene ≥1
  // participante; rondas superiores: ≥1 hijo real). Los matches fantasma
  // no generan slots imposibles de llenar.
  const real: boolean[][] = [];
  real[0] = Array.from({ length: counts[0] }, (_, m) => padded.slice(m * S, m * S + S).some((p) => !!p));
  for (let r = 1; r < counts.length; r++) {
    real[r] = Array.from({ length: counts[r] }, (_, m) => {
      for (let i = 0; i < S; i++) if (real[r - 1][S * m + i]) return true;
      return false;
    });
  }
  const kidsOf = (r: number, m: number): number => {
    if (r === 0) return S;
    let n = 0;
    for (let i = 0; i < S; i++) if (real[r - 1][S * m + i]) n++;
    return n;
  };

  const rounds: Match[][] = counts.map((count, r) =>
    Array.from({ length: count }, (_, m) => ({
      id: `r${r}m${m}`,
      slots: Array.from({ length: kidsOf(r, m) }, () => emptySlot()),
      w: null,
      status: "ready" as const,
    }))
  );

  for (let m = 0; m < counts[0]; m++) {
    const match = rounds[0][m];
    let filled = 0;
    let only = -1;
    for (let i = 0; i < S; i++) {
      const p = padded[m * S + i];
      match.slots[i] = p ? slotFrom(p) : emptySlot();
      if (p) {
        filled++;
        only = i;
      }
    }
    if (filled === 0) {
      match.status = "done";
      match.bye = true;
    } else if (filled === 1) {
      match.w = only;
      match.status = "done";
      match.bye = true;
    }
  }

  // propagar byes hacia adelante
  for (let r = 0; r < rounds.length - 1; r++) {
    for (let m = 0; m < rounds[r].length; m++) {
      const match = rounds[r][m];
      if (match.status === "done" && match.w !== null) advanceSlot(rounds, r, m, match.w, S);
    }
  }
  // byes estructurales en rondas superiores: matches de un sólo clasado real
  for (let r = 1; r < rounds.length; r++) {
    for (let m = 0; m < rounds[r].length; m++) autoByeAdvance(rounds, r, m, S);
  }
  return { rounds, createdAt: Date.now(), s: S };
}

/** Marca ganador y avanza al siguiente match. Libera las PCs del match. */
export function applyWin(b: Bracket, r: number, m: number, slotIdx: number) {
  const S = b.s ?? 2;
  const match = b.rounds[r]?.[m];
  if (!match) return;
  match.w = slotIdx;
  match.status = "done";
  delete match.pcs; // las PCs quedan libres para el siguiente match
  for (let i = 0; i < match.slots.length; i++) {
    if (i === slotIdx) continue;
    const other = match.slots[i];
    if (other && other.pid && other.st !== "dq") other.st = "ok";
  }
  advanceSlot(b.rounds, r, m, slotIdx, S);
  // si el match destino quedó con un único clasado real, avanza directo (bye)
  const nx = nextOf(r, m, S);
  autoByeAdvance(b.rounds, nx.r, nx.m, S);
}

/** Quita el resultado y limpia el slot que avanzó (si proviene de este match). */
export function applyUnwin(b: Bracket, r: number, m: number) {
  const S = b.s ?? 2;
  const match = b.rounds[r]?.[m];
  if (!match) return;
  match.w = null;
  match.status = "ready";
  delete match.pcs;
  const nx = nextOf(r, m, S);
  const nm = b.rounds[nx.r]?.[nx.m];
  if (nm) {
    const s = nm.slots[nx.s];
    if (s && s.src === match.id) {
      nm.slots[nx.s] = emptySlot();
      if (!nm.slots.every((x) => x.pid)) {
        if (nm.status === "done") {
          // limpiar en cascada el resultado del match siguiente
          applyUnwin(b, nx.r, nx.m);
        }
        nm.status = "ready";
        nm.w = null;
      }
    }
  }
}

export function resetMatch(b: Bracket, r: number, m: number) {
  const match = b.rounds[r]?.[m];
  if (!match) return;
  applyUnwin(b, r, m);
  match.slots.forEach((s) => {
    s.score = 0;
  });
  match.status = "ready";
}

/** Reinicia TODOS los resultados del bracket (marcadores, ganadores, DQs)
    conservando las asignaciones de participantes. Los byes estructurales
    se re-propagan para restaurar los slots que avanzaron automáticamente. */
export function resetAllResults(b: Bracket) {
  // 1) limpiar matches jugables
  for (const round of b.rounds) {
    for (const match of round) {
      if (match.bye) continue; // estructural: se conserva
      match.w = null;
      match.status = "ready";
      delete match.pcs;
      for (const s of match.slots) {
        s.score = 0;
        s.st = "ok";
      }
    }
  }
  // 2) vaciar slots que avanzaron de rondas anteriores
  for (let r = 1; r < b.rounds.length; r++) {
    for (const match of b.rounds[r]) {
      for (const s of match.slots) {
        if (s.src) {
          s.pid = null;
          s.label = "";
          s.members = [];
          s.score = 0;
          s.st = "ok";
          delete s.src; // Firestore rechaza undefined: hay que eliminar la clave
        }
      }
      if (!match.bye) {
        match.w = null;
        match.status = "ready";
      }
    }
  }
  // 3) re-propagar byes en orden de rondas
  for (let r = 0; r < b.rounds.length - 1; r++) {
    for (let m = 0; m < b.rounds[r].length; m++) {
      const match = b.rounds[r][m];
      if (match.bye && match.w !== null) advanceSlot(b.rounds, r, m, match.w, b.s ?? 2);
    }
  }
}

/** Tiempo estimado (epoch ms) de inicio de cada match: secuencial según duración
    configurada. Incluye TODOS los matches no-bye, incluso los de rondas futuras
    cuyos participantes aún no se definen — así el visor puede mostrar la
    cartelera completa desde el inicio. */
export function computeSchedule(
  bracket: Bracket,
  startAt: number | null,
  matchMins: number
): Map<string, number> {
  const map = new Map<string, number>();
  if (!startAt || matchMins <= 0) return map;
  let t = startAt;
  for (const round of bracket.rounds) {
    for (const match of round) {
      if (match.bye) continue;
      map.set(match.id, t);
      t += matchMins * 60_000;
    }
  }
  return map;
}

export function totalMatches(bracket: Bracket): number {
  return bracket.rounds.reduce((acc, r) => acc + r.filter((m) => !m.bye).length, 0);
}

export function doneMatches(bracket: Bracket): number {
  return bracket.rounds.reduce(
    (acc, r) => acc + r.filter((m) => !m.bye && m.status === "done" && m.slots.some((s) => s.pid)).length,
    0
  );
}

export function roundName(teamsInRound: number): string {
  switch (teamsInRound) {
    case 2:
      return "GRAN FINAL";
    case 4:
      return "SEMIFINALES";
    case 8:
      return "CUARTOS DE FINAL";
    case 16:
      return "OCTAVOS DE FINAL";
    case 32:
      return "DIECISEISAVOS";
    case 64:
      return "PRIMERA RONDA";
    default:
      return `RONDA DE ${teamsInRound}`;
  }
}

export function roundShort(teamsInRound: number): string {
  switch (teamsInRound) {
    case 2:
      return "FINAL";
    case 4:
      return "SEMI";
    case 8:
      return "CUARTOS";
    case 16:
      return "OCTAVOS";
    case 32:
      return "16AVOS";
    case 64:
      return "R1";
    default:
      return "R";
  }
}

/** Participantes teóricos en la ronda r (matches × slots por match). */
export function teamsInRound(bracket: Bracket, r: number): number {
  const S = bracket.s ?? 2;
  const first = bracket.rounds[0]?.length ?? 0;
  return (first * S) / S ** r;
}

/* ---------------- Serialización para Firestore ----------------
   Firestore no soporta arrays anidados (Match[][]), así que se guarda
   un array plano de matches con sus coordenadas r/m explícitas.
   `s` = slots por match (2 clásico · 4 FFA) para reconstruir el árbol. */

export interface BracketDoc {
  v: 1;
  createdAt: number;
  s?: number;
  matches: Array<Match & { r: number; m: number }>;
}

export function serializeBracket(b: Bracket): BracketDoc {
  const matches: BracketDoc["matches"] = [];
  b.rounds.forEach((round, r) =>
    round.forEach((m, mi) => matches.push({ ...m, r, m: mi }))
  );
  return { v: 1, s: b.s ?? 2, createdAt: b.createdAt, matches };
}

export function deserializeBracket(data: BracketDoc): Bracket {
  const maxR = data.matches.reduce((acc, m) => Math.max(acc, m.r), 0);
  const rounds: Match[][] = Array.from({ length: maxR + 1 }, () => []);
  for (const { r, m, ...match } of data.matches) {
    if (!rounds[r]) rounds[r] = [];
    rounds[r][m] = match;
  }
  // compatibilidad: brackets antiguos no traen `s` → inferir de los slots
  const s = data.s ?? data.matches[0]?.slots?.length ?? 2;
  return { rounds, createdAt: data.createdAt, s };
}

export function matchTag(bracket: Bracket, r: number, m: number): string {
  return r === bracket.rounds.length - 1 ? "GRAN FINAL" : `${roundShortLabel(bracket, r)} · M${m + 1}`;
}

/** Nombre de la ronda.
    · S = 2: por participantes (32 → DIECISEISAVOS, 4 → SEMIFINALES…).
    · S > 2 (FFA): por Nº DE MATCHES — 8 matches → OCTAVOS, 4 → CUARTOS,
      2 → SEMIFINALES (el nombre clásico equivale a 2× los matches).
    La última ronda SIEMPRE es la Gran Final. */
export function roundLabel(bracket: Bracket, r: number): string {
  if (r === bracket.rounds.length - 1) return "GRAN FINAL";
  const S = bracket.s ?? 2;
  const matches = bracket.rounds[r]?.length ?? 0;
  return S > 2 ? roundName(matches * 2) : roundName(teamsInRound(bracket, r));
}

/** Versión corta (chips del rail). */
export function roundShortLabel(bracket: Bracket, r: number): string {
  if (r === bracket.rounds.length - 1) return "FINAL";
  const S = bracket.s ?? 2;
  const matches = bracket.rounds[r]?.length ?? 0;
  return S > 2 ? roundShort(matches * 2) : roundShort(teamsInRound(bracket, r));
}

/** Podio: campeón + subcampeón + terceros.
    · S = 2 (clásico): sub = perdedor de la final; terceros = perdedores de semis.
    · S > 2 (FFA): sub y terceros = mejores marcadores del resto de la final. */
export function getPodium(b: Bracket): { champion: MatchSlot | null; second: MatchSlot | null; thirds: MatchSlot[] } {
  const R = b.rounds.length;
  const S = b.s ?? 2;
  const finalMatch = b.rounds[R - 1]?.[0];
  let champion: MatchSlot | null = null;
  let second: MatchSlot | null = null;
  const thirds: MatchSlot[] = [];
  if (finalMatch && finalMatch.w !== null) {
    champion = finalMatch.slots[finalMatch.w];
    if (S === 2) {
      second = finalMatch.slots[1 - finalMatch.w];
      if (R >= 2) {
        for (const semi of b.rounds[R - 2]) {
          if (semi.w !== null) {
            const loser = semi.slots[1 - semi.w];
            if (loser && loser.pid) thirds.push(loser);
          }
        }
      }
    } else {
      const rest = finalMatch.slots
        .map((s, i) => ({ s, i }))
        .filter((x) => x.i !== finalMatch.w && x.s.pid)
        .sort((a, z) => z.s.score - a.s.score)
        .map((x) => x.s);
      second = rest[0] ?? null;
      thirds.push(...rest.slice(1, 3));
    }
  }
  return { champion, second, thirds };
}

/* ---------------- Formato de tiempo ---------------- */

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function fmtDateLong(ts: number): string {
  return new Date(ts).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function toLocalInputValue(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

// re-export para consumidores del bracket
export { slotsPerMatch };
