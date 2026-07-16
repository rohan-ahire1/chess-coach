import { NextRequest, NextResponse } from "next/server";
import { buildPatternPayload } from "@/lib/patterns";
import type { Profile } from "@/lib/types";

export const runtime = "edge";

const MAX_BODY_BYTES = 80_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const SYSTEM_PROMPT = `You are a warm, direct chess coach. Given a player's weakness summary, write a short readout that:
- names the single biggest leak in their game,
- when recurring patterns are provided, use them as stronger evidence than raw counts,
- when a concrete example move is provided, references it specifically (e.g. "in one game you played Nf3 and dropped a piece"),
- explains briefly why this likely happens for a player at their level,
- gives exactly one concrete drill or habit to fix it.
Max 200 words. Plain language. No engine jargon, no centipawn numbers, no long move lists. Be encouraging but honest.`;

function rateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (existing.count >= RATE_LIMIT_MAX) return false;
  existing.count++;
  return true;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validProfile(profile: Profile): boolean {
  return (
    profile != null &&
    isFiniteNumber(profile.gamesAnalyzed) &&
    profile.gamesAnalyzed >= 0 &&
    isFiniteNumber(profile.totalBlunders) &&
    Array.isArray(profile.blunders) &&
    profile.blunders.length <= 500
  );
}

function buildUserPayload(profile: Profile) {
  const examples = [...profile.blunders]
    .sort((a, b) => b.swingCp - a.swingCp)
    .slice(0, 5)
    .map((b) => ({
      kind: b.mistakeKind,
      phase: b.phase,
      move: b.move,
      move_number: b.moveNumber,
      swing_pawns: Math.round(b.swingCp / 10) / 10,
      material_lost_pawns: b.materialLost,
      clock_after_seconds: b.clockAfterSec,
      time_spent_seconds: b.timeSpentSec,
    }));

  return {
    rating: profile.rating,
    games_analyzed: profile.gamesAnalyzed,
    blunders_by_phase: profile.blundersByPhase,
    mistakes_by_kind: profile.mistakesByKind,
    hanging_pieces: profile.hangingPieces,
    worst_hangs: profile.worstHangs.map((h) => ({
      phase: h.phase,
      kind: h.mistakeKind,
      move: h.move,
      material_lost_pawns: h.materialLost,
      move_number: h.moveNumber,
    })),
    representative_examples: examples,
    recurring_patterns: buildPatternPayload(profile).top_patterns,
  };
}

export async function POST(req: NextRequest) {
  const key = rateLimitKey(req);
  if (!checkRateLimit(key)) {
    return NextResponse.json({ error: "Too many coaching requests. Try again in a minute." }, { status: 429 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Coaching is not configured." }, { status: 503 });
  }

  let profile: Profile;
  try {
    profile = (await req.json()) as Profile;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!validProfile(profile)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const model = process.env.COACH_MODEL || "deepseek/deepseek-v4-flash";

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(buildUserPayload(profile)) },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Coaching temporarily unavailable." }, { status: 502 });
    }

    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: "Coaching temporarily unavailable." }, { status: 502 });
    }

    return NextResponse.json({ coaching: text.trim() });
  } catch {
    return NextResponse.json({ error: "Coaching temporarily unavailable." }, { status: 502 });
  }
}
