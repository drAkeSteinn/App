/* ============================================================
   INGEST SERVER — ingesta HTTP de la transmisión del OBS.
   Puerto fijo: 3030 (se alcanza desde fuera SOLO a través del
   gateway de la app con ?XTransformPort=3030, así OBS no
   necesita ningún puerto extra abierto).

   ¿Por qué existe? OBS puede publicar de 2 maneras:
   · RTMP directo  → rtmp://<host>:1935/arena  (requiere 1935 accesible)
   · HTTP MPEG-TS  → http://<host>/ingest?XTransformPort=3030
     (OBS → Salida personalizada FFmpeg → contenedor mpegts → URL)
     Este servidor recibe el body MPEG-TS en streaming y lo
     re-publica con ffmpeg (sin recodificar, -c copy) como RTMP
     al MediaMTX local (127.0.0.1:1935, path "arena"), que es el
     que genera el HLS que reproduce el visor.

   Todo el pipeline es AUTÓNOMO (sin servicios externos):
   OBS → [HTTP o RTMP] → ffmpeg → MediaMTX → HLS → visor.
   ============================================================ */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

const PORT = 3030;
const RTMP_OUT = "rtmp://127.0.0.1:1935/arena";

interface IngestState {
  proc: ChildProcessWithoutNullStreams | null;
  startedAt: number | null;
  bytes: number;
  lastError: string | null;
  /** contador de sesiones aceptadas (se reemplaza la anterior) */
  session: number;
}

const state: IngestState = {
  proc: null,
  startedAt: null,
  bytes: 0,
  lastError: null,
  session: 0,
};

function killCurrent(reason: string) {
  const p = state.proc;
  if (!p) return;
  state.proc = null;
  state.lastError = reason;
  try {
    p.stdin.destroy();
  } catch {
    /* noop */
  }
  try {
    // SIGKILL: ffmpeg con -c copy no necesita finalizar nada
    p.kill("SIGKILL");
  } catch {
    /* noop */
  }
}

/** Lanza ffmpeg: lee MPEG-TS por stdin y publica RTMP al MediaMTX local. */
function startFfmpeg(): ChildProcessWithoutNullStreams {
  const args = [
    "-hide_banner",
    "-loglevel",
    "warning",
    // el feed llega en vivo: regenerar timestamps si OBS no los manda completos
    "-fflags",
    "+genpts",
    "-i",
    "pipe:0",
    // SIN recodificación: la señal llega igual que salió de OBS (resolución nativa)
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-flush_packets",
    "1",
    "-f",
    "flv",
    RTMP_OUT,
  ];
  const proc = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] }) as ChildProcessWithoutNullStreams;
  proc.stderr.on("data", (chunk: Buffer) => {
    const line = chunk.toString().trim();
    if (line) console.log(`[ffmpeg] ${line}`);
  });
  proc.on("exit", (code, signal) => {
    if (state.proc === proc) {
      state.proc = null;
      state.lastError = `ffmpeg terminó (code=${code ?? "-"} signal=${signal ?? "-"})`;
      console.log(`[ingest] ${state.lastError}`);
    }
  });
  proc.on("error", (err) => {
    if (state.proc === proc) {
      state.proc = null;
      state.lastError = `ffmpeg error: ${err.message}`;
      console.error(`[ingest] ${state.lastError}`);
    }
  });
  return proc;
}

async function handleIngest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Solo POST (OBS → salida FFmpeg mpegts)" }, 405);
  }
  const body = req.body;
  if (!body) {
    return json({ error: "Body vacío: se esperaba MPEG-TS" }, 400);
  }

  // una sola transmisión a la vez: la nueva reemplaza a la anterior
  killCurrent("reemplazada por una nueva sesión");
  const proc = startFfmpeg();
  state.proc = proc;
  state.startedAt = Date.now();
  state.bytes = 0;
  state.lastError = null;
  state.session += 1;
  const session = state.session;
  console.log(`[ingest] sesión #${session} iniciada (${req.headers.get("user-agent") ?? "cliente desconocido"})`);

  const source = Readable.fromWeb(body as unknown as NodeWebReadableStream<Uint8Array>);
  source.on("data", (chunk: Buffer) => {
    state.bytes += chunk.length;
  });

  /** cierra la petición cuando ffmpeg muere (para que OBS reintente) */
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    try {
      source.destroy();
    } catch {
      /* noop */
    }
  };
  proc.on("exit", finish);
  proc.on("error", finish);

  const abort = () => {
    if (state.proc === proc) killCurrent("el emisor cortó la conexión");
  };
  req.signal.addEventListener("abort", abort);

  // bombea el body hacia ffmpeg (backpressure automática vía pipe)
  await new Promise<void>((resolve) => {
    source.pipe(proc.stdin);
    proc.stdin.on("close", resolve);
    proc.on("exit", resolve);
    source.on("error", () => {
      if (state.proc === proc) killCurrent("error leyendo el body");
      resolve();
    });
  });

  req.signal.removeEventListener("abort", abort);
  const ok = state.proc === null && state.bytes > 0 && !state.lastError;
  console.log(
    `[ingest] sesión #${session} terminada · bytes=${state.bytes} ok=${ok} último=${state.lastError ?? "limpia"}`
  );
  if (state.bytes === 0) {
    return json({ error: "No se recibieron datos MPEG-TS" }, 400);
  }
  return new Response(null, { status: 204 });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/ingest" || url.pathname.startsWith("/ingest/")) {
        return await handleIngest(req);
      }
      if (url.pathname === "/status") {
        return json({
          ffmpegAlive: state.proc !== null,
          bytes: state.bytes,
          startedAt: state.startedAt,
          session: state.session,
          lastError: state.lastError,
          rtmpOut: RTMP_OUT,
        });
      }
      if (url.pathname === "/healthz") return json({ ok: true });
      return json({ error: "not found" }, 404);
    } catch (err) {
      console.error("[ingest] error no controlado:", err);
      return json({ error: err instanceof Error ? err.message : "error interno" }, 500);
    }
  },
});

console.log(`[ingest] escuchando en :${PORT} → ${RTMP_OUT}`);
