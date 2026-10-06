"use client";

import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  CheckCircle2,
  Eye,
  HelpCircle,
  Lock,
  Minus,
  Music,
  Pencil,
  Play,
  Plus,
  Radio,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  Trophy,
  Upload,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { Contest, Participant } from "@/lib/contests";
import {
  addParticipant,
  addScore,
  addSound,
  deleteParticipant,
  deleteSound,
  resetContest,
  setRevealAnswer,
  setRevealQuestion,
  setSolved,
  setSoundPlaying,
  setWinner,
  updateContest,
  updateParticipant,
  wipeParticipants,
} from "@/lib/contests";
import { useContestState, useParticipants, useSounds } from "@/lib/contestHooks";
import { closeTournament, getActiveInfo, openContest, useActiveTournament } from "@/lib/activeTournament";
import { useTournaments } from "@/lib/hooks";
import { useContests } from "@/lib/contestHooks";
import { Btn, Confirm, Field, IconBtn, Modal, TextInput } from "./ui";

/* ============================================================
   SoundAdmin — administración del concurso de Sonidos Gamer.
   Layout: 2/3 sonidos | 1/3 participantes.
   ============================================================ */

const MAX_SOUND_BYTES = 800 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error("No se pudo leer el archivo"));
    fr.readAsDataURL(file);
  });
}

