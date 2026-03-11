import React, { useEffect, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

let BannerAdViewComponent: any = null;
let BannerAdSizeClass: any = null;

if (Platform.OS !== 'web') {
  try {
    const yma = require('yandex-mobile-ads');
    BannerAdViewComponent = yma.BannerView;
    BannerAdSizeClass = yma.BannerAdSize;
  } catch (e) {
    console.warn('[ads] yandex-mobile-ads not available');
  }
}

const BANNER_ID = 'R-M-18890253-3';

type YandexBannerProps = {
  adUnitId?: string;
  /** Inline between list items: full width, smaller vertical margin */
  inline?: boolean;
};

export function YandexBanner({ adUnitId = BANNER_ID, inline }: YandexBannerProps) {
  const { width } = useWindowDimensions();
  const [adSize, setAdSize] = useState<any>(null);

  const bannerWidth = inline ? Math.floor(width - 40) : 320;
  const bannerHeight = inline ? 90 : 100;

  useEffect(() => {
    if (!BannerAdSizeClass || Platform.OS === 'web') return;
    BannerAdSizeClass.inlineSize(bannerWidth, bannerHeight)
      .then(setAdSize)
      .catch((e: any) => console.warn('[ads] banner size error:', e));
  }, [bannerWidth, bannerHeight]);

  if (!BannerAdViewComponent || !adSize || Platform.OS === 'web') return null;
  const BannerView = BannerAdViewComponent;
  return (
    <View style={{ alignItems: 'center', marginVertical: inline ? 0 : 12 }}>
      <BannerView adUnitId={adUnitId} size={adSize} />
    </View>
  );
}
