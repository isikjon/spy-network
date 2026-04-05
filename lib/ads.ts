import { Platform } from 'react-native';
import { getInlineAdPositions as computeInlineAdPositions } from './ad-inline-positions';

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

/**
 * Returns indices (0-based) after which to insert ad blocks.
 * Positions are randomised based on list length for variety.
 */
export function getInlineAdPositions(itemCount: number): number[] {
  return computeInlineAdPositions(
    itemCount,
    ADS_CONFIG.NATIVE_AD_MIN_GAP,
    ADS_CONFIG.NATIVE_AD_MAX_GAP,
  );
}
