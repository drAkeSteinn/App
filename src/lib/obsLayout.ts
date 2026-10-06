"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { fdb } from "./firebase";

/* ============================================================
   Layout de las cards de OBS — posiciones personalizables.
   · Documento GLOBAL: arena/obsLayout = { PC1: {x,y}, PC2: {x,y}, ... }
   · Las posiciones son % del viewport (0-100) → independientes de
     la resolución de la pantalla de transmisión.
   · Aplica a TODOS los torneos y modalidades: cada PC (PC1..PC4)
     tiene su posición fija. El caster las arrange una vez y queda.
   ============================================================ */

export interface CardPos {
  x: number; // 0-100 (% del viewport horizontal)
  y: number; // 0-100 (% del viewport vertical)
}

export type ObsLayout = Partial<Record<string, CardPos>>;

const layoutRef = () => doc(fdb, "arena", "obsLayout");

/** Hook de tiempo real sobre el layout de cards de OBS. */
export function useObsLayout(): { layout: ObsLayout; loading: boolean } {
  const [layout, setLayout] = useState<ObsLayout>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(
      layoutRef(),
      (snap) => {
        if (snap.exists()) {
          setLayout((snap.data() as ObsLayout) ?? {});
        } else {
          setLayout({});
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);
  return { layout, loading };
}

/** Guarda el layout completo de cards de OBS. */
export async function saveObsLayout(layout: ObsLayout): Promise<void> {
  await setDoc(layoutRef(), layout);
}

/** Borra el layout guardado (vuelve al layout automático por defecto). */
export async function resetObsLayout(): Promise<void> {
  await deleteDoc(layoutRef());
}
