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

      {/* Колонка ПРОФИЛЬ — сворачивается */}
      {profileVisible && (
        <View style={[styles.profileColumn, { borderLeftColor: theme.border }]}>
          {/* Кнопка сворачивания — внутри колонки профиля */}
          <TouchableOpacity
            style={[styles.toggleButton, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setProfileVisible(false)}
            activeOpacity={0.7}
          >
            <ChevronRight size={16} color={theme.primary} strokeWidth={2} />
          </TouchableOpacity>
          <ProfileScreen />
        </View>
      )}

      {/* Кнопка разворачивания — когда профиль скрыт */}
      {!profileVisible && (
        <TouchableOpacity
          style={[styles.expandButton, { backgroundColor: theme.background, borderColor: theme.border }]}
          onPress={() => setProfileVisible(true)}
          activeOpacity={0.7}
        >
          <ChevronLeft size={16} color={theme.primary} strokeWidth={2} />
        </TouchableOpacity>
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
    position: 'relative' as const,
    width: 340,
    borderLeftWidth: 1,
    overflow: 'visible' as const,
  },
  toggleButton: {
    position: 'absolute' as const,
    left: -24,
    top: '50%' as any,
    zIndex: 10,
    width: 24,
    height: 48,
    borderWidth: 1,
    borderRightWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButton: {
    width: 24,
    height: 48,
    borderWidth: 1,
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 'auto' as any,
    marginBottom: 'auto' as any,
  },
});
