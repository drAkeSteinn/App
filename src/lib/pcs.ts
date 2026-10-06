import type { Bracket, Match, Modality } from "./types";
import { matchTag } from "./bracket";

/* ============================================================
   Sistema de PCs del escenario (4 computadoras disponibles).
   Cada match "EN JUEGO" ocupa un grupo de PCs según la modalidad:

   · 1v1 → 2 PCs por match (una por jugador)
          Match A: PC1 vs PC2 · Match B: PC3 vs PC4
          → caben 2 matches simultáneos
   · 2v2 → 4 PCs por match (equipo A: PC1+PC2, equipo B: PC3+PC4)
          → 1 match simultáneo
   · 3v3 → hasta la PC3 (estación por posición: la posición 1 de
          cada equipo juega en PC1, la 2 en PC2, la 3 en PC3)
          → 1 match simultáneo
   · 4v4 → las 4 PCs (posición por estación, igual que 3v3)
          → 1 match simultáneo
   · 1v1v1v1 (FFA) → las 4 PCs: 1 jugador por PC
          → 1 match simultáneo

   Al definirse un ganador el match libera sus PCs y el siguiente
   match marcado "en juego" toma automáticamente el grupo libre.
   ============================================================ */

export const TOTAL_PCS = 4;

/** PCs que consume un match según la modalidad. */
export function pcCountFor(modality: Modality): number {
  return modality === 1 ? 2 : modality === 2 ? 4 : modality === 3 ? 3 : 4;
}

/** Matches simultáneos posibles: 1v1 → 2, resto → 1. */
export function maxSimultaneous(modality: Modality): number {
  return Math.max(1, Math.floor(TOTAL_PCS / pcCountFor(modality)));
}

/** Grupos de PCs asignables (un grupo = un match en juego). */
export function pcGroups(modality: Modality): string[][] {
  if (modality === 1) return [["PC1", "PC2"], ["PC3", "PC4"]];
  if (modality === 3) return [["PC1", "PC2", "PC3"]];
  return [["PC1", "PC2", "PC3", "PC4"]];
}

/** PC de un jugador concreto (slot + posición dentro del equipo).
    En FFA (1v1v1v1) cada slot es 1 jugador y juega en la PC de su posición. */
export function pcForPlayer(
  modality: Modality,
  pcs: string[] | undefined | null,
  slotIdx: number,
  memberIdx: number
): string | null {
  if (!pcs || pcs.length === 0) return null;
  if (modality === 1 || modality === 5) return pcs[slotIdx] ?? null;
  if (modality === 2) return pcs[slotIdx * 2 + memberIdx] ?? null;
  return pcs[memberIdx] ?? null;
}

/** PCs que usa cada lado del match (para el spotlight del visor). */
export function pcsForSide(
  modality: Modality,
  pcs: string[] | undefined | null,
  slotIdx: number
): string[] {
  if (!pcs || pcs.length === 0) return [];
  if (modality === 1 || modality === 5) return pcs[slotIdx] ? [pcs[slotIdx]] : [];
  if (modality === 2) return pcs.slice(slotIdx * 2, slotIdx * 2 + 2);
  return [...pcs];
}

export function pcsKey(pcs: string[] | undefined | null): string {
  return (pcs ?? []).join("|");
}

export function pcsLabel(pcs: string[] | undefined | null): string {
  return (pcs ?? []).join(" · ");
}

/** Texto compacto para badges: [PC1,PC2] → "PC1·2", [PC1,PC2,PC3,PC4] → "PC1·2·3·4". */
export function pcsCompact(pcs: string[] | undefined | null): string {
  if (!pcs || pcs.length === 0) return "";
  return pcs.map((p, i) => (i === 0 ? p : p.replace(/^PC/, ""))).join("·");
}

function pcIndex(pc: string): number {
  const n = Number(pc.replace(/^PC/, ""));
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_PCS ? n - 1 : -1;
}

/** Ocupación de una PC por un match del plan (PC → slot/miembro). */
export interface PcCellInfo {
  pc: string;
  r: number;
  m: number;
  matchId: string;
  tag: string;
  /** Quién ocupa la PC: nick/lado (1v1), miembro (2v2) o posición (3v3/4v4). */
  label: string;
  status: Match["status"];
}

/** Mapa de las 4 PCs del escenario: qué match y qué participante ocupa cada una.
   · En juego → PC ocupada por su match con estado "live".
   · Listos → plan derivada (mismos criterios que plannedPcs).
   · PC sin asignación → null (LIBRE). */
