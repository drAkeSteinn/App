"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Cast,
  Copy,
  Globe,
  Info,
  MonitorPlay,
  Network,
  RadioTower,
  Save,
  Server,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ObsStreamPlayer, useObsStreamStatus } from "./ObsStreamPlayer";
import { useObsSettingsForm } from "@/lib/obsStream";
import { Btn, TextInput } from "./ui";

/* ============================================================
   ObsStreamManager — sección COMPLETA (no modal) de Configuración.
   Todo lo que hay que configurar para la transmisión del OBS:
   · Estado de la señal (en vivo / sin señal + espectadores).
   · URL(es) que se pegan en OBS para poder transmitir:
     - RTMP directo (servidor + clave), con la URL para OBS en
       ESTA PC (localhost) y para OBS en OTRA PC de la red (IP LAN).
     - HTTP mpegts (salida FFmpeg personalizada) por la MISMA URL
       HTTP de la app — universal, sin puertos extra, funciona
       igual en cualquier PC (Windows/macOS/Linux) o sandbox.
   · Tamaño en píxeles del marco del visor (settings/obs).
   Todo el pipeline es autónomo (SIN servicios externos):
   OBS → app (MediaMTX interno) → visor.
   La app puede correr en la PC que sea: el RTMP es el mismo y
   solo cambia el host de la URL; el estado (Mostrar transmicion,
   tamaño del visor) se sincroniza por la nube (Firestore).
   ============================================================ */

const STREAM_KEY = "arena";

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado al portapapeles`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[8px] font-extrabold tracking-[0.28em] uppercase text-[#6b6e78]">{label}</div>
        <div
          className={`mt-1 truncate text-[12px] font-bold text-white bg-black/40 border border-white/10 rounded-sm px-2.5 py-1.5 ${mono ? "font-mono" : ""}`}
        >
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copiar ${label}`}
        title={`Copiar ${label}`}
        className="btn-press clip-btn shrink-0 h-9 px-3 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#c9cbd3] hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 inline-flex items-center gap-1.5"
      >
        <Copy size={12} />
        <span className="hidden sm:inline">Copiar</span>
      </button>
    </div>
  );
}

function StepsList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="text-[11px] font-semibold text-[#c9cbd3] leading-relaxed list-decimal list-inside space-y-0.5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

