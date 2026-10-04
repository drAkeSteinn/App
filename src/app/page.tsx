"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Emblem } from "@/components/arena/ui";
import { MainApp } from "@/components/arena/MainApp";
import { SpectatorView } from "@/components/arena/SpectatorView";
import { ObsOverlay } from "@/components/arena/ObsOverlay";

function Splash() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#070708]">
      <div className="beat">
        <Emblem size={54} />
      </div>
      <p className="text-[10px] font-extrabold tracking-[0.5em] uppercase text-[#6b6e78]">Cargando arena…</p>
    </div>
  );
}

function Views() {
  const sp = useSearchParams();
  // Fuente de navegador para OBS Studio (fondo transparente, cards fijas)
  if (sp.get("obs") === "1") {
    return <ObsOverlay tid={sp.get("t")} />;
  }
  if (sp.get("v") === "show") {
    return <SpectatorView tid={sp.get("t")} />;
  }
  return <MainApp />;
}

export default function Home() {
  return (
    <Suspense fallback={<Splash />}>
      <Views />
    </Suspense>
  );
}
