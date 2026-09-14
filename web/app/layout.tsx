import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "@/app/components/Toast";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

// Para los datos (horas, plazas, contadores) -- un toque tecnico puntual sin tocar el
// resto de la identidad editorial. Antes "font-mono" caia en la fuente monoespaciada
// del sistema operativo, que no tiene por que pegar con el resto de tipografias elegidas.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "muno — eventos tech en Madrid",
  description: "Conferencias, meetups y hackathons de tech, IA y ML en Madrid, curados en un solo sitio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${instrumentSerif.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
