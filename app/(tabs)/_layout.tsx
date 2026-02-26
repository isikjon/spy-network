import { Tabs } from "expo-router";
import { Users, Network, User } from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";
import { useApp } from "@/contexts/AppContext";

export default function TabLayout() {
  const { theme, t } = useApp();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.primaryDim,
        tabBarStyle: Platform.OS === 'web'
          ? { display: 'none' }
          : {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
              borderTopWidth: 2,
            },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.dossiers,
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: t.tabs.network,
          tabBarIcon: ({ color }) => <Network size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
