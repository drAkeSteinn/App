import { NextResponse } from "next/server";
import os from "node:os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ============================================================
   ESTADO DE LA TRANSMISIÓN OBS
   Consulta la API local de MediaMTX (mini-service stream-server,
   puerto 9997 solo-localhost) y reporta si el path "arena" está
   publicando (OBS transmitiendo) y cuántos lectores HLS hay.
   El navegador NUNCA habla directo con MediaMTX: siempre pasa
   por aquí (misma origen, sin CORS).

   Además expone `lan`: las IPs IPv4 de red de la máquina donde
   corre la app, para armar la URL RTMP cuando el OBS está en
   OTRA PC de la misma red (rtmp://<lan-ip>:1935). Si OBS y la
   app están en la MISMA PC basta rtmp://localhost:1935.
   ============================================================ */

type MediamtxReader = { type?: string };
type MediamtxPath = { name?: string; ready?: boolean; readers?: MediamtxReader[] };

const MEDIAMTX_API = "http://127.0.0.1:9997/v3/paths/list";
const STREAM_PATH = "arena";

/** IPs IPv4 reales de la máquina (sin loopback) — para OBS en otra PC de la red. */
function lanIps(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) out.push(a.address);
    }
  }
  return out;
}

export async function GET() {
  const lan = lanIps();
  try {
    const res = await fetch(MEDIAMTX_API, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`mediamtx api ${res.status}`);
    const data = (await res.json()) as { items?: MediamtxPath[] };
    const items = Array.isArray(data.items) ? data.items : [];
    const arena = items.find((p) => p.name === STREAM_PATH);
    const live = Boolean(arena?.ready);
    const readers = Array.isArray(arena?.readers) && arena.readers ? arena.readers : [];
    // cada espectador HLS crea una sesión de lectura ("...Session");
    // los muxers internos no se cuentan
    const viewers = readers.filter((r) => String(r.type ?? "").toLowerCase().includes("session")).length;
    return NextResponse.json(
      { live, viewers, lan },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    // MediaMTX caído / sin señal → offline (la UI simplemente oculta el player);
    // `lan` sigue disponible para mostrar las URLs correctas en la configuración
    return NextResponse.json(
      { live: false, viewers: 0, lan },
      { headers: { "cache-control": "no-store" } }
    );
  }
}
