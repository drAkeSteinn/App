"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Music, Play, RefreshCw, Trash2, Upload, Volume2, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  SOUND_EVENTS,
  saveSound,
  removeSound,
  playSound,
  useSounds,
  type SoundEvent,
  type SoundMeta,
} from "@/lib/sounds";
import { Btn, Modal } from "./ui";

/* ============================================================
   SoundsConfig — sección de configuración de sonidos.
   El usuario puede subir .mp3/.wav por evento, previsualizar
   y restablecer al default sintetizado.
   ============================================================ */

const MAX_BYTES = 600 * 1024; // 600 KB por sonido (Firestore ~1MB/doc)

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error("No se pudo leer el archivo"));
    fr.readAsDataURL(file);
  });
}

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

export function SoundsConfig({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sounds, loading } = useSounds();
  const [busyEvent, setBusyEvent] = useState<SoundEvent | null>(null);

  const handleUpload = async (event: SoundEvent, file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(`El archivo es demasiado grande (máx ${Math.round(MAX_BYTES / 1024)} KB). Usa un clip más corto.`);
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
      // preview inmediato
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

  return (
    <Modal open={open} onClose={onClose} title="Sonidos personalizados" wide>
      <div className="flex items-center gap-2 mb-3 text-[11px] font-bold text-[#8e919c] uppercase tracking-wider">
        <Volume2 size={13} className="text-[#e8102e]" />
        Personaliza los sonidos de cada acción
      </div>
      <p className="text-[10px] font-semibold text-[#6b6e78] mb-4 leading-snug">
        Sube un <span className="text-[#c9cbd3]">.mp3</span> o <span className="text-[#c9cbd3]">.wav</span> (máx {Math.round(MAX_BYTES / 1024)} KB) por
        evento. Si no subes nada, se usa un sonido por defecto sintetizado. Los sonidos se reproducen en el
        panel <span className="text-[#c9cbd3]">Torneo en vivo</span> y en el <span className="text-[#c9cbd3]">visor</span> para el público.
        Tip: busca sonidos gratis en <span className="text-[#c9cbd3]">mixkit.co/free-sound-effects</span> o{" "}
        <span className="text-[#c9cbd3]">freesound.org</span>.
      </p>

      {loading ? (
        <div className="text-[11px] font-bold text-[#6b6e78] uppercase py-6 text-center">Cargando…</div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
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

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/8">
        <Zap size={12} className="text-[#ffb830]" />
        <span className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#6b6e78] flex-1">
          Los cambios se sincronizan en tiempo real con el visor
        </span>
        <Btn variant="ghost" onClick={onClose}>
          Cerrar
        </Btn>
      </div>
    </Modal>
  );
}
