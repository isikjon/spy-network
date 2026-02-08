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

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading, theme, tutorialCompleted, completeTutorial, t } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const [showTutorial, setShowTutorial] = useState(false);
  const hasNavigated = useRef(false);

  const rootSegment = segments?.[0] ?? '';

  useEffect(() => {
    if (isLoading) return;
    if (!rootNavState?.key) return;

    const inAuth = rootSegment === 'auth';
    const inAdmin = rootSegment === 'admin';

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
