import { createWriteStream } from "fs";
import { mkdir, stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "stream/web";
import { availableName, sanitizeName, VIDEO_RE, VIDEOS_DIR } from "@/lib/videoFiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   POST /api/videos/upload?name=<archivo> — sube un video EN
   STREAMING: el body llega como stream y se escribe directo a
   disco por bloques (sin buffer en memoria) → SIN LÍMITE DE
   PESO. El cliente manda el archivo crudo con XHR (progreso de
   subida) y el nombre viaja en el query string.
   Si el archivo ya existe se guarda como "nombre-2.ext", etc.
   ============================================================ */

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    // searchParams YA viene decodificado; el fallback por header sí se decodifica
    const qp = url.searchParams.get("name");
    const headerRaw = req.headers.get("x-file-name");
    let raw = qp ?? "";
    if (raw === "" && headerRaw) {
      try {
        raw = decodeURIComponent(headerRaw);
      } catch {
        raw = headerRaw;
      }
    }
    const name = sanitizeName(raw);
    if (!name || !VIDEO_RE.test(name)) {
      return Response.json({ error: "Nombre de archivo de video inválido" }, { status: 400 });
    }
    if (!req.body) {
      return Response.json({ error: "Petición sin contenido" }, { status: 400 });
    }

    await mkdir(VIDEOS_DIR, { recursive: true });
    const final = await availableName(VIDEOS_DIR, name);
    const dest = createWriteStream(path.join(VIDEOS_DIR, final));
    await pipeline(Readable.fromWeb(req.body as unknown as NodeWebReadableStream), dest);
    const st = await stat(path.join(VIDEOS_DIR, final));
    return Response.json({ name: final, size: st.size });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error al subir el video" },
      { status: 500 }
    );
  }
}
