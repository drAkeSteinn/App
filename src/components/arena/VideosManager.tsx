"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  Film,
  HardDrive,
  ListVideo,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchVideos,
  fmtBytes,
  useVideoSelection,
  videoFileUrl,
  type VideoMeta,
} from "@/lib/videos";
import { Btn, Confirm, IconBtn, Modal } from "./ui";

/* ============================================================
   VideosManager — sección COMPLETA (no modal) de Configuración.
   · Lee los videos de la carpeta `videos/` de la app.
   · Sube nuevos videos SIN límite de peso (subida en streaming
     con barra de progreso real, varios archivos a la vez).
   · Lista de videos subidos + botón RESINCRONIZAR para releer
     la carpeta (refleja también archivos copiados al servidor).
   · Checkbox por video: los marcados son los que el visor
     reproduce en loop en la pantalla "Esperando transmisión".
   ============================================================ */

interface UploadJob {
  id: string;
  name: string;
  pct: number;
  status: "up" | "ok" | "err";
  error?: string;
}

/** Formatos que el navegador NO suele poder reproducir — se avisan pero se permiten. */
function mayNotPlay(name: string): boolean {
  return /\.(mkv|avi|wmv|flv|mpg|mpeg|ts)$/i.test(name);
}

/** Sube un archivo en streaming con progreso real (XHR). Sin límite de peso. */
function uploadVideo(file: File, onProgress: (pct: number) => void): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/videos/upload?name=${encodeURIComponent(file.name)}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText) as { name?: string; size?: number; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && d.name) {
          resolve({ name: d.name, size: d.size ?? file.size, mtime: Date.now() });
        } else {
          reject(new Error(d.error ?? "Error al subir el video"));
        }
      } catch {
        reject(new Error("Respuesta inválida del servidor"));
      }
    };
    xhr.onerror = () => reject(new Error("Error de red al subir el video"));
    xhr.send(file);
  });
}

