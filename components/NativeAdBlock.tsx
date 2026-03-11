import React from 'react';
import { Platform, View } from 'react-native';
import { YandexBanner } from './YandexBanner';
import { useApp } from '@/contexts/AppContext';

/**
 * Inline ad block between list items. Renders only BannerView, no wrapper.
 * Yandex banners include their own ad disclosure.
 */
export function NativeAdBlock() {
  const { subscriptionLevel } = useApp();

  if (subscriptionLevel === 'working' || Platform.OS === 'web') return null;

  return (
    <View style={{ marginBottom: 12 }}>
      <YandexBanner inline />
    </View>
  );
}
