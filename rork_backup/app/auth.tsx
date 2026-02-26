import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { Shield, Lock, Phone, RefreshCw, Monitor } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function QrWebAuth({ theme, onLogin }: { theme: any; onLogin: (phone: string) => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const createSessionMutation = trpc.qrAuth.createSession.useMutation({
    onSuccess: (data) => {
      console.log('[QrWebAuth] session created', { sessionId: data.sessionId });
      setSessionId(data.sessionId);
      setExpired(false);
      setError(null);
    },
    onError: (err) => {
      console.log('[QrWebAuth] createSession error', err);
      setError('Failed to create session');
    },
  });

  const checkSessionQuery = trpc.qrAuth.checkSession.useQuery(
    { sessionId: sessionId ?? '' },
    {
      enabled: !!sessionId && !expired,
      refetchInterval: 2500,
      refetchIntervalInBackground: false,
    },
  );

  useEffect(() => {
    createSessionMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checkSessionQuery.data) return;

    const { status, phone } = checkSessionQuery.data;
    console.log('[QrWebAuth] checkSession result', { status, phone });

    if (status === 'confirmed' && phone) {
      onLogin(phone);
    } else if (status === 'expired') {
      setExpired(true);
      setSessionId(null);
    }
  }, [checkSessionQuery.data, onLogin]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleRefresh = useCallback(() => {
    setExpired(false);
    setError(null);
    setSessionId(null);
    createSessionMutation.mutate();
  }, [createSessionMutation]);

  const styles = createQrStyles(theme);

  const qrUrl = sessionId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(sessionId)}&bgcolor=0a0a0a&color=00ff41&format=png`
    : null;

  return (
    <View style={styles.qrContainer}>
      <View style={styles.qrIconRow}>
        <Monitor size={20} color={theme.primary} />
        <Text style={styles.qrTitle}>АВТОРИЗАЦИЯ ВЕБ-ВЕРСИИ</Text>
      </View>

      <Text style={styles.qrInstructions}>
        Отсканируйте QR-код{'\n'}в мобильном приложении
      </Text>

      <View style={styles.qrFrame}>
        <View style={styles.qrCornerTL} />
        <View style={styles.qrCornerTR} />
        <View style={styles.qrCornerBL} />
        <View style={styles.qrCornerBR} />

        {createSessionMutation.isPending && (
          <View style={styles.qrPlaceholder}>
            <ActivityIndicator color={theme.primary} size="large" />
            <Text style={styles.qrLoadingText}>GENERATING...</Text>
          </View>
        )}

        {expired && (
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrExpiredText}>СЕССИЯ ИСТЕКЛА</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
              <RefreshCw size={20} color={theme.primary} />
              <Text style={styles.refreshText}>ОБНОВИТЬ</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && !expired && (
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrExpiredText}>{error}</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
              <RefreshCw size={20} color={theme.primary} />
              <Text style={styles.refreshText}>ПОВТОРИТЬ</Text>
            </TouchableOpacity>
          </View>
        )}

        {qrUrl && !expired && !error && (
          <Image
            source={{ uri: qrUrl }}
            style={styles.qrImage}
            resizeMode="contain"
          />
        )}
      </View>

      {sessionId && !expired && (
        <Animated.View style={[styles.statusRow, { opacity: pulseAnim }]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>ОЖИДАНИЕ СКАНИРОВАНИЯ...</Text>
        </Animated.View>
      )}

      <View style={styles.stepsContainer}>
        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>Откройте приложение на телефоне</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>Перейдите в Профиль → «Привязать веб»</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>Наведите камеру на QR-код</Text>
        </View>
      </View>
    </View>
  );
}

export default function AuthScreen() {
  const { login, theme } = useApp();
  const [phone, setPhone] = useState<string>('');

  const isWeb = Platform.OS === 'web';

  const styles = createStyles(theme);

  const handleLogin = () => {
    if (phone.length >= 10) {
      console.log('[AuthScreen] login submit', { phoneLength: phone.length });
      login(phone);
    }
  };

  const handleQrLogin = useCallback((phoneNumber: string) => {
    console.log('[AuthScreen] QR login', { phone: phoneNumber });
    login(phoneNumber);
  }, [login]);

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Shield size={60} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>CLASSIFIED ACCESS</Text>
          <Text style={styles.subtitle}>NETWORK INTELLIGENCE SYSTEM</Text>
        </View>

        {isWeb ? (
          <View style={styles.form}>
            <QrWebAuth theme={theme} onLogin={handleQrLogin} />
          </View>
        ) : (
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
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>SYSTEM STATUS: ACTIVE</Text>
          <Text style={styles.footerText}>ENCRYPTION: AES-256</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createQrStyles = (theme: any) => StyleSheet.create({
  qrContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  qrIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  qrTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  qrInstructions: {
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    letterSpacing: 1,
  },
  qrFrame: {
    width: 270,
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    marginBottom: 20,
  },
  qrCornerTL: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: theme.primary,
  },
  qrCornerTR: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.primary,
  },
  qrCornerBL: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: theme.primary,
  },
  qrCornerBR: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.primary,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.overlay,
    gap: 16,
  },
  qrLoadingText: {
    fontSize: 11,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  qrExpiredText: {
    fontSize: 12,
    color: theme.danger,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  refreshText: {
    fontSize: 12,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    fontWeight: '600' as const,
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
  },
  statusText: {
    fontSize: 11,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  stepsContainer: {
    gap: 12,
    width: '100%',
    maxWidth: 320,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primaryDim,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
  },
});

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
