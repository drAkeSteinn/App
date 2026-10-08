"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { fdb } from "./firebase";

/* ============================================================
   VIDEOS DE ESPERA — playlist del visor.
   · Los archivos viven en la carpeta `videos/` de la app y se
     sirven vía /api/videos/* (streaming con Range).
   · La SELECCIÓN (qué videos se reproducen) se guarda en
     Firestore (doc settings/videos = { selected: string[] }) —
     así el visor la recibe en tiempo real, como todo el estado.
   · Orden de reproducción = orden alfabético natural del nombre
     (01-intro.mp4, 02-promo.mp4 … 10-final.mp4).
   ============================================================ */

export interface VideoMeta {
  name: string;
  size: number;
  mtime: number;
}

const selRef = () => doc(fdb, "settings", "videos");

/** Lista los videos de la carpeta (GET /api/videos). */
export async function fetchVideos(): Promise<VideoMeta[]> {
  const res = await fetch("/api/videos", { cache: "no-store" });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error ?? "Error al leer la carpeta de videos");
  }
  const data = (await res.json()) as { videos: VideoMeta[] };
  return data.videos;
}

/** URL de reproducción de un video (?v=mtime bustea la caché al re-subir). */
export function videoFileUrl(name: string, mtime?: number): string {
  return `/api/videos/file/${encodeURIComponent(name)}${mtime ? `?v=${mtime}` : ""}`;
}

/** Formatea un tamaño en bytes (KB/MB/GB). */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Selección de la playlist en tiempo real (Firestore). */
export function useVideoSelection() {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(
      selRef(),
      (snap) => {
        const d = snap.data() as { selected?: string[] } | undefined;
        setSelected(Array.isArray(d?.selected) ? (d.selected as string[]) : []);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);
  const save = useCallback(async (names: string[]) => {
    await setDoc(selRef(), { selected: names, updatedAt: Date.now() });
  }, []);
  return { selected, loading, save };
}

/** Playlist del visor: videos de la carpeta ∩ marcados, en orden natural
    de nombre. Vuelve a leer la carpeta cada `pollMs`. */
export function useWaitingPlaylist(pollMs = 30_000) {
  const [videos, setVideos] = useState<VideoMeta[] | null>(null); // null = cargando
  const [error, setError] = useState<string | null>(null);
  const { selected, loading: selLoading } = useVideoSelection();

  useEffect(() => {
    let alive = true;
    const run = () => {
      fetchVideos()
        .then((list) => {
          if (!alive) return;
          setVideos(list);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setVideos([]);
          setError(e instanceof Error ? e.message : "Error al leer videos");
        });
    };
    run();
    const t = setInterval(run, pollMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pollMs]);

  const playlist = useMemo(() => {
    if (!videos) return [];
    const sel = new Set(selected);
    return videos
      .filter((v) => sel.has(v.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  }, [videos, selected]);

  return {
    /** true cuando ya se leyó la carpeta y la selección de Firestore */
    ready: videos !== null && !selLoading,
    playlist,
    error,
  };
}
