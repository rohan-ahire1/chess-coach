import type { Metadata, Viewport } from "next";
import { Archivo, Reenie_Beanie } from "next/font/google";
import "./globals.css";
import ReportProvider from "./ReportProvider";
import TopBar from "./TopBar";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const hand = Reenie_Beanie({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
  display: "swap",
});

const TITLE = "Coachmate: find the move that cost you the game";
const DESCRIPTION =
  "Link your Chess.com or Lichess profile. Stockfish reads your last 15 games in your browser, and a coach tells you what keeps going wrong. Free, no account.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: TITLE,
    template: "%s | Coachmate",
  },
  description: DESCRIPTION,
  applicationName: "Coachmate",
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Coachmate",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "A chess game drawn as one falling line on pink chart paper" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4B8A8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${hand.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <ReportProvider>
          <TopBar />
          <main id="main-content">{children}</main>
        </ReportProvider>
      </body>
    </html>
  );
}
