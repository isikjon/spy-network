/** Pure helpers for inline ad slots (no react-native). */

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Returns indices (0-based) after which to insert ad blocks.
 */
export function getInlineAdPositions(
  itemCount: number,
  minGap: number,
  maxGap: number,
): number[] {
  if (itemCount < 4) return [];
  const positions: number[] = [];
  let next = 0;

  while (next < itemCount - 1) {
    const gap = minGap + Math.floor(seededRandom(next * 7 + itemCount) * (maxGap - minGap + 1));
    next += gap;
    if (next >= itemCount - 1) break;
    positions.push(next);
    next += 1;
  }
  return positions;
}
