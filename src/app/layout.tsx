import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "ARENA · Gestor de Torneos",
  description:
    "Gestión profesional de torneos gaming: registro de jugadores, brackets en vivo y visor de transmisión con animaciones.",
  icons: { icon: "/hyperlogo.png", apple: "/hyperlogo.png" },
};

export const viewport: Viewport = {
  themeColor: "#070708",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/RBNo3.1-ExtraboldItalic.otf" as="font" type="font/opentype" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/montserrat-latin-700-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/montserrat-latin-800-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-center"
          gap={8}
          toastOptions={{
            style: {
              background: "#101014",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#f5f5f7",
              fontFamily: "'Gotham','Montserrat',sans-serif",
              fontWeight: 700,
              fontSize: "13px",
              borderRadius: 0,
              clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
            },
          }}
        />
      </body>
    </html>
  );
}
