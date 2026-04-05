import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createYandexAdsScheduler } from "../yandex-ads-scheduler";

function makeDeps(platformOS: string) {
  const initializeSdk = vi.fn();
  const runAfterInteractions = vi.fn((cb: () => void) => {
    cb();
    return { cancel: () => {} };
  });
  return {
    platformOS,
    runAfterInteractions,
    scheduleDelayed: (cb: () => void, ms: number) => {
      setTimeout(cb, ms);
    },
    initializeSdk,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createYandexAdsScheduler", () => {
  it("Android: calls initializeSdk immediately, no InteractionManager deferral", () => {
    const deps = makeDeps("android");
    const { startYandexAdsInitialization } = createYandexAdsScheduler(deps);
    startYandexAdsInitialization();
    expect(deps.initializeSdk).toHaveBeenCalledTimes(1);
    expect(deps.runAfterInteractions).not.toHaveBeenCalled();
  });

  it("iOS: defers initializeSdk until after InteractionManager and 1500ms", async () => {
    const deps = makeDeps("ios");
    deps.runAfterInteractions.mockImplementation((cb: () => void) => {
      queueMicrotask(cb);
      return { cancel: () => {} };
    });
    const { startYandexAdsInitialization } = createYandexAdsScheduler(deps);
    startYandexAdsInitialization();
    expect(deps.initializeSdk).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(deps.initializeSdk).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1499);
    expect(deps.initializeSdk).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(deps.initializeSdk).toHaveBeenCalledTimes(1);
  });

  it("idempotent start on Android", () => {
    const deps = makeDeps("android");
    const { startYandexAdsInitialization } = createYandexAdsScheduler(deps);
    startYandexAdsInitialization();
    startYandexAdsInitialization();
    expect(deps.initializeSdk).toHaveBeenCalledTimes(1);
  });

  it("web: never calls initializeSdk", () => {
    const deps = makeDeps("web");
    const { startYandexAdsInitialization, whenYandexAdsReady } = createYandexAdsScheduler(deps);
    startYandexAdsInitialization();
    expect(deps.initializeSdk).not.toHaveBeenCalled();
    void whenYandexAdsReady();
    expect(deps.initializeSdk).not.toHaveBeenCalled();
  });

  it("whenYandexAdsReady on iOS resolves after full defer chain", async () => {
    const deps = makeDeps("ios");
    deps.runAfterInteractions.mockImplementation((cb: () => void) => {
      queueMicrotask(cb);
      return { cancel: () => {} };
    });
    const { whenYandexAdsReady } = createYandexAdsScheduler(deps);
    const p = whenYandexAdsReady();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1500);
    await p;
    expect(deps.initializeSdk).toHaveBeenCalledTimes(1);
  });

  it("whenYandexAdsReady on Android resolves after sync init", async () => {
    const deps = makeDeps("android");
    const { startYandexAdsInitialization, whenYandexAdsReady } = createYandexAdsScheduler(deps);
    startYandexAdsInitialization();
    await expect(whenYandexAdsReady()).resolves.toBeUndefined();
    expect(deps.initializeSdk).toHaveBeenCalledTimes(1);
  });

  it("isAppOpenAdSupported only on Android", () => {
    expect(createYandexAdsScheduler(makeDeps("android")).isAppOpenAdSupported()).toBe(true);
    expect(createYandexAdsScheduler(makeDeps("ios")).isAppOpenAdSupported()).toBe(false);
    expect(createYandexAdsScheduler(makeDeps("web")).isAppOpenAdSupported()).toBe(false);
  });
});
