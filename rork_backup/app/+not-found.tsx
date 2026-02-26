import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/contexts/AppContext';

export default function NotFoundScreen() {
  const { theme } = useApp();
  const styles = createStyles(theme);
  
  return (
    <>
      <Stack.Screen options={{ title: 'ERROR 404' }} />
      <View style={styles.container}>
        <Text style={styles.title}>ERROR 404</Text>
        <Text style={styles.subtitle}>ACCESS DENIED</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{'>'} RETURN TO BASE</Text>
        </Link>
      </View>
    </>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  title: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.primaryDim,
    marginTop: 8,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  link: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  linkText: {
    fontSize: 14,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
});
