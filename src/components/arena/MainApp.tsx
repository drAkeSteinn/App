"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Eye, Loader2, MonitorPlay, Radio, Settings2, Trophy, UserPlus } from "lucide-react";
import { useBracket, usePlayers, useTournaments } from "@/lib/hooks";
import type { Tournament } from "@/lib/types";
import { MODALITY_LABEL, playersCapacity } from "@/lib/types";
import { Backdrop, Emblem, EmptyState, Select } from "./ui";
import { TournamentsView } from "./TournamentsView";
import { RegistrationView } from "./RegistrationView";
import { LiveAdminView } from "./LiveAdminView";

type Tab = "config" | "registro" | "live";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "config", label: "Configuración", icon: <Settings2 size={13} /> },
  { id: "registro", label: "Registro", icon: <UserPlus size={13} /> },
  { id: "live", label: "Torneo en vivo", icon: <Radio size={13} /> },
];

export function MainApp() {
  const { data: tournaments, loading, error } = useTournaments();
  const [tab, setTab] = useState<Tab>("config");
  const [tidRaw, setTidRaw] = useState<string | null>(null);

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

  const openViewer = (id: string) => {
    window.open(`/?v=show&t=${id}`, "_blank", "noopener");
  };

  /* Cards OBS: web GENERAL (sin id de torneo) — la URL es siempre la misma
     y el overlay resuelve el torneo activo, ideal para el Browser Source. */
  const openObsCards = () => {
    window.open("/?obs=1", "_blank", "noopener");
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

      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070708]/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 h-[64px] flex items-center gap-3 sm:gap-5 overflow-x-auto sm:overflow-x-visible no-scrollbar">
          {/* brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Emblem size={34} />
            <div className="leading-none hidden sm:block">
              <div className="font-display italic text-[17px] uppercase">
                <span className="text-white">Arena</span> <span className="text-red-grad">Torneos</span>
              </div>
              <div className="text-[8px] font-extrabold tracking-[0.32em] uppercase text-[#6b6e78] mt-1">
                Gestor de torneos gaming
              </div>
            </div>
          </div>

          {/* nav tabs */}
          <nav className="flex items-center gap-1 p-1 bg-black/40 border border-white/10 overflow-x-auto" aria-label="Secciones">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`tab-btn clip-tag px-3 sm:px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] whitespace-nowrap flex items-center gap-1.5 ${
                  tab === t.id ? "active" : "text-[#8e919c] hover:text-white"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>

          {/* selector torneo + visor */}
          <div className="ml-auto flex items-center gap-2 min-w-0">
            <Select
              compact
              className="w-[150px] sm:w-[230px]"
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
            <button
              type="button"
              onClick={openObsCards}
              title="Abrir las cards para OBS (nueva ventana) — URL general, sirve para todos los torneos"
              aria-label="Abrir cards de OBS en nueva ventana"
              className="btn-press clip-btn obs-btn px-3 sm:px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em] flex items-center gap-1.5"
            >
              <MonitorPlay size={13} />
              <span className="hidden md:inline">Cards OBS</span>
              <ExternalLink size={10} />
            </button>
            <button
              type="button"
              onClick={() => tid && openViewer(tid)}
              disabled={!tid}
              title="Abrir visor para espectadores (nueva pestaña)"
              aria-label="Abrir visor para espectadores"
              className="btn-press clip-btn red-badge px-3 sm:px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em] flex items-center gap-1.5 disabled:opacity-40"
            >
              <Eye size={13} />
              <span className="hidden sm:inline">Visor</span>
              <ExternalLink size={10} />
            </button>
          </div>
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
              {tournaments.length === 0 && tab !== "config" ? (
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
                />
              ) : tab === "registro" ? (
                <RegistrationView tournament={tournament} players={players} loading={false} />
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
