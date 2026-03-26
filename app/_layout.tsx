import "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as NavigationBar from "expo-navigation-bar";
import React, { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider, useApp } from "@/contexts/AppContext";
import LoadingScreen from "@/components/LoadingScreen";
import Tutorial from "@/components/Tutorial";
import { trpc, trpcClient } from "@/lib/trpc";
import { isStaffWebBuild } from "@/lib/staff";

let adsInitialized = false;

function initYandexAds() {
  if (adsInitialized || Platform.OS === 'web') return;
  adsInitialized = true;
  try {
    const { MobileAds } = require('yandex-mobile-ads');
    MobileAds.initialize();
    console.log('[ads] Yandex Mobile Ads initialized');
  } catch (e) {
    console.warn('[ads] Failed to init Yandex Ads:', e);
  }
}

let appOpenShown = false;
async function showAppOpenAd() {
  if (Platform.OS === 'web' || appOpenShown) return;
  appOpenShown = true;
  try {
    const { AppOpenAdLoader, AdRequestConfiguration } = require('yandex-mobile-ads');
    const loader = await AppOpenAdLoader.create();
    const config = new AdRequestConfiguration({ adUnitId: 'R-M-18890253-1' });
    const ad = await loader.loadAd(config);
    await ad.show();
    console.log('[ads] App Open ad shown');
  } catch (e) {
    console.warn('[ads] App Open ad error:', e);
  }
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading, theme, tutorialCompleted, completeTutorial, t, subscriptionLevel } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const [showTutorial, setShowTutorial] = useState(false);
  const hasNavigated = useRef(false);

  const rootSegment = segments?.[0] ?? '';

  const inAuth = rootSegment === 'auth';
  const inAdmin = rootSegment === 'admin';

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!rootNavState?.key) return;
    if (isStaffWebBuild()) return;
    if (!inAdmin) return;
    router.replace("/(tabs)");
  }, [inAdmin, router, rootNavState?.key]);

  useEffect(() => {
    if (isLoading) return;
    if (!rootNavState?.key) return;

    if (!isAuthenticated && !inAuth && !inAdmin) {
      if (hasNavigated.current) return;
      console.log('[RootLayoutNav] redirect -> /auth', { rootSegment, isAuthenticated });
      hasNavigated.current = true;
      setTimeout(() => {
        router.replace('/auth');
      }, 0);
      return;
    }

    if (isAuthenticated && inAuth) {
      if (hasNavigated.current) return;
      console.log('[RootLayoutNav] redirect -> /(tabs)', { rootSegment, isAuthenticated });
      hasNavigated.current = true;
      setTimeout(() => {
        router.replace('/(tabs)');
        if (subscriptionLevel !== 'working') {
          setTimeout(showAppOpenAd, 1500);
        }
      }, 0);
    }

    if ((isAuthenticated && !inAuth && !inAdmin) || (!isAuthenticated && inAuth)) {
      hasNavigated.current = false;
    }
  }, [isAuthenticated, isLoading, rootNavState?.key, rootSegment]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !tutorialCompleted) {
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, tutorialCompleted]);

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    completeTutorial();
  };

  if (isLoading) {
    return <LoadingScreen theme={theme} />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" options={{ headerShown: true }} />
        <Stack.Screen
          name="qr-confirm"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="qr-scanner"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
      <Tutorial
        visible={showTutorial}
        onClose={handleCloseTutorial}
        theme={theme}
        t={t}
      />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    initYandexAds();

    if (Platform.OS === "android") {
      NavigationBar.setBackgroundColorAsync("rgba(0,0,0,0.01)");
      NavigationBar.setVisibilityAsync("hidden");
      NavigationBar.setBehaviorAsync("overlay-swipe");
    }
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AppProvider>
            <RootLayoutNav />
          </AppProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
