import { useApp } from '@/contexts/AppContext';
import { router } from 'expo-router';
import { Shield, Lock, Phone } from 'lucide-react-native';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthScreen() {
  const { login, theme } = useApp();
  const [phone, setPhone] = useState('');

  const styles = createStyles(theme);

  const handleLogin = () => {
    if (phone.length >= 10) {
      login(phone);
      router.replace('/');
    }
  };

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Shield size={60} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>CLASSIFIED ACCESS</Text>
          <Text style={styles.subtitle}>NETWORK INTELLIGENCE SYSTEM</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Lock size={20} color={theme.primaryDim} style={styles.inputIcon} />
            <Text style={styles.label}>SECURE LINE AUTHENTICATION</Text>
          </View>

          <View style={styles.phoneInputContainer}>
            <Phone size={20} color={theme.primary} style={styles.phoneIcon} />
            <TextInput
              style={styles.input}
              placeholder="+7 XXX XXX XX XX"
              placeholderTextColor={theme.primaryDim}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={20}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, phone.length < 10 && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={phone.length < 10}
            activeOpacity={0.7}
          >
            <View style={styles.buttonBorder}>
              <Text style={styles.buttonText}>
                {'>'} ESTABLISH CONNECTION
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.warning}>
            ⚠ UNAUTHORIZED ACCESS PROHIBITED
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SYSTEM STATUS: ACTIVE</Text>
          <Text style={styles.footerText}>ENCRYPTION: AES-256</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: theme.primary,
    marginTop: 20,
    letterSpacing: 4,
    fontFamily: 'monospace' as const,
  },
  subtitle: {
    fontSize: 12,
    color: theme.primaryDim,
    marginTop: 8,
    letterSpacing: 2,
    fontFamily: 'monospace' as const,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 100,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  label: {
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 32,
  },
  phoneIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  button: {
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonBorder: {
    borderWidth: 2,
    borderColor: theme.primary,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: theme.overlay,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  warning: {
    fontSize: 11,
    color: theme.danger,
    textAlign: 'center',
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  footer: {
    paddingBottom: 20,
    gap: 4,
  },
  footerText: {
    fontSize: 10,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    textAlign: 'center',
  },
});
