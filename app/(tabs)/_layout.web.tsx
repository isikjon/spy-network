import { useApp } from '@/contexts/AppContext';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import DossiersScreen from './index';
import NetworkScreen from './network';
import ProfileScreen from './profile';

export default function WebTabLayout() {
  const { theme } = useApp();
  const [profileVisible, setProfileVisible] = useState(true);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Колонка ДОСЬЕ */}
      <View style={[styles.column, { borderRightColor: theme.border }]}>
        <DossiersScreen />
      </View>

      {/* Колонка СЕТЬ */}
      <View style={[styles.column, { borderRightColor: theme.border }]}>
        <NetworkScreen />
      </View>

      {/* Кнопка сворачивания */}
      <TouchableOpacity
        style={[styles.toggleButton, { backgroundColor: theme.background, borderColor: theme.border }]}
        onPress={() => setProfileVisible(v => !v)}
        activeOpacity={0.7}
      >
        {profileVisible
          ? <ChevronRight size={16} color={theme.primary} strokeWidth={2} />
          : <ChevronLeft size={16} color={theme.primary} strokeWidth={2} />
        }
      </TouchableOpacity>

      {/* Колонка ПРОФИЛЬ — сворачивается */}
      {profileVisible && (
        <View style={[styles.profileColumn, { borderLeftColor: theme.border }]}>
          <ProfileScreen />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    borderRightWidth: 1,
    overflow: 'hidden' as const,
  },
  profileColumn: {
    width: 340,
    borderLeftWidth: 1,
    overflow: 'hidden' as const,
  },
  toggleButton: {
    position: 'absolute' as const,
    right: 341,
    top: '50%' as any,
    zIndex: 10,
    width: 24,
    height: 48,
    borderWidth: 1,
    borderRightWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
