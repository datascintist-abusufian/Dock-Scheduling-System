import type { Metadata } from "next";
// Self-hosted fonts (no build-time network dependency).
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { Nav } from "@/components/Nav";
import { getRepository } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dock Scheduling", template: "%s · Dock Scheduling" },
  description: "Berth reservations with automatic conflict and vessel-fit checks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = getRepository().mode;
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Nav demoMode={mode === "memory"} />
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