export function SoundAdmin({
  contest,
  onClose,
}: {
  contest: Contest;
  onClose: () => void;
}) {
  const { data: participants, loading } = useParticipants(contest.id);
  const { data: sounds } = useSounds(contest.id);
  const state = useContestState(contest.id);
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmWinner, setConfirmWinner] = useState<{ id: string; nick: string } | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmDeleteP, setConfirmDeleteP] = useState<Participant | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editingP, setEditingP] = useState<Participant | null>(null);
  const [editNick, setEditNick] = useState("");
  const [forceModal, setForceModal] = useState<{ blockingName: string } | null>(null);
  const { data: allTournaments } = useTournaments();
  const { data: allContests } = useContests();
  const activeTx = useActiveTournament();
  const isActive = activeTx.contestId === contest.id;

  const soundFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [soundQ, setSoundQ] = useState("¿De qué videojuego es este sonido?");
  const [soundA, setSoundA] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string>("");

  const isLive = contest.status === "live";
  const isFinished = contest.status === "finished";
  const currentSoundId = state?.currentSoundId ?? null;
  const soundPlaying = state?.soundPlaying ?? false;
  const revealAnswer = state?.revealAnswer ?? false;
  const revealQuestion = state?.revealQuestion ?? false;
  const winnerPid = contest.winnerPid;

  const sorted = useMemo(
    () => [...participants].sort((a, b) => b.score - a.score),
    [participants]
  );

  const add = async () => {
    if (!nick.trim()) {
      toast.error("El nick es obligatorio");
      return;
    }
    setBusy(true);
    try {
      await addParticipant(contest.id, { nick: nick.trim(), name: "" });
      setNick("");
      toast.success(`${nick.trim()} registrado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const startLive = async () => {
    setBusy(true);
    try {
      await updateContest(contest.id, { status: "live" });
      toast.success("Concurso EN VIVO");
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

  const uploadSound = async () => {
    if (!pendingFile) {
      toast.error("Selecciona un archivo de audio");
      return;
    }
    if (pendingFile.size > MAX_SOUND_BYTES) {
      toast.error(`Archivo demasiado grande (máx ${Math.round(MAX_SOUND_BYTES / 1024)} KB)`);
      return;
    }
    if (!soundA.trim()) {
      toast.error("La respuesta es obligatoria");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(pendingFile);
      await addSound(contest.id, dataUrl, pendingFile.type || "audio/mpeg", soundQ.trim(), soundA.trim(), pendingImage);
      setPendingFile(null);
      setPendingImage(null);
      setPendingImageName("");
      setSoundA("");
      if (soundFileRef.current) soundFileRef.current.value = "";
      if (imageFileRef.current) imageFileRef.current.value = "";
      toast.success("Sonido agregado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
    }
  };

  /** Reproduce el sonido (una vez). Si ya está sonando este mismo sonido,
      lo detiene y lo vuelve a reproducir desde el inicio (toggle replay).
      Si era otro sonido, cambia al nuevo.
      NO resetea revealQuestion ni revealAnswer — eso lo controla el admin
      manualmente con los botones dedicados.
      Si la pregunta está marcada como resuelta, no reproduce. */
  const playSound = async (sid: string, solved: boolean) => {
    if (solved) {
      toast.error("Esta pregunta ya está resuelta — no se puede reproducir");
      return;
    }
    if (currentSoundId === sid && soundPlaying) {
      // detener y reproducir de nuevo: apagar y encender en secuencia
      await setSoundPlaying(contest.id, sid, false);
      setTimeout(() => setSoundPlaying(contest.id, sid, true).catch(() => {}), 120);
    } else {
      // cambiar a este sonido y reproducir
      await setSoundPlaying(contest.id, sid, true);
    }
  };

  /** Muestra/oculta la pregunta del sonido actual en el visor.
      Si no es el sonido actual, lo selecciona (sin reproducir) y muestra la pregunta.
      Si la pregunta está resuelta, no permite mostrarla. */
  const toggleQuestion = async (sid: string, solved: boolean) => {
    if (solved) {
      toast.error("Esta pregunta ya está resuelta — no se puede mostrar");
      return;
    }
    if (currentSoundId !== sid) {
      // cambiar al sonido sin reproducir, solo mostrar pregunta
      await setRevealAnswer(contest.id, false);
      await setRevealQuestion(contest.id, true);
      await setSoundPlaying(contest.id, sid, false);
      return;
    }
    // es el sonido actual → toggle de la pregunta
    await setRevealQuestion(contest.id, !revealQuestion);
  };

  /** Muestra/oculta la respuesta en el visor.
      Si la pregunta está resuelta, no permite mostrarla. */
  const toggleAnswer = async (sid: string, solved: boolean) => {
    if (solved) {
      toast.error("Esta pregunta ya está resuelta — no se puede mostrar la respuesta");
      return;
    }
    await setRevealAnswer(contest.id, !revealAnswer);
  };

  /** Marca/desmarca un sonido como resuelto (ya respondido).
      También oculta la pregunta y la respuesta del visor al marcarlo. */
  const toggleSolved = async (sid: string, current: boolean) => {
    if (!current) {
      // al marcar como resuelta → ocultar pregunta y respuesta, detener sonido
      await setRevealQuestion(contest.id, false);
      await setRevealAnswer(contest.id, false);
      await setSoundPlaying(contest.id, sid, false);
    }
    await setSolved(contest.id, sid, !current);
  };

  /** Procesa una imagen a 1:1 (recorta al centro). */
  const handleImagePick = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo no es una imagen");
      return;
    }
    if (file.size > 600 * 1024) {
      toast.error("Imagen demasiado grande (máx 600 KB)");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const c = document.createElement("canvas");
        c.width = 400;
        c.height = 400;
        const ctx = c.getContext("2d");
        if (!ctx) {
          setPendingImage(dataUrl);
          setPendingImageName(file.name);
          return;
        }
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
        setPendingImage(c.toDataURL("image/jpeg", 0.85));
        setPendingImageName(file.name);
      };
      img.onerror = () => {
        setPendingImage(dataUrl);
        setPendingImageName(file.name);
      };
      img.src = dataUrl;
    } catch {
      toast.error("No se pudo procesar la imagen");
    }
  };

  const startEdit = (p: Participant) => {
    setEditingP(p);
    setEditNick(p.nick);
  };

  const saveEdit = async () => {
    if (!editingP || !editNick.trim()) return;
    try {
      await updateParticipant(contest.id, editingP.id, { nick: editNick.trim() });
      toast.success("Participante actualizado");
      setEditingP(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="panel clip-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 mr-auto">
          <span className="w-10 h-10 shrink-0 clip-card-sm border border-white/12 bg-black/40 flex items-center justify-center text-[#e8102e]">
            <Music size={18} />
          </span>
          <div className="min-w-0">
            <div className="font-display italic text-[17px] uppercase truncate">{contest.name}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`chip clip-tag ${isLive ? "bg-[#e8102e] text-white" : isFinished ? "bg-[#ffb830] text-[#241500]" : "bg-white/[0.06] text-[#c9cbd3] border border-white/10"}`}>
                {isFinished ? "FINALIZADO" : isLive ? "EN VIVO" : "REGISTRO"}
              </span>
              <span className="chip clip-tag bg-white/[0.06] text-[#c9cbd3] border border-white/10">
                <Music size={11} />
                {sounds.length} sonidos
              </span>
              <span className="chip clip-tag bg-white/[0.06] text-[#c9cbd3] border border-white/10">
                <Users size={11} />
                {participants.length} participantes
              </span>
              {soundPlaying ? (
                <span className="chip clip-tag bg-[#e8102e]/15 text-[#ff8095] border border-[#e8102e]/40">
                  <span className="w-1.5 h-1.5 bg-[#ff2440] blink" />
                  SONANDO
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isLive && !isFinished ? (
            <Btn small variant="red" disabled={busy} onClick={startLive}>
              <Zap size={12} />
              Iniciar
            </Btn>
          ) : null}
          <Btn small variant="dark" onClick={() => setConfirmReset(true)} disabled={busy} title="Resetear concurso: scores a 0, preguntas no resueltas">
            <RotateCcw size={12} />
            Resetear
          </Btn>
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

      {/* layout 2/3 sonidos | 1/3 participantes */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* ============ SONIDOS (2/3) ============ */}
        <div className="space-y-4">
          {/* subir sonido */}
          {!isFinished ? (
            <div className="panel clip-card p-4">
              <div className="label-cap mb-3 flex items-center gap-2">
                <Upload size={12} />
                Subir sonido
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => soundFileRef.current?.click()}
                  className="btn-press w-full panel-2 clip-card-sm p-3 flex items-center gap-3 hover:border-[#e8102e]/60 text-left"
                >
                  <span className="w-9 h-9 shrink-0 clip-badge bg-black/40 border border-white/10 flex items-center justify-center text-[#8e919c]">
                    {pendingFile ? <Music size={15} className="text-[#ffb830]" /> : <Upload size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-extrabold uppercase text-white truncate">
                      {pendingFile ? pendingFile.name : "Seleccionar audio (.mp3, .wav)"}
                    </span>
                    <span className="block text-[10px] font-semibold text-[#6b6e78]">
                      {pendingFile ? `${(pendingFile.size / 1024).toFixed(0)} KB` : `Máx ${Math.round(MAX_SOUND_BYTES / 1024)} KB`}
                    </span>
                  </span>
                </button>
                <input
                  ref={soundFileRef}
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp3,.mp3,.wav"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPendingFile(f);
                    e.target.value = "";
                  }}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Pregunta">
                    <TextInput value={soundQ} onChange={(e) => setSoundQ(e.target.value)} maxLength={80} />
                  </Field>
                  <Field label="Respuesta correcta">
                    <TextInput value={soundA} onChange={(e) => setSoundA(e.target.value)} placeholder="EJ. STREET FIGHTER 2" maxLength={60} onKeyDown={(e) => { if (e.key === "Enter") uploadSound(); }} />
                  </Field>
                </div>
                {/* imagen 1:1 */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => imageFileRef.current?.click()}
                    className="btn-press w-16 h-16 shrink-0 clip-card-sm border border-white/12 bg-black/40 flex items-center justify-center overflow-hidden hover:border-[#e8102e]/60"
                    title="Subir imagen 1:1 (se recorta al centro)"
                  >
                    {pendingImage ? (
                      <img src={pendingImage} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload size={16} className="text-[#8e919c]" />
                    )}
                  </button>
                  <input
                    ref={imageFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImagePick(f);
                      e.target.value = "";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-[#c9cbd3] truncate">
                      {pendingImage ? pendingImageName || "Imagen lista" : "Sin imagen"}
                    </div>
                    <div className="text-[9px] font-semibold text-[#6b6e78]">Imagen 1:1 · máx 600 KB</div>
                    {pendingImage ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingImage(null);
                          setPendingImageName("");
                          if (imageFileRef.current) imageFileRef.current.value = "";
                        }}
                        className="text-[9px] font-bold uppercase tracking-wider text-[#ff8095] hover:text-white mt-1"
                      >
                        Quitar imagen
                      </button>
                    ) : null}
                  </div>
                </div>
                <Btn variant="red" onClick={uploadSound} disabled={busy || !pendingFile} small>
                  <Plus size={13} />
                  Agregar sonido
                </Btn>
              </div>
            </div>
          ) : null}

          {/* banco de sonidos — cards más grandes con thumbnail visible */}
          <div className="panel clip-card p-4">
            <div className="label-cap mb-3 flex items-center gap-2">
              <Music size={12} />
              Banco de sonidos ({sounds.length})
            </div>
            {sounds.length === 0 ? (
              <div className="text-[12px] font-bold text-[#6b6e78] uppercase py-6 text-center">Sin sonidos aún</div>
            ) : (
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {sounds.map((s, i) => {
                  const isCurrent = currentSoundId === s.id;
                  const isPlaying = isCurrent && soundPlaying;
                  const isRevealed = isCurrent && revealAnswer;
                  const isQuestionShown = isCurrent && revealQuestion;
                  const isSolved = !!s.solved;
                  return (
                    <div
                      key={s.id}
                      className={`panel-2 clip-card-sm p-3 transition-all relative ${
                        isSolved
                          ? "border-[#3a3d45] bg-black/20 opacity-55"
                          : isCurrent
                            ? "border-[#e8102e]/50"
                            : ""
                      } ${isRevealed ? "!border-[#ffb830]/60 !bg-[#ffb830]/[0.04]" : ""}`}
                    >
                      {/* eliminar — esquina superior derecha */}
                      <button
                        type="button"
                        onClick={() => deleteSound(contest.id, s.id).catch((e) => toast.error(e.message))}
                        className="btn-press absolute top-2 right-2 p-1.5 border border-[#e8102e]/30 bg-[#e8102e]/8 text-[#ff8095] hover:bg-[#e8102e]/20 hover:text-white transition-colors z-10"
                        title="Eliminar sonido"
                        aria-label="Eliminar sonido"
                      >
                        <Trash2 size={12} />
                      </button>
                      {/* fila 1: thumbnail + info + badge resuelta */}
                      <div className="flex items-start gap-3 pr-8">
                        {s.image ? (
                          <img src={s.image} alt="" className={`w-14 h-14 shrink-0 clip-card-sm object-cover border ${isSolved ? "border-[#3a3d45] grayscale" : "border-white/12"}`} />
                        ) : (
                          <span className="w-14 h-14 shrink-0 clip-card-sm bg-black/40 border border-white/10 flex items-center justify-center text-[#6b6e78] tabular-nums text-[16px] font-extrabold">
                            {i + 1}
                          </span>
                        )}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-[#6b6e78]">Pregunta</span>
                            {isSolved ? (
                              <span className="chip clip-tag bg-[#3a3d45] text-[#8e919c] !text-[7px] !px-1.5 !py-[1px] flex items-center gap-1">
                                <CheckCircle2 size={9} />
                                Resuelta
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[12px] font-bold text-[#c9cbd3] mb-2">{s.question}</div>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-[#6b6e78] mb-1">Respuesta</div>
                          <div className="text-[13px] font-extrabold text-[#ffb830] uppercase">{s.answer}</div>
                        </div>
                      </div>
                      {/* fila 2: 4 botones del mismo tamaño (grid 4 cols) */}
                      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/8">
                        {/* Mostrar pregunta — deshabilitado si está resuelta */}
                        <button
                          type="button"
                          disabled={isSolved}
                          onClick={() => toggleQuestion(s.id, isSolved)}
                          className={`btn-press clip-tag py-2 px-1 text-[9px] font-extrabold uppercase tracking-[0.06em] flex items-center justify-center gap-1 border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            isQuestionShown
                              ? "border-[#8e919c] bg-[#8e919c]/15 text-white"
                              : "border-white/12 bg-black/30 text-[#c9cbd3] hover:border-[#8e919c]/60 hover:text-white"
                          }`}
                          title={isSolved ? "Pregunta resuelta — bloqueada" : isQuestionShown ? "Ocultar pregunta en el visor" : "Mostrar pregunta en el visor"}
                        >
                          <HelpCircle size={11} />
                          {isQuestionShown ? "Ocultar" : "Mostrar"}
                        </button>
                        {/* Reproducir — deshabilitado si está resuelta */}
                        <button
                          type="button"
                          disabled={isSolved}
                          onClick={() => playSound(s.id, isSolved)}
                          className={`btn-press clip-tag py-2 px-1 text-[9px] font-extrabold uppercase tracking-[0.06em] flex items-center justify-center gap-1 border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            isPlaying
                              ? "border-[#e8102e] bg-[#e8102e]/15 text-white"
                              : "border-white/12 bg-black/30 text-[#c9cbd3] hover:border-[#e8102e]/60 hover:text-white"
                          }`}
                          title={isSolved ? "Pregunta resuelta — bloqueada" : isPlaying ? "Reproducir de nuevo" : "Reproducir (una vez)"}
                        >
                          {isPlaying ? <RotateCw size={11} /> : <Play size={11} />}
                          {isPlaying ? "De nuevo" : "Reproducir"}
                        </button>
                        {/* Respuesta — deshabilitado si está resuelta */}
                        <button
                          type="button"
                          disabled={!isCurrent || isSolved}
                          onClick={() => toggleAnswer(s.id, isSolved)}
                          className={`btn-press clip-tag py-2 px-1 text-[9px] font-extrabold uppercase tracking-[0.06em] flex items-center justify-center gap-1 border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            isRevealed
                              ? "border-[#ffb830] bg-[#ffb830]/15 text-[#ffb830]"
                              : "border-white/12 bg-black/30 text-[#c9cbd3] hover:border-[#ffb830]/60 hover:text-white"
                          }`}
                          title={isSolved ? "Pregunta resuelta — bloqueada" : isRevealed ? "Ocultar respuesta en el visor" : "Mostrar respuesta en el visor"}
                        >
                          <Eye size={11} />
                          {isRevealed ? "Ocultar" : "Respuesta"}
                        </button>
                        {/* Resuelta — solo marca, no reproduce */}
                        <button
                          type="button"
                          onClick={() => toggleSolved(s.id, isSolved)}
                          className={`btn-press clip-tag py-2 px-1 text-[9px] font-extrabold uppercase tracking-[0.06em] flex items-center justify-center gap-1 border transition-colors ${
                            isSolved
                              ? "border-[#3a3d45] bg-[#3a3d45]/30 text-[#8e919c]"
                              : "border-white/12 bg-black/30 text-[#c9cbd3] hover:border-[#8e919c]/60 hover:text-white"
                          }`}
                          title={isSolved ? "Marcar como no resuelta" : "Marcar como resuelta (ya respondida)"}
                        >
                          <CheckCircle2 size={11} />
                          Resuelta
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ============ PARTICIPANTES (1/3) ============ */}
        <div className="space-y-4">
          {/* registro + wipe */}
          {!isFinished ? (
            <div className="panel clip-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="label-cap flex items-center gap-2">
                  <Plus size={12} />
                  Registrar
                </span>
                {participants.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(true)}
                    className="text-[9px] font-bold uppercase tracking-wider text-[#ff8095] hover:text-white"
                    title="Eliminar todos los participantes"
                  >
                    Eliminar todos
                  </button>
                ) : null}
              </div>
              <div className="flex items-end gap-2">
                <Field label="Nick" className="flex-1">
                  <TextInput value={nick} onChange={(e) => setNick(e.target.value)} placeholder="EJ. SHADOWWOLF" maxLength={40} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
                </Field>
                <Btn variant="red" onClick={add} disabled={busy} small>
                  <Plus size={13} />
                </Btn>
              </div>
            </div>
          ) : null}

          {/* marcador */}
          <div className="panel clip-card p-4">
            <div className="label-cap mb-3 flex items-center gap-2">
              <Trophy size={12} />
              Marcador ({participants.length})
            </div>
            {loading ? (
              <div className="text-[12px] font-bold text-[#6b6e78] uppercase py-4 text-center">Cargando…</div>
            ) : sorted.length === 0 ? (
              <div className="text-[12px] font-bold text-[#6b6e78] uppercase py-4 text-center">Sin participantes aún</div>
            ) : (
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {sorted.map((p, i) => {
                  const isWinner = winnerPid === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`panel-2 clip-card-sm p-2.5 flex items-center gap-2 ${isWinner ? "border-[#ffb830] bg-[#ffb830]/10" : ""}`}
                    >
                      <span className={`w-7 h-7 shrink-0 clip-badge flex items-center justify-center font-extrabold text-[11px] ${i === 0 ? "bg-[#ffb830] text-[#241500]" : "bg-black/40 border border-white/10 text-[#8e919c]"}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-extrabold uppercase text-white truncate">{p.nick}</div>
                      </div>
                      <span className="font-display italic text-[18px] tabular-nums text-[#ffb830] leading-none min-w-[28px] text-center">
                        {p.score}
                      </span>
                      {isWinner ? (
                        <Crown size={14} className="text-[#ffb830] shrink-0" />
                      ) : !isFinished ? (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <IconBtn title="Restar" small onClick={() => addScore(contest.id, p.id, -1).catch((e) => toast.error(e.message))}>
                            <Minus size={11} />
                          </IconBtn>
                          <IconBtn title="Sumar punto" small onClick={() => addScore(contest.id, p.id, 1).catch((e) => toast.error(e.message))}>
                            <Plus size={11} />
                          </IconBtn>
                          <IconBtn title="Editar" small onClick={() => startEdit(p)}>
                            <Pencil size={11} />
                          </IconBtn>
                          <IconBtn title="Eliminar" small danger onClick={() => setConfirmDeleteP(p)}>
                            <Trash2 size={11} />
                          </IconBtn>
                          <IconBtn title="Marcar ganador" small onClick={() => setConfirmWinner({ id: p.id, nick: p.nick })}>
                            <Trophy size={11} />
                          </IconBtn>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ modales ============ */}
      <Modal open={!!editingP} onClose={() => setEditingP(null)} title="Editar participante">
        {editingP ? (
          <div className="space-y-3">
            <Field label="Nick">
              <TextInput value={editNick} onChange={(e) => setEditNick(e.target.value)} maxLength={40} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} />
            </Field>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setEditingP(null)}>Cancelar</Btn>
              <Btn variant="red" onClick={saveEdit}>Guardar</Btn>
            </div>
          </div>
        ) : null}
      </Modal>

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
            await setSoundPlaying(contest.id, null, false);
            toast.success(`${confirmWinner.nick} es el ganador`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          }
        }}
      />

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
        message="El visor dejará de mostrar este concurso."
        onConfirm={async () => {
          await closeTransmission();
          setConfirmClose(false);
        }}
      />

      <Confirm
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        danger
        confirmLabel="Resetear concurso"
        title="Resetear concurso"
        message="Se pondrán todos los marcadores a 0, todas las preguntas se marcarán como no resueltas y se deshacerá el ganador si lo hay. Los participantes y sonidos NO se borran."
        onConfirm={async () => {
          setBusy(true);
          try {
            await resetContest(contest.id);
            toast.success("Concurso reseteado — scores a 0, preguntas no resueltas");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al resetear");
          } finally {
            setBusy(false);
          }
          setConfirmReset(false);
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
