"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
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
          <Link
            className={`nav-link${isActive("/") ? " active" : ""}`}
            href="/"
            aria-current={isActive("/") ? "page" : undefined}
          >
            Coach
          </Link>
          <Link
            className={`nav-link${isActive("/play") ? " active" : ""}`}
            href="/play"
            aria-current={isActive("/play") ? "page" : undefined}
          >
            Play
          </Link>
        </nav>
        <div className="nav-utilities">
          <span className="local-indicator">
            <Icon name="shield-check" size={15} />
            Local-first
          </span>
          <a className="help-link" href="mailto:hello@coachmate.app">
            <Icon name="help-circle" size={20} />
            Help
          </a>
        </div>
      </div>
    </header>
  );
}
