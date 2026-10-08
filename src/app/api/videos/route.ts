import { mkdir, readdir, stat } from "fs/promises";
import path from "path";
import { VIDEOS_DIR, VIDEO_RE } from "@/lib/videoFiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   GET /api/videos — lista los videos de la carpeta `videos/`
   de la app. El botón "Resincronizar" de la sección Videos
   vuelve a llamar aquí para releer la carpeta (así también se
   reflejan archivos copiados manualmente al servidor).
   ============================================================ */

export async function GET() {
  try {
    await mkdir(VIDEOS_DIR, { recursive: true });
    const entries = await readdir(VIDEOS_DIR, { withFileTypes: true });
    const videos: { name: string; size: number; mtime: number }[] = [];
    for (const e of entries) {
      if (!e.isFile() || e.name.startsWith(".") || !VIDEO_RE.test(e.name)) continue;
      try {
        const st = await stat(path.join(VIDEOS_DIR, e.name));
        videos.push({ name: e.name, size: st.size, mtime: Math.round(st.mtimeMs) });
      } catch {
        /* el archivo pudo desaparecer entre readdir y stat — se ignora */
      }
    }
    videos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    return Response.json({ videos });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error al leer la carpeta de videos" },
      { status: 500 }
    );
  }
}
