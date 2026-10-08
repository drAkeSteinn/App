import path from "path";

/* ============================================================
   Utilidades de SERVIDOR para la carpeta `videos/` de la app.
   (Solo backend — nunca importar desde código cliente)

   La carpeta vive en la raíz del proyecto: <app>/videos/
   Ahí el admin puede subir videos desde la sección "Videos"
   de Configuración, o copiarlos directamente al servidor
   (FTP/SSH) y pulsar "Resincronizar" para leerlos.
   ============================================================ */

export const VIDEOS_DIR = path.join(process.cwd(), "videos");

/** Extensiones de video aceptadas en la carpeta. */
export const VIDEO_RE = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv|avi|mpg|mpeg|wmv|flv|ts|3gp)$/i;

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".ts": "video/mp2t",
  ".3gp": "video/3gpp",
};

export function contentTypeFor(name: string): string {
  return CONTENT_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

/** Limpia el nombre: sin rutas, sin caracteres de control/inválidos,
    longitud acotada. Conserva acentos y espacios (nombres en español). */
export function sanitizeName(raw: string): string {
  let name = raw.normalize("NFC");
  name = name.replace(/[\\/]+/g, "_"); // nunca permitir rutas
  name = name.replace(/[\u0000-\u001f\u007f]/g, ""); // caracteres de control
  name = name.replace(/[<>:"|?*]/g, ""); // inválidos en sistemas comunes
  name = name.replace(/\s+/g, " ").trim();
  if (!name || name === "." || name === "..") return "";
  const ext = path.extname(name);
  if (ext.length > 12) return ""; // extensión absurda
  if (name.length > 180) name = name.slice(0, 180 - ext.length) + ext;
  return name;
}

/** Devuelve un nombre libre: si "promo.mp4" existe → "promo-2.mp4", etc. */
export async function availableName(dir: string, name: string): Promise<string> {
  const { access } = await import("fs/promises");
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let candidate = name;
  for (let i = 2; i < 1000; i++) {
    try {
      await access(path.join(dir, candidate));
      candidate = `${base}-${i}${ext}`;
    } catch {
      return candidate;
    }
  }
  return `${base}-${Date.now()}${ext}`;
}
