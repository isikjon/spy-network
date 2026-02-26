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

  // На вебе приложение под /app/* — pathname /app/auth даёт segments ['app','auth'], поэтому
  // rootSegment === 'auth' ложно. Считаем inAuth по pathname, чтобы не редиректить с /app/auth на /auth.
  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
  const pathnameIsAuth = isWeb && /\/auth\/?(\?|$)/.test(window.location.pathname);
  const inAuth = rootSegment === 'auth' || pathnameIsAuth;
  const inAdmin = rootSegment === 'admin';

  useEffect(() => {
    if (isLoading) return;
    if (!rootNavState?.key) return;

    if (!isAuthenticated && !inAuth && !inAdmin) {
      if (hasNavigated.current) return;
      console.log('[RootLayoutNav] redirect -> auth', { rootSegment, isAuthenticated });
      hasNavigated.current = true;
      setTimeout(() => {
        if (isWeb) {
          // Редирект в рамках приложения: остаёмся под /app/auth, иначе уходим на spynetwork.ru/auth
          window.location.pathname = '/app/auth';
        } else {
          router.replace('/auth');
        }
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
