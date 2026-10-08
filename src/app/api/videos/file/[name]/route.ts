import { createReadStream } from "fs";
import { stat, unlink } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { contentTypeFor, sanitizeName, VIDEOS_DIR } from "@/lib/videoFiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   GET /api/videos/file/<nombre> — sirve el video desde la
   carpeta `videos/` con soporte de RANGE (HTTP 206), necesario
   para que el <video> del visor haga streaming y seeking.
   DELETE — elimina el archivo de la carpeta.
   ============================================================ */

type Ctx = { params: Promise<{ name: string }> };

/** Resuelve el nombre del archivo de forma tolerante (Next puede
    entregar el segmento decodificado o no) y siempre dentro de videos/. */
async function resolveName(rawName: string): Promise<string | null> {
  const candidates = [rawName];
  try {
    candidates.push(decodeURIComponent(rawName));
  } catch {
    /* segmento mal codificado — queda el original */
  }
  for (const c of candidates) {
    const name = sanitizeName(c);
    if (!name || name === "." || name === "..") continue;
    const p = path.join(VIDEOS_DIR, name);
    if (p !== VIDEOS_DIR && !p.startsWith(VIDEOS_DIR + path.sep)) continue;
    try {
      const st = await stat(p);
      if (st.isFile()) return name;
    } catch {
      /* probar siguiente candidato */
    }
  }
  return null;
}

function baseHeaders(name: string, size: number, mtime: Date): Record<string, string> {
  return {
    "Content-Type": contentTypeFor(name),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
    "Last-Modified": mtime.toUTCString(),
    "Content-Length": String(size),
  };
}

export async function GET(req: Request, ctx: Ctx) {
  const { name: raw } = await ctx.params;
  const name = await resolveName(raw);
  if (!name) return Response.json({ error: "Video no encontrado" }, { status: 404 });

  const filePath = path.join(VIDEOS_DIR, name);
  const st = await stat(filePath);
  const range = req.headers.get("range");

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      const size = st.size;
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : size - 1;
      if (!m[1] && m[2]) {
        // rango sufijo: bytes=-N → últimos N bytes
        start = Math.max(0, size - parseInt(m[2], 10));
        end = size - 1;
      }
      if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end < start || start >= size) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      end = Math.min(end, size - 1);
      const node = createReadStream(filePath, { start, end });
      const web = Readable.toWeb(node) as unknown as ReadableStream<Uint8Array>;
      return new Response(web, {
        status: 206,
        headers: {
          ...baseHeaders(name, end - start + 1, st.mtime),
          "Content-Range": `bytes ${start}-${end}/${size}`,
        },
      });
    }
  }

  const node = createReadStream(filePath);
  const web = Readable.toWeb(node) as unknown as ReadableStream<Uint8Array>;
  return new Response(web, { status: 200, headers: baseHeaders(name, st.size, st.mtime) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { name: raw } = await ctx.params;
  const name = await resolveName(raw);
  if (!name) return Response.json({ error: "Video no encontrado" }, { status: 404 });
  try {
    await unlink(path.join(VIDEOS_DIR, name));
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "No se pudo eliminar" },
      { status: 500 }
    );
  }
  return Response.json({ ok: true });
}
