import { useApp } from '@/contexts/AppContext';
import { View, StyleSheet } from 'react-native';
import DossiersScreen from './index';
import NetworkScreen from './network';
import ProfileScreen from './profile';

export default function WebTabLayout() {
  const { theme } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.column, { borderRightColor: theme.border }]}>
        <DossiersScreen />
      </View>
      <View style={[styles.column, { borderRightColor: theme.border }]}>
        <NetworkScreen />
      </View>
      <View style={[styles.column, { borderRightWidth: 0 }]}>
        <ProfileScreen />
      </View>
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
});
