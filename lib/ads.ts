import { Platform } from 'react-native';

export const ADS_CONFIG = {
  BANNER_ID: 'R-M-18890253-3',
  INTERSTITIAL_ID: 'R-M-18890253-2',
  APP_OPEN_ID: 'R-M-18890253-1',
  INTERSTITIAL_FREQUENCY: 4,
  /** Min items between inline ad blocks */
  NATIVE_AD_MIN_GAP: 3,
  /** Max items between inline ad blocks */
  NATIVE_AD_MAX_GAP: 7,
};

let interstitialCounter = 0;

export function shouldShowInterstitial(): boolean {
  if (Platform.OS === 'web') return false;
  interstitialCounter++;
  return interstitialCounter % ADS_CONFIG.INTERSTITIAL_FREQUENCY === 0;
}

export function resetInterstitialCounter(): void {
  interstitialCounter = 0;
}

/** Seeded random 0..1 for stable ad positions */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Returns indices (0-based) after which to insert ad blocks.
 * Positions are randomised based on list length for variety.
 */
export function getInlineAdPositions(itemCount: number): number[] {
  if (itemCount < 4) return [];
  const positions: number[] = [];
  let next = 0;
  const minGap = ADS_CONFIG.NATIVE_AD_MIN_GAP;
  const maxGap = ADS_CONFIG.NATIVE_AD_MAX_GAP;

  while (next < itemCount - 1) {
    const gap = minGap + Math.floor(seededRandom(next * 7 + itemCount) * (maxGap - minGap + 1));
    next += gap;
    if (next >= itemCount - 1) break;
    positions.push(next);
    next += 1;
  }
  return positions;
}
