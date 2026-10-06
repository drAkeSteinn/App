"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { fdb } from "./firebase";

/* ============================================================
   Sistema de SONIDOS personalizados.
   · Configuración global (compartida por todos los torneos)
     almacenada en Firestore, colección `sounds`, un doc por
     evento: sounds/{eventId} = { data, type, updatedAt }.
   · Cada evento tiene un sonido por defecto SINTETIZADO con
     Web Audio API (siempre disponible, sin archivos) que el
     usuario puede reemplazar subiendo un .mp3/.wav.
   · Reproducción: playSound(event) → si hay override cargado
     lo reproduce, si no sintetiza el default.
   ============================================================ */

export type SoundEvent =
  | "scoreUp"
  | "winner"
  | "matchLive"
  | "bankSwap"
  | "tournamentFinish"
  | "mixLaunch"
  | "mixPlace";

export interface SoundMeta {
  id: SoundEvent;
  label: string;
  desc: string;
  icon: string; // emoji o símbolo
}

export const SOUND_EVENTS: SoundMeta[] = [
  { id: "scoreUp", label: "Subir marcador", desc: "Al sumar una victoria a un jugador", icon: "▲" },
  { id: "winner", label: "Ganador marcado", desc: "Al definir al ganador de un match", icon: "🏆" },
  { id: "matchLive", label: "Match en juego", desc: "Al poner un match en juego (EN VIVO)", icon: "🔴" },
  { id: "bankSwap", label: "Cambio del banco", desc: "Al entrar un reserva del banco al bracket", icon: "🔁" },
  { id: "mixLaunch", label: "Lanzar mix", desc: "Al lanzar el mix match (sorteo)", icon: "🎲" },
  { id: "mixPlace", label: "Jugador colocado (mix)", desc: "Al fijarse cada jugador en el bracket durante el mix", icon: "✦" },
  { id: "tournamentFinish", label: "Finalizar torneo", desc: "Al finalizar el torneo (podio)", icon: "👑" },
];

export type SoundMap = Partial<Record<SoundEvent, { data: string; type: string }>>;

const soundsCol = (eventId: string) => doc(fdb, "sounds", eventId);

/** Hook: carga todos los overrides de sonidos desde Firestore. */
export function useSounds() {
  const [sounds, setSounds] = useState<SoundMap>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const unsubs = SOUND_EVENTS.map((ev) =>
      onSnapshot(
        soundsCol(ev.id),
        (snap) => {
          if (!alive) return;
          setSounds((prev) => {
            const next = { ...prev };
            if (snap.exists()) {
              const d = snap.data() as { data: string; type: string };
              next[ev.id] = { data: d.data, type: d.type };
            } else {
              delete next[ev.id];
            }
            return next;
          });
        },
        () => {}
      )
    );
    const r = requestAnimationFrame(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(r);
      unsubs.forEach((u) => u());
    };
  }, []);
  return { sounds, loading };
}

/** Sube (o reemplaza) el sonido de un evento. dataUrl = data URL del archivo. */
export async function saveSound(event: SoundEvent, dataUrl: string, type: string) {
  await setDoc(soundsCol(event), { data: dataUrl, type, updatedAt: Date.now() });
}

/** Elimina el override de un evento (vuelve al default sintetizado). */
export async function removeSound(event: SoundEvent) {
  await deleteDoc(soundsCol(event));
}

/* ============================================================
   Síntesis por defecto (Web Audio API).
   Cada evento tiene un stinger distintivo — estilo arcade/ESports.
   ============================================================ */

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

interface ToneOpts {
  freq: number;
  to?: number; // glissando
  type?: OscillatorType;
  start: number;
  dur: number;
  gain?: number;
}

function tone(ac: AudioContext, o: ToneOpts) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, ac.currentTime + o.start);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), ac.currentTime + o.start + o.dur);
  const peak = o.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, ac.currentTime + o.start);
  g.gain.exponentialRampToValueAtTime(peak, ac.currentTime + o.start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + o.start + o.dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(ac.currentTime + o.start);
  osc.stop(ac.currentTime + o.start + o.dur + 0.02);
}

function noise(ac: AudioContext, start: number, dur: number, gain: number, filterFreq: number) {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(ac.currentTime + start);
  src.stop(ac.currentTime + start + dur + 0.02);
}

