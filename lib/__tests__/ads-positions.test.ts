import { describe, expect, it } from "vitest";
import { getInlineAdPositions } from "../ad-inline-positions";

describe("getInlineAdPositions", () => {
  it("returns empty array when fewer than 4 items", () => {
    expect(getInlineAdPositions(0, 3, 7)).toEqual([]);
    expect(getInlineAdPositions(3, 3, 7)).toEqual([]);
  });

  it("returns sorted indices within range for longer lists", () => {
    const positions = getInlineAdPositions(20, 3, 7);
    expect(positions.length).toBeGreaterThan(0);
    for (const idx of positions) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(19);
    }
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });
});