export function pcOccupancy(b: Bracket, modality: Modality): (PcCellInfo | null)[] {
  const plan = plannedPcs(b, modality);
  const out: (PcCellInfo | null)[] = Array.from({ length: TOTAL_PCS }, () => null);
  if (plan.size === 0) return out;

  // mismo orden que plannedPcs: primero los EN JUEGO, luego los listos en orden de bracket
  const ordered: { match: Match; r: number; m: number; pcs: string[] }[] = [];
  b.rounds.forEach((round, r) =>
    round.forEach((match, m) => {
      const pcs = plan.get(match.id);
      if (pcs) ordered.push({ match, r, m, pcs });
    })
  );
  ordered.sort((a, z) => (a.match.status === "live" ? 0 : 1) - (z.match.status === "live" ? 0 : 1));

  for (const { match, r, m, pcs } of ordered) {
    pcs.forEach((pc) => {
      const idx = pcIndex(pc);
      if (idx < 0 || out[idx]) return;
      let label = "";
      if (modality === 1 || modality === 5) {
        const side = pcs.indexOf(pc);
        label = match.slots[side]?.label ?? "";
      } else if (modality === 2) {
        const pos = pcs.indexOf(pc);
        const side = pos < 2 ? 0 : 1;
        const mi = pos % 2;
        label = match.slots[side]?.members[mi]?.nick ?? match.slots[side]?.label ?? "";
      } else {
        label = `POS ${pcs.indexOf(pc) + 1}`;
      }
      out[idx] = {
        pc,
        r,
        m,
        matchId: match.id,
        tag: match.bye ? "BYE" : matchTag(b, r, m),
        label,
        status: match.status,
      };
    });
  }
  return out;
}

/** Primer grupo de PCs libre dado un conjunto de claves usadas. */
export function firstFreeGroup(modality: Modality, usedKeys: Iterable<string>): string[] | null {
  const used = new Set(usedKeys);
  return pcGroups(modality).find((g) => !used.has(g.join("|"))) ?? null;
}

/** En FFA los matches parciales (p.ej. Gran Final de 2 clasados) sólo usan
    las PCs de sus slots: el resto del grupo queda libre. */
function ffaTrim(modality: Modality, match: Match, pcs: string[]): string[] {
  return modality === 5 && match.slots.length > 0 && match.slots.length < pcs.length
    ? pcs.slice(0, match.slots.length)
    : pcs;
}

/** Mapa matchId → PCs visibles en las cards:
    · En juego: sus PCs guardadas (o el primer grupo libre si las perdió).
    · Listos (ambos participantes definidos): plan asignada con los grupos
      que sobran, en orden de bracket. Al terminar un match su grupo queda
      libre y el siguiente match listo hereda ese grupo automáticamente. */
export function plannedPcs(b: Bracket, modality: Modality): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const used = new Set<string>();

  // 1) los matches EN JUEGO conservan sus PCs
  for (const round of b.rounds) {
    for (const match of round) {
      if (match.status !== "live") continue;
      const pcs = match.pcs?.length ? match.pcs : firstFreeGroup(modality, used);
      if (pcs) {
        out.set(match.id, ffaTrim(modality, match, pcs));
        used.add(pcs.join("|"));
      }
    }
  }

  // 2) los matches LISTOS se reparten los grupos restantes en orden
  if (out.size < pcGroups(modality).length) {
    for (const round of b.rounds) {
      for (const match of round) {
        if (match.bye || match.status !== "ready") continue;
        if (match.slots.filter((s) => s.pid).length < 2) continue;
        const g = firstFreeGroup(modality, used);
        if (!g) return out; // sin PCs libres: el resto queda sin plan
        out.set(match.id, ffaTrim(modality, match, g));
        used.add(g.join("|"));
      }
    }
  }

  // 3) match de 3er lugar (thirdPlace) — PCs en vivo o planificadas
  if (b.thirdPlace) {
    const tp = b.thirdPlace;
    if (tp.status === "live" && tp.pcs?.length) {
      out.set(tp.id, ffaTrim(modality, tp, tp.pcs));
    } else if (tp.status === "ready" && tp.slots.filter((s) => s.pid).length >= 2 && !out.has(tp.id)) {
      const g = firstFreeGroup(modality, used);
      if (g) {
        out.set(tp.id, ffaTrim(modality, tp, g));
        used.add(g.join("|"));
      }
    }
  }

  return out;
}