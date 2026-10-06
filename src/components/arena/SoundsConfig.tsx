"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Music, Pause, Play, Plus, RefreshCw, Trash2, Upload, Volume2, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  SOUND_EVENTS,
  saveSound,
  removeSound,
  playSound,
  useSounds,
  useMusicLoops,
  saveMusicLoop,
  deleteMusicLoop,
  updateLoopVolume,
  useLoopPlayer,
  type SoundEvent,
  type SoundMeta,
} from "@/lib/sounds";
import { Btn, Modal } from "./ui";

/* ============================================================
   SoundsConfig — sección de configuración de sonidos.
   · Sonidos de eventos (subir .mp3/.wav por acción)
   · Loops de música (melodías de fondo en loop)
   ============================================================ */

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB por sonido de evento
const MAX_LOOP_BYTES = 5 * 1024 * 1024; // 5 MB por loop de música

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error("No se pudo leer el archivo"));
    fr.readAsDataURL(file);
  });
}

/* ---------------- Fila de sonido de evento ---------------- */

function SoundRow({
  meta,
  hasOverride,
  onPreview,
  onUpload,
  onReset,
  busy,
}: {
  meta: SoundMeta;
  hasOverride: boolean;
  onPreview: () => void;
  onUpload: (file: File) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <motion.div
      layout
      className={`panel-2 clip-card-sm p-3 flex items-center gap-3 ${hasOverride ? "border-[#ffb830]/35" : ""}`}
    >
      <span className="w-9 h-9 shrink-0 clip-badge bg-black/40 border border-white/10 flex items-center justify-center text-[16px]">
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-extrabold uppercase text-white truncate flex items-center gap-2">
          {meta.label}
          {hasOverride ? (
            <span className="chip clip-tag bg-[#ffb830]/14 text-[#ffb830] border border-[#ffb830]/35 !text-[7px] !px-1.5 !py-[1px] tracking-[0.12em]">
              <Music size={8} />
              Personalizado
            </span>
          ) : (
            <span className="chip clip-tag bg-white/[0.05] text-[#8e919c] border border-white/10 !text-[7px] !px-1.5 !py-[1px] tracking-[0.12em]">
              Default
            </span>
          )}
        </div>
        <div className="text-[10px] font-semibold text-[#8e919c] truncate mt-0.5">{meta.desc}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onPreview}
          title="Reproducir"
          aria-label={`Reproducir sonido de ${meta.label}`}
          className="btn-press p-2 border border-white/12 text-[#8e919c] hover:text-white hover:border-[#e8102e]/60"
        >
          <Play size={13} />
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Subir audio (.mp3, .wav)"
          aria-label={`Subir sonido para ${meta.label}`}
          className="btn-press p-2 border border-white/12 text-[#8e919c] hover:text-white hover:border-[#e8102e]/60"
        >
          <Upload size={13} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp3,.mp3,.wav"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        {hasOverride ? (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            title="Restablecer al default sintetizado"
            aria-label={`Restablecer sonido de ${meta.label}`}
            className="btn-press p-2 border border-white/12 text-[#8e919c] hover:text-[#ff8095] hover:border-[#e8102e]/60"
          >
            <RefreshCw size={13} />
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

/* ---------------- Fila de loop de música ---------------- */

function LoopRow({
  loop,
  isPlaying,
  onPlay,
  onStop,
  onDelete,
  onVolume,
}: {
  loop: { id: string; name: string; volume: number };
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onDelete: () => void;
  onVolume: (v: number) => void;
}) {
  return (
    <div className="panel-2 clip-card-sm p-3 flex items-center gap-3">
      <span className="w-9 h-9 shrink-0 clip-badge bg-[#ffb830]/15 border border-[#ffb830]/30 flex items-center justify-center text-[#ffb830]">
        <Music size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-extrabold uppercase text-white truncate">{loop.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="range"
            min={0}
            max={100}
            value={loop.volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="flex-1 h-1 accent-[#ffb830] cursor-pointer"
            title="Volumen"
          />
          <span className="text-[9px] font-bold tabular-nums text-[#8e919c] w-7 text-right">{loop.volume}%</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={isPlaying ? onStop : onPlay}
          title={isPlaying ? "Detener" : "Reproducir en loop"}
          className={`btn-press p-2 border transition-colors ${
            isPlaying
              ? "border-[#e8102e] bg-[#e8102e]/15 text-white"
              : "border-white/12 text-[#8e919c] hover:text-white hover:border-[#e8102e]/60"
          }`}
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Eliminar loop"
          className="btn-press p-2 border border-[#e8102e]/30 text-[#ff8095] hover:bg-[#e8102e]/20 hover:text-white"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================ */

export function SoundsConfig({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sounds, loading } = useSounds();
  const [busyEvent, setBusyEvent] = useState<SoundEvent | null>(null);

  // loops
  const { loops, loading: loopsLoading } = useMusicLoops();
  const loopPlayer = useLoopPlayer();
  const loopFileRef = useRef<HTMLInputElement>(null);
  const [loopName, setLoopName] = useState("");
  const [pendingLoop, setPendingLoop] = useState<File | null>(null);
  const [uploadingLoop, setUploadingLoop] = useState(false);

  const handleUpload = async (event: SoundEvent, file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(`Archivo demasiado grande (máx ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`);
      return;
    }
    const ok = file.type.startsWith("audio/") || /\.(mp3|wav)$/i.test(file.name);
    if (!ok) {
      toast.error("Formato no soportado. Sube un .mp3 o .wav");
      return;
    }
    setBusyEvent(event);
    try {
      const dataUrl = await fileToDataUrl(file);
      await saveSound(event, dataUrl, file.type || "audio/mpeg");
      toast.success(`Sonido de "${SOUND_EVENTS.find((e) => e.id === event)?.label}" actualizado`);
      playSound(event, { [event]: { data: dataUrl, type: file.type } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir el sonido");
    } finally {
      setBusyEvent(null);
    }
  };

  const handleReset = async (event: SoundEvent) => {
    setBusyEvent(event);
    try {
      await removeSound(event);
      toast.success("Restablecido al default sintetizado");
      playSound(event, {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al restablecer");
    } finally {
      setBusyEvent(null);
    }
  };

  const handleLoopUpload = async () => {
    if (!pendingLoop) {
      toast.error("Selecciona un archivo de audio");
      return;
    }
    if (pendingLoop.size > MAX_LOOP_BYTES) {
      toast.error(`Loop demasiado grande (máx ${Math.round(MAX_LOOP_BYTES / 1024 / 1024)} MB)`);
      return;
    }
    if (!loopName.trim()) {
      toast.error("Ponle un nombre al loop");
      return;
    }
    setUploadingLoop(true);
    try {
      const dataUrl = await fileToDataUrl(pendingLoop);
      await saveMusicLoop(loopName.trim(), dataUrl, pendingLoop.type || "audio/mpeg");
      setPendingLoop(null);
      setLoopName("");
      if (loopFileRef.current) loopFileRef.current.value = "";
      toast.success("Loop agregado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir el loop");
    } finally {
      setUploadingLoop(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Sonidos personalizados" wide>
      {/* ===== SONIDOS DE EVENTOS ===== */}
      <div className="flex items-center gap-2 mb-3 text-[11px] font-bold text-[#8e919c] uppercase tracking-wider">
        <Volume2 size={13} className="text-[#e8102e]" />
        Sonidos de eventos
      </div>
      <p className="text-[10px] font-semibold text-[#6b6e78] mb-4 leading-snug">
        Sube un <span className="text-[#c9cbd3]">.mp3</span> o <span className="text-[#c9cbd3]">.wav</span> (máx {Math.round(MAX_BYTES / 1024 / 1024)} MB) por
        evento. Si no subes nada, se usa un default sintetizado. Los sonidos se guardan en <span className="text-[#c9cbd3]">Firestore</span> (base de datos).
      </p>

      {loading ? (
        <div className="text-[11px] font-bold text-[#6b6e78] uppercase py-6 text-center">Cargando…</div>
      ) : (
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {SOUND_EVENTS.map((meta) => (
            <SoundRow
              key={meta.id}
              meta={meta}
              hasOverride={!!sounds[meta.id]}
              onPreview={() => playSound(meta.id, sounds)}
              onUpload={(f) => handleUpload(meta.id, f)}
              onReset={() => handleReset(meta.id)}
              busy={busyEvent === meta.id}
            />
          ))}
        </div>
      )}

      {/* ===== LOOPS DE MÚSICA ===== */}
      <div className="flex items-center gap-2 mt-6 mb-3 text-[11px] font-bold text-[#8e919c] uppercase tracking-wider">
        <Music size={13} className="text-[#ffb830]" />
        Loops de música
      </div>
      <p className="text-[10px] font-semibold text-[#6b6e78] mb-4 leading-snug">
        Sube melodías que se reproducen en <span className="text-[#c9cbd3]">loop continuo</span> (máx {Math.round(MAX_LOOP_BYTES / 1024 / 1024)} MB).
        Úsalas como música de fondo durante el torneo. Los loops se guardan en <span className="text-[#c9cbd3]">Firestore</span> (base de datos).
      </p>

      {/* subir loop */}
      <div className="panel-2 clip-card-sm p-3 mb-3 space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8e919c] block mb-1">Nombre</label>
            <input
              type="text"
              value={loopName}
              onChange={(e) => setLoopName(e.target.value)}
              placeholder="EJ. MÚSICA DE FONDO 1"
              maxLength={40}
              className="field-input clip-tag w-full px-3 py-2 text-[11px]"
            />
          </div>
          <button
            type="button"
            onClick={() => loopFileRef.current?.click()}
            className="btn-press clip-tag px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em] border border-white/12 bg-black/30 text-[#c9cbd3] hover:border-[#ffb830]/60 hover:text-white whitespace-nowrap"
          >
            <Upload size={12} className="inline mr-1" />
            {pendingLoop ? pendingLoop.name.substring(0, 20) : "Audio"}
          </button>
          <input
            ref={loopFileRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp3,.mp3,.wav"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPendingLoop(f);
              e.target.value = "";
            }}
          />
          <Btn variant="red" small onClick={handleLoopUpload} disabled={uploadingLoop || !pendingLoop}>
            <Plus size={13} />
            Subir
          </Btn>
        </div>
      </div>

      {/* lista de loops */}
      {loopsLoading ? (
        <div className="text-[11px] font-bold text-[#6b6e78] uppercase py-4 text-center">Cargando loops…</div>
      ) : loops.length === 0 ? (
        <div className="text-[11px] font-bold text-[#6b6e78] uppercase py-4 text-center">Sin loops de música todavía</div>
      ) : (
        <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
          {loops.map((loop) => (
            <LoopRow
              key={loop.id}
              loop={loop}
              isPlaying={loopPlayer.isPlaying(loop.id)}
              onPlay={() => loopPlayer.play(loop)}
              onStop={() => loopPlayer.stop(loop.id)}
              onDelete={() => {
                loopPlayer.stop(loop.id);
                deleteMusicLoop(loop.id).catch((e) => toast.error(e.message));
              }}
              onVolume={(v) => {
                updateLoopVolume(loop.id, v).catch(() => {});
                loopPlayer.setVolume({ ...loop, volume: v });
              }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/8">
        <Zap size={12} className="text-[#ffb830]" />
        <span className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#6b6e78] flex-1">
          Los cambios se sincronizan en tiempo real · Sonidos y loops se guardan en Firestore (base de datos)
        </span>
        <Btn variant="ghost" onClick={onClose}>
          Cerrar
        </Btn>
      </div>
    </Modal>
  );
}
