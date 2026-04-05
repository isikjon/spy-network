import { InteractionManager, Platform } from "react-native";
import { createYandexAdsScheduler } from "./yandex-ads-scheduler";

const scheduler = createYandexAdsScheduler({
  platformOS: Platform.OS,
  runAfterInteractions: (cb) => InteractionManager.runAfterInteractions(cb),
  scheduleDelayed: (cb, ms) => {
    setTimeout(cb, ms);
  },
  initializeSdk: () => {
    try {
      const { MobileAds } = require("yandex-mobile-ads");
      MobileAds.initialize();
      console.log("[ads] Yandex Mobile Ads initialized");
    } catch (e) {
      console.warn("[ads] Failed to init Yandex Ads:", e);
    }
  },
});

export const startYandexAdsInitialization = scheduler.startYandexAdsInitialization;
export const whenYandexAdsReady = scheduler.whenYandexAdsReady;
export const isAppOpenAdSupported = scheduler.isAppOpenAdSupported;
