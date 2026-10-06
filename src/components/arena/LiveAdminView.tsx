"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Columns3,
  Hand,
  LayoutPanelLeft,
  Loader2,
  Lock,
  Maximize2,
  Minus,
  Monitor,
  MonitorPlay,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Radio,
  RefreshCw,
  Repeat,
  Rocket,
  RotateCcw,
  SkipForward,
  Square,
  TimerReset,
  Trash2,
  Trophy,
  Undo2,
  UserMinus,
  UserPlus,
  Users,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { Bracket, Modality, Player, Tournament } from "@/lib/types";
import { MODALITY_LABEL, matchPlayable, playersCapacity } from "@/lib/types";
import { computeBank, type BankInfo } from "@/lib/bank";
import {
  computeSchedule,
  doneMatches,
  fmtTime,
  groupParticipants,
  matchTag,
  roundLabel,
  totalMatches,
} from "@/lib/bracket";
import {
  deleteBracket,
  disqualify,
  fillSeats,
  launchMix,
  removeDemoPlayers,
  replaceFromBank,
  resetBracketResults,
  resetMatchScores,
  setMatchLive,
  setScore,
  setSlotOk,
  setStartAt,
  setWinner,
  setStatus,
} from "@/lib/actions";
import { closeBankPick, emitSound, openBankPick, setSchedOpen, useArenaState } from "@/lib/arenaState";
import { useSoundPlayer, type SoundEvent } from "@/lib/sounds";
import { closeTournament, getActiveInfo, openTournament, useActiveTournament } from "@/lib/activeTournament";
import { useTournaments } from "@/lib/hooks";
import { useContests } from "@/lib/contestHooks";
import { BracketTree, FitStage } from "@/components/bracket/BracketTree";
import { maxSimultaneous, pcForPlayer, pcOccupancy, plannedPcs, pcsLabel } from "@/lib/pcs";
import { RoundColumns } from "./RoundColumns";
import { Btn, Confirm, EmptyState, IconBtn, Modal, ModalityChip, StatusChip } from "./ui";

/* ============================================================
   Vista TORNEO EN VIVO — administración del bracket
   · Dos vistas: Bracket (árbol) y Rondas (columnas de cards)
   · Panel lateral colapsable de edición del match
   · Zoom manual del bracket + auto-fit
   · Reiniciar marcadores / Reiniciar torneo completo
   ============================================================ */

type AdminView = "tree" | "rounds";