export function ObsStreamManager({ onBack }: { onBack: () => void }) {
  const status = useObsStreamStatus(5000);
  const { settings, loading: loadingSettings, saving, save } = useObsSettingsForm();
  const [widthInput, setWidthInput] = useState<string | null>(null);
  const [heightInput, setHeightInput] = useState<string | null>(null);

  const width = widthInput ?? String(settings.width);
  const height = heightInput ?? String(settings.height);

  /* OBS en la MISMA PC de la app (escenario típico en Windows): localhost
     es loopback interno — no pasa por firewall ni por la red, funciona siempre.
     OBS en OTRA PC: la IP LAN la reporta el servidor. */
  const lanIps = useMemo(() => (status.lan ?? []).filter(Boolean), [status.lan]);
  const lanIp = lanIps[0];
  const rtmpUrl = "rtmp://localhost:1935";
  const rtmpLanUrl = lanIp ? `rtmp://${lanIp}:1935` : null;

  const httpUrl = useMemo(() => {
    if (typeof window === "undefined") return "http://<host-de-la-app>/api/stream/ingest";
    return `${window.location.origin}/api/stream/ingest`;
  }, []);

  const saveSize = async () => {
    const w = Number(width);
    const h = Number(height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 160 || h < 90) {
      toast.error("Tamaño inválido · mínimo 160×90 px");
      return;
    }
    try {
      const saved = await save(w, h);
      setWidthInput(null);
      setHeightInput(null);
      toast.success(`Tamaño del visor guardado · ${saved.width}×${saved.height} px`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  };

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
              <span className="text-silver-grad">Transmisión</span> <span className="text-red-grad">OBS</span>
            </h2>
          </div>
          <p className="text-[11px] text-[#8e919c] font-bold tracking-[0.14em] uppercase mt-2 ml-[52px]">
            OBS transmite a la app · se muestra en el visor con “Mostrar transmicion”
          </p>
        </div>
        <span
          className={`chip clip-tag shrink-0 text-[9px] px-3 py-2 ${
            status.live
              ? "bg-[#e8102e]/15 text-[#ff8095] border border-[#e8102e]/40"
              : "bg-white/[0.05] text-[#8e919c] border border-white/10"
          }`}
        >
          {status.live ? (
            <>
              <span className="w-1.5 h-1.5 bg-[#ff2440] blink" aria-hidden />
              En vivo{status.viewers > 0 ? ` · ${status.viewers} viendo` : ""}
            </>
          ) : (
            <>Sin señal</>
          )}
        </span>
      </div>

      {/* ===== nota sin servicios externos ===== */}
      <div className="flex gap-2.5 rounded-sm border border-[#ffb830]/25 bg-[#ffb830]/[0.06] p-3 mb-5">
        <ShieldCheck size={15} className="text-[#ffb830] shrink-0 mt-0.5" />
        <p className="text-[10.5px] font-semibold text-[#c9cbd3] leading-relaxed">
          <span className="text-[#ffb830] font-extrabold uppercase tracking-wider">Sin servicios externos ·</span>{" "}
          el servidor de streaming (MediaMTX) corre <span className="text-white">dentro de la propia app</span>: OBS
          transmite directo a la app y los espectadores la reciben desde el visor. No se usa YouTube, Twitch ni
          ningún tercero, y la señal no se recodifica (llega tal como sale de OBS, a resolución nativa).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ===== método 1: RTMP ===== */}
        <section className="panel clip-card p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-9 h-9 shrink-0 clip-card-sm border border-white/15 bg-black/50 flex items-center justify-center">
              <Server size={15} className="text-[#e8102e]" />
            </span>
            <div>
              <h3 className="font-display italic text-[15px] uppercase leading-none">Método 1 · RTMP directo</h3>
              <p className="text-[8.5px] font-extrabold tracking-[0.22em] uppercase text-[#6b6e78] mt-1">
                Recomendado · mejor latencia
              </p>
            </div>
          </div>
          <div className="mt-4">
            <StepsList
              items={[
                <>
                  OBS → <span className="text-white">Configuración → Emisión</span> → Servicio:{" "}
                  <span className="text-white">Personalizado…</span>
                </>,
                <>Pega el servidor y la clave (botones de copiar ↓).</>,
                <>
                  Aplica y pulsa <span className="text-white">Iniciar transmisión</span>.
                </>,
              ]}
            />
          </div>
          <div className="mt-4 space-y-2.5">
            <CopyRow label="Servidor (RTMP) · OBS en esta PC" value={rtmpUrl} />
            {rtmpLanUrl ? (
              <CopyRow label={`Servidor (RTMP) · OBS en otra PC (${lanIp})`} value={rtmpLanUrl} />
            ) : null}
            <CopyRow label="Clave de stream" value={STREAM_KEY} />
          </div>
          <div className="mt-4 flex gap-2 rounded-sm border border-white/10 bg-white/[0.03] p-3">
            <Network size={13} className="text-[#8e919c] shrink-0 mt-0.5" />
            <p className="text-[10px] font-semibold text-[#8e919c] leading-relaxed">
              Con OBS en la <span className="text-white">misma PC que la app</span> (Windows, macOS o Linux) usa el
              servidor <span className="text-white">localhost</span>: la conexión es interna (loopback), no pasa por el
              firewall ni por la red. Para OBS en <span className="text-white">otra PC de la red</span> usa la IP LAN y
              permite el puerto <span className="text-white">1935</span> en el firewall de Windows. Si solo tienes un
              puerto HTTP disponible, usa el método 2.
            </p>
          </div>
        </section>

        {/* ===== método 2: HTTP mpegts ===== */}
        <section className="panel clip-card p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-9 h-9 shrink-0 clip-card-sm border border-white/15 bg-black/50 flex items-center justify-center">
              <Globe size={15} className="text-[#ffb830]" />
            </span>
            <div>
              <h3 className="font-display italic text-[15px] uppercase leading-none">Método 2 · HTTP (sin puertos extra)</h3>
              <p className="text-[8.5px] font-extrabold tracking-[0.22em] uppercase text-[#6b6e78] mt-1">
                Solo usa el mismo puerto HTTP de la app
              </p>
            </div>
          </div>
          <div className="mt-4">
            <StepsList
              items={[
                <>
                  OBS → <span className="text-white">Configuración → Salida → Modo de salida: Avanzado</span> →
                  pestaña <span className="text-white">Grabación</span> → Tipo:{" "}
                  <span className="text-white">Salida personalizada (FFmpeg)</span>
                </>,
                <>
                  Tipo de salida FFmpeg: <span className="text-white">Salida a URL</span> · Formato de contenedor:{" "}
                  <span className="text-white">mpegts</span> · Códecs: H264 + AAC
                </>,
                <>
                  Pega la URL (botón de copiar ↓) y pulsa <span className="text-white">Iniciar grabación</span> —
                  “graba” en vivo hacia la app.
                </>,
              ]}
            />
          </div>
          <div className="mt-4">
            <CopyRow label="URL para OBS (mpegts)" value={httpUrl} />
          </div>
          <div className="mt-4 flex gap-2 rounded-sm border border-white/10 bg-white/[0.03] p-3">
            <Info size={13} className="text-[#8e919c] shrink-0 mt-0.5" />
            <p className="text-[10px] font-semibold text-[#8e919c] leading-relaxed">
              Ideal cuando la app corre detrás de un único puerto HTTP (como esta vista previa). En Windows requiere{" "}
              <span className="text-white">ffmpeg en el PATH</span> (el método 1 RTMP no necesita nada extra). Si
              cortas la transmisión en OBS, vuelve a pulsar Iniciar grabación para reconectar.
            </p>
          </div>
        </section>

        {/* ===== tamaño en el visor ===== */}
        <section className="panel clip-card p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-9 h-9 shrink-0 clip-card-sm border border-white/15 bg-black/50 flex items-center justify-center">
              <MonitorPlay size={15} className="text-[#ffb830]" />
            </span>
            <div>
              <h3 className="font-display italic text-[15px] uppercase leading-none">Tamaño en el visor</h3>
              <p className="text-[8.5px] font-extrabold tracking-[0.22em] uppercase text-[#6b6e78] mt-1">
                Marco en píxeles donde se ve la transmisión
              </p>
            </div>
          </div>
          <p className="text-[10px] font-semibold text-[#8e919c] leading-relaxed mt-3">
            La transmisión aparece <span className="text-white">centrada encima de los brackets</span> dentro de un
            marco de este tamaño. El video se ajusta al marco sin deformarse, así que usa la{" "}
            <span className="text-white">misma resolución del canvas de OBS</span> (p. ej. 1920×1080) para verla a
            resolución nativa.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <div className="text-[8px] font-extrabold tracking-[0.28em] uppercase text-[#6b6e78] mb-1.5">
                Ancho (px)
              </div>
              <TextInput
                type="number"
                min={160}
                max={7680}
                value={width}
                onChange={(e) => setWidthInput(e.target.value)}
                placeholder="1920"
                aria-label="Ancho en píxeles"
              />
            </div>
            <div>
              <div className="text-[8px] font-extrabold tracking-[0.28em] uppercase text-[#6b6e78] mb-1.5">
                Alto (px)
              </div>
              <TextInput
                type="number"
                min={90}
                max={4320}
                value={height}
                onChange={(e) => setHeightInput(e.target.value)}
                placeholder="1080"
                aria-label="Alto en píxeles"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Btn variant="red" onClick={saveSize} disabled={saving || loadingSettings}>
              <Save size={13} />
              Guardar tamaño
            </Btn>
            <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#6b6e78]">
              {loadingSettings ? "Cargando…" : `Actual: ${settings.width}×${settings.height} px · se aplica al instante`}
            </span>
          </div>
        </section>

        {/* ===== vista previa + cómo se muestra ===== */}
        <section className="panel clip-card p-5 flex flex-col">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-9 h-9 shrink-0 clip-card-sm border border-white/15 bg-black/50 flex items-center justify-center">
              <RadioTower size={15} className="text-white" />
            </span>
            <div>
              <h3 className="font-display italic text-[15px] uppercase leading-none">Señal recibida</h3>
              <p className="text-[8.5px] font-extrabold tracking-[0.22em] uppercase text-[#6b6e78] mt-1">
                Vista previa · lo que verá el visor
              </p>
            </div>
          </div>
          {status.live ? (
            <div className="flex justify-center bg-black rounded-sm border border-white/10 p-1.5">
              <ObsStreamPlayer status={status} pollMs={10000} maxBox="max-h-[240px]" />
            </div>
          ) : (
            <div className="h-[150px] rounded-sm border border-dashed border-white/12 bg-black/40 flex flex-col items-center justify-center gap-2">
              <Cast size={20} className="text-[#3f414a]" />
              <span className="text-[9px] font-extrabold tracking-[0.3em] uppercase text-[#6b6e78] text-center px-4">
                Sin señal · inicia la transmisión en OBS para verla aquí
              </span>
            </div>
          )}
          <div className="mt-4 flex gap-2 rounded-sm border border-white/10 bg-white/[0.03] p-3 mt-auto">
            <Cast size={13} className="text-[#8e919c] shrink-0 mt-0.5" />
            <p className="text-[10px] font-semibold text-[#8e919c] leading-relaxed">
              Mostrarla a los espectadores: <span className="text-white">Torneo en vivo → botón “Mostrar transmicion”</span>{" "}
              (junto a Cartelera). Mientras esté oculta, el visor muestra los brackets o la pantalla de espera.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
