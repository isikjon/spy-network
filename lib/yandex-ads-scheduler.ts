/**
 * Testable scheduling for Yandex Mobile Ads init (no react-native / yandex-mobile-ads imports).
 * iOS: defer initializeSdk until after interactions + delay to reduce main-thread jank.
 */

export type YandexAdsSchedulerDeps = {
  platformOS: string;
  runAfterInteractions: (callback: () => void) => { cancel: () => void };
  scheduleDelayed: (callback: () => void, delayMs: number) => void;
  initializeSdk: () => void;
};

const IOS_INIT_DELAY_MS = 1500;

export function createYandexAdsScheduler(deps: YandexAdsSchedulerDeps) {
  let initDone = false;
  let initializationStarted = false;
  const waiters: Array<() => void> = [];

  function flushWaiters() {
    initDone = true;
    while (waiters.length) {
      const r = waiters.pop();
      r?.();
    }
  }

  function startYandexAdsInitialization(): void {
    if (deps.platformOS === "web" || initializationStarted) return;
    initializationStarted = true;

    const runInit = () => {
      if (initDone) return;
      try {
        deps.initializeSdk();
      } catch {
        /* logged in production wrapper */
      }
      flushWaiters();
    };

    if (deps.platformOS === "ios") {
      deps.runAfterInteractions(() => {
        deps.scheduleDelayed(runInit, IOS_INIT_DELAY_MS);
      });
    } else {
      runInit();
    }
  }

  function whenYandexAdsReady(): Promise<void> {
    if (deps.platformOS === "web" || initDone) return Promise.resolve();
    if (!initializationStarted) startYandexAdsInitialization();
    return new Promise((resolve) => waiters.push(resolve));
  }

  function isAppOpenAdSupported(): boolean {
    return deps.platformOS === "android";
  }

  return {
    startYandexAdsInitialization,
    whenYandexAdsReady,
    isAppOpenAdSupported,
  };
}
