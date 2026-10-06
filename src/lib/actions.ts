"use client";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { fdb } from "./firebase";
import {
  firstFreeGroup,
  maxSimultaneous,
} from "./pcs";
import {
  applyWin,
  applyUnwin,
  buildBracket,
  deserializeBracket,
  groupParticipants,
  resetAllResults,
  resetMatch,
  serializeBracket,
  type BracketDoc,
} from "./bracket";
import { MODALITY_LABEL, isTeamModality, matchPlayable, playersCapacity, slotsPerMatch, type Bracket, type MatchMember, type Modality, type Player, type Tournament } from "./types";
import { clearArenaForReset } from "./arenaState";

/* ============================================================
   Acciones Firestore (cliente) — colección: tournaments
   ============================================================ */

const tCol = () => collection(fdb, "tournaments");
const tDoc = (id: string) => doc(fdb, "tournaments", id);
const pCol = (tid: string) => collection(fdb, "tournaments", tid, "players");
const pDoc = (tid: string, pid: string) => doc(fdb, "tournaments", tid, "players", pid);
const bDoc = (tid: string) => doc(fdb, "tournaments", tid, "bracket", "main");

export type TournamentInput = Omit<Tournament, "id" | "status" | "createdAt">;

export async function createTournament(data: TournamentInput) {
  const ref = await addDoc(tCol(), {
    ...data,
    status: "open",
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateTournament(id: string, partial: Partial<TournamentInput> & { status?: Tournament["status"] }) {
  await updateDoc(tDoc(id), partial);
}

export async function deleteTournament(id: string) {
  const batch = writeBatch(fdb);
  const players = await getDocs(pCol(id));
  players.forEach((d) => batch.delete(d.ref));
  batch.delete(bDoc(id));
  // el estado de arena (podio, cartelera, banco) también se elimina con el torneo
  batch.delete(doc(fdb, "tournaments", id, "arena", "state"));
  batch.delete(tDoc(id));
  await batch.commit();
}

/* ---------------- Players ---------------- */

export type PlayerInput = Omit<Player, "id" | "createdAt">;

export async function addPlayer(tid: string, data: PlayerInput) {
  const ref = await addDoc(pCol(tid), { ...data, createdAt: Date.now() });
  return ref.id;
}

/* ---------------- Llenado automático de registros (demo) ---------------- */

const DEMO_FIRST = [
  "Alex", "Bruno", "Carlos", "Diego", "Emiliano", "Fer", "Gael", "Hugo", "Iker", "Joaco",
  "Kevin", "Lalo", "Mauri", "Nico", "Omar", "Pato", "Quique", "Rafa", "Santi", "Tono",
  "Ulises", "Vic", "Wicho", "Xavi", "Yahir", "Zuri", "Ana", "Bety", "Cami", "Dana",
];
const DEMO_LAST = [
  "Ríos", "Vega", "Cruz", "Luna", "Mora", "Soto", "Reyes", "Navarro", "Duarte", "Solís",
  "Pineda", "Marroquín", "Zamora", "Treviño", "Escobar", "Barragán", "Cisneros", "Olivas",
];
const DEMO_TAGS_A = [
  "Shadow", "Neon", "Iron", "Ciber", "Turbo", "Dark", "Pixel", "Hyper", "Astro", "Frozen",
  "Crimson", "Storm", "Ghost", "Titan", "Nova", "Vortex", "Rapid", "Black", "Feral", "Ultra",
];
const DEMO_TAGS_B = [
  "Wolf", "Fox", "King", "Reaper", "Sniper", "Blade", "Panda", "Drake", "Viper", "Hawk",
  "Rhino", "Cobra", "Falcon", "Ghost", "Slayer", "Rider", "Beast", "Core", "Strike", "Zero",
];
const DEMO_TEAMS = [
  "FALCONS", "VIPERS", "KRAKEN", "TITANES", "COBRAS", "PEGASUS", "LOBOS", "RAVENA",
  "BASILISCO", "CICLÓN", "OMBRA", "FÉNIX", "MAMBA", "GLADIADORES", "QUIMERA", "HURACÁN",
  "MURCIÉLAGO", "JAGUAR", "LEVIATÁN", "WYVERN", "GÓLEM", "ESPECTRO", "GRIFFIN", "MANTIS",
  "CÁRCOL", "NÁYADE", "SÍLFIDE", "GARGOLA", "MINOTAURO", "QUETZAL", "ESFINGE", "PEGASO",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function demoNick(used: Set<string>): string {
  for (let i = 0; i < 60; i++) {
    const n = `${pick(DEMO_TAGS_A)}${pick(DEMO_TAGS_B)}${Math.floor(Math.random() * 99)}`;
    if (!used.has(n.toUpperCase())) {
      used.add(n.toUpperCase());
      return n;
    }
  }
  const fb = `DEMO_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  used.add(fb);
  return fb;
}

/** Llena los asientos oficiales restantes con jugadores de demostración
    (marcados con demo:true para poder eliminarlos en lote después). */
export async function fillSeats(tid: string, players: Player[], tournament: Tournament) {
  const cap = playersCapacity(tournament);
  const officials = players.filter((p) => p.seat === "off");
  const missing = cap - officials.length;
  if (missing <= 0) throw new Error("Los asientos oficiales ya están llenos");

  const used = new Set(players.map((p) => p.nick.toUpperCase()));
  const usedTeams = new Set(players.map((p) => (p.team || "").toUpperCase()).filter(Boolean));
  let teamIdx = 0;
  while (usedTeams.has(DEMO_TEAMS[teamIdx % DEMO_TEAMS.length])) teamIdx++;

  const batch = writeBatch(fdb);
  const base = Date.now() - 60_000;
  for (let i = 0; i < missing; i++) {
    const inTeam = isTeamModality(tournament.modality);
    // se asigna un equipo nuevo por cada grupo de `modality` jugadores
    const teamSlot = Math.floor(i / Math.max(1, tournament.modality));
    const team = inTeam ? DEMO_TEAMS[(teamIdx + teamSlot) % DEMO_TEAMS.length] : "";
    if (team) usedTeams.add(team);
    const name = `${pick(DEMO_FIRST)} ${pick(DEMO_LAST)}`;
    const nick = demoNick(used);
    const phone = `55 ${String(1000 + Math.floor(Math.random() * 9000))} ${String(1000 + Math.floor(Math.random() * 9000))}`;
    batch.set(doc(pCol(tid)), {
      name,
      nick,
      phone,
      team,
      seat: "off",
      demo: true,
      createdAt: base + i,
    });
  }
  await batch.commit();
  return missing;
}

/** Elimina todos los jugadores demo generados automáticamente. */
export async function removeDemoPlayers(tid: string, players: Player[]) {
  const demos = players.filter((p) => p.demo);
  if (demos.length === 0) throw new Error("No hay jugadores demo que eliminar");
  const batch = writeBatch(fdb);
  demos.forEach((p) => batch.delete(pDoc(tid, p.id)));
  await batch.commit();
  return demos.length;
}

export async function updatePlayer(tid: string, pid: string, partial: Partial<PlayerInput>) {
  await updateDoc(pDoc(tid, pid), partial);
}

export async function deletePlayer(tid: string, pid: string) {
  await deleteDoc(pDoc(tid, pid));
}

/* ---------------- Bracket / flujo del torneo ---------------- */

/** FASE 4 — Lanzar Mix. Reinicio completo del torneo: los marcadores,
    ganadores y descalificaciones de la corrida anterior se eliminan por
    completo de la base de datos (setDoc reemplaza el doc).
    · Los jugadores registrados NUNCA se tocan.
    · Si quedan cupos oficiales vacíos, se completan con jugadores DEMO
      para que TODOS los slots del bracket queden llenos.
    · El bracket nuevo se sortea con todos los participantes oficiales. */
export async function launchMix(tid: string, players: Player[], tournament: Tournament) {
  const modality = tournament.modality;
  let roster = players;
  const cap = playersCapacity(tournament);
  const missing = cap - players.filter((p) => p.seat === "off").length;
  if (missing > 0) {
    await fillSeats(tid, players, tournament);
    const snap = await getDocs(pCol(tid));
    roster = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Player, "id">) }));
  }
  const parts = groupParticipants(roster, modality);
  if (parts.length < 2) {
    throw new Error("Se necesitan al menos 2 participantes oficiales para crear el bracket");
  }
  const bracket = buildBracket(parts, slotsPerMatch(modality));
  await setDoc(bDoc(tid), serializeBracket(bracket));
  await updateDoc(tDoc(tid), { status: "mixing" });
  // torneo nuevo → sin podio residual ni señales viejas en el visor
  await clearArenaForReset(tid);
}

/** Reinicia el torneo: borra el bracket y vuelve a registro abierto.
    Los jugadores registrados se conservan intactos; también se limpia
    la cuenta regresiva pendiente. */
export async function deleteBracket(tid: string) {
  const batch = writeBatch(fdb);
  batch.delete(bDoc(tid)); // borrar doc inexistente es un no-op seguro
  batch.update(tDoc(tid), { status: "open", startAt: null });
  await batch.commit();
  // reinicio completo → limpiar podio/cartelera/banco en el visor
  await clearArenaForReset(tid);
}

/** Elimina TODOS los registros (oficiales + banco) para limpiar el torneo:
    borra cada jugador, el bracket y sus resultados, y deja el torneo en
    registro abierto. La configuración del torneo se conserva. */
export async function wipeRegistrations(tid: string) {
  const snap = await getDocs(pCol(tid));
  const refs = snap.docs.map((d) => d.ref);
  // Firestore admite máx. 500 ops por batch: se divide en lotes seguros
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(fdb);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  const batch = writeBatch(fdb);
  batch.delete(bDoc(tid));
  batch.update(tDoc(tid), { status: "open", startAt: null });
  await batch.commit();
  await clearArenaForReset(tid);
}

/** Mutación atómica del bracket (transacción). */
export async function mutateBracket(tid: string, fn: (b: Bracket) => void) {
  const ref = bDoc(tid);
  await runTransaction(fdb, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("No existe el bracket de este torneo");
    const b = deserializeBracket(snap.data() as BracketDoc);
    fn(b);
    tx.set(ref, serializeBracket(b));
  });
}

/* Helper: obtiene el match por (r, m). r = -1 → thirdPlace match. */
function getMatch(b: Bracket, r: number, m: number): Match | null {
  if (r === -1) return b.thirdPlace ?? null;
  return b.rounds[r]?.[m] ?? null;
}

/* Helper: obtiene todos los matches live (incluye thirdPlace). */
function allLiveMatches(b: Bracket): Match[] {
  const out: Match[] = [];
  for (const round of b.rounds) {
    for (const x of round) {
      if (x.status === "live" && x.pcs?.length) out.push(x);
    }
  }
  if (b.thirdPlace && b.thirdPlace.status === "live" && b.thirdPlace.pcs?.length) {
    out.push(b.thirdPlace);
  }
  return out;
}

export async function setScore(tid: string, r: number, m: number, slotIdx: number, delta: number, winsNeeded: number) {
  await mutateBracket(tid, (b) => {
    const match = getMatch(b, r, m);
    const slot = match?.slots[slotIdx];
    if (!match || !slot || !slot.pid || match.status === "done") return;
    slot.score = Math.max(0, Math.min(winsNeeded, slot.score + delta));
    if (slot.score >= winsNeeded) {
      if (r === -1) {
        // third place match — marcar ganador directamente (no avanza a ningún lado)
        match.w = slotIdx;
        match.status = "done";
        delete match.pcs;
      } else {
        applyWin(b, r, m, slotIdx);
      }
    }
  });
}

export async function setWinner(tid: string, r: number, m: number, slotIdx: number | null) {
  await mutateBracket(tid, (b) => {
    const match = getMatch(b, r, m);
    if (!match) return;
    if (slotIdx === null) {
      if (r === -1) {
        match.w = null;
        match.status = "ready";
        delete match.pcs;
      } else {
        applyUnwin(b, r, m);
      }
    } else {
      if (!match.slots[slotIdx]?.pid) return;
      if (r === -1) {
        match.w = slotIdx;
        match.status = "done";
        delete match.pcs;
      } else {
        applyWin(b, r, m, slotIdx);
      }
    }
  });
}

export async function disqualify(tid: string, r: number, m: number, slotIdx: number) {
  await mutateBracket(tid, (b) => {
    const S = b.s ?? 2;
    const match = getMatch(b, r, m);
    const slot = match?.slots[slotIdx];
    if (!match || !slot || !slot.pid) return;
    if (match.status === "done" && match.w === slotIdx) {
      if (r === -1) {
        match.w = null;
        match.status = "ready";
        delete match.pcs;
      } else {
        applyUnwin(b, r, m);
      }
    }
    slot.st = "dq";
    slot.score = 0;
    if (S === 2) {
      const other = match.slots[1 - slotIdx];
      if (other?.pid) {
        if (r === -1) {
          match.w = 1 - slotIdx;
          match.status = "done";
          delete match.pcs;
        } else {
          applyWin(b, r, m, 1 - slotIdx);
        }
      }
    }
  });
}

export async function setSlotOk(tid: string, r: number, m: number, slotIdx: number) {
  await mutateBracket(tid, (b) => {
    const match = getMatch(b, r, m);
    const slot = match?.slots[slotIdx];
    if (slot && slot.pid) slot.st = "ok";
  });
}

/** Reserva que entra a un slot del bracket. */
export interface BankPick {
  label: string;
  members: MatchMember[];
  full?: boolean; // reemplaza el participante COMPLETO (equipo del banco rotativo)
}

/** Reemplaza un slot con una reserva del banco.
    · Modalidades individuales (1v1/FFA) o `full`: el participante completo
      ocupa el slot — así cubre un no-show un eliminado de la ronda anterior
      (banco rotativo) o un equipo completo de reserva.
    · Equipos + reserva individual del registro: la reserva se integra al
      equipo (sustituye a un integrante DQ, completa un lugar libre o entra
      por el primer integrante). Los matches terminados no se tocan. */
export async function replaceFromBank(tid: string, r: number, m: number, slotIdx: number, pick: BankPick, modality: Modality) {
  await mutateBracket(tid, (b) => {
    const match = getMatch(b, r, m);
    const slot = match?.slots[slotIdx];
    if (!match || !slot || !slot.pid) return;
    if (match.status === "done") return;
    slot.st = "rep";
    const incoming = pick.members.map((mm) => ({ pid: mm.pid, nick: mm.nick, sub: true }));
    if (incoming.length === 0) return;
    if (modality === 1 || modality === 5 || pick.full) {
      slot.pid = incoming[0].pid || `bank_${slotIdx}`;
      slot.label = pick.label;
      slot.members = incoming;
    } else {
      const members = slot.members.length ? slot.members : [{ pid: "x", nick: slot.label }];
      const dqIdx = members.findIndex((x) => x.dq);
      if (dqIdx >= 0) {
        members[dqIdx] = incoming[0];
      } else if (members.length < modality) {
        members.push(incoming[0]);
      } else {
        members[0] = incoming[0];
      }
      slot.members = members;
    }
  });
}

/** Marca/desmarca un match EN JUEGO. Al ponerlo en juego asigna el primer
    grupo de PCs libre (1v1: PC1+PC2 o PC3+PC4 — máx. 2 simultáneos; resto
    de modalidades: 1 match a la vez). Al detenerlo o definir ganador las
    PCs quedan libres para el siguiente match. */
export async function setMatchLive(tid: string, r: number, m: number, on: boolean, modality: Modality) {
  await mutateBracket(tid, (b) => {
    const match = getMatch(b, r, m);
    if (!match || match.status === "done") return;
    if (!matchPlayable(match)) return;
    if (on) {
      if (!match.pcs?.length) {
        const used = new Set<string>();
        // contar matches live en rondas + thirdPlace
        for (const x of allLiveMatches(b)) {
          if (x.id !== match.id) used.add(x.pcs!.join("|"));
        }
        const free = firstFreeGroup(modality, used);
        if (!free) {
          throw new Error(
            `Sin PCs disponibles: máximo ${maxSimultaneous(modality)} match(es) en juego en ${MODALITY_LABEL[modality]}`
          );
        }
        match.pcs = free;
      }
      match.status = "live";
    } else {
      match.status = "ready";
      delete match.pcs;
    }
  });
}

export async function resetMatchScores(tid: string, r: number, m: number) {
  await mutateBracket(tid, (b) => {
    if (r === -1) {
      // reset del thirdPlace match
      if (!b.thirdPlace) return;
      b.thirdPlace.w = null;
      b.thirdPlace.status = "ready";
      delete b.thirdPlace.pcs;
      b.thirdPlace.slots.forEach((s) => { s.score = 0; });
    } else {
      resetMatch(b, r, m);
    }
  });
}

/** Limpia marcadores, ganadores y DQs de TODO el bracket conservando las
    asignaciones del mix. El torneo queda listo para jugar de nuevo.
    Al desaparecer el campeón, el podio también se limpia del visor. */
export async function resetBracketResults(tid: string) {
  await mutateBracket(tid, (b) => {
    resetAllResults(b);
  });
  await clearArenaForReset(tid);
}

export async function setStartAt(tid: string, ts: number | null) {
  await updateDoc(tDoc(tid), { startAt: ts });
}

export async function setStatus(tid: string, status: Tournament["status"]) {
  await updateDoc(tDoc(tid), { status });
}

/* ---------------- Seguridad del flujo del torneo ---------------- */

/** FASE 2 — Cerrar registros con validación: solo se permite si TODOS los
    lugares oficiales están llenos. El banco de reservas es opcional. */
export async function closeRegistration(tid: string, players: Player[], tournament: Tournament) {
  const cap = playersCapacity(tournament);
  const officials = players.filter((p) => p.seat === "off").length;
  const missing = cap - officials;
  if (missing > 0) {
    throw new Error(
      `No se puede cerrar el registro: faltan ${missing} jugador(es) para llenar los ${cap} lugares oficiales. El banco de reservas es opcional.`
    );
  }
  await updateDoc(tDoc(tid), { status: "closed" });
}

/** FASE 5 — Detener torneo: pausa la transmisión (NO lo finaliza).
    Se puede reabrir desde la fase 5 del flujo. */
export async function stopTournament(tid: string) {
  await updateDoc(tDoc(tid), { status: "stopped" });
}

/** FASE 5 — Finalizar torneo: SOLO es posible cuando la Gran Final ya tiene
    ganador (champion definido). Un torneo realmente termina al resolverse
    la final — nunca por detener la transmisión. */
export async function finishTournament(tid: string, bracket: Bracket | null) {
  if (!bracket) throw new Error("No hay bracket: lanza el mix antes de finalizar");
  const finalMatch = bracket.rounds[bracket.rounds.length - 1]?.[0];
  const champion = finalMatch && finalMatch.w !== null ? finalMatch.slots[finalMatch.w] : null;
  if (!finalMatch || finalMatch.w === null || !champion?.pid) {
    throw new Error("No se puede finalizar: la Gran Final todavía no tiene ganador");
  }
  await updateDoc(tDoc(tid), { status: "finished" });
}
