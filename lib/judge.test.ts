import { describe, expect, it } from "vitest";
import { judge, whiteWinPercent } from "@/lib/judge";

describe("judge", () => {
  it("returns null for no drop", () => {
    expect(judge(0)).toBeNull();
  });

  it("labels the Lichess thresholds", () => {
    expect(judge(5)).toBe("inaccuracy");
    expect(judge(10)).toBe("mistake");
    expect(judge(15)).toBe("blunder");
  });
});

describe("whiteWinPercent", () => {
  it("is 50 for an equal position", () => {
    expect(whiteWinPercent(0, null)).toBe(50);
  });

  it("treats mate as the ceiling", () => {
    expect(whiteWinPercent(null, 3)).toBeGreaterThan(95);
    expect(whiteWinPercent(null, -3)).toBeLessThan(5);
  });
});
