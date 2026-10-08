"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { fdb } from "./firebase";

/* ============================================================
   TRANSMISIÓN OBS — ajustes del visor.
   Doc Firestore: settings/obs = { width, height }
   · width/height = tamaño EN PÍXELES del marco del visor donde
     se muestra la transmisión (centrada encima de los brackets).
   · El video SIEMPRE se ajusta dentro del marco sin deformarse
     (object-contain): se recomienda usar la misma resolución del
     canvas de OBS (p. ej. 1920×1080) para que ocupe todo el marco
     a resolución nativa.
   · En tiempo real: el visor reacciona al instante al guardar.
   ============================================================ */

export interface ObsDisplaySettings {
  width: number;
  height: number;
}

export const OBS_DEFAULTS: ObsDisplaySettings = { width: 1920, height: 1080 };

const obsRef = () => doc(fdb, "settings", "obs");

/** Ajustes del visor en tiempo real (con valores por defecto). */
export function useObsDisplaySettings() {
  const [settings, setSettings] = useState<ObsDisplaySettings>(OBS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(
      obsRef(),
      (snap) => {
        const d = snap.data() as Partial<ObsDisplaySettings> | undefined;
        const w = Number(d?.width);
        const h = Number(d?.height);
        setSettings({
          width: Number.isFinite(w) && w >= 160 ? Math.min(w, 7680) : OBS_DEFAULTS.width,
          height: Number.isFinite(h) && h >= 90 ? Math.min(h, 4320) : OBS_DEFAULTS.height,
        });
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);
  return { settings, loading };
}

/** Guarda el tamaño del marco en el visor (validado y acotado). */
export async function saveObsDisplaySettings(width: number, height: number): Promise<ObsDisplaySettings> {
  const clean: ObsDisplaySettings = {
    width: Number.isFinite(width) && width >= 160 ? Math.min(Math.round(width), 7680) : OBS_DEFAULTS.width,
    height: Number.isFinite(height) && height >= 90 ? Math.min(Math.round(height), 4320) : OBS_DEFAULTS.height,
  };
  await setDoc(obsRef(), { ...clean, updatedAt: Date.now() });
  return clean;
}

/** Hook de escritura local para el formulario (solo admin). */
export function useObsSettingsForm() {
  const { settings, loading } = useObsDisplaySettings();
  const [saving, setSaving] = useState(false);
  const save = useCallback(async (width: number, height: number) => {
    setSaving(true);
    try {
      return await saveObsDisplaySettings(width, height);
    } finally {
      setSaving(false);
    }
  }, []);
  return { settings, loading, saving, save };
}
