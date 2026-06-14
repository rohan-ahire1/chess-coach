"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

export default function Navbar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="brand" aria-label="Coachmate home">
          <Logo />
          <span className="brand-name">Coachmate</span>
        </Link>
        <nav className="nav-links">
          <Link className={`nav-link${isActive("/") ? " active" : ""}`} href="/">
            Coach
          </Link>
          <Link className={`nav-link${isActive("/play") ? " active" : ""}`} href="/play">
            Play
          </Link>
        </nav>
      </div>
    </header>
  );
}