export function LiveAdminView({
  tournament,
  players,
  bracket,
  loadingBracket,
}: {
  tournament: Tournament | null;
  players: Player[];
  bracket: Bracket | null;
  loadingBracket: boolean;
}) {
  const [sel, setSel] = useState<{ r: number; m: number } | null>(null);
  const [pickBank, setPickBank] = useState<{ r: number; m: number; slotIdx: number } | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "remix" | "finish" | "wipe" | "reopen" | "results" | "fill" | "demos" }>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<AdminView>("tree");
  const [panelOpen, setPanelOpen] = useState(true);
  const [zoom, setZoom] = useState<number | null>(null); // null = auto-fit
  const [startMins, setStartMins] = useState(1);
  const [forceModal, setForceModal] = useState<{ blockingName: string } | null>(null);
  const { data: allTournaments } = useTournaments();
  const { data: allContests } = useContests();

  /* banco efectivo: reservas del registro antes de la primera eliminatoria;
     después, los eliminados de la última ronda completada (banco rotativo) */
  const bankInfo = useMemo(() => computeBank(bracket, players), [bracket, players]);
  const arenaState = useArenaState(tournament?.id ?? null);
  const playSound = useSoundPlayer();
  const schedOpen = arenaState?.schedOpen ?? false;
  /** Dispara un sonido en el panel local y lo emite al visor. */
  const fireSound = (event: SoundEvent) => {
    playSound(event);
    if (tournament) emitSound(tournament.id, event).catch(() => {});
  };
  /* Torneo activo para transmisión (visor + OBS). Solo uno a la vez. */
  const active = useActiveTournament();
  const isActive = !!tournament && active.tid === tournament.id;
  const anotherActive = !!active.tid && active.tid !== tournament?.id;
  const activeTournamentName = active.tournament?.name ?? null;
  const participants = useMemo(
    () => (tournament ? groupParticipants(players, tournament.modality) : []),
    [players, tournament]
  );
  const officialsCount = useMemo(() => players.filter((p) => p.seat === "off").length, [players]);
  const demoCount = useMemo(() => players.filter((p) => p.demo).length, [players]);
  const missingPlayers = tournament ? playersCapacity(tournament) - officialsCount : 0;
  const schedule = useMemo(
    () => (tournament && bracket ? computeSchedule(bracket, tournament.startAt, tournament.matchMins) : new Map()),
    [bracket, tournament]
  );
  /* capacidad del escenario: matches simultáneos según las 4 PCs */
  const maxSim = tournament ? maxSimultaneous(tournament.modality) : 1;
  const liveCount = useMemo(
    () => (bracket ? bracket.rounds.reduce((acc, round) => acc + round.filter((x) => x.status === "live").length, 0) : 0),
    [bracket]
  );

  /* navegación secuencial de matches (para editar rápido sin recorrer todo) */
  const flatMatches = useMemo(() => {
    if (!bracket) return [];
    const out: { r: number; m: number }[] = [];
    bracket.rounds.forEach((round, r) => round.forEach((_, m) => out.push({ r, m })));
    return out;
  }, [bracket]);
  const flatIdx = useMemo(() => {
    if (!sel || !bracket) return -1;
    return flatMatches.findIndex((x) => x.r === sel.r && x.m === sel.m);
  }, [flatMatches, sel, bracket]);

  if (!tournament) {
    return (
      <div className="panel clip-card">
        <EmptyState
          icon={<Radio size={26} />}
          title="Selecciona un torneo"
          message="Elige un torneo en el selector superior para administrar el bracket en vivo: ganadores, descalificaciones y reemplazos del banco."
        />
      </div>
    );
  }

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de operación");
    } finally {
      setBusy(false);
    }
  };

  const selMatch = sel && bracket ? bracket.rounds[sel.r]?.[sel.m] : null;

  const stepMatch = (dir: 1 | -1) => {
    const nx = flatMatches[flatIdx + dir];
    if (nx) setSel(nx);
  };

  const zoomStep = (dir: 1 | -1) => {
    setZoom((z) => {
      const base = z ?? 0.8;
      return Math.min(1.8, Math.max(0.3, Math.round((base + dir * 0.1) * 100) / 100));
    });
  };

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* ============ barra de info del torneo ============ */}
      <div className="panel clip-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 mr-auto">
          <span className="slashes w-8 h-4 inline-block shrink-0" aria-hidden />
          <div className="min-w-0">
            <div className="font-display italic text-[17px] uppercase truncate">{tournament.name}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusChip status={tournament.status} />
              <ModalityChip modality={tournament.modality} />
              {bracket ? (
                <span
                  className={`chip clip-tag border ${
                    liveCount >= maxSim
                      ? "bg-[#e8102e]/15 text-[#ff8095] border-[#e8102e]/40"
                      : "bg-[#e8102e]/12 text-[#ff8095] border-[#e8102e]/35"
                  }`}
                  title="Matches en juego / máximo simultáneo según las PCs del escenario (4 PCs)"
                >
                  <Monitor size={10} />
                  EN JUEGO {liveCount}/{maxSim}
                </span>
              ) : null}
              {bracket ? (
                <span className="chip clip-tag bg-white/[0.06] text-[#c9cbd3] border border-white/10">
                  {doneMatches(bracket)}/{totalMatches(bracket)} MATCHES
                </span>
              ) : (
                <span className="chip clip-tag bg-white/[0.06] text-[#c9cbd3] border border-white/10">
                  {officialsCount}/{playersCapacity(tournament)} JUGADORES
                </span>
              )}
              {tournament.startAt ? (
                <span className="chip clip-tag bg-[#ffb830]/12 text-[#ffb830] border border-[#ffb830]/35">
                  <TimerReset size={10} />
                  INICIA ≈ {fmtTime(tournament.startAt)}
                </span>
              ) : null}
              {isActive ? (
                <span className="chip clip-tag bg-[#e8102e] text-white text-[9px] blink">
                  <span className="w-1.5 h-1.5 bg-white rounded-full" aria-hidden />
                  EN TRANSMISIÓN
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {/* control de transmisión: Abrir / Cerrar torneo para el visor + OBS */}
        <div className="flex items-center gap-2 shrink-0">
          {isActive ? (
            <Btn
              small
              variant="dark"
              onClick={() =>
                guard(async () => {
                  await closeTournament();
                  toast.success("Torneo cerrado — el visor y las cards de OBS dejan de transmitir");
                })
              }
              title="Cerrar torneo: el visor y las cards de OBS dejan de mostrar este torneo"
            >
              <Lock size={12} />
              Cerrar torneo
            </Btn>
          ) : (
            <Btn
              small
              variant={anotherActive ? "dark" : "red"}
              title={
                anotherActive
                  ? `Ya hay otra transmisión activa: ${activeTournamentName}. Clic para forzar.`
                  : "En vivo: el visor y las cards de OBS mostrarán este torneo"
              }
              onClick={() =>
                guard(async () => {
                  if (!tournament) return;
                  /* verificar si hay otra transmisión activa */
                  const info = await getActiveInfo();
                  const hasOther = (info.tid && info.tid !== tournament.id) || info.contestId;
                  if (hasOther) {
                    /* determinar el nombre del bloqueante */
                    let blockingName = "otra transmisión";
                    if (info.tid) {
                      const t = allTournaments.find((x) => x.id === info.tid);
                      blockingName = t?.name ?? "un torneo";
                    } else if (info.contestId) {
                      const c = allContests.find((x) => x.id === info.contestId);
                      blockingName = c?.name ?? "un concurso";
                    }
                    setForceModal({ blockingName });
                    return;
                  }
                  await openTournament(tournament.id, tournament.name);
                  toast.success("Torneo en vivo — el visor y las cards de OBS lo muestran");
                })
              }
            >
              <Radio size={12} />
              {anotherActive ? `Ocupado: ${activeTournamentName}` : "En vivo"}
            </Btn>
          )}
        </div>
      </div>

      {/* ============ FLUJO POR FASES ============ */}
      <PhaseBar
        tournament={tournament}
        bracket={bracket}
        participantsCount={participants.length}
        officialsCount={officialsCount}
        missingPlayers={missingPlayers}
        demoCount={demoCount}
        bankCount={bankInfo.entries.length}
        startMins={startMins}
        setStartMins={setStartMins}
        busy={busy}
        guard={guard}
        onConfirm={(kind) => setConfirm({ kind })}
        onLaunchMix={() =>
          guard(async () => {
            await launchMix(tournament.id, players, tournament);
            setSel(null);
            fireSound("mixLaunch");
            toast.success("Mix match lanzado — el visor reproduce la animación");
          })
        }
      />

      {/* ============ cuerpo ============ */}
      {loadingBracket ? (
        <div className="panel clip-card p-14 flex items-center justify-center text-[#8e919c]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !bracket ? (
        <div className="panel clip-card">
          <EmptyState
            icon={<Zap size={26} />}
            title="Brackets no creados"
            message={`Cuando estés listo, lanza el MIX MATCH: se randomizarán los ${participants.length} participantes y el visor de espectadores mostrará la animación de llenado de brackets.`}
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                <Btn
                  variant="red"
                  disabled={participants.length < 2}
                  onClick={() =>
                    guard(async () => {
                      await launchMix(tournament.id, players, tournament);
                      fireSound("mixLaunch");
                      toast.success("Mix match lanzado");
                    })
                  }
                >
                  <Rocket size={13} />
                  Lanzar mix match
                </Btn>
                <Btn
                  variant="dark"
                  onClick={() =>
                    guard(async () => {
                      await setStartAt(tournament.id, Date.now() + startMins * 60_000);
                      toast.success(`Inicio configurado en ${startMins} min — el visor cambia a brackets con el cronómetro`);
                    })
                  }
                >
                  <TimerReset size={13} />
                  Inicio en {startMins} min
                </Btn>
              </div>
            }
          />
          {/* vista previa de participantes */}
          {participants.length > 0 ? (
            <div className="px-5 pb-5">
              <div className="label-cap mb-2 flex items-center gap-2">
                <Users size={11} />
                Participantes que entrarán al sorteo ({participants.length})
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {participants.map((p, i) => (
                  <span key={p.pid} className="chip clip-tag bg-white/[0.05] text-[#c9cbd3] border border-white/10">
                    {i + 1}. {p.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {/* ============ toolbar de vistas ============ */}
          <div className="panel clip-card-sm px-3 py-2 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 p-0.5 bg-black/40 border border-white/10" role="radiogroup" aria-label="Vista del bracket">
              <button
                type="button"
                role="radio"
                aria-checked={view === "tree"}
                onClick={() => setView("tree")}
                className={`btn-press clip-tag px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] flex items-center gap-1.5 transition-colors ${
                  view === "tree" ? "bg-[linear-gradient(160deg,#ff2440,#a30d24)] text-white" : "text-[#8e919c] hover:text-white"
                }`}
              >
                <LayoutPanelLeft size={12} />
                Bracket
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={view === "rounds"}
                onClick={() => setView("rounds")}
                className={`btn-press clip-tag px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] flex items-center gap-1.5 transition-colors ${
                  view === "rounds" ? "bg-[linear-gradient(160deg,#ff2440,#a30d24)] text-white" : "text-[#8e919c] hover:text-white"
                }`}
              >
                <Columns3 size={12} />
                Rondas
              </button>
            </div>

            {selMatch ? (
              <span className="chip clip-tag bg-[#e8102e]/15 text-[#ff8095] border border-[#e8102e]/40 text-[9px] flex items-center gap-1.5">
                <Hand size={10} />
                {matchTag(bracket, sel!.r, sel!.m)} seleccionado
              </span>
            ) : (
              <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#6b6e78] hidden sm:inline">
                Clic en un match para administrarlo
              </span>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              {/* navegación prev/next */}
              <div className="flex items-center gap-1">
                <IconBtn title="Match anterior" disabled={flatIdx <= 0} onClick={() => stepMatch(-1)}>
                  <ChevronLeft size={14} />
                </IconBtn>
                <IconBtn title="Match siguiente" disabled={flatIdx < 0 || flatIdx >= flatMatches.length - 1} onClick={() => stepMatch(1)}>
                  <ChevronRight size={14} />
                </IconBtn>
              </div>

              {/* zoom (solo vista bracket) */}
              {view === "tree" ? (
                <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                  <IconBtn title="Alejar" onClick={() => zoomStep(-1)}>
                    <ZoomOut size={14} />
                  </IconBtn>
                  <span className="text-[9px] font-extrabold tabular-nums text-[#8e919c] w-10 text-center uppercase">
                    {zoom ? `${Math.round(zoom * 100)}%` : "AUTO"}
                  </span>
                  <IconBtn title="Acercar" onClick={() => zoomStep(1)}>
                    <ZoomIn size={14} />
                  </IconBtn>
                  <IconBtn title="Ajustar a la pantalla" active={zoom === null} onClick={() => setZoom(null)}>
                    <Maximize2 size={13} />
                  </IconBtn>
                </div>
              ) : null}

              {/* toggle cartelera en el visor (proyectado) */}
              <button
                type="button"
                onClick={() => {
                  if (!tournament) return;
                  setSchedOpen(tournament.id, !schedOpen).catch(() => {});
                }}
                title={schedOpen ? "Ocultar cartelera en el visor" : "Mostrar cartelera de horarios en el visor"}
                aria-pressed={schedOpen}
                className={`btn-press clip-tag px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em] flex items-center gap-1.5 border transition-colors ${
                  schedOpen
                    ? "border-[#ffb830]/60 bg-[#ffb830]/12 text-[#ffb830]"
                    : "border-white/12 text-[#8e919c] hover:text-white hover:border-[#ffb830]/50"
                }`}
              >
                <CalendarClock size={13} />
                <span className="hidden md:inline">Cartelera</span>
              </button>

              {/* editar posición de cards de OBS (abre el editor draggable) */}
              <button
                type="button"
                onClick={() => window.open("/?obs=1&edit=1", "_blank", "noopener")}
                title="Arrastrar las cards de OBS (PC1-PC4) a posiciones personalizadas — se guarda para todos los torneos"
                className="btn-press clip-tag px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em] flex items-center gap-1.5 border border-white/12 text-[#8e919c] hover:text-white hover:border-[#e8102e]/60 transition-colors"
              >
                <MonitorPlay size={13} />
                <span className="hidden md:inline">Editar cards OBS</span>
              </button>

              {/* toggle panel lateral */}
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                title={panelOpen ? "Ocultar panel del match" : "Mostrar panel del match"}
                aria-pressed={panelOpen}
                className={`btn-press p-2 border transition-colors hidden xl:inline-flex ${
                  panelOpen
                    ? "border-[#e8102e]/60 bg-[#e8102e]/10 text-white"
                    : "border-white/12 text-[#8e919c] hover:text-white"
                }`}
              >
                {panelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </button>
            </div>
          </div>

          {/* ============ stage + panel lateral colapsable ============ */}
          <div className="flex gap-3 items-stretch min-h-0">
            {/* área principal */}
            <div className="flex-1 min-w-0 min-h-0">
              <div className="panel clip-card p-3 min-h-[420px] h-[calc(100vh-330px)] max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-2 pb-2">
                  <span className="label-cap">
                    {view === "tree" ? "Bracket · clic en un match para administrar" : "Rondas · cards seleccionables con botón de ganador directo"}
                  </span>
                  <span className="label-cap">{MODALITY_LABEL[tournament.modality]} · a {tournament.winsNeeded} wins</span>
                </div>

                {/* monitor del escenario: asignación de las 4 PCs por match */}
                <PcDock tournament={tournament} bracket={bracket} onSelectMatch={(r, m) => setSel({ r, m })} />

                {view === "tree" ? (
                  <div className="flex-1 min-h-0 border border-white/8 bg-black/30 clip-card-sm">
                    <FitStage deps={[bracket, tournament.modality, zoom]} maxScale={0.95} minScale={0.4} zoom={zoom} className="w-full h-full">
                      <BracketTree
                        bracket={bracket}
                        modality={tournament.modality}
                        mode="admin"
                        selectedId={selMatch?.id ?? null}
                        onSelectMatch={(r, m) => setSel({ r, m })}
                        schedule={schedule}
                        showTimes
                      />
                    </FitStage>
                  </div>
                ) : (
                  <RoundColumns
                    bracket={bracket}
                    modality={tournament.modality}
                    times={schedule}
                    selectedId={selMatch?.id ?? null}
                    onSelectMatch={(r, m) => setSel({ r, m })}
                    onPickWinner={(r, m, slotIdx) =>
                      guard(async () => {
                        await setWinner(tournament.id, r, m, slotIdx);
                        fireSound("winner");
                        setSel({ r, m });
                        toast.success(`${bracket.rounds[r][m].slots[slotIdx].label} avanza`);
                      })
                    }
                  />
                )}
              </div>
            </div>

            {/* panel lateral (desktop, colapsable) */}
            <aside
              className={`hidden xl:block shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${
                panelOpen ? "w-[376px]" : "w-0"
              }`}
              aria-hidden={!panelOpen}
            >
              <div className="w-[376px] h-full">
                <MatchPanel
                  tournament={tournament}
                  bracket={bracket}
                  sel={sel}
                  setSel={setSel}
                  selMatch={selMatch}
                  schedule={schedule}
                  bankInfo={bankInfo}
                  onClose={() => setPanelOpen(false)}
                  guard={guard}
                  setPickBank={setPickBank}
                  busy={busy}
                  stepMatch={stepMatch}
                  onSound={fireSound}
                />
              </div>
            </aside>
          </div>

          {/* panel del match (móvil/tablet: debajo) */}
          <div className="xl:hidden">
            <MatchPanel
              tournament={tournament}
              bracket={bracket}
              sel={sel}
              setSel={setSel}
              selMatch={selMatch}
              schedule={schedule}
              bankInfo={bankInfo}
              onClose={() => setSel(null)}
              guard={guard}
              setPickBank={setPickBank}
              busy={busy}
              stepMatch={stepMatch}
              onSound={fireSound}
            />
          </div>

          {/* pestaña flotante para reabrir el panel en desktop */}
          {!panelOpen && selMatch ? (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="btn-press fixed right-0 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col items-center gap-2 red-badge clip-badge-l px-2 py-4 text-[10px] font-extrabold uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(232,16,46,0.4)]"
              style={{ writingMode: "vertical-rl" }}
            >
              <ChevronLeft size={12} />
              Panel del match
            </button>
          ) : null}
        </>
      )}

      {/* ============ modal banco ============ */}
      <Modal
        open={!!pickBank}
        onClose={() => {
          setPickBank(null);
          if (tournament) closeBankPick(tournament.id).catch(() => {});
        }}
        title="Reemplazar desde el banco"
      >
        <p className="text-[11px] font-bold text-[#8e919c] uppercase tracking-wider mb-1">
          Selecciona la reserva que entrará al match
        </p>
        <p className="text-[10px] font-semibold text-[#6b6e78] mb-3 leading-snug">
          {bankInfo.fromRound === null
            ? "Reservas del registro · el banco se renueva con los eliminados de cada eliminatoria"
            : `Banco renovado: reservas eliminadas en ${bankInfo.sourceLabel}`}
        </p>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {bankInfo.entries.length === 0 ? (
            <p className="text-[11px] font-bold text-[#6b6e78] uppercase">
              {bankInfo.fromRound === null
                ? "No hay jugadores en el banco"
                : "Banco vacío — se llena al terminar la ronda anterior"}
            </p>
          ) : (
            bankInfo.entries.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={async () => {
                  if (!pickBank || !tournament) return;
                  await guard(async () => {
                    await replaceFromBank(
                      tournament.id,
                      pickBank.r,
                      pickBank.m,
                      pickBank.slotIdx,
                      { label: e.label, members: e.members, full: e.origin === "round" },
                      tournament.modality
                    );
                    // libera el visor (cierra la vista de banco → el bracket
                    // actualizado dispara la animación de entrada del reserva)
                    await closeBankPick(tournament.id);
                    fireSound("bankSwap");
                    toast.success(`${e.label} entra al match`);
                    setPickBank(null);
                  });
                }}
                className="w-full panel-2 clip-card-sm flex items-center gap-3 px-3 py-2.5 hover:border-[#ffb830]/50 text-left transition-colors"
              >
                <span className="w-10 h-7 clip-badge red-badge flex items-center justify-center">
                  <SkipForward size={12} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold uppercase text-white truncate">{e.label}</span>
                  {e.detail ? (
                    <span className="block text-[10px] font-semibold text-[#8e919c] truncate">{e.detail}</span>
                  ) : null}
                </span>
                {e.dq ? (
                  <span className="chip clip-tag bg-[#e8102e] text-white text-[8px] px-1.5 py-[2px] shrink-0">DQ</span>
                ) : null}
                <span
                  className={`chip clip-tag text-[8px] shrink-0 border ${
                    e.origin === "round"
                      ? "bg-[#ffb830]/12 text-[#ffb830] border-[#ffb830]/35"
                      : "bg-white/[0.06] text-[#8e919c] border-white/10"
                  }`}
                >
                  {e.origin === "round" ? `ELIM. ${bankInfo.sourceShort}` : "REGISTRO"}
                </span>
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* ============ confirmaciones de flujo ============ */}
      <Confirm
        open={confirm?.kind === "remix"}
        onClose={() => setConfirm(null)}
        danger
        confirmLabel="Lanzar mix"
        title="Lanzar mix — reinicio completo"
        message={`Se borran por completo los resultados anteriores (marcadores, ganadores, descalificaciones) y se crean brackets 100% nuevos con los participantes randomizados. Los jugadores registrados NO se eliminan${missingPlayers > 0 ? ` y los ${missingPlayers} cupos vacíos se completarán con jugadores DEMO para llenar todos los slots` : ""}. El visor reproducirá la animación de mix desde cero.`}
        onConfirm={() =>
          tournament &&
          guard(async () => {
            await launchMix(tournament.id, players, tournament);
            setSel(null);
            fireSound("mixLaunch");
            toast.success("Mix lanzado — brackets nuevos y limpios");
          })
        }
      />
      <Confirm
        open={confirm?.kind === "finish"}
        onClose={() => setConfirm(null)}
        confirmLabel="Finalizar"
        title="Finalizar torneo"
        message="El visor de espectadores mostrará el podio con el campeón. Podrás reabrir el torneo si necesitas corregir algo."
        onConfirm={() =>
          tournament &&
          guard(async () => {
            await setStatus(tournament.id, "finished");
            fireSound("tournamentFinish");
            toast.success("Torneo finalizado — podio activado");
          })
        }
      />
      <Confirm
        open={confirm?.kind === "results"}
        onClose={() => setConfirm(null)}
        danger
        confirmLabel="Reiniciar marcadores"
        title="Reiniciar marcadores del torneo"
        message="Se limpiarán todos los marcadores, ganadores y descalificaciones. Las llaves del mix se conservan tal cual, listas para jugar de nuevo."
        onConfirm={() =>
          tournament &&
          guard(async () => {
            await resetBracketResults(tournament.id);
            setSel(null);
            toast.success("Marcadores reiniciados — torneo listo de nuevo");
          })
        }
      />
      <Confirm
        open={confirm?.kind === "wipe"}
        onClose={() => setConfirm(null)}
        danger
        confirmLabel="Reiniciar todo"
        title="Reiniciar torneo completo"
        message="Se eliminará el bracket completo y el torneo volverá a estado de registro abierto. Los jugadores registrados NO se borran: podrás lanzar un nuevo mix."
        onConfirm={() =>
          tournament &&
          guard(async () => {
            await deleteBracket(tournament.id);
            setSel(null);
            setZoom(null);
            toast.success("Torneo reiniciado");
          })
        }
      />
      <Confirm
        open={confirm?.kind === "reopen"}
        onClose={() => setConfirm(null)}
        confirmLabel="Reabrir"
        title="Reabrir torneo"
        message="El torneo volverá a estado EN VIVO y el podio se ocultará."
        onConfirm={() =>
          tournament &&
          guard(async () => {
            await setStatus(tournament.id, "live");
          })
        }
      />
      <Confirm
        open={confirm?.kind === "fill"}
        onClose={() => setConfirm(null)}
        confirmLabel={`Llenar ${missingPlayers} lugares`}
        title="Llenar registros automáticamente"
        message={`Se agregarán ${missingPlayers} jugadores de demostración para completar los ${playersCapacity(tournament)} cupos oficiales. Quedan marcados como DEMO y podrás eliminarlos en lote cuando quieras.`}
        onConfirm={() =>
          tournament &&
          guard(async () => {
            const n = await fillSeats(tournament.id, players, tournament);
            toast.success(`${n} jugadores agregados — torneo completo`);
          })
        }
      />
      <Confirm
        open={confirm?.kind === "demos"}
        onClose={() => setConfirm(null)}
        danger
        confirmLabel={`Eliminar ${demoCount} demo`}
        title="Eliminar jugadores demo"
        message={`Se eliminarán los ${demoCount} jugadores generados automáticamente. Los registrados manualmente no se tocan.`}
        onConfirm={() =>
          tournament &&
          guard(async () => {
            const n = await removeDemoPlayers(tournament.id, players);
            toast.success(`${n} jugadores demo eliminados`);
          })
        }
      />

      {/* modal de forzar transmisión */}
      <Modal open={!!forceModal} onClose={() => setForceModal(null)} title="Ya hay una transmisión activa">
        {forceModal ? (
          <div className="space-y-4">
            <p className="text-[12px] font-bold text-[#c9cbd3]">
              Actualmente se está transmitiendo:{" "}
              <span className="text-white font-extrabold">{forceModal.blockingName}</span>
            </p>
            <p className="text-[11px] font-semibold text-[#8e919c]">
              ¿Quieres forzar la transmisión de este torneo? El visor y las cards de OBS
              cambiarán inmediatamente a este torneo, reemplazando la transmisión actual.
            </p>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setForceModal(null)}>
                Cancelar
              </Btn>
              <Btn
                variant="red"
                onClick={() =>
                  guard(async () => {
                    if (!tournament) return;
                    await openTournament(tournament.id, tournament.name, true);
                    setForceModal(null);
                    toast.success("Transmisión forzada — el visor ahora muestra este torneo");
                  })
                }
              >
                Forzar transmisión
              </Btn>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ============================================================
   PC DOCK — monitor del escenario: qué match y quién ocupa
   cada una de las 4 PCs (● EN JUEGO / PLANIFICADA / LIBRE).
   Clic en una PC ocupada abre ese match en el panel.
   ============================================================ */
function PcDock({
  tournament,
  bracket,
  onSelectMatch,
}: {
  tournament: Tournament;
  bracket: Bracket;
  onSelectMatch: (r: number, m: number) => void;
}) {
  const cells = useMemo(() => pcOccupancy(bracket, tournament.modality), [bracket, tournament.modality]);
  const maxSim = maxSimultaneous(tournament.modality);
  return (
    <div
      className="shrink-0 mb-2 mx-1 clip-tag border border-white/10 bg-black/40 px-2.5 py-1.5 flex items-stretch gap-1.5 overflow-x-auto"
      role="group"
      aria-label="Asignación de PCs del escenario"
    >
      <div className="flex flex-col justify-center gap-0.5 shrink-0 pr-2.5 border-r border-white/10 mr-1">
        <span className="label-cap flex items-center gap-1.5 whitespace-nowrap">
          <Monitor size={12} className="text-[#e8102e]" />
          PCs del escenario
        </span>
        <span className="text-[8px] font-bold text-[#6b6e78] uppercase tracking-[0.1em] whitespace-nowrap">
          Máx {maxSim} simultáneo{maxSim > 1 ? "s" : ""}
        </span>
      </div>
      {cells.map((c, i) => {
        const key = `PC${i + 1}`;
        const live = c?.status === "live";
        return (
          <button
            key={key}
            type="button"
            disabled={!c}
            onClick={() => c && onSelectMatch(c.r, c.m)}
            title={c ? `${c.tag} · ${key}${c.label ? ` · ${c.label}` : ""} — clic para administrar el match` : `${key} libre`}
            className={`btn-press min-w-[138px] flex-1 text-left px-2 py-1 border transition-colors ${
              live
                ? "border-[#e8102e]/60 bg-[#e8102e]/[0.08]"
                : c
                  ? "border-white/12 bg-white/[0.03] hover:border-[#ffb830]/50"
                  : "border-dashed border-white/10 bg-transparent cursor-default"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`flex items-center gap-1 text-[9.5px] font-extrabold tracking-[0.14em] ${
                  live ? "text-[#ff2440]" : c ? "text-[#c9cbd3]" : "text-[#6b6e78]"
                }`}
              >
                <Monitor size={9} />
                {key}
              </span>
              {c ? (
                <span className={`text-[8.5px] font-extrabold uppercase tracking-[0.08em] truncate ${live ? "text-[#ff8095]" : "text-[#8e919c]"}`}>
                  {c.tag}
                </span>
              ) : (
                <span className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-white/25">libre</span>
              )}
            </div>
            {c ? (
              <>
                <div className={`text-[10.5px] font-extrabold uppercase truncate leading-tight mt-0.5 ${live ? "text-white" : "text-[#a9adb8]"}`}>
                  {c.label || "—"}
                </div>
                <div className={`text-[7.5px] font-extrabold uppercase tracking-[0.14em] mt-0.5 ${live ? "text-[#ff2440] blink" : "text-[#6b6e78]"}`}>
                  {live ? "● EN JUEGO" : "PLANIFICADA"}
                </div>
              </>
            ) : (
              <div className="text-[9px] font-bold text-white/15 mt-1">—</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Panel lateral de edición del match seleccionado
   ============================================================ */
function MatchPanel({
  tournament,
  bracket,
  sel,
  setSel,
  selMatch,
  schedule,
  bankInfo,
  onClose,
  guard,
  setPickBank,
  busy,
  stepMatch,
  onSound,
}: {
  tournament: Tournament;
  bracket: Bracket;
  sel: { r: number; m: number } | null;
  setSel: (v: { r: number; m: number } | null) => void;
  selMatch: Bracket["rounds"][number][number] | null;
  schedule: Map<string, number>;
  bankInfo: BankInfo;
  onClose: () => void;
  guard: (fn: () => Promise<void>) => Promise<void>;
  setPickBank: (v: { r: number; m: number; slotIdx: number } | null) => void;
  busy: boolean;
  stepMatch: (dir: 1 | -1) => void;
  onSound: (event: SoundEvent) => void;
}) {
  /* capacidad del escenario (4 PCs) + PCs del match seleccionado */
  const maxSim = maxSimultaneous(tournament.modality);
  const liveCount = useMemo(
    () => bracket.rounds.reduce((acc, round) => acc + round.filter((x) => x.status === "live").length, 0),
    [bracket]
  );
  const planned = useMemo(() => plannedPcs(bracket, tournament.modality), [bracket, tournament.modality]);
  const selPcsStr = selMatch ? pcsLabel(planned.get(selMatch.id)) : "";
  const blockedByPcs = !!selMatch && selMatch.status !== "live" && liveCount >= maxSim;

  return (
    <div className="panel clip-card p-4 h-full flex flex-col gap-3 overflow-y-auto">
      {!selMatch || !sel ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 border border-white/12 bg-white/[0.03] clip-card-sm flex items-center justify-center text-[#e8102e]">
            <Hand size={20} />
          </div>
          <p className="text-[11px] font-bold text-[#8e919c] uppercase tracking-wider">Selecciona un match</p>
          <p className="text-[10px] text-[#6b6e78] font-semibold mt-1">
            Podrás marcar ganador, descalificar, reemplazar desde el banco y llevar el marcador
          </p>
        </div>
      ) : (
        <>
          {/* encabezado */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display italic text-[16px] uppercase">{matchTag(bracket, sel.r, sel.m)}</div>
              <div className="text-[9px] font-bold text-[#8e919c] uppercase tracking-[0.18em] mt-0.5">
                {roundLabel(bracket, sel.r) === "GRAN FINAL"
                  ? "Gran Final"
                  : `${roundLabel(bracket, sel.r)} · Match ${sel.m + 1}`}
                {schedule.get(selMatch.id) ? ` · ≈ ${fmtTime(schedule.get(selMatch.id)!)}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {selPcsStr && !selMatch.bye ? (
                <span
                  className={`chip clip-tag text-[9px] ${
                    selMatch.status === "live"
                      ? "bg-[#e8102e]/15 text-[#ff8095] border border-[#e8102e]/45"
                      : "bg-white/[0.06] text-[#8e919c] border border-white/10"
                  }`}
                  title={selMatch.status === "live" ? "PCs del escenario — match en juego" : "PCs planificadas para este match"}
                >
                  <Monitor size={10} />
                  {selPcsStr}
                </span>
              ) : null}
              {selMatch.status === "live" ? (
                <span className="chip clip-tag bg-[#e8102e] text-white text-[9px] blink">● EN VIVO</span>
              ) : selMatch.status === "done" ? (
                <span className="chip clip-tag bg-[#ffb830]/15 text-[#ffb830] border border-[#ffb830]/40 text-[9px]">FINALIZADO</span>
              ) : (
                <span className="chip clip-tag bg-white/[0.07] text-[#c9cbd3] border border-white/10 text-[9px]">LISTO</span>
              )}
              <button
                type="button"
                onClick={onClose}
                title="Cerrar panel"
                aria-label="Cerrar panel del match"
                className="btn-press p-1.5 text-[#8e919c] hover:text-white border border-white/10 hover:border-[#e8102e]/60"
              >
                ✕
              </button>
            </div>
          </div>

          {/* slots con controles */}
          <div className="space-y-2">
            {selMatch.slots.map((_, i) => (
              <SlotRow
                key={i}
                tid={tournament.id}
                bracket={bracket}
                r={sel.r}
                m={sel.m}
                slotIdx={i}
                modality={tournament.modality}
                winsNeeded={tournament.winsNeeded}
                pcs={planned.get(selMatch.id)}
                bankCount={bankInfo.entries.length}
                onPickBank={() => {
                  if (!tournament || !bracket || !sel) return;
                  const tag = sel.r === bracket.rounds.length - 1 ? "GRAN FINAL" : matchTag(bracket, sel.r, sel.m);
                  setPickBank({ r: sel.r, m: sel.m, slotIdx: i });
                  // avisa al visor para mostrar la vista de banco (caster)
                  openBankPick(tournament.id, {
                    r: sel.r,
                    m: sel.m,
                    slotIdx: i,
                    matchId: selMatch.id,
                    tag,
                  }).catch(() => {});
                }}
                onSound={onSound}
              />
            ))}
          </div>

          {/* acciones */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/8">
            {selMatch.status !== "done" ? (
              <Btn
                small
                variant={selMatch.status === "live" ? "red" : "dark"}
                disabled={busy || !matchPlayable(selMatch) || blockedByPcs}
                title={
                  blockedByPcs
                    ? `Sin PCs disponibles — máximo ${maxSim} match(es) en juego en ${MODALITY_LABEL[tournament.modality]}`
                    : selMatch.status === "live"
                      ? "Detener el match y liberar sus PCs"
                      : "Poner en juego: el visor lanza el corte VS y las PCs se asignan"
                }
                onClick={() =>
                  guard(async () => {
                    const turningOn = selMatch.status !== "live";
                    await setMatchLive(tournament.id, sel.r, sel.m, turningOn, tournament.modality);
                    if (turningOn) {
                      fireSound("matchLive");
                      toast.success(
                        `Match en juego — PCs asignadas (${maxSim} máximo simultáneo${maxSim > 1 ? "s" : ""})`
                      );
                    } else {
                      toast.success("Match detenido — PCs liberadas para el siguiente");
                    }
                  })
                }
              >
                {selMatch.status === "live" ? (
                  <>
                    <Square size={11} /> Detener
                  </>
                ) : (
                  <>
                    <CircleDot size={11} /> Marcar en juego
                  </>
                )}
              </Btn>
            ) : (
              <Btn small variant="dark" onClick={() => guard(() => setWinner(tournament.id, sel.r, sel.m, null))}>
                <Undo2 size={11} /> Deshacer ganador
              </Btn>
            )}
            <Btn small variant="ghost" onClick={() => guard(() => resetMatchScores(tournament.id, sel.r, sel.m))}>
              <TimerReset size={11} /> Reiniciar match
            </Btn>
          </div>
        </>
      )}

      {/* banco rápido */}
      <div className="border-t border-white/8 pt-3 mt-auto">
        <div className="label-cap mb-1 flex items-center gap-2 flex-wrap">
          <Zap size={11} className="text-[#ffb830]" />
          {bankInfo.fromRound === null
            ? `Banco de registro (${bankInfo.entries.length})`
            : `Banco · eliminados de ${bankInfo.sourceLabel} (${bankInfo.entries.length})`}
        </div>
        <p className="text-[9px] font-bold text-[#6b6e78] leading-snug mb-2">
          {bankInfo.fromRound === null
            ? "Reservas del registro hasta que termine la primera eliminatoria"
            : "Se renueva con los eliminados de cada ronda · cubren no-shows de la ronda en curso"}
        </p>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {bankInfo.entries.length === 0 ? (
            <span className="text-[10px] font-bold text-[#6b6e78] uppercase tracking-wider">
              {bankInfo.fromRound === null ? "Sin reservas registradas" : "Banco vacío por ahora"}
            </span>
          ) : (
            bankInfo.entries.map((e) => (
              <span
                key={e.key}
                title={e.detail || e.label}
                className={`chip clip-tag border ${
                  e.dq
                    ? "bg-[#e8102e]/10 text-[#ff8095] border-[#e8102e]/35"
                    : "bg-[#ffb830]/10 text-[#ffb830] border-[#ffb830]/30"
                }`}
              >
                {e.label}
                {e.dq ? " · DQ" : ""}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* Fila de controles por slot */
function SlotRow(props: {
  tid: string;
  bracket: Bracket;
  r: number;
  m: number;
  slotIdx: number;
  bankCount: number;
  modality: number;
  winsNeeded: number;
  pcs?: string[];
  onPickBank: () => void;
  onSound: (event: SoundEvent) => void;
}) {
  const { tid, bracket, r, m, slotIdx, bankCount, modality, winsNeeded, pcs, onPickBank, onSound } = props;
  const slot = bracket.rounds[r][m].slots[slotIdx];
  const match = bracket.rounds[r][m];
  const isWinner = match.status === "done" && match.w === slotIdx;

  if (!slot.pid) {
    return (
      <div className="panel-2 clip-card-sm p-3 opacity-60">
        <div className="text-[10px] font-extrabold tracking-[0.2em] text-[#6b6e78] uppercase">Por definir</div>
      </div>
    );
  }

  return (
    <motion.div layout className={`panel-2 clip-card-sm p-3 ${slot.st === "dq" ? "border-[#e8102e]/60" : ""} ${slot.st === "rep" ? "border-[#ffb830]/40 bg-[#ffb830]/[0.04]" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="red-badge clip-badge px-2 py-1 min-w-[34px] text-center">
          <span className="font-display italic text-[14px]">{slot.score}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold uppercase text-white truncate">{slot.label}</div>
          {slot.members.length > 1 ? (
            <div className="text-[9px] font-bold text-[#8e919c] truncate">
              {slot.members.map((mm) => (mm.dq ? `✗ ${mm.nick}` : mm.nick)).join(" · ")}
            </div>
          ) : null}
        </div>
        {isWinner ? <Trophy size={14} className="text-[#ffb830] shrink-0" /> : null}
        {slot.st === "dq" ? (
          <span className="chip clip-tag bg-[#e8102e] text-white text-[8px] px-1.5 py-[2px]">DQ</span>
        ) : null}
      </div>
      {/* PC asignada a cada miembro del slot */}
      {pcs && pcs.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {slot.members.map((mm, mi) => {
            const pc = pcForPlayer(modality as Modality, pcs, slotIdx, mi);
            if (!pc) return null;
            return (
              <span
                key={mi}
                title={`${mm.nick || slot.label} juega en ${pc}`}
                className={`chip clip-tag text-[8px] flex items-center gap-1 border ${
                  match.status === "live"
                    ? "bg-[#e8102e]/12 text-[#ff8095] border-[#e8102e]/40"
                    : "bg-white/[0.05] text-[#a9adb8] border-white/10"
                }`}
              >
                <Monitor size={8} />
                {mm.nick ? `${mm.nick} · ` : ""}
                {pc}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <IconBtn
          title="Restar victoria"
          disabled={match.status === "done" || slot.score <= 0}
          onClick={() => setScore(tid, r, m, slotIdx, -1, winsNeeded).catch((e) => toast.error(e.message))}
        >
          <Minus size={13} />
        </IconBtn>
        <IconBtn
          title="Sumar victoria"
          disabled={match.status === "done"}
          onClick={() => {
            setScore(tid, r, m, slotIdx, 1, winsNeeded)
              .then(() => onSound("scoreUp"))
              .catch((e) => toast.error(e.message));
          }}
        >
          <Plus size={13} />
        </IconBtn>
        <Btn
          small
          variant={isWinner ? "gold" : "silver"}
          disabled={match.status === "done" || !match.slots.some((s, si) => si !== slotIdx && s.pid)}
          onClick={() => {
            setWinner(tid, r, m, slotIdx)
              .then(() => onSound("winner"))
              .catch((e) => toast.error(e.message));
          }}
        >
          <Check size={11} />
          Ganador
        </Btn>
        {slot.st === "dq" ? (
          <Btn small variant="dark" onClick={() => setSlotOk(tid, r, m, slotIdx).catch((e) => toast.error(e.message))}>
            <Undo2 size={11} />
            Quitar DQ
          </Btn>
        ) : (
          <Btn
            small
            variant="dark"
            disabled={match.status === "done" && match.w !== slotIdx}
            onClick={() => disqualify(tid, r, m, slotIdx).catch((e) => toast.error(e.message))}
          >
            <UserMinus size={11} />
            Descalificar
          </Btn>
        )}
        <Btn
          small
          variant="dark"
          disabled={bankCount === 0 || match.status === "done"}
          title={
            match.status === "done"
              ? "El match ya terminó — no admite reemplazos"
              : bankCount === 0
                ? "Banco vacío"
                : "Reemplazar con una reserva del banco"
          }
          onClick={onPickBank}
        >
          <Repeat size={11} />
          Banco
        </Btn>
      </div>
    </motion.div>
  );
}

/* ============================================================
   PHASE BAR — flujo operativo del torneo en 5 fases:
   F1 Registro abierto → F2 Registros cerrados → F3 Cuenta regresiva
   → F4 Mix match → F5 En vivo. Cada fase dispara su reflejo
   automático en el visor de espectadores.
   ============================================================ */

type Guard = (fn: () => Promise<void>) => Promise<void>;
type ConfirmKind = "remix" | "finish" | "wipe" | "reopen" | "results" | "fill" | "demos";

function MiniCountdown({ target }: { target: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const total = Math.max(0, Math.floor((target - now) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return (
    <span className="font-display italic text-[20px] leading-none text-silver-grad tabular-nums">
      {h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}
    </span>
  );
}

function PhaseCard({
  n,
  label,
  state,
  hint,
  children,
}: {
  n: number;
  label: string;
  state: "done" | "current" | "pending";
  hint: string;
  children?: React.ReactNode;
}) {
  const border =
    state === "current"
      ? "border-[#e8102e]/70 bg-[#e8102e]/[0.06] shadow-[0_0_24px_rgba(232,16,46,0.18)]"
      : state === "done"
        ? "border-[#ffb830]/35 bg-[#ffb830]/[0.04]"
        : "border-white/10 bg-white/[0.015]";
  return (
    <div className={`clip-card-sm border p-3 flex flex-col gap-2.5 transition-colors ${border}`}>
      <div className="flex items-center gap-2">
        <span
          className={`w-7 h-7 shrink-0 clip-badge flex items-center justify-center ${
            state === "done" ? "bg-[#ffb830] text-[#241500]" : state === "current" ? "red-badge" : "bg-white/[0.06] text-[#6b6e78]"
          }`}
          aria-hidden
        >
          {state === "done" ? <Check size={13} /> : <span className="font-display italic text-[13px]">{n}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] font-extrabold uppercase tracking-[0.14em] truncate ${state === "pending" ? "text-[#6b6e78]" : "text-white"}`}>
            {label}
          </div>
          <div className="text-[8.5px] font-bold text-[#6b6e78] uppercase tracking-[0.1em] truncate">{hint}</div>
        </div>
        {state === "current" ? (
          <span className="chip clip-tag bg-[#e8102e] text-white text-[8px] px-1.5 py-[2px] shrink-0 blink">● En curso</span>
        ) : state === "done" ? (
          <span className="chip clip-tag bg-[#ffb830]/15 text-[#ffb830] border border-[#ffb830]/35 text-[8px] px-1.5 py-[2px] shrink-0">LISTA</span>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-1.5">{children}</div> : null}
    </div>
  );
}

function PhaseBar({
  tournament,
  bracket,
  participantsCount,
  officialsCount,
  missingPlayers,
  demoCount,
  bankCount,
  startMins,
  setStartMins,
  busy,
  guard,
  onConfirm,
  onLaunchMix,
}: {
  tournament: Tournament;
  bracket: Bracket | null;
  participantsCount: number;
  officialsCount: number;
  missingPlayers: number;
  demoCount: number;
  bankCount: number;
  startMins: number;
  setStartMins: (n: number) => void;
  busy: boolean;
  guard: Guard;
  onConfirm: (kind: ConfirmKind) => void;
  onLaunchMix: () => void;
}) {
  const status = tournament.status;
  const phase = status === "open" ? 0 : status === "closed" ? (tournament.startAt ? 2 : 1) : status === "mixing" ? 3 : status === "live" ? 4 : 5;
  const st = (n: number): "done" | "current" | "pending" => (n < phase ? "done" : n === phase ? "current" : "pending");
  const hasCountdown = !!tournament.startAt && tournament.startAt > Date.now();
  const capPlayers = playersCapacity(tournament);

  const goLive = () =>
    guard(async () => {
      if (!tournament.startAt || tournament.startAt > Date.now()) await setStartAt(tournament.id, Date.now());
      await setStatus(tournament.id, "live");
      toast.success("Torneo EN VIVO — la transmisión arrancó");
    });

  return (
    <div className="panel clip-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="label-cap">Flujo del torneo</span>
        <span className="h-[1px] flex-1 bg-white/8" aria-hidden />
        <span className="text-[9px] font-extrabold tracking-[0.14em] uppercase text-[#6b6e78] hidden sm:inline">
          Fase 1 → 5 · el visor reacciona a cada cambio
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2.5">
        {/* ============ FASE 1 — REGISTRO ABIERTO ============ */}
        <PhaseCard n={1} label="Registro abierto" state={st(0)} hint="visor en modo registro">
          <div className="w-full flex items-center justify-between gap-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8e919c]">
            <span>
              {officialsCount}/{capPlayers} jugadores
            </span>
            <span className={missingPlayers <= 0 ? "text-[#ffb830]" : "text-[#ff8095]"}>
              {missingPlayers <= 0 ? "COMPLETO" : `${missingPlayers} libres`}
            </span>
          </div>
          <div className="w-full h-[5px] bg-black/50 overflow-hidden">
            <div
              className="h-full bg-[linear-gradient(90deg,#ff2440,#e8102e)] transition-all duration-500"
              style={{ width: `${Math.min(100, (officialsCount / Math.max(1, capPlayers)) * 100)}%` }}
            />
          </div>
          {phase !== 0 ? (
            <Btn
              small
              variant="dark"
              disabled={busy}
              title="Vuelve a la fase de registro: el visor mostrará el llenado de lugares"
              onClick={() =>
                guard(async () => {
                  await setStartAt(tournament.id, null);
                  await setStatus(tournament.id, "open");
                  toast.success("Registro abierto — visor en modo registro");
                })
              }
            >
              <UserPlus size={11} />
              Registro abierto
            </Btn>
          ) : null}
          <Btn small variant="silver" disabled={busy || missingPlayers <= 0} title="Completa los cupos con jugadores de demostración" onClick={() => onConfirm("fill")}>
            <Wand2 size={11} />
            Llenar lugares
          </Btn>
          {demoCount > 0 ? (
            <Btn small variant="ghost" disabled={busy} onClick={() => onConfirm("demos")} title="Elimina los jugadores demo generados">
              <Trash2 size={11} />
              Quitar demo ({demoCount})
            </Btn>
          ) : null}
        </PhaseCard>

        {/* ============ FASE 2 — REGISTROS CERRADOS ============ */}
        <PhaseCard n={2} label="Registros cerrados" state={st(1)} hint="cierra la inscripción">
          {phase < 2 || status === "open" ? (
            <Btn small variant="dark" disabled={busy || status !== "open"} onClick={() => guard(async () => {
              await setStatus(tournament.id, "closed");
              toast.success("Registros cerrados — el visor lo muestra en grande");
            })}>
              <Lock size={11} />
              Cerrar registros
            </Btn>
          ) : (
            <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ffb830] flex items-center gap-1.5">
              <Lock size={11} />
              Inscripción cerrada
            </span>
          )}
          <span className="text-[9px] font-bold text-[#6b6e78] leading-snug">
            {bankCount > 0 ? `${bankCount} en el banco de reservas` : "Sin banco de reservas"}
          </span>
        </PhaseCard>

        {/* ============ FASE 3 — CUENTA REGRESIVA ============ */}
        <PhaseCard n={3} label="Cuenta regresiva" state={st(2)} hint="inicio programado">
          <div className="w-full flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={720}
              value={startMins}
              onChange={(e) => {
                const v = Math.max(1, Math.min(720, Math.floor(Number(e.target.value) || 1)));
                setStartMins(v);
              }}
              aria-label="Minutos para el inicio"
              className="field-input clip-card-sm w-[58px] px-2 py-2 text-center text-[13px] font-extrabold"
            />
            <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#6b6e78]">min</span>
            <Btn
              small
              variant={hasCountdown ? "dark" : "red"}
              disabled={busy || (status !== "open" && status !== "closed")}
              title={status === "open" || status === "closed" ? "Programa el inicio: el visor cambia a brackets con el cronómetro en grande" : "Solo disponible en fases de registro"}
              onClick={() =>
                guard(async () => {
                  await setStartAt(tournament.id, Date.now() + startMins * 60_000);
                  toast.success(`Inicio en ${startMins} min — el visor cambia a brackets con el cronómetro`);
                })
              }
            >
              <TimerReset size={11} />
              Inicio en {startMins}
            </Btn>
          </div>
          {hasCountdown ? (
            <div className="w-full flex items-center justify-between gap-2 border border-[#ffb830]/35 bg-[#ffb830]/[0.06] clip-card-sm px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[8.5px] font-extrabold tracking-[0.16em] uppercase text-[#ffb830]">Comienza</span>
                <MiniCountdown target={tournament.startAt!} />
              </div>
              <button
                type="button"
                onClick={() => guard(() => setStartAt(tournament.id, null))}
                title="Cancelar cuenta regresiva"
                aria-label="Cancelar cuenta regresiva"
                className="btn-press p-1 text-[#8e919c] hover:text-white border border-white/10 hover:border-[#e8102e]/60"
              >
                <X size={11} />
              </button>
            </div>
          ) : tournament.startAt ? (
            <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8e919c]">Inició ≈ {fmtTime(tournament.startAt)}</span>
          ) : (
            <span className="text-[9px] font-bold text-[#6b6e78]">Sin inicio programado (opcional)</span>
          )}
        </PhaseCard>

        {/* ============ FASE 4 — MIX MATCH ============ */}
        <PhaseCard n={4} label="Mix match" state={st(3)} hint="sorteo + brackets nuevos">
          {status === "mixing" ? (
            <>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ff8095] blink">● Mezclando en el visor…</span>
              <Btn small variant="ghost" disabled={busy} onClick={() => onConfirm("remix")}>
                <RefreshCw size={11} />
                Re-lanzar mix
              </Btn>
            </>
          ) : (
            <Btn
              small
              variant={phase <= 3 ? "red" : "dark"}
              disabled={busy || participantsCount < 2}
              title={participantsCount < 2 ? "Se necesitan al menos 2 participantes oficiales" : "Reinicia TODO y crea brackets nuevos al azar"}
              onClick={() => (bracket ? onConfirm("remix") : onLaunchMix())}
            >
              <Rocket size={11} />
              Lanzar mix
            </Btn>
          )}
          <span className="text-[9px] font-bold text-[#6b6e78] leading-snug">
            {participantsCount} participantes · borra resultados · conserva jugadores
          </span>
        </PhaseCard>

        {/* ============ FASE 5 — EN VIVO ============ */}
        <PhaseCard n={5} label="En vivo" state={st(4)} hint="transmisión de matches">
          {status === "live" ? (
            <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-white flex items-center gap-1.5">
              <span className="w-2 h-2 bg-[#ff2440] blink rounded-full" aria-hidden />
              Transmitiendo
            </span>
          ) : status === "finished" ? (
            <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#ffb830]">Finalizado · podio</span>
          ) : (
            <Btn small variant="red" disabled={busy || !bracket} title={bracket ? "Arranca la transmisión" : "Lanza el mix primero"} onClick={goLive}>
              <Radio size={11} />
              Pasar a en vivo
            </Btn>
          )}
          {status === "live" ? (
            <Btn small variant="gold" disabled={busy} onClick={() => onConfirm("finish")}>
              <Trophy size={11} />
              Finalizar
            </Btn>
          ) : null}
        </PhaseCard>
      </div>

      {/* ============ gestión (en vivo / finalizado) ============ */}
      {status === "live" || status === "finished" ? (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/8">
          <span className="label-cap mr-1">Gestión</span>
          {status === "live" ? (
            <>
              <Btn small variant="ghost" disabled={busy} onClick={() => onConfirm("remix")}>
                <RefreshCw size={11} />
                Re-mix total
              </Btn>
              <Btn small variant="ghost" disabled={busy} onClick={() => onConfirm("results")} title="Limpia marcadores, ganadores y DQs; conserva las llaves">
                <RotateCcw size={11} />
                Reiniciar marcadores
              </Btn>
              <Btn small variant="ghost" disabled={busy} onClick={() => onConfirm("wipe")} title="Borra el bracket y vuelve a registro abierto; los jugadores registrados se conservan">
                <Square size={11} />
                Reiniciar torneo
              </Btn>
            </>
          ) : (
            <>
              <Btn small variant="dark" disabled={busy} onClick={() => onConfirm("reopen")}>
                <Undo2 size={11} />
                Reabrir torneo
              </Btn>
              <Btn small variant="ghost" disabled={busy} onClick={() => onConfirm("results")}>
                <RotateCcw size={11} />
                Reiniciar marcadores
              </Btn>
              <Btn small variant="ghost" disabled={busy} onClick={() => onConfirm("wipe")} title="Borra el bracket y vuelve a registro abierto; los jugadores registrados se conservan">
                <Square size={11} />
                Reiniciar torneo
              </Btn>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
