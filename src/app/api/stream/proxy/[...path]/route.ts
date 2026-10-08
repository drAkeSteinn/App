import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ============================================================
   PROXY HLS DE LA TRANSMISIÓN OBS
   El reproductor del visor pide TODO por la misma origen:
     /api/stream/proxy/index.m3u8        → playlist maestra
     /api/stream/proxy/video1_stream.m3u8 → playlist de medios
     /api/stream/proxy/<segmento>.mp4     → segmentos

   DETALLES DE MEDIAMTX que este proxy resuelve:
   1. Comprobación de cookies: la playlist maestra responde 302 +
      Set-Cookie (cookieCheck). El fetch de Node NO gestiona
      cookies, así que seguimos el redirect a mano y guardamos la
      cookie en un jar global (globalThis sobrevive al hot-reload
      de módulos en dev).
   2. La sesión HLS queda ligada a esa cookie: playlists/segmentos
      sin cookie responden 401 directo (sin 302 de recuperación).
      Si la sesión caduca ("closed: inactive"), el siguiente 401
      dispara la renovación automática: rehacemos la danza de la
      playlist maestra (crea sesión nueva) y reintentamos 1 vez.
   3. Reescritura de .m3u8: toda URI interna apunta al proxy para
      que el visor funcione sin puertos extra ni CORS.
   ============================================================ */

const UPSTREAM_BASE = "http://127.0.0.1:8888/arena";
const PROXY_PREFIX = "/api/stream/proxy/";

type CookieState = { jar: string };
const globalRef = globalThis as unknown as { __arenaStreamCookie?: CookieState };
const cookieState: CookieState = (globalRef.__arenaStreamCookie ??= { jar: "" });

function saveCookie(res: Response) {
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const pair = setCookie.split(";")[0].trim();
    if (pair) cookieState.jar = pair;
  }
}

/** fetch con la cookie actual; sigue 302 a mano capturando cookies nuevas */
async function fetchWithDance(url: string, hops = 0): Promise<Response> {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "manual",
    headers: cookieState.jar ? { cookie: cookieState.jar } : undefined,
  });
  saveCookie(res);
  const loc = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && loc && hops < 3) {
    return fetchWithDance(new URL(loc, url).toString(), hops + 1);
  }
  return res;
}

/** Renueva la sesión: la danza de la playlist maestra crea una cookie-sesión fresca */
async function renewSession(): Promise<void> {
  cookieState.jar = "";
  await fetchWithDance(`${UPSTREAM_BASE}/index.m3u8`).catch(() => undefined);
}

async function fetchUpstream(rel: string, qs: string): Promise<Response> {
  const url = `${UPSTREAM_BASE}/${rel}${qs}`;
  let res = await fetchWithDance(url);
  if (res.status === 401) {
    // sesión caducada → renovar y reintentar una vez
    await renewSession();
    res = await fetchWithDance(url);
  }
  return res;
}

/** Reescribe playlist: cualquier URI de segmento/sub-playlist pasa por el proxy. */
function rewriteM3u8(body: string): string {
  return body.replace(
    /([\w.\-/]+\.(?:m3u8|ts|m4s|mp4|aac|cmfv|cmfa))/g,
    (uri) => `${PROXY_PREFIX}${uri}`
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const rel = path.map((seg) => encodeURIComponent(seg)).join("/");
  const qs = request.nextUrl.search; // preserva ?session=… / ?cookieCheck=1 / _HLS_msn…

  try {
    const upstream = await fetchUpstream(rel, qs);

    if (rel.endsWith(".m3u8")) {
      const text = await upstream.text();
      return new NextResponse(rewriteM3u8(text), {
        status: upstream.status,
        headers: {
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "cache-control": "no-store, no-transform",
        },
      });
    }

    // segmentos → streaming passthrough (sin buffering extra)
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "video/mp4",
        "cache-control": "no-store, no-transform",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "stream_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
}