function synthDefault(event: SoundEvent) {
  const ac = ctx();
  if (!ac) return;
  switch (event) {
    case "scoreUp":
      // blip ascendente corto
      tone(ac, { freq: 523, to: 880, type: "triangle", start: 0, dur: 0.12, gain: 0.2 });
      tone(ac, { freq: 1046, type: "sine", start: 0.04, dur: 0.1, gain: 0.12 });
      break;
    case "winner":
      // arpeggio mayor triunfal
      tone(ac, { freq: 523, type: "sawtooth", start: 0, dur: 0.14, gain: 0.16 });
      tone(ac, { freq: 659, type: "sawtooth", start: 0.1, dur: 0.14, gain: 0.16 });
      tone(ac, { freq: 784, type: "sawtooth", start: 0.2, dur: 0.14, gain: 0.16 });
      tone(ac, { freq: 1046, type: "sawtooth", start: 0.3, dur: 0.32, gain: 0.2 });
      tone(ac, { freq: 1318, type: "sine", start: 0.3, dur: 0.32, gain: 0.12 });
      break;
    case "matchLive":
      // golpe tenso + baja
      tone(ac, { freq: 180, to: 90, type: "square", start: 0, dur: 0.28, gain: 0.22 });
      noise(ac, 0, 0.18, 0.12, 220);
      tone(ac, { freq: 330, type: "sine", start: 0.06, dur: 0.16, gain: 0.1 });
      break;
    case "bankSwap":
      // swoosh intercambio
      noise(ac, 0, 0.22, 0.14, 800);
      tone(ac, { freq: 440, to: 1100, type: "sine", start: 0.04, dur: 0.18, gain: 0.12 });
      tone(ac, { freq: 1100, to: 440, type: "sine", start: 0.12, dur: 0.16, gain: 0.1 });
      break;
    case "mixLaunch":
      // boom dramático
      tone(ac, { freq: 120, to: 50, type: "sine", start: 0, dur: 0.5, gain: 0.28 });
      noise(ac, 0, 0.4, 0.18, 150);
      tone(ac, { freq: 240, type: "sawtooth", start: 0.02, dur: 0.3, gain: 0.12 });
      break;
    case "mixPlace":
      // tick de colocación (corto, alto)
      tone(ac, { freq: 1320, type: "triangle", start: 0, dur: 0.05, gain: 0.14 });
      tone(ac, { freq: 1760, type: "sine", start: 0.02, dur: 0.04, gain: 0.08 });
      break;
    case "tournamentFinish":
      // fanfare ascendente de 4 notas
      tone(ac, { freq: 392, type: "sawtooth", start: 0, dur: 0.18, gain: 0.18 });
      tone(ac, { freq: 523, type: "sawtooth", start: 0.14, dur: 0.18, gain: 0.18 });
      tone(ac, { freq: 659, type: "sawtooth", start: 0.28, dur: 0.18, gain: 0.18 });
      tone(ac, { freq: 1046, type: "sawtooth", start: 0.42, dur: 0.5, gain: 0.22 });
      tone(ac, { freq: 1318, type: "sine", start: 0.42, dur: 0.5, gain: 0.12 });
      noise(ac, 0.42, 0.3, 0.06, 2000);
      break;
  }
}

/* ============================================================
   Reproductor.
   ============================================================ */

const audioCache = new Map<string, HTMLAudioElement>();

function playOverride(data: string) {
  try {
    let el = audioCache.get(data);
    if (!el) {
      el = new Audio(data);
      el.preload = "auto";
      audioCache.set(data, el);
    }
    el.currentTime = 0;
    el.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Reproduce el sonido de un evento (override si existe, si no sintetizado). */
export function playSound(event: SoundEvent, sounds: SoundMap) {
  const ov = sounds[event];
  if (ov?.data) {
    playOverride(ov.data);
  } else {
    synthDefault(event);
  }
}

/** Hook de conveniencia: reproductor que mantiene la config de sonidos
    cargada y expone play(event). Pensado para usar en admin y visor. */
export function useSoundPlayer() {
  const { sounds } = useSounds();
  const soundsRef = useRef<SoundMap>({});
  useEffect(() => {
    soundsRef.current = sounds;
  }, [sounds]);
  return useCallback((event: SoundEvent) => playSound(event, soundsRef.current), []);
}
