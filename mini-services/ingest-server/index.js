/* ============================================================
   INGEST SERVER — ingesta HTTP de la transmisión del OBS.
   Puerto fijo: 3030 (Node puro: funciona igual en Windows,
   Linux y macOS; no requiere Bun).

   ¿Por qué existe? OBS puede publicar de 2 maneras:
   · RTMP directo  → rtmp://<host>:1935/arena  (requiere 1935 accesible)
   · HTTP MPEG-TS  → http://<host-de-la-app>/api/stream/ingest
     (OBS → Salida personalizada FFmpeg → contenedor mpegts → URL)
     Esta ruta de la app reenvía el body MPEG-TS aquí, y este
     servidor lo re-publica con ffmpeg (sin recodificar, -c copy)
     como RTMP al MediaMTX local (127.0.0.1:1935, path "arena"),
     que es el que genera el HLS que reproduce el visor.

   Requisito: ffmpeg en el PATH (solo para el método HTTP;
   el RTMP directo no usa este servidor).
   ============================================================ */

const http = require("node:http");
const { spawn } = require("node:child_process");

const PORT = 3030;
const RTMP_OUT = "rtmp://127.0.0.1:1935/arena";

const state = {
  proc: null,
  startedAt: null,
  bytes: 0,
  lastError: null,
  /** contador de sesiones aceptadas (se reemplaza la anterior) */
  session: 0,
};

function killCurrent(reason) {
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
function startFfmpeg() {
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
  const proc = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  proc.stderr.on("data", (chunk) => {
    const line = String(chunk).trim();
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

function json(res, data, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

/** POST /ingest — el body MPEG-TS se bombea a ffmpeg (backpressure vía pipe). */
function handleIngest(req, res) {
  // una sola transmisión a la vez: la nueva reemplaza a la anterior
  killCurrent("reemplazada por una nueva sesión");
  const proc = startFfmpeg();
  state.proc = proc;
  state.startedAt = Date.now();
  state.bytes = 0;
  state.lastError = null;
  state.session += 1;
  const session = state.session;
  console.log(`[ingest] sesión #${session} iniciada (${req.headers["user-agent"] ?? "cliente desconocido"})`);

  let answered = false;
  const answer = (status, body) => {
    if (answered) return;
    answered = true;
    if (body) json(res, body, status);
    else {
      res.writeHead(status);
      res.end();
    }
  };

  req.on("data", (chunk) => {
    state.bytes += chunk.length;
  });

  // bombea el body hacia ffmpeg (backpressure automática vía pipe)
  req.pipe(proc.stdin);

  // el emisor cortó la conexión (OBS detiene la grabación / cancela)
  req.on("aborted", () => {
    if (state.proc === proc) killCurrent("el emisor cortó la conexión");
  });

  // el emisor terminó de enviar: cerramos stdin → ffmpeg hace flush y sale
  req.on("end", () => {
    try {
      proc.stdin.end();
    } catch {
      /* noop */
    }
  });

  proc.on("exit", () => {
    const ok = state.proc === null && state.bytes > 0 && !state.lastError;
    console.log(
      `[ingest] sesión #${session} terminada · bytes=${state.bytes} ok=${ok} último=${state.lastError ?? "limpia"}`
    );
    if (state.bytes === 0) answer(400, { error: "No se recibieron datos MPEG-TS" });
    else answer(204);
  });
  proc.on("error", (err) => {
    answer(500, { error: `ffmpeg no disponible: ${err.message}` });
  });
  req.on("error", () => {
    if (state.proc === proc) killCurrent("error leyendo el body");
    answer(400, { error: "error leyendo el body" });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/ingest" || url.pathname.startsWith("/ingest/")) {
      if (req.method !== "POST") {
        return json(res, { error: "Solo POST (OBS → salida FFmpeg mpegts)" }, 405);
      }
      return handleIngest(req, res);
    }
    if (url.pathname === "/status") {
      return json(res, {
        ffmpegAlive: state.proc !== null,
        bytes: state.bytes,
        startedAt: state.startedAt,
        session: state.session,
        lastError: state.lastError,
        rtmpOut: RTMP_OUT,
      });
    }
    if (url.pathname === "/healthz") return json(res, { ok: true });
    return json(res, { error: "not found" }, 404);
  } catch (err) {
    console.error("[ingest] error no controlado:", err);
    return json(res, { error: err instanceof Error ? err.message : "error interno" }, 500);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[ingest] escuchando en 127.0.0.1:${PORT} → ${RTMP_OUT}`);
});
