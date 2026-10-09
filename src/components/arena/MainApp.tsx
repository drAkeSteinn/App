"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Eye, Loader2, MonitorPlay, Radio, Settings2, Sparkles, Trophy, UserPlus, Clapperboard, Cast } from "lucide-react";
import { ObsStreamDot } from "./ObsStreamPlayer";
import { useBracket, usePlayers, useTournaments } from "@/lib/hooks";
import { useContests } from "@/lib/contestHooks";
import type { Tournament } from "@/lib/types";
import { MODALITY_LABEL, playersCapacity } from "@/lib/types";
import { Backdrop, Emblem, EmptyState, Select } from "./ui";
import { TournamentsView } from "./TournamentsView";
import { RegistrationView } from "./RegistrationView";
import { LiveAdminView } from "./LiveAdminView";
import { ContestsView } from "./ContestsView";
import { CosplayAdmin } from "./CosplayAdmin";
import { SoundAdmin } from "./SoundAdmin";

type Tab = "config" | "registro" | "live" | "concursos";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "config", label: "Configuración", icon: <Settings2 size={13} /> },
  { id: "registro", label: "Registro", icon: <UserPlus size={13} /> },
  { id: "live", label: "Torneo en vivo", icon: <Radio size={13} /> },
  { id: "concursos", label: "Concursos", icon: <Sparkles size={13} /> },
];

