import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { BottomNav, TopBar } from "@/app/components/Nav";
import { SessionProvider } from "@/app/components/Session";
import { ToastProvider } from "@/app/components/Toast";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700", "800"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://muno-events.vercel.app"),
  title: { default: "muno — eventos tech, IA y startups en Madrid", template: "%s · muno" },
  description:
    "Todos los meetups, conferencias, hackathons y networking de tech e IA de Madrid en un sitio. Apúntate con tu gente y comparte las fotos después.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1822" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} antialiased`}>
      <body className="min-h-dvh overflow-x-clip">
        <SessionProvider>
          <ToastProvider>
            <TopBar />
            <div className="pb-24 sm:pb-12">{children}</div>
            <BottomNav />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
