import { Tabs } from "expo-router";
import { Users, Share2, User } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { useApp } from "@/contexts/AppContext";

export default function TabLayout() {
  const { theme } = useApp();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary || "#00FF41",
        tabBarInactiveTintColor: theme.primaryDim || "#004d18",
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "monospace",
          letterSpacing: 1,
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border || "rgba(0,255,65,0.15)",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "ДОСЬЕ",
          tabBarIcon: ({ focused, color }) => (
            <Users
              size={24}
              color={color}
              strokeWidth={focused ? 2 : 1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          tabBarLabel: "СЕТЬ",
          tabBarIcon: ({ focused, color }) => (
            <Share2
              size={24}
              color={color}
              strokeWidth={focused ? 2 : 1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: "ПРОФИЛЬ",
          tabBarIcon: ({ focused, color }) => (
            <User
              size={24}
              color={color}
              strokeWidth={focused ? 2 : 1.5}
            />
          ),
        }}
      />
    </Tabs>
  );
}
