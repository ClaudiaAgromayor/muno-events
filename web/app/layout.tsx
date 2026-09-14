import type { Metadata } from "next";
import { Instrument_Serif, Space_Grotesk } from "next/font/google";
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

export const metadata: Metadata = {
  title: "muno — eventos tech en Madrid",
  description: "Conferencias, meetups y hackathons de tech, IA y ML en Madrid, curados en un solo sitio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${instrumentSerif.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
