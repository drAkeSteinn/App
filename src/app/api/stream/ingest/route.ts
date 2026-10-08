import type { NextRequest } from "next/server";
import http from "node:http";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ============================================================
   INGESTA HTTP UNIVERSAL DE LA TRANSMISIÓN OBS (Método 2)
   URL para OBS (Salida personalizada FFmpeg → mpegts → Salida a URL):
     http://<host-de-la-app>/api/stream/ingest
   Esta ruta vive DENTRO de la app (mismo puerto HTTP), así que
   funciona igual en cualquier despliegue — sandbox, Windows, macOS
   o Linux — sin puertos extra ni gateways: OBS → app → ingest-server
   (127.0.0.1:3030) → ffmpeg -c copy → MediaMTX (1935) → HLS → visor.
   El body se bombea en streaming (sin buffer en memoria) y la
   respuesta se resuelve cuando termina la transmisión (igual que
   el ingest-server), de modo que OBS mantiene la conexión viva.
   ============================================================ */

const INGEST_HOST = "127.0.0.1";
const INGEST_PORT = 3030;

export async function POST(request: NextRequest) {
  if (!request.body) {
    return Response.json(
      { error: "Body vacío: se esperaba MPEG-TS (OBS → Salida personalizada FFmpeg)" },
      { status: 400 }
    );
  }

  return await new Promise<Response>((resolve) => {
    let settled = false;
    const settle = (res: Response) => {
      if (settled) return;
      settled = true;
      resolve(res);
    };

    const upstream = http.request(
      {
        host: INGEST_HOST,
        port: INGEST_PORT,
        path: "/ingest",
        method: "POST",
        headers: {
          "content-type": request.headers.get("content-type") ?? "video/mp2t",
          "user-agent": request.headers.get("user-agent") ?? "arena-ingest-proxy",
        },
      },
      (ures) => {
        // el ingest-server responde al FINAL de la transmisión: relay del status
        ures.resume();
        ures.on("end", () => settle(new Response(null, { status: ures.statusCode ?? 200 })));
        ures.on("error", () => settle(new Response(null, { status: 502 })));
      }
    );

    upstream.on("error", (err) => {
      settle(
        Response.json(
          { error: `Ingest no disponible (${err.message}). ¿Está corriendo mini-services/ingest-server?` },
          { status: 503 }
        )
      );
    });

    // si el emisor corta (OBS detiene la grabación / cancela), cerrar el upstream
    request.signal.addEventListener("abort", () => {
      upstream.destroy(new Error("el emisor cortó la conexión"));
    });

    const source = Readable.fromWeb(request.body as unknown as NodeWebReadableStream<Uint8Array>);
    source.on("error", () => {
      upstream.destroy(new Error("error leyendo el body"));
    });
    // backpressure automática vía pipe: OBS → app → ingest → ffmpeg
    source.pipe(upstream);
  });
}

export function GET() {
  return Response.json({ error: "Solo POST (OBS → salida FFmpeg mpegts)" }, { status: 405 });
}
