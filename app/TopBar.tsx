"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLATFORM_LABEL } from "@/lib/games";
import Mark from "./Mark";
import { useReport } from "./ReportProvider";

const LINKS = [
  { href: "/report", label: "Review", match: ["/report", "/review"] },
  { href: "/drill", label: "Drill", match: ["/drill"] },
  { href: "/play", label: "Play", match: ["/play"] },
  { href: "/method", label: "Method", match: ["/method"] },
];

export default function TopBar() {
  const pathname = usePathname();
  const { link, run, isRunning } = useReport();
  const isHome = pathname === "/";

  return (
    <header className={`topbar${isHome ? " on-chart" : ""}`}>
      <Link href="/" className="wordmark">
        <Mark />
        Coachmate
      </Link>
      <nav aria-label="Main">
        {LINKS.map((item) => {
          const active = item.match.some((m) => pathname.startsWith(m));
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {isRunning && run.games.length > 0 ? (
        <Link href="/report" className="topbar-who">
          Reading {Math.min(run.done + 1, run.games.length)} of {run.games.length}
        </Link>
      ) : (
        link && (
          <Link href="/report" className="topbar-who">
            {link.username}
            <small>
              {link.rating ?? PLATFORM_LABEL[link.platform]}
            </small>
          </Link>
        )
      )}
    </header>
  );
}
