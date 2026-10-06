"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Crown, Hand, Music, Trophy, Users, Volume2 } from "lucide-react";
import type { Contest, Participant } from "@/lib/contests";
import { useContestState, useParticipants, useSounds } from "@/lib/contestHooks";
import { useActiveTournament } from "@/lib/activeTournament";
import { FitLine } from "./MatchSpotlight";
import { Backdrop } from "./ui";

/* ============================================================
   ContestViewer — visor de concursos para proyección.
   · Cosplay: muestra el participante aplaudido en grande.
   · Sound: split top/bottom — arriba sonido+imagen+respuesta,
     abajo marcador con cards grandes de jugadores.
   ============================================================ */

function ShowBackground() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden>
      <img src="/Background.jpg" alt="" draggable={false} className="w-full h-full object-cover" />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(115% 85% at 50% 38%, rgba(7,7,8,0.4) 0%, rgba(7,7,8,0.72) 60%, rgba(7,7,8,0.9) 100%)",
        }}
      />
    </div>
  );
}

/* ---------- Cosplay spotlight ---------- */

function CosplaySpotlight({
  nick,
  name,
  isWinner,
}: {
  nick: string;
  name: string;
  isWinner: boolean;
}) {
  useEffect(() => {
    if (!isWinner) return;
    const colors = ["#ffb830", "#ffe9b0", "#ffffff"];
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 }, colors, disableForReducedMotion: true });
    const iv = setInterval(() => {
      confetti({ particleCount: 30, spread: 90, origin: { x: 0.2 + Math.random() * 0.6, y: 0.3 }, colors, disableForReducedMotion: true });
    }, 1800);
    return () => clearInterval(iv);
  }, [isWinner]);

  return (
    <motion.div
      key={nick}
      initial={{ opacity: 0, scale: 0.5, y: 60 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -30 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="flex flex-col items-center gap-6 sm:gap-10 px-5"
    >
      {/* tag grande — ¡RUIDO! o Ganador, con slashes 3x más grandes */}
      <motion.div
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-5"
      >
        <span className="slashes w-28 h-10 inline-block" aria-hidden />
        <motion.span
          animate={isWinner ? {} : { scale: [1, 1.06, 1] }}
          transition={isWinner ? {} : { duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
          className={`chip clip-tag ${isWinner ? "bg-[#ffb830] text-[#241500]" : "bg-[#e8102e] text-white"} text-[28px] sm:text-[36px] font-extrabold tracking-[0.3em] uppercase px-8 py-4 flex items-center gap-3 live-glow`}
        >
          {isWinner ? <Crown size={28} /> : <Hand size={28} />}
          {isWinner ? "¡Ganador!" : "¡Ruido!"}
        </motion.span>
        <span className="slashes w-28 h-10 inline-block" aria-hidden />
      </motion.div>

      {/* nick — con animación de zoom in/out + shake cuando se aplaude */}
      <motion.div
        animate={isWinner ? {} : { scale: [1, 1.08, 1], x: [0, -3, 3, -2, 2, 0] }}
        transition={isWinner ? {} : { duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <FitLine>
          <span
            className="font-display italic uppercase leading-[0.9] whitespace-nowrap text-silver-grad glitch-in"
            style={{ fontSize: "clamp(40px, 8vw, 110px)" }}
          >
            {nick}
          </span>
        </FitLine>
      </motion.div>

      {name ? (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.4 }}
          className="text-[16px] sm:text-[22px] font-bold tracking-[0.2em] uppercase text-[#c9cbd3]"
        >
          {name}
        </motion.span>
      ) : null}

      {/* ondas de aplauso más grandes */}
      {!isWinner ? (
        <div className="flex items-center gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              className="w-5 h-5 rounded-full bg-[#ffb830]"
              animate={{ scale: [1, 1.8, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
            />
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

/* ---------- Cosplay grid ---------- */

function CosplayGrid({ participants }: { participants: Participant[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-6 w-full max-w-6xl px-5"
    >
      {/* título PARTICIPANTES — 3x más grande */}
      <div className="flex items-center gap-5">
        <span className="slashes w-24 h-9 inline-block" aria-hidden />
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display italic uppercase leading-none text-silver-grad"
          style={{ fontSize: "clamp(28px, 4vw, 48px)" }}
        >
          Participantes
        </motion.h2>
        <span className="slashes w-24 h-9 inline-block" aria-hidden />
      </div>

      {participants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <Hand size={48} className="text-[#6b6e78]" />
          <p className="text-[14px] font-bold tracking-[0.16em] uppercase text-[#6b6e78]">
            Sin participantes registrados
          </p>
        </div>
      ) : (
        <>
          {/* grid de cards */}
          <div
            className="grid gap-4 w-full justify-items-center"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 260px), 1fr))`,
              maxWidth: "1200px",
            }}
          >
            {participants.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.6) }}
                className="panel clip-card-sm w-full p-5 flex flex-col items-center gap-3 text-center"
              >
                <span className="w-12 h-12 shrink-0 clip-badge bg-[#e8102e] flex items-center justify-center font-display italic text-[18px] text-white">
                  {i + 1}
                </span>
                <FitLine>
                  <span className="font-display italic uppercase text-silver-grad leading-none" style={{ fontSize: "clamp(18px, 2.4vw, 30px)" }}>
                    {p.nick}
                  </span>
                </FitLine>
                {p.name ? (
                  <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#8e919c] truncate w-full">
                    {p.name}
                  </span>
                ) : null}
              </motion.div>
            ))}
          </div>
          {/* contador DEBAJO de las cards */}
          <p className="text-[14px] sm:text-[16px] font-extrabold tracking-[0.22em] uppercase text-[#8e919c] text-center mt-2">
            {participants.length} {participants.length === 1 ? "participante" : "participantes"} en concurso
          </p>
        </>
      )}
    </motion.div>
  );
}

/* ---------- Sound: visualizador de ondas real (AnalyserNode) ---------- */

/** Visualizador de audio que reacciona al sonido REAL usando Web Audio API.
    Cada barra mide la amplitud de una banda de frecuencia del audio en vivo. */
function LiveWaveform({ audioEl }: { audioEl: HTMLAudioElement | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!audioEl) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    try {
      ctx = new AC();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source = ctx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(ctx.destination);
    } catch {
      return;
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext("2d");
    if (!c2d) return;

    const BARS = 24;
    const draw = () => {
      if (!analyser || !c2d) return;
      analyser.getByteFrequencyData(data);
      const w = canvas.width;
      const h = canvas.height;
      c2d.clearRect(0, 0, w, h);
      const barW = w / BARS;
      for (let i = 0; i < BARS; i++) {
        // mapear los bins del analyser a las barras
        const idx = Math.floor((i / BARS) * data.length);
        const val = data[idx] / 255; // 0-1
        const barH = Math.max(3, val * h * 0.95);
        const x = i * barW;
        const y = (h - barH) / 2;
        // gradiente rojo→dorado
        const grad = c2d.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, "#ff2440");
        grad.addColorStop(1, "#ffb830");
        c2d.fillStyle = grad;
        c2d.fillRect(x + 1, y, barW - 2, barH);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      try {
        source?.disconnect();
        analyser?.disconnect();
        ctx?.close();
      } catch {
        /* ignore */
      }
    };
  }, [audioEl]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={64}
      className="w-full max-w-[400px] h-12 sm:h-16"
      style={{ imageRendering: "auto" }}
    />
  );
}

/* ---------- Sound: ganador coronado — animación llamativa ---------- */

function SoundWinner({ nick, score }: { nick: string; score: number }) {
  useEffect(() => {
    const colors = ["#ffb830", "#ffe9b0", "#ffffff", "#ff2440"];
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.45 }, colors, disableForReducedMotion: true });
    const iv = setInterval(() => {
      confetti({ particleCount: 34, spread: 95, origin: { x: 0.15 + Math.random() * 0.7, y: 0.25 }, colors, disableForReducedMotion: true });
    }, 1600);
    return () => clearInterval(iv);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="flex flex-col items-center gap-4 sm:gap-6 px-5"
    >
      {/* tag GANADOR */}
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-5"
      >
        <span className="slashes w-24 h-9 inline-block" aria-hidden />
        <span className="chip clip-tag bg-[#ffb830] text-[#241500] text-[24px] sm:text-[30px] font-extrabold tracking-[0.3em] uppercase px-7 py-3.5 flex items-center gap-3 live-glow">
          <Crown size={26} />
          ¡Ganador!
        </span>
        <span className="slashes w-24 h-9 inline-block" aria-hidden />
      </motion.div>

      {/* trophy con pulso */}
      <motion.div
        animate={{ scale: [1, 1.12, 1], filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Trophy size={56} className="text-[#ffb830]" style={{ filter: "drop-shadow(0 0 26px rgba(255,184,48,0.7))" }} />
      </motion.div>

      {/* nick en GRANDE */}
      <FitLine>
        <span
          className="font-display italic uppercase leading-[0.9] whitespace-nowrap text-silver-grad glitch-in"
          style={{ fontSize: "clamp(36px, 7vw, 96px)" }}
        >
          {nick}
        </span>
      </FitLine>

      {/* score */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex items-center gap-3"
      >
        <span className="text-[11px] font-extrabold tracking-[0.28em] uppercase text-[#8e919c]">
          Puntos
        </span>
        <span className="font-display italic text-[#ffb830] tabular-nums leading-none" style={{ fontSize: "clamp(28px, 4vw, 52px)" }}>
          {score}
        </span>
      </motion.div>

      {/* ondas doradas de celebración */}
      <div className="flex items-center gap-2 mt-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="w-3 h-3 rounded-full bg-[#ffb830]"
            animate={{ scale: [1, 1.6, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- Sound: zona superior (sonido + imagen + respuesta) ---------- */

function SoundStage({
  question,
  answer,
  image,
  revealAnswer,
  revealQuestion,
  audioEl,
  soundActive,
}: {
  question: string;
  answer: string;
  image: string | null;
  revealAnswer: boolean;
  revealQuestion: boolean;
  audioEl: HTMLAudioElement | null;
  soundActive: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 px-5 w-full">
      {/* tag SONANDO — más grande, solo cuando el audio está realmente activo */}
      {soundActive ? (
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="chip clip-tag bg-[#e8102e] text-white text-[22px] sm:text-[28px] font-extrabold tracking-[0.3em] uppercase px-8 py-4 flex items-center gap-3 live-glow"
        >
          <span className="w-3.5 h-3.5 bg-white rounded-full blink" />
          Sonando
        </motion.span>
      ) : null}

      {/* visualizador de ondas real — solo cuando el audio está activo y no se revela respuesta */}
      {soundActive && !revealAnswer ? (
        <LiveWaveform audioEl={audioEl} />
      ) : null}

      {/* pregunta — cuando hay sonido activo o se pidió mostrar, y no se revela respuesta */}
      {(soundActive || revealQuestion) && !revealAnswer ? (
        <FitLine>
          <span className="font-display italic uppercase text-silver-grad" style={{ fontSize: "clamp(18px, 3vw, 38px)" }}>
            {question}
          </span>
        </FitLine>
      ) : null}

      {/* RESPUESTA REVELADA — imagen + nombre del juego */}
      <AnimatePresence>
        {revealAnswer ? (
          <motion.div
            key="answer"
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="flex flex-col items-center gap-4"
          >
            <span className="chip clip-tag bg-[#ffb830] text-[#241500] text-[18px] sm:text-[22px] font-extrabold tracking-[0.26em] uppercase px-6 py-3">
              Respuesta
            </span>
            {image ? (
              <div className="w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44 clip-card-sm border-2 border-[#ffb830] overflow-hidden shadow-[0_0_40px_rgba(255,184,48,0.55)]">
                <img src={image} alt={answer} className="w-full h-full object-cover" />
              </div>
            ) : null}
            <FitLine>
              <span
                className="font-display italic uppercase text-silver-grad leading-none"
                style={{ fontSize: "clamp(28px, 6vw, 72px)" }}
              >
                {answer}
              </span>
            </FitLine>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Sound: idle (sin sonido) — branding HyperX ---------- */

function SoundIdle({ isFinished }: { isFinished: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-6 text-center px-5"
    >
      {isFinished ? (
        <>
          <Trophy size={56} className="text-[#ffb830]" style={{ filter: "drop-shadow(0 0 20px rgba(255,184,48,0.5))" }} />
          <p className="text-[18px] font-bold tracking-[0.22em] uppercase text-[#8e919c]">
            Concurso finalizado
          </p>
        </>
      ) : (
        <>
          {/* logo HyperX — más grande con glow */}
          <motion.div
            animate={{ opacity: [0.65, 1, 0.65], scale: [0.97, 1.03, 0.97] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center"
          >
            <img
              src="/hyperlogo.png"
              alt="HyperX"
              className="w-full h-full object-contain"
              style={{ filter: "drop-shadow(0 0 28px rgba(232,16,46,0.5))" }}
            />
          </motion.div>
          <div className="flex flex-col items-center gap-3">
            <motion.h2
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              className="font-display italic uppercase leading-none text-silver-grad"
              style={{ fontSize: "clamp(28px, 5vw, 56px)" }}
            >
              ¿Qué tan gamer eres?
            </motion.h2>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="text-[16px] sm:text-[22px] font-extrabold tracking-[0.3em] uppercase text-red-grad"
            >
              Demuéstralo con HyperX
            </motion.p>
          </div>
          {/* puntos pulsantes más grandes */}
          <div className="flex items-center gap-3 mt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="w-3 h-3 rounded-full bg-[#e8102e]"
                animate={{ scale: [0.5, 1.3, 0.5], opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ---------- Sound: zona inferior (marcador con cards grandes) ---------- */

function LeaderCard({
  p,
  rank,
  isWinner,
}: {
  p: Participant;
  rank: number;
  isWinner: boolean;
}) {
  const prevScore = useRef(p.score);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (p.score > prevScore.current) {
      prevScore.current = p.score;
      const r = requestAnimationFrame(() => setFlash(true));
      const t = setTimeout(() => setFlash(false), 1200);
      return () => {
        cancelAnimationFrame(r);
        clearTimeout(t);
      };
    }
    prevScore.current = p.score;
  }, [p.score]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`clip-card-sm px-4 py-3 flex items-center gap-3 transition-all relative overflow-hidden ${
        flash
          ? "bg-[linear-gradient(160deg,rgba(255,184,48,0.3),rgba(255,184,48,0.08))] border border-[#ffb830]"
          : isWinner
            ? "bg-[linear-gradient(160deg,rgba(255,184,48,0.2),rgba(255,184,48,0.05))] border border-[#ffb830]/60"
            : rank === 0
              ? "bg-white/[0.08] border border-white/12"
              : "bg-black/40 border border-white/8"
      }`}
    >
      {flash ? (
        <>
          <motion.div
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(255,184,48,0.35),transparent_70%)] pointer-events-none"
          />
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: [0, 1, 0], y: -20 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute right-3 top-0 font-display italic text-[#ffb830] text-[14px] font-extrabold pointer-events-none"
          >
            +1
          </motion.div>
        </>
      ) : null}
      <span className={`w-9 h-9 shrink-0 clip-badge flex items-center justify-center font-display italic text-[16px] ${rank === 0 ? "bg-[#ffb830] text-[#241500]" : "bg-black/40 border border-white/10 text-[#8e919c]"}`}>
        {rank + 1}
      </span>
      <div className="min-w-0 flex-1">
        <FitLine>
          <span className="font-display italic uppercase text-white truncate block" style={{ fontSize: "clamp(15px, 1.8vw, 22px)" }}>
            {p.nick}
          </span>
        </FitLine>
      </div>
      {isWinner ? <Crown size={18} className="text-[#ffb830] shrink-0" /> : null}
      <span
        key={p.score}
        className={`font-display italic tabular-nums leading-none ${flash ? "text-[#ffe9b0] obs-score-pop" : "text-[#ffb830]"}`}
        style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
      >
        {p.score}
      </span>
    </motion.div>
  );
}

function SoundLeaderboard({ participants, winnerPid }: { participants: Participant[]; winnerPid: string | null }) {
  const sorted = useMemo(
    () => [...participants].sort((a, b) => b.score - a.score),
    [participants]
  );
  if (sorted.length === 0) return null;
  return (
    <div className="w-full h-full flex flex-col">
      <div className="label-cap mb-2 flex items-center gap-2 shrink-0">
        <Trophy size={13} className="text-[#ffb830]" />
        Marcador
        <span className="text-[#6b6e78]">· {sorted.length} jugadores</span>
      </div>
      <div
        className="grid gap-2 flex-1 content-center"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 180px), 1fr))`,
        }}
      >
        {sorted.map((p, i) => (
          <LeaderCard key={p.id} p={p} rank={i} isWinner={winnerPid === p.id} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */

export function ContestViewer() {
  const { contest } = useActiveTournament();
  const { data: participants } = useParticipants(contest?.id ?? null);
  const { data: sounds } = useSounds(contest?.id ?? null);
  const state = useContestState(contest?.id ?? null);

  /* ---- Audio: se reproduce una vez. El visor detecta cuando termina
     y actualiza `soundActive` localmente (no depende de Firestore). ---- */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [soundActive, setSoundActive] = useState(false);

  const currentSoundId = state?.currentSoundId ?? null;
  const fsSoundPlaying = state?.soundPlaying ?? false;
  const currentSound = useMemo(() => {
    if (!currentSoundId || !sounds.length) return null;
    return sounds.find((s) => s.id === currentSoundId) ?? null;
  }, [currentSoundId, sounds]);
  const currentSoundData = currentSound?.data ?? null;

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      // si no hay sonido o Firestore dice que no está sonando → limpiar
      if (!currentSoundData || !fsSoundPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        setAudioEl(null);
        setSoundActive(false);
        return;
      }
      // recrear el Audio → suena una vez desde el inicio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(currentSoundData);
      audio.loop = false;
      audio.onended = () => {
        // el audio terminó naturalmente → el visor deja de mostrar "Sonando"
        setSoundActive(false);
        setAudioEl(null);
      };
      audio.play().then(() => {
        setSoundActive(true);
        setAudioEl(audio);
      }).catch(() => {
        setSoundActive(false);
      });
      audioRef.current = audio;
    });
    return () => {
      cancelAnimationFrame(raf);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setAudioEl(null);
      setSoundActive(false);
    };
  }, [currentSoundData, fsSoundPlaying]);

  if (!contest) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#070708" }}>
        <ShowBackground />
        <div className="relative z-10 text-center px-6">
          <span className="text-[11px] font-extrabold tracking-[0.5em] uppercase text-[#ff8095]">Visor de concursos</span>
          <h1 className="font-display italic text-[34px] sm:text-[44px] uppercase leading-none mt-3">
            <span className="text-silver-grad">Esperando</span> <span className="text-red-grad">concurso</span>
          </h1>
          <p className="text-[12px] font-bold tracking-[0.16em] uppercase text-[#8e919c] mt-6">
            El administrador debe abrir un concurso
          </p>
        </div>
      </div>
    );
  }

  const isCosplay = contest.type === "cosplay";
  const isSound = contest.type === "sound";
  const spotlightPid = state?.spotlightPid ?? null;
  const spotlight = participants.find((p) => p.id === spotlightPid) ?? null;
  const winner = contest.winnerPid ? participants.find((p) => p.id === contest.winnerPid) : null;
  const isFinished = contest.status === "finished";
  const revealAnswer = state?.revealAnswer ?? false;
  const revealQuestion = state?.revealQuestion ?? false;

  /* El visor muestra el SoundStage cuando: hay sonido activo (realmente
     reproduciéndose), o se pidió mostrar la pregunta, o se reveló la
     respuesta. Si no → muestra el idle con branding HyperX. */
  const showStage = soundActive || revealQuestion || revealAnswer;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#070708" }}>
      <Backdrop variant="show" />
      <ShowBackground />

      {/* header con TÍTULO GRANDE del concurso */}
      <header className="relative z-20 shrink-0 border-b border-white/10 bg-black/55 backdrop-blur-md flex flex-col items-center justify-center py-3 px-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[9px] sm:text-[10px] font-extrabold tracking-[0.4em] uppercase text-[#ffb830]">
            {isCosplay ? "Concurso Cosplayer" : "Sonidos Gamer"}
          </span>
          <span className={`chip clip-tag ${isFinished ? "bg-[#ffb830] text-[#241500]" : contest.status === "live" ? "bg-[#e8102e] text-white" : "bg-white/[0.06] text-[#c9cbd3] border border-white/10"} !text-[8px] !px-2 !py-[2px]`}>
            {isFinished ? "FINALIZADO" : contest.status === "live" ? "EN VIVO" : "REGISTRO"}
          </span>
        </div>
        <FitLine>
          <h1 className="font-display italic uppercase leading-none text-silver-grad" style={{ fontSize: "clamp(22px, 3.5vw, 40px)" }}>
            {contest.name}
          </h1>
        </FitLine>
        <div className="flex items-center gap-3 mt-1.5 text-[9px] font-bold tracking-[0.2em] uppercase text-[#6b6e78]">
          <span className="flex items-center gap-1">
            <Users size={11} />
            {participants.length}
          </span>
          {isSound ? (
            <span className="flex items-center gap-1">
              <Music size={11} />
              {sounds.length} sonidos
            </span>
          ) : null}
        </div>
      </header>

      {/* cuerpo */}
      <main className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
        {isCosplay ? (
          <div className="flex-1 min-h-0 flex items-center justify-center py-4 overflow-y-auto">
            <AnimatePresence mode="wait">
              {winner ? (
                <CosplaySpotlight key="winner" nick={winner.nick} name={winner.name} isWinner />
              ) : spotlight ? (
                <CosplaySpotlight key={spotlight.id} nick={spotlight.nick} name={spotlight.name} isWinner={false} />
              ) : (
                <CosplayGrid key="grid" participants={participants.filter((p) => !p.eliminated)} />
              )}
            </AnimatePresence>
          </div>
        ) : null}

        {isSound ? (
          <>
            {/* ZONA SUPERIOR (50%): ganador / sonido + imagen + respuesta / idle */}
            <div className="flex-[1_1_50%] min-h-0 flex items-center justify-center p-4 border-b border-white/8">
              <AnimatePresence mode="wait">
                {winner ? (
                  <SoundWinner key="winner" nick={winner.nick} score={winner.score} />
                ) : showStage && currentSound ? (
                  <SoundStage
                    key="stage"
                    question={currentSound.question}
                    answer={currentSound.answer}
                    image={currentSound.image}
                    revealAnswer={revealAnswer}
                    revealQuestion={revealQuestion}
                    audioEl={audioEl}
                    soundActive={soundActive}
                  />
                ) : (
                  <SoundIdle key="idle" isFinished={isFinished} />
                )}
              </AnimatePresence>
            </div>
            {/* ZONA INFERIOR (50%): marcador con cards grandes */}
            <div className="flex-[1_1_50%] min-h-0 p-4 overflow-y-auto">
              <SoundLeaderboard participants={participants} winnerPid={contest.winnerPid} />
            </div>
          </>
        ) : null}
      </main>

      {/* footer */}
      <footer className="relative z-20 shrink-0 h-9 border-t border-white/10 bg-black/70 flex items-center justify-center">
        <span className="text-[9px] font-extrabold tracking-[0.3em] uppercase text-[#6b6e78]">
          {isCosplay ? "Concurso Cosplayer · aplausos del público" : "Sonidos Gamer · adivina el juego"}
        </span>
      </footer>
    </div>
  );
}