export function VideosManager({ onBack }: { onBack: () => void }) {
  const [videos, setVideos] = useState<VideoMeta[] | null>(null);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<VideoMeta | null>(null);
  const [deleting, setDeleting] = useState<VideoMeta | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /* espejo de la selección: los clics rápidos construyen sobre la última
     intención local sin esperar el eco de Firestore (evita carreras) */
  const selectedRef = useRef<string[]>([]);

  const { selected, loading: selLoading, save } = useVideoSelection();

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const refresh = useCallback(
    async (announce = false) => {
      setSyncing(true);
      try {
        const list = await fetchVideos();
        setVideos(list);
        if (announce) toast.success(`Carpeta sincronizada · ${list.length} video${list.length === 1 ? "" : "s"}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al leer la carpeta");
      } finally {
        setSyncing(false);
      }
    },
    []
  );

  React.useEffect(() => {
    /* carga inicial silenciosa (sin toast ni spinner de resincronización) */
    let alive = true;
    fetchVideos()
      .then((list) => {
        if (alive) setVideos(list);
      })
      .catch(() => {
        if (alive) setVideos([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const startUploads = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const newJobs: UploadJob[] = files.map((f) => ({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        pct: 0,
        status: "up",
      }));
      setJobs((prev) => [...newJobs, ...prev].slice(0, 12));

      files.forEach((file, i) => {
        const job = newJobs[i];
        uploadVideo(file, (pct) => {
          setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, pct } : j)));
        })
          .then((meta) => {
            setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, pct: 100, status: "ok", name: meta.name } : j)));
            refresh();
            toast.success(`"${meta.name}" subido (${fmtBytes(meta.size)})`);
          })
          .catch((e: Error) => {
            setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "err", error: e.message } : j)));
            toast.error(`"${file.name}": ${e.message}`);
          });
      });
    },
    [refresh]
  );

  const toggleSelected = (name: string) => {
    const cur = selectedRef.current;
    const next = cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name];
    selectedRef.current = next; // intención inmediata para el siguiente clic
    save(next).catch((e: Error) => toast.error(e.message));
  };

  const removeJob = (id: string) => setJobs((prev) => prev.filter((j) => j.id !== id));

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/videos/file/${encodeURIComponent(deleting.name)}`, { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "No se pudo eliminar");
      }
      if (selected.includes(deleting.name)) {
        await save(selected.filter((n) => n !== deleting.name)).catch(() => {});
      }
      toast.success(`"${deleting.name}" eliminado`);
      setPreview(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const totalSize = (videos ?? []).reduce((acc, v) => acc + v.size, 0);
  const uploading = jobs.some((j) => j.status === "up");

  return (
    <div>
      {/* ===== encabezado de la sección ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              title="Volver a torneos"
              aria-label="Volver a torneos"
              className="btn-press p-2 border border-white/15 text-[#8e919c] hover:text-white hover:border-[#e8102e]/60"
            >
              <ArrowLeft size={16} />
            </button>
            <h2 className="font-display italic text-[26px] sm:text-[32px] uppercase leading-none">
              <span className="text-silver-grad">Videos de</span> <span className="text-red-grad">Espera</span>
            </h2>
          </div>
          <p className="text-[11px] text-[#8e919c] font-bold tracking-[0.14em] uppercase mt-2 ml-[52px]">
            Playlist en loop del visor · se reproduce mientras no hay transmisión
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="dark" onClick={() => refresh(true)} disabled={syncing} title="Releer la carpeta videos/ del servidor">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            Resincronizar
          </Btn>
          <Btn variant="red" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={14} />
            Subir videos
          </Btn>
        </div>
      </div>

      {/* ===== chips de estado ===== */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="chip clip-tag bg-white/[0.06] border border-white/10 text-[#c9cbd3] text-[10px] px-3 py-1.5">
          <Film size={11} className="text-[#e8102e]" />
          {videos ? videos.length : "…"} en la carpeta
        </span>
        <span className="chip clip-tag bg-[#ffb830]/12 border border-[#ffb830]/35 text-[#ffb830] text-[10px] px-3 py-1.5">
          <ListVideo size={11} />
          {selLoading ? "…" : selected.length} en reproducción
        </span>
        <span className="chip clip-tag bg-white/[0.06] border border-white/10 text-[#c9cbd3] text-[10px] px-3 py-1.5">
          <HardDrive size={11} className="text-[#8e919c]" />
          {fmtBytes(totalSize)} en disco
        </span>
        <span className="text-[9.5px] font-bold tracking-[0.1em] uppercase text-[#6b6e78] hidden md:inline">
          Carpeta del servidor: <span className="text-[#c9cbd3]">app/videos/</span> · el orden de reproducción sigue el nombre (01, 02, …)
        </span>
      </div>

      {/* ===== zona de subida (drag & drop, sin límite de peso) ===== */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona para subir videos"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          startUploads(Array.from(e.dataTransfer.files));
        }}
        className={`dropzone clip-card ${dragOver ? "is-over" : ""} p-6 mb-4 flex flex-col items-center justify-center gap-2 cursor-pointer select-none`}
      >
        <span className="w-11 h-11 clip-badge bg-black/40 border border-white/10 flex items-center justify-center">
          <Upload size={18} className="text-[#e8102e]" />
        </span>
        <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#c9cbd3]">
          Arrastra videos aquí o haz clic para elegir
        </span>
        <span className="text-[10px] font-semibold text-[#6b6e78]">
          Sin límite de peso · MP4 y WebM recomendados · varios archivos a la vez
        </span>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="video/*,.mkv,.avi,.mov,.mp4,.webm,.m4v,.mpg,.mpeg,.wmv,.ts"
        className="hidden"
        onChange={(e) => {
          startUploads(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {/* ===== trabajos de subida (progreso) ===== */}
      {jobs.length > 0 ? (
        <div className="space-y-1.5 mb-4">
          {jobs.map((j) => (
            <div key={j.id} className="panel-2 clip-card-sm px-3 py-2 flex items-center gap-3">
              {j.status === "ok" ? (
                <Check size={13} className="text-[#5dd97c] shrink-0" />
              ) : j.status === "err" ? (
                <AlertTriangle size={13} className="text-[#ff8095] shrink-0" />
              ) : (
                <Upload size={13} className="text-[#ffb830] shrink-0 animate-pulse" />
              )}
              <span className="text-[11px] font-bold text-white truncate flex-1 min-w-0">{j.name}</span>
              {j.status === "up" ? (
                <>
                  <div className="w-32 sm:w-56 h-1.5 bg-white/8 overflow-hidden shrink-0">
                    <div
                      className="h-full bg-[linear-gradient(90deg,#ff2440,#ffb830)] transition-[width] duration-200"
                      style={{ width: `${j.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-extrabold tabular-nums text-[#ffb830] w-9 text-right">{j.pct}%</span>
                </>
              ) : j.status === "ok" ? (
                <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#5dd97c]">Subido</span>
              ) : (
                <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ff8095] truncate max-w-[40%]">
                  {j.error}
                </span>
              )}
              <IconBtn small danger title="Quitar de la lista" onClick={() => removeJob(j.id)}>
                <X size={11} />
              </IconBtn>
            </div>
          ))}
        </div>
      ) : null}

      {/* ===== lista de videos ===== */}
      {videos === null ? (
        <div className="panel clip-card p-8 flex items-center justify-center text-[#8e919c]">
          <RefreshCw size={20} className="animate-spin" />
        </div>
      ) : videos.length === 0 ? (
        <div className="panel clip-card p-8 text-center">
          <Film size={26} className="mx-auto text-[#6b6e78] mb-3" />
          <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#8e919c]">
            La carpeta está vacía
          </p>
          <p className="text-[11px] font-semibold text-[#6b6e78] mt-2">
            Sube videos con el botón de arriba, o cópialos directo a <span className="text-[#c9cbd3]">app/videos/</span> en el
            servidor y pulsa <span className="text-[#c9cbd3]">Resincronizar</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1 scroll-slim">
          {videos.map((v, i) => {
            const on = selected.includes(v.name);
            return (
              <motion.div
                key={v.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2) }}
                className={`panel-2 clip-card-sm p-3 flex items-center gap-3 ${on ? "border-[#ffb830]/40" : ""}`}
              >
                {/* checkbox de reproducción */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleSelected(v.name)}
                  title={on ? "Quitar de la playlist del visor" : "Reproducir en el visor (pantalla de espera)"}
                  className={`btn-press w-6 h-6 shrink-0 clip-tag border flex items-center justify-center transition-colors ${
                    on
                      ? "bg-[linear-gradient(160deg,#ffb830,#d99312)] border-[#ffb830] text-[#141519]"
                      : "border-white/20 bg-black/30 text-transparent hover:border-[#ffb830]/70"
                  }`}
                >
                  <Check size={14} strokeWidth={3.5} />
                </button>

                {/* índice + info */}
                <span className="w-7 h-7 shrink-0 clip-badge bg-black/40 border border-white/10 flex items-center justify-center text-[11px] font-extrabold text-[#8e919c] tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[12px] font-extrabold text-white truncate" title={v.name}>
                      {v.name}
                    </span>
                    {mayNotPlay(v.name) ? (
                      <span
                        className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-[0.1em] text-[#ffb830] border border-[#ffb830]/40 bg-[#ffb830]/10 px-1.5 py-[1px] shrink-0"
                        title="Este formato puede no reproducirse en el navegador — conviértelo a MP4 (H.264)"
                      >
                        <AlertTriangle size={8} />
                        Formato
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[10px] font-semibold text-[#8e919c] mt-0.5 flex items-center gap-2">
                    <span className="tabular-nums">{fmtBytes(v.size)}</span>
                    <span className="flex items-center gap-1">
                      <Clock3 size={9} />
                      {new Date(v.mtime).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* acciones */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {on ? (
                    <span className="hidden sm:inline text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#ffb830] border border-[#ffb830]/40 bg-[#ffb830]/10 px-1.5 py-[2px]">
                      En loop
                    </span>
                  ) : null}
                  <IconBtn
                    title="Ver video"
                    onClick={() => setPreview(v)}
                  >
                    <Play size={13} />
                  </IconBtn>
                  <IconBtn danger title="Eliminar video del servidor" onClick={() => setDeleting(v)}>
                    <Trash2 size={13} />
                  </IconBtn>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* nota inferior */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/8">
        <ListVideo size={12} className="text-[#ffb830]" />
        <span className="text-[9px] font-extrabold tracking-[0.18em] uppercase text-[#6b6e78]">
          Los videos marcados se reproducen en loop en el visor cuando no hay transmisión · la selección se sincroniza en tiempo real
        </span>
      </div>

      {/* ===== preview ===== */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? "Video"} wide>
        {preview ? (
          <video
            key={preview.name}
            src={videoFileUrl(preview.name, preview.mtime)}
            controls
            autoPlay
            className="w-full max-h-[60vh] bg-black"
            aria-label={`Vista previa de ${preview.name}`}
          />
        ) : null}
      </Modal>

      {/* ===== confirmar borrado ===== */}
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        confirmLabel="Eliminar"
        title="Eliminar video"
        message={`Se eliminará "${deleting?.name}" de la carpeta del servidor. Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
