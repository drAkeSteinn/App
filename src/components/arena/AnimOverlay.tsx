"use client";

import React, { useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import type { Modality } from "@/lib/types";
import { getPodium } from "@/lib/bracket";
import { useBracket, useTournaments } from "@/lib/hooks";
import { useActiveTournament } from "@/lib/activeTournament";
import { useArenaState } from "@/lib/arenaState";
import { useDramaCuts } from "@/lib/spotlight";
import { MatchSpotlight } from "./MatchSpotlight";
import { SubEnterOverlay } from "./SubEnterOverlay";
import { Podium } from "./Podium";

/* ============================================================
   ANIM OVERLAY — SOLO LAS ANIMACIONES para OBS Studio
   URL: /?obs=anims   (GENERAL: torneos y concursos — solo se
   emite una cosa a la vez, así que la URL NUNCA cambia y se
   configura una sola vez en OBS. Opcional: /?obs=anims&t=<id>
   fuerza un torneo.)

   · Es la hermana de "Cards OBS" (/?obs=1): fondo TRANSPARENTE
     para que OBS componga el alfa sobre la escena.
   · Muestra ÚNICAMENTE las animaciones del broadcast:
       - VS / GANADOR (MatchSpotlight) — cuando el admin pone un
         match en juego o marca un ganador.
       - Reserva que entra al match (SubEnterOverlay).
       - Podio de campeones (Podium) — cuando el admin activa
         "Mostrar podio" y hay campeón real (mismo guard anti-
         residual que el visor).
   · La detección usa el MISMO hook (useDramaCuts) que el visor
     (/?v=show), así que siempre están sincronizadas.
   · Es MUDO a propósito: el sonido lo pone el visor; así no se
     duplica el audio de la transmisión.
   · Sin animación activa → pantalla 100% transparente (no dibuja
     nada, ideal para dejar la fuente fija en OBS).
   ============================================================ */

export function AnimOverlay({ tid }: { tid: string | null }) {
  const { data: tournaments } = useTournaments();
  const active = useActiveTournament();

  /* URL única (/?obs=anims): si no viene ?t=, se resuelve el torneo ACTIVO
     desde Firestore (arena/active). Solo puede haber uno activo a la vez. */
  const resolvedTid = tid ?? active.tid;
  const tournament = useMemo(
    () => tournaments.find((t) => t.id === resolvedTid) ?? null,
    [tournaments, resolvedTid]
  );
  const { data: bracket } = useBracket(tournament ? resolvedTid : null);
  const arenaState = useArenaState(tournament ? resolvedTid : null);
  const status = tournament?.status ?? "open";
  const modality: Modality = tournament?.modality ?? 1;

  /* fondo transparente para OBS: el alfa de la página se compone sobre la escena */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.background = "transparent";
    body.style.background = "transparent";
    body.classList.add("obs-mode");
    return () => {
      html.style.background = "";
      body.style.background = "";
      body.classList.remove("obs-mode");
    };
  }, []);

  /* mismos cortes que el visor: VS/en juego + ganador + reserva que entra */
  const { spotlight, subEnter, dismissSpotlight, dismissSubEnter } = useDramaCuts({
    tid: tournament ? resolvedTid : null,
    bracket: bracket ?? null,
    status,
    winsNeeded: tournament?.winsNeeded ?? 1,
    modality,
    bankPick: arenaState?.bankPick ?? null,
  });

  /* podio: misma señal del admin y el MISMO guard anti-residual del visor
     (sin campeón real JAMÁS se dibuja, aunque el flag venga true) */
  const podiumFlag = arenaState?.showPodium ?? false;
  const hasChampion = useMemo(() => (bracket ? !!getPodium(bracket).champion?.pid : false), [bracket]);
  const showPodium = podiumFlag && hasChampion;

  return (
    <div
      className="fixed inset-0 z-10 overflow-hidden"
      role="img"
      aria-label="Overlay de animaciones para OBS — cortes de VS, ganador y podio"
    >
      {/* corte VS / GANADOR (fondo con velo suave, transparente para OBS) */}
      <AnimatePresence>
        {spotlight ? (
          <MatchSpotlight key={spotlight.id} data={spotlight} transparent onDone={dismissSpotlight} />
        ) : null}
      </AnimatePresence>

      {/* reserva entrando al match */}
      <AnimatePresence>
        {subEnter ? (
          <SubEnterOverlay key={subEnter.id} data={subEnter} transparent onDone={dismissSubEnter} />
        ) : null}
      </AnimatePresence>

      {/* podio de campeones (sin botones: lo controla el admin desde la Fase 5) */}
      <AnimatePresence>
        {bracket && showPodium && tournament ? (
          <Podium
            key="podium"
            bracket={bracket}
            tournament={tournament}
            transparent
            hideControls
            onClose={() => {}}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
