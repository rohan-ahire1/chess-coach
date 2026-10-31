"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PLATFORM_LABEL } from "@/lib/games";
import type { GameFilter, Platform } from "@/lib/types";
import { useReport } from "./ReportProvider";

const FILTERS: { value: GameFilter; label: string }[] = [
  { value: "standard", label: "Rapid and blitz" },
  { value: "rapid", label: "Rapid" },
  { value: "blitz", label: "Blitz" },
  { value: "bullet", label: "Bullet" },
];

export default function LinkForm({ submitLabel = "Read my games" }: { submitLabel?: string }) {
  const router = useRouter();
  const { attempt, link, start, isRunning } = useReport();
  const [platform, setPlatform] = useState<Platform>(attempt?.platform ?? "chesscom");
  const [username, setUsername] = useState(attempt?.username ?? "");
  const [filter, setFilter] = useState<GameFilter>(attempt?.filter ?? "standard");
  const [count, setCount] = useState(attempt?.count ?? 15);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!link || attempt) return;
    setPlatform(link.platform);
    setUsername(link.username);
  }, [attempt, link]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      field.current?.focus();
      return;
    }
    start(platform, username, filter, count);
    router.push("/report");
  };

  return (
    <form className="link-form" onSubmit={submit}>
      <div className="platform" role="radiogroup" aria-label="Where you play">
        {(Object.keys(PLATFORM_LABEL) as Platform[]).map((value) => (
          <label key={value} className={platform === value ? "is-on" : undefined}>
            <input
              className="sr-only"
              type="radio"
              name="platform"
              value={value}
              checked={platform === value}
              onChange={() => setPlatform(value)}
            />
            {PLATFORM_LABEL[value]}
          </label>
        ))}
      </div>
      <div className="link-row">
        <label className="sr-only" htmlFor="username">
          Your {PLATFORM_LABEL[platform]} username
        </label>
        <input
          ref={field}
          id="username"
          className="field"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={`${PLATFORM_LABEL[platform]} username`}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={isRunning}>
          {submitLabel}
        </button>
      </div>
      <div className="link-options">
        <label>
          <span className="sr-only">Number of games</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            <option value={15}>Last 15 games</option>
            <option value={10}>Last 10 games</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Time control</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as GameFilter)}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </form>
  );
}
