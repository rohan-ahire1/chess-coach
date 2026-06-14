import { NextRequest, NextResponse } from "next/server";
import type { Profile } from "@/lib/types";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are a warm, direct chess coach. Given a player's weakness summary, write a short readout that:
- names the single biggest leak in their game,
- when a concrete example move is provided, references it specifically (e.g. "in one game you played Nf3 and dropped a piece"),
- explains briefly why this likely happens for a player at their level,
- gives exactly one concrete drill or habit to fix it.
Max 200 words. Plain language. No engine jargon, no centipawn numbers, no long move lists. Be encouraging but honest.`;

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
  };
}

export async function POST(req: NextRequest) {
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
