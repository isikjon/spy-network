import * as GestureHandler from "react-native-gesture-handler";
import * as Updates from "expo-updates";
import { Platform, Alert } from "react-native";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { AppProvider, useApp } from "@/contexts/AppContext";
import LoadingScreen from "@/components/LoadingScreen";
import Tutorial from "@/components/Tutorial";
import { trpc, trpcClient } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    console.log("[RootLayout] updates status", {
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
      updateId: Updates.updateId,
      isEnabled: Updates.isEnabled,
    });

    if (!Updates.isEnabled) return;

    const timer = setTimeout(async () => {
      try {
        console.log("[RootLayout] checkForUpdateAsync: start");
        const result = await Updates.checkForUpdateAsync();
        console.log("[RootLayout] checkForUpdateAsync: result", result);
        if (result.isAvailable) {
          console.log("[RootLayout] fetchUpdateAsync: start");
          await Updates.fetchUpdateAsync();
          console.log("[RootLayout] reloadAsync: start");
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log("[RootLayout] expo-updates error (ignored)", {
          message: e instanceof Error ? e.message : String(e),
        });
        Alert.alert(
          "Update недоступен",
          "Не удалось скачать обновление. Продолжаем запуск с текущей версией.",
        );
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const { isAuthenticated, isLoading, isBootstrapped, theme, tutorialCompleted, completeTutorial, t } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const [showTutorial, setShowTutorial] = useState(false);
  const hasNavigated = useRef(false);

  const rootSegment = segments?.[0] ?? '';

  useEffect(() => {
    if (isLoading) return;
    if (!isBootstrapped) return;
    if (!rootNavState?.key) return;

    const inAuth = rootSegment === ('auth' as string);
    const inAdmin = rootSegment === ('admin' as string);

    if (!isAuthenticated && !inAuth && !inAdmin) {
      if (hasNavigated.current) return;
      console.log('[RootLayoutNav] redirect -> /auth', { rootSegment, isAuthenticated });
      hasNavigated.current = true;
      setTimeout(() => {
        router.replace('/auth' as any);
      }, 0);
      return;
    }

    if (isAuthenticated && inAuth) {
      if (hasNavigated.current) return;
      console.log('[RootLayoutNav] redirect -> /', { rootSegment, isAuthenticated });
      hasNavigated.current = true;
      setTimeout(() => {
        router.replace('/' as any);
      }, 0);
    }

    if ((isAuthenticated && !inAuth && !inAdmin) || (!isAuthenticated && inAuth)) {
      hasNavigated.current = false;
    }
  }, [isAuthenticated, isLoading, isBootstrapped, rootNavState?.key, rootSegment, router]);

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
        <Stack.Screen name="dossier/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: true }} />
        <Stack.Screen name="qr-scanner" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
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
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandler.GestureHandlerRootView style={{ flex: 1 }}>
          <AppProvider>
            <RootLayoutNav />
          </AppProvider>
        </GestureHandler.GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
