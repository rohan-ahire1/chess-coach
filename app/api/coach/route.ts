import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const MAX_BODY_BYTES = 24_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const MAX_MOMENTS = 5;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const FACTS_ONLY = `Use only the facts you are given. Never invent a move, a piece, a square, a name or a number. Say "chances", never centipawns or evaluation. No move lists. No headings, no bullet points, no bold.`;

const REPORT_PROMPT = `You are a warm, direct chess coach talking to a club player about their recent games. Write a short read of their play that:
- names the one habit costing them the most,
- treats recurring patterns as stronger evidence than raw counts,
- refers to one concrete move from worst_moves ("on move 14 you played Bxf3 where Nd5 was there"),
- gives exactly one habit to practise.
Two short paragraphs, at most 110 words. Be honest and encouraging. If there are fewer than five games, say the sample is small. ${FACTS_ONLY}`;

const GAME_PROMPT = `You are a warm, direct chess coach annotating a club player's game. Each moment is a move that cost them. For each moment write one or two plain sentences, addressed to the player as "you": what the move allowed and what to look for next time. Use the opponent's reply and the better move when given. At most 40 words per moment. ${FACTS_ONLY}
Reply with only a JSON object mapping each moment's ply to its note, like {"27":"..."}.`;

function rateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  // Drop expired buckets so the map doesn't grow with every IP ever seen.
  if (buckets.size > 1000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
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

interface ReportData {
  games: number;
  worst_moves: unknown[];
}

interface GameData {
  moments: { ply: number }[];
}

function isObjectList(value: unknown, max: number): boolean {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    value.every((item) => typeof item === "object" && item !== null)
  );
}

function validReport(data: ReportData | null): boolean {
  return (
    data != null &&
    isFiniteNumber(data.games) &&
    data.games > 0 &&
    isObjectList(data.worst_moves, MAX_MOMENTS)
  );
}

function validGame(data: GameData | null): boolean {
  return (
    data != null &&
    Array.isArray(data.moments) &&
    data.moments.length > 0 &&
    data.moments.length <= MAX_MOMENTS &&
    data.moments.every((m) => isFiniteNumber(m?.ply))
  );
}

/** Models sometimes wrap JSON in prose or a code fence, so read between the braces. */
function parseNotes(text: string, moments: { ply: number }[]): Record<number, string> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const notes: Record<number, string> = {};
  for (const { ply } of moments) {
    const note = parsed[String(ply)];
    if (typeof note === "string" && note.trim()) notes[ply] = note.trim().slice(0, 600);
  }
  return Object.keys(notes).length > 0 ? notes : null;
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

  let body: { type?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const isGame = body.type === "game";
  const valid = isGame ? validGame(body.data as GameData) : body.type === "report" && validReport(body.data as ReportData);
  if (!valid) {
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
        max_tokens: isGame ? 500 : 300,
        messages: [
          { role: "system", content: isGame ? GAME_PROMPT : REPORT_PROMPT },
          { role: "user", content: JSON.stringify(body.data) },
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

    if (isGame) {
      const notes = parseNotes(text, (body.data as GameData).moments);
      if (!notes) return NextResponse.json({ error: "Coaching temporarily unavailable." }, { status: 502 });
      return NextResponse.json({ notes });
    }
    return NextResponse.json({ coaching: text.trim() });
  } catch {
    return NextResponse.json({ error: "Coaching temporarily unavailable." }, { status: 502 });
  }
}
