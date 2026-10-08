#!/usr/bin/env node
/* ============================================================
   ARENA — stream-server (lanzador MULTIPLATAFORMA)
   Arranca MediaMTX con la config del proyecto:
     · RTMP ingest :1935  ← OBS publica aquí (rtmp://localhost:1935, clave "arena")
     · HLS output  :8888  ← la app lo consume vía /api/stream/proxy
     · API control :9997  (solo localhost)
   Windows  → mini-services/stream-server/mediamtx.exe
   Linux    → mini-services/stream-server/mediamtx
   Funciona igual con `npm run dev` (Windows) y `bun run dev`
   (sandbox/Linux): solo usa Node estándar.
   ============================================================ */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const dir = __dirname;
const isWindows = process.platform === "win32";
const exe = isWindows ? "mediamtx.exe" : "mediamtx";
const exePath = path.join(dir, exe);

if (!fs.existsSync(exePath)) {
  console.error(`[stream-server] No se encontró "${exe}" en ${dir}`);
  if (isWindows) {
    console.error(
      "[stream-server] Descarga mediamtx_v1.21.1_windows_amd64.zip desde https://github.com/bluenviron/mediamtx/releases/tag/v1.21.1 y extrae mediamtx.exe en esta carpeta."
    );
  } else {
    console.error("[stream-server] Descarga el binario mediamtx linux_amd64 v1.21.1 en esta carpeta.");
  }
  process.exit(1);
}

console.log(
  `[stream-server] arrancando MediaMTX · RTMP :1935 (clave "arena") · HLS :8888 · API 127.0.0.1:9997`
);

const child = spawn(exePath, ["mediamtx.yml"], { cwd: dir, stdio: "inherit" });

const forward = (sig) => {
  try {
    child.kill(sig);
  } catch {
    /* noop */
  }
};
process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("error", (err) => {
  console.error(`[stream-server] no se pudo ejecutar ${exe}:`, err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  process.exit(code == null ? (signal ? 1 : 0) : code);
});