export function MainApp() {
  const { data: tournaments, loading, error } = useTournaments();
  const { data: contests } = useContests();
  const [tab, setTab] = useState<Tab>("config");
  const [tidRaw, setTidRaw] = useState<string | null>(null);
  const [adminContestId, setAdminContestId] = useState<string | null>(null);
  /* nonce que pide a Configuración abrir la sección Transmisión OBS */
  const [obsNonce, setObsNonce] = useState(0);

  useEffect(() => {
    const handler = () => {
       
      setTidRaw(localStorage.getItem("arena:lastTid"));
    };
    handler();
  }, []);

  // torneo activo derivado: el guardado si existe, si no el primero
  const tid = useMemo(() => {
    if (tidRaw && tournaments.some((t) => t.id === tidRaw)) return tidRaw;
    return tournaments[0]?.id ?? null;
  }, [tidRaw, tournaments]);

  const setTid = (id: string) => {
    setTidRaw(id);
    try {
      localStorage.setItem("arena:lastTid", id);
    } catch {
      /* ignore */
    }
  };

  const tournament: Tournament | null = useMemo(() => tournaments.find((t) => t.id === tid) ?? null, [tournaments, tid]);
  const { data: players } = usePlayers(tid);
  const playerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of players) {
      if (p.seat === "off") map[tid!] = (map[tid!] ?? 0) + 1;
    }
    return map;
  }, [players, tid]);
  const bankCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of players) {
      if (p.seat === "bank") map[tid!] = (map[tid!] ?? 0) + 1;
    }
    return map;
  }, [players, tid]);

  /* Visor: URL única (/?v=show) — lee el torneo ACTIVO desde Firestore.
     Solo puede haber uno activo a la vez (lo controla el admin desde
     "Torneo en vivo"). La URL nunca cambia, ideal para dejar fija. */
  const openViewer = () => {
    window.open("/?v=show", "_blank", "noopener");
  };

  /* Cards OBS: URL única (/?obs=1) — mismo torneo activo que el visor. */
  const openObsCards = () => {
    window.open("/?obs=1", "_blank", "noopener");
  };

  /* Animaciones OBS: URL única (/?obs=anims) — SOLO las animaciones
     (VS/ganador, reserva que entra, podio) con fondo transparente.
     Sirve para todos los torneos y concursos: la URL nunca cambia. */
  const openObsAnims = () => {
    window.open("/?obs=anims", "_blank", "noopener");
  };

  /* Transmisión OBS: OBS transmite su señal a la app (RTMP o HTTP mpegts)
     y el visor la muestra con el botón "Mostrar transmicion" de la fase 5.
     Este botón salta a la sección de configuración completa (URLs, tamaño
     en píxeles del visor, estado y vista previa). */
  const openObsStream = () => {
    setTab("config");
    setObsNonce((n) => n + 1);
  };

  const goRegister = (id: string) => {
    setTid(id);
    setTab("registro");
  };
  const goLive = (id: string) => {
    setTid(id);
    setTab("live");
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <Backdrop variant="app" />

      {/* ================= HEADER (dos filas) =================
          Fila 1 · utilidades: marca + torneo activo + salidas de
          transmisión (Transmisión OBS · Animaciones OBS · Cards OBS ·
          Visor) con labels visibles desde lg.
          Fila 2 · navegación: las secciones (Configuración · Registro
          · Torneo en vivo · Concursos) repartidas a lo ancho — cada
          tab con su label SIEMPRE visible y buen objetivo táctil,
          sin apiñamiento horizontal. */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070708]/85 backdrop-blur-md">
        {/* ----- fila 1: identidad + torneo + salidas ----- */}
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 h-[58px] flex items-center gap-3 overflow-x-auto no-scrollbar">
          {/* brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Emblem size={30} />
            <div className="leading-none hidden md:block">
              <div className="font-display italic text-[16px] uppercase">
                <span className="text-white">Arena</span> <span className="text-red-grad">Torneos</span>
              </div>
              <div className="text-[8px] font-extrabold tracking-[0.32em] uppercase text-[#6b6e78] mt-1">
                Gestor de torneos gaming
              </div>
            </div>
          </div>

          {/* cluster derecho: torneo activo + salidas de transmisión */}
          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            <Select
              className="w-[150px] xl:w-[190px] min-w-[120px]"
              placeholder="TORNEO…"
              value={tid}
              onChange={setTid}
              options={tournaments.map((t) => ({
                value: t.id,
                label: t.name,
                hint: `${MODALITY_LABEL[t.modality]} · ${playersCapacity(t)} jugadores`,
                logo: t.logo,
              }))}
            />

            {/* dock de salidas: Transmisión OBS · Animaciones OBS · Cards OBS · Visor */}
            <div className="hdr-dock shrink-0" role="group" aria-label="Salidas de transmisión">
              <button
                type="button"
                onClick={openObsStream}
                title="Transmisión OBS — configurar la señal que OBS envía a la app (URLs, tamaño en el visor y estado)"
                aria-label="Configurar la transmisión de OBS"
                className="hdr-ctl clip-tag obs-stream-btn px-3"
              >
                <Cast size={13} />
                <ObsStreamDot pollMs={12000} />
                <span className="hidden lg:inline">Transmisión OBS</span>
              </button>
              <button
                type="button"
                onClick={openObsAnims}
                title="Abrir solo las animaciones para OBS (nueva ventana) — VS, ganador, reserva y podio con el mismo oscurecimiento del visor. URL general para todos los torneos y concursos"
                aria-label="Abrir animaciones de OBS en nueva ventana"
                className="hdr-ctl clip-tag obs-anim-btn px-3"
              >
                <Clapperboard size={13} className="text-[#ffd25e]/85" />
                <span className="hidden lg:inline">Animaciones OBS</span>
              </button>
              <button
                type="button"
                onClick={openObsCards}
                title="Abrir las cards para OBS (nueva ventana) — URL general, sirve para todos los torneos"
                aria-label="Abrir cards de OBS en nueva ventana"
                className="hdr-ctl clip-tag obs-btn px-3"
              >
                <MonitorPlay size={13} className="text-[#ffb3be]/85" />
                <span className="hidden lg:inline">Cards OBS</span>
              </button>
              <button
                type="button"
                onClick={openViewer}
                title="Abrir visor para espectadores (nueva pestaña) — muestra el torneo activo"
                aria-label="Abrir visor para espectadores"
                className="hdr-ctl clip-tag red-badge px-3"
              >
                <Eye size={13} />
                <span className="hidden sm:inline">Visor</span>
                <ExternalLink size={10} className="opacity-60 hidden lg:inline" />
              </button>
            </div>
          </div>
        </div>

        {/* ----- fila 2: navegación de secciones (labels siempre visibles) ----- */}
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
          <nav className="hdr-dock w-full overflow-x-auto no-scrollbar" aria-label="Secciones">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`hdr-ctl clip-tag tab-btn flex-1 px-3 ${
                  tab === t.id
                    ? "active"
                    : "text-[#8e919c] hover:text-white bg-white/[0.03] hover:bg-white/[0.07]"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* barra roja inferior decorativa */}
        <div className="h-[2px] bg-[linear-gradient(90deg,#ff2440,#6e0a1a_40%,transparent_75%)]" aria-hidden />
      </header>

      {/* ================= CONTENIDO ================= */}
      <main className="flex-1 mx-auto w-full max-w-[1500px] px-4 sm:px-6 py-6 sm:py-8">
        {error ? (
          <div className="panel clip-card p-4 mb-6 border-[#e8102e]/60 bg-[#e8102e]/10">
            <p className="text-[12px] font-extrabold text-[#ff8095] uppercase tracking-wider mb-1">
              No se pudo conectar con Firebase
            </p>
            <p className="text-[11px] font-semibold text-[#c9cbd3]">
              Verifica que Firestore esté creado en el proyecto <span className="text-white">torneos-6cd4b</span> y que las
              reglas permitan lectura/escritura. Error: {error}
            </p>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-32 text-[#8e919c]">
            <Loader2 size={26} className="animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {tournaments.length === 0 && tab !== "config" && tab !== "concursos" ? (
                <div className="panel clip-card">
                  <EmptyState
                    icon={<Trophy size={26} />}
                    title="Primero crea un torneo"
                    message="Ve a la sección Configuración y crea tu primer torneo para habilitar el registro de jugadores y el modo en vivo."
                    action={
                      <button
                        type="button"
                        onClick={() => setTab("config")}
                        className="btn-press clip-btn red-badge px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.14em]"
                      >
                        Ir a configuración
                      </button>
                    }
                  />
                </div>
              ) : tab === "config" ? (
                <TournamentsView
                  tournaments={tournaments}
                  loading={loading}
                  error={null}
                  playerCounts={playerCounts}
                  bankCounts={bankCounts}
                  onGoRegister={goRegister}
                  onGoLive={goLive}
                  onOpenViewer={openViewer}
                  obsNonce={obsNonce}
                />
              ) : tab === "registro" ? (
                <RegistrationView tournament={tournament} players={players} loading={false} />
              ) : tab === "concursos" ? (
                adminContestId ? (
                  (() => {
                    const c = contests.find((x) => x.id === adminContestId);
                    if (!c) {
                      return (
                        <div className="panel clip-card">
                          <EmptyState
                            icon={<Sparkles size={26} />}
                            title="Concurso no encontrado"
                            message="El concurso que buscas ya no existe."
                            action={
                              <button
                                type="button"
                                onClick={() => setAdminContestId(null)}
                                className="btn-press clip-btn red-badge px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.14em]"
                              >
                                Volver a concursos
                              </button>
                            }
                          />
                        </div>
                      );
                    }
                    return c.type === "cosplay" ? (
                      <CosplayAdmin contest={c} onClose={() => setAdminContestId(null)} />
                    ) : (
                      <SoundAdmin contest={c} onClose={() => setAdminContestId(null)} />
                    );
                  })()
                ) : (
                  <ContestsView
                    onAdmin={(cid) => setAdminContestId(cid)}
                    onViewer={openViewer}
                  />
                )
              ) : (
                <LiveAdminContainer tid={tid} tournament={tournament} players={players} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="mt-auto relative z-10 border-t border-white/10 bg-black/60">
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 h-12 flex items-center gap-4">
          <span className="slashes w-8 h-3 inline-block" aria-hidden />
          <span className="text-[9px] font-extrabold tracking-[0.3em] uppercase text-[#6b6e78]">
            Arena Torneos — Juega · Compite · Conecta
          </span>
          <span className="ml-auto flex items-center gap-2">
            {tournament?.status === "live" ? (
              <span className="chip clip-tag bg-[#e8102e]/15 text-[#ff8095] border border-[#e8102e]/40 text-[8px]">
                <span className="w-1.5 h-1.5 bg-[#ff2440] blink" aria-hidden />
                {tournament.name} en vivo
              </span>
            ) : (
              <span className="text-[9px] font-extrabold tracking-[0.3em] uppercase text-[#3f414a]">We&apos;re all gamers</span>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}

/* Contenedor que carga bracket para la vista en vivo */
function LiveAdminContainer({
  tid,
  tournament,
  players,
}: {
  tid: string | null;
  tournament: Tournament | null;
  players: import("@/lib/types").Player[];
}) {
  const { data: bracket, loading } = useBracket(tid);
  return (
    <LiveAdminView tournament={tournament} players={players} bracket={bracket} loadingBracket={loading} />
  );
}
