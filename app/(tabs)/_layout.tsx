import { Tabs } from "expo-router";
import { Home, Search, User } from "lucide-react-native";
import React from "react";
import { Platform, View } from "react-native";
import { useApp } from "@/contexts/AppContext";

export default function TabLayout() {
  const { theme } = useApp();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.text || "#FFFFFF",
        tabBarInactiveTintColor: theme.primaryDim || "#666666",
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border || "rgba(255,255,255,0.08)",
          borderTopWidth: 0.5,
          height: Platform.OS === "ios" ? 84 : 60,
          paddingTop: 8,
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
          tabBarIcon: ({ focused, color }) => (
            <Home
              size={26}
              color={color}
              strokeWidth={focused ? 2.5 : 1.5}
              fill={focused ? color : "transparent"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Search
              size={26}
              color={color}
              strokeWidth={focused ? 2.5 : 1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View
              style={
                focused
                  ? {
                      borderWidth: 2,
                      borderColor: color,
                      borderRadius: 50,
                      padding: 1,
                    }
                  : undefined
              }
            >
              <User
                size={focused ? 22 : 26}
                color={color}
                strokeWidth={focused ? 2 : 1.5}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
