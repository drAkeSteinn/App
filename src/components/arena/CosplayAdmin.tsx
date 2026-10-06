"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Hand, Lock, Pencil, Palette, Plus, Radio, Trash2, Trophy, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Contest, Participant } from "@/lib/contests";
import {
  addParticipant,
  deleteParticipant,
  setSpotlight,
  setWinner,
  updateContest,
  updateParticipant,
  wipeParticipants,
} from "@/lib/contests";
import { useContestState, useParticipants } from "@/lib/contestHooks";
import { closeTournament, getActiveInfo, openContest, useActiveTournament } from "@/lib/activeTournament";
import { useTournaments } from "@/lib/hooks";
import { useContests } from "@/lib/contestHooks";
import { Btn, Confirm, Field, IconBtn, Modal, TextInput } from "./ui";

/* ============================================================
   CosplayAdmin — administración del concurso de Cosplayer.
   · Registro de participantes.
   · Seleccionar un participante para aplaudir (spotlight en el visor).
   · Eliminar participantes (hasta quedar finalistas).
   · Marcar ganador.
   ============================================================ */

export function CosplayAdmin({
  contest,
  onClose,
}: {
  contest: Contest;
  onClose: () => void;
}) {
  const { data: participants, loading } = useParticipants(contest.id);
  const state = useContestState(contest.id);
  const [nick, setNick] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmWinner, setConfirmWinner] = useState<ParticipantLite | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmDeleteP, setConfirmDeleteP] = useState<Participant | null>(null);
  const [editingP, setEditingP] = useState<Participant | null>(null);
  const [editNick, setEditNick] = useState("");
  const [editName, setEditName] = useState("");
  const [forceModal, setForceModal] = useState<{ blockingName: string } | null>(null);
  const { data: allTournaments } = useTournaments();
  const { data: allContests } = useContests();
  const activeTx = useActiveTournament();
  const isActive = activeTx.contestId === contest.id;

  const active = participants.filter((p) => !p.eliminated);
  const eliminated = participants.filter((p) => p.eliminated);
  const spotlightPid = state?.spotlightPid ?? null;
  const winnerPid = contest.winnerPid;

  const isLive = contest.status === "live";
  const isFinished = contest.status === "finished";

  const add = async () => {
    if (!nick.trim()) {
      toast.error("El nick es obligatorio");
      return;
    }
    setBusy(true);
    try {
      await addParticipant(contest.id, { nick: nick.trim(), name: name.trim() });
      setNick("");
      setName("");
      toast.success(`${nick.trim()} registrado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: Participant) => {
    setEditingP(p);
    setEditNick(p.nick);
    setEditName(p.name);
  };

  const saveEdit = async () => {
    if (!editingP || !editNick.trim()) return;
    try {
      await updateParticipant(contest.id, editingP.id, { nick: editNick.trim(), name: editName.trim() });
      toast.success("Participante actualizado");
      setEditingP(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const startLive = async () => {
    setBusy(true);
    try {
      await updateContest(contest.id, { status: "live" });
      toast.success("Concurso EN VIVO — el visor ya puede mostrar los aplausos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const openForTransmission = async () => {
    setBusy(true);
    try {
      const info = await getActiveInfo();
      const hasOther = info.tid || (info.contestId && info.contestId !== contest.id);
      if (hasOther) {
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
      await openContest(contest.id);
      toast.success("Concurso en vivo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const closeTransmission = async () => {
    setBusy(true);
    try {
      await closeTournament();
      toast.success("Transmisión cerrada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="panel clip-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 mr-auto">
          <span className="w-10 h-10 shrink-0 clip-card-sm border border-white/12 bg-black/40 flex items-center justify-center text-[#e8102e]">
            <Palette size={18} />
          </span>
          <div className="min-w-0">
            <div className="font-display italic text-[17px] uppercase truncate">{contest.name}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`chip clip-tag ${isLive ? "bg-[#e8102e] text-white" : isFinished ? "bg-[#ffb830] text-[#241500]" : "bg-white/[0.06] text-[#c9cbd3] border border-white/10"}`}>
                {isFinished ? "FINALIZADO" : isLive ? "EN VIVO" : "REGISTRO"}
              </span>
              <span className="chip clip-tag bg-white/[0.06] text-[#c9cbd3] border border-white/10">
                <Users size={11} />
                {active.length} activos
              </span>
              {spotlightPid ? (
                <span className="chip clip-tag bg-[#ffb830]/15 text-[#ffb830] border border-[#ffb830]/40">
                  <Hand size={11} />
                  Aplaudiendo
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isLive && !isFinished ? (
            <Btn small variant="red" disabled={busy || active.length < 2} onClick={startLive}>
              <Zap size={12} />
              Iniciar en vivo
            </Btn>
          ) : null}
          {isActive ? (
            <Btn small variant="red" onClick={() => setConfirmClose(true)} disabled={busy}>
              <Lock size={12} />
              Cerrar concurso
            </Btn>
          ) : (
            <Btn small variant="dark" onClick={openForTransmission} disabled={busy}>
              <Radio size={12} />
              En vivo
            </Btn>
          )}
          <Btn small variant="ghost" onClick={onClose}>
            Volver
          </Btn>
        </div>
      </div>

      {/* registro */}
      {!isFinished ? (
        <div className="panel clip-card p-4">
          <div className="label-cap mb-3 flex items-center gap-2">
            <Plus size={12} />
            Registrar participante
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Nick / Personaje" className="flex-1 min-w-[180px]">
              <TextInput value={nick} onChange={(e) => setNick(e.target.value)} placeholder="EJ. MAID SAKURA" maxLength={40} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            </Field>
            <Field label="Nombre real (opcional)" className="flex-1 min-w-[180px]">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="EJ. Ana Treviño" maxLength={40} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            </Field>
            <Btn variant="red" onClick={add} disabled={busy}>
              <Plus size={13} />
              Agregar
            </Btn>
            {participants.length > 0 ? (
              <Btn variant="ghost" onClick={() => setConfirmWipe(true)} disabled={busy}>
                <Trash2 size={13} />
                Eliminar todos
              </Btn>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* participantes activos */}
      <div className="panel clip-card p-4">
        <div className="label-cap mb-3 flex items-center gap-2">
          <Users size={12} />
          Participantes {isFinished ? "—" : "activos"} ({active.length})
        </div>
        {loading ? (
          <div className="text-[12px] font-bold text-[#6b6e78] uppercase py-4 text-center">Cargando…</div>
        ) : active.length === 0 ? (
          <div className="text-[12px] font-bold text-[#6b6e78] uppercase py-4 text-center">
            {participants.length === 0 ? "Aún no hay participantes registrados" : "Todos los participantes fueron eliminados"}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {active.map((p) => {
              const isSpot = spotlightPid === p.id;
              const isWinner = winnerPid === p.id;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`panel-2 clip-card-sm p-3 flex items-center gap-3 ${isSpot ? "border-[#ffb830]/60 bg-[#ffb830]/[0.06]" : ""} ${isWinner ? "border-[#ffb830] bg-[#ffb830]/10" : ""}`}
                >
                  <span className="w-8 h-8 shrink-0 clip-badge bg-black/40 border border-white/10 flex items-center justify-center text-[#ffb830]">
                    {isWinner ? <Crown size={14} /> : <Palette size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-extrabold uppercase text-white truncate">{p.nick}</div>
                    {p.name ? <div className="text-[10px] font-semibold text-[#8e919c] truncate">{p.name}</div> : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isWinner ? null : (
                      <>
                        <IconBtn
                          title={isSpot ? "Quitar aplauso" : "Aplaudir — destacar en el visor"}
                          active={isSpot}
                          onClick={() => setSpotlight(contest.id, isSpot ? null : p.id).catch((e) => toast.error(e.message))}
                        >
                          <Hand size={13} />
                        </IconBtn>
                        {!isFinished ? (
                          <>
                            <IconBtn title="Editar" small onClick={() => startEdit(p)}>
                              <Pencil size={11} />
                            </IconBtn>
                            <IconBtn
                              title="Marcar como ganador"
                              onClick={() => setConfirmWinner(p)}
                            >
                              <Trophy size={13} />
                            </IconBtn>
                            <IconBtn
                              title="Eliminar (no gana)"
                              danger
                              onClick={() => setConfirmDeleteP(p)}
                            >
                              <Trash2 size={13} />
                            </IconBtn>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* eliminados */}
      {eliminated.length > 0 ? (
        <div className="panel clip-card p-4 opacity-70">
          <div className="label-cap mb-3">Eliminados ({eliminated.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {eliminated.map((p) => (
              <span key={p.id} className="chip clip-tag bg-white/[0.04] text-[#6b6e78] border border-white/8 line-through">
                {p.nick}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* ganador */}
      {winnerPid ? (
        <div className="panel clip-card p-5 border-[#ffb830]/40 bg-[#ffb830]/[0.06] flex items-center gap-4">
          <span className="w-14 h-14 shrink-0 clip-card-sm bg-[linear-gradient(160deg,#ffe9b0,#d99312)] flex items-center justify-center">
            <Crown size={26} className="text-[#241500]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold tracking-[0.3em] uppercase text-[#ffb830]">Ganador del concurso</div>
            <div className="font-display italic text-[24px] uppercase text-white truncate mt-1">
              {participants.find((p) => p.id === winnerPid)?.nick ?? "—"}
            </div>
          </div>
          <Btn small variant="dark" onClick={() => setWinner(contest.id, null).catch(() => {})}>
            Deshacer
          </Btn>
        </div>
      ) : null}

      <Confirm
        open={!!confirmWinner}
        onClose={() => setConfirmWinner(null)}
        confirmLabel="Coronar ganador"
        title="Coronar ganador"
        message={`¿Marcar a "${confirmWinner?.nick}" como ganador del concurso? Se finalizará el concurso.`}
        onConfirm={async () => {
          if (!confirmWinner) return;
          try {
            await setWinner(contest.id, confirmWinner.id);
            await setSpotlight(contest.id, null);
            toast.success(`${confirmWinner.nick} es el ganador`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          }
        }}
      />

      <Modal open={!!editingP} onClose={() => setEditingP(null)} title="Editar participante">
        {editingP ? (
          <div className="space-y-3">
            <Field label="Nick / Personaje">
              <TextInput value={editNick} onChange={(e) => setEditNick(e.target.value)} maxLength={40} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} />
            </Field>
            <Field label="Nombre real (opcional)">
              <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} />
            </Field>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setEditingP(null)}>Cancelar</Btn>
              <Btn variant="red" onClick={saveEdit}>Guardar</Btn>
            </div>
          </div>
        ) : null}
      </Modal>

      <Confirm
        open={!!confirmDeleteP}
        onClose={() => setConfirmDeleteP(null)}
        danger
        confirmLabel="Eliminar"
        title="Eliminar participante"
        message={`¿Eliminar a "${confirmDeleteP?.nick}" del concurso?`}
        onConfirm={async () => {
          if (!confirmDeleteP) return;
          try {
            await deleteParticipant(contest.id, confirmDeleteP.id);
            toast.success("Participante eliminado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          }
        }}
      />

      <Confirm
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        danger
        confirmLabel="Eliminar todos"
        title="Eliminar todos los participantes"
        message={`Se eliminarán los ${participants.length} participantes del concurso. Esta acción no se puede deshacer.`}
        onConfirm={async () => {
          try {
            await wipeParticipants(contest.id);
            toast.success("Participantes eliminados");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          }
          setConfirmWipe(false);
        }}
      />

      <Confirm
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        confirmLabel="Cerrar"
        title="Cerrar transmisión"
        message="El visor dejará de mostrar este concurso y volverá a la pantalla de espera."
        onConfirm={async () => {
          await closeTransmission();
          setConfirmClose(false);
        }}
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
              ¿Quieres forzar la transmisión de este concurso? El visor cambiará inmediatamente
              a este concurso, reemplazando la transmisión actual.
            </p>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setForceModal(null)}>
                Cancelar
              </Btn>
              <Btn
                variant="red"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await openContest(contest.id, true);
                    setForceModal(null);
                    toast.success("Transmisión forzada — el visor ahora muestra este concurso");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Error");
                  } finally {
                    setBusy(false);
                  }
                }}
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

type ParticipantLite = { id: string; nick: string };
