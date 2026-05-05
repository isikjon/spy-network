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

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: Platform.OS !== 'web',
      retry: 1,
    },
  },
});

function RootLayoutNav() {
  const { isAuthenticated, isLoading, theme, tutorialCompleted, completeTutorial, t } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const [showTutorial, setShowTutorial] = useState(false);
  const hasNavigated = useRef(false);

  const rootSegment = segments?.[0] ?? '';

  const inAuth = rootSegment === 'auth';
  const inAdmin = rootSegment === 'admin' || rootSegment === 'admin-analytics';

  useEffect(() => {
    if (isLoading) return;
    if (!rootNavState?.key) return;

    if (!isAuthenticated && !inAuth && !inAdmin) {
      console.log('[RootLayoutNav] redirect -> /auth', { rootSegment, isAuthenticated });
      hasNavigated.current = true;
      setTimeout(() => {
        router.replace('/auth');
      }, 0);
      return;
    }

    if (isAuthenticated && inAuth) {
      console.log('[RootLayoutNav] redirect -> /(tabs)', { rootSegment, isAuthenticated });
      hasNavigated.current = true;
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 0);
      return;
    }

    hasNavigated.current = false;
  }, [inAdmin, inAuth, isAuthenticated, isLoading, rootNavState?.key, rootSegment, router]);

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
        <Stack.Screen name="admin-analytics" options={{ headerShown: true }} />
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
    void SplashScreen.hideAsync();

    if (Platform.OS === "android") {
      void NavigationBar.setBackgroundColorAsync("rgba(0,0,0,0.01)");
      void NavigationBar.setVisibilityAsync("hidden");
      void NavigationBar.setBehaviorAsync("overlay-swipe");
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
