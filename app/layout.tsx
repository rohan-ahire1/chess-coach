import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./Navbar";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Coachmate - train your chess, play the bot",
    template: "%s | Coachmate",
  },
  description:
    "Coachmate finds your recurring chess mistakes from real games, then lets you practice and play a tunable bot.",
  applicationName: "Coachmate",
  openGraph: {
    title: "Coachmate - find and fix your chess leaks",
    description:
      "Analyze recent Chess.com games, drill recurring mistakes on the board, and play a tunable bot.",
    siteName: "Coachmate",
    type: "website",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "Coachmate chess coach" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coachmate - find and fix your chess leaks",
    description:
      "Analyze recent Chess.com games, drill recurring mistakes on the board, and play a tunable bot.",
    images: ["/og.svg"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Navbar />
        <div className="app-main" id="main-content">
          {children}
        </div>
      </body>
    </html>
  );
}
