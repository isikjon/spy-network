import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { router, useLocalSearchParams } from 'expo-router';
import { Shield, RefreshCw, CheckCircle, AlertTriangle, Smartphone } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

type AuthStep = 'loading' | 'qr' | 'waiting' | 'done' | 'error';

const BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://spynetwork.ru';
const DEV_TEST_PHONE = '71111111111';

export default function WebAuthScreen() {
  const { loginWithToken, theme } = useApp();
  const [step, setStep] = useState<AuthStep>('loading');
  const [sessionId, setSessionId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const activeRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showDevForm, setShowDevForm] = useState(false);
  const [devPhone, setDevPhone] = useState(DEV_TEST_PHONE);
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState('');

  const params = useLocalSearchParams<{ dev?: string }>();
  useEffect(() => {
    if (params.dev === '1') setShowDevForm(true);
  }, [params.dev]);

  const createSessionMutation = trpc.qrAuth.createSession.useMutation();
  const requestCallMutation = trpc.phoneAuth.requestCall.useMutation();
  const utils = trpc.useUtils();
  const styles = createStyles(theme);

  // Таймер обратного отсчёта
  useEffect(() => {
    if (expiresAt <= 0) return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [expiresAt]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Поллинг статуса QR-сессии
  const startPoll = useCallback((sid: string) => {
    stopPoll();

    const check = async () => {
      if (!activeRef.current) return;
      try {
        const result = await utils.qrAuth.checkSession.fetch({ sessionId: sid });

        if (!activeRef.current) return;

        if (result.ok) {
          stopPoll();
          setStep('done');
          try {
            await loginWithToken(result.phone, result.token);
            setTimeout(() => router.replace('/(tabs)/profile'), 600);
          } catch {
            setStep('error');
            setErrorMsg('Ошибка сохранения сессии');
          }
          return;
        }

        if (result.error === 'EXPIRED' || result.error === 'REJECTED') {
          stopPoll();
          setStep('error');
          setErrorMsg(
            result.error === 'REJECTED'
              ? 'Авторизация отклонена на устройстве'
              : 'QR-код истёк. Обновите страницу.',
          );
        }

        if (result.error === 'PENDING' && (result as any).expiresAt) {
          setExpiresAt((result as any).expiresAt);
          if (step !== 'waiting') setStep('waiting');
        }
      } catch (e: any) {
        console.log('[web-auth] poll error', e?.message);
      }
    };

    check();
    pollRef.current = setInterval(check, 2500);
  }, [loginWithToken, step, stopPoll, utils]);

  const createSession = useCallback(async () => {
    setStep('loading');
    setErrorMsg('');
    stopPoll();

    try {
      const res = await createSessionMutation.mutateAsync();
      if (res.ok) {
        setSessionId(res.sessionId);
        setExpiresAt(Date.now() + 5 * 60 * 1000);
        setStep('qr');
        startPoll(res.sessionId);
      } else {
        setStep('error');
        setErrorMsg('Не удалось создать QR-сессию');
      }
    } catch (e: any) {
      setStep('error');
      setErrorMsg(e?.message || 'Ошибка сети');
    }
  }, [createSessionMutation, startPoll, stopPoll]);

  const devLogin = useCallback(async () => {
    let phone = devPhone.replace(/\D/g, '');
    if (phone.length === 10) phone = '7' + phone;
    if (phone.length === 11 && phone.startsWith('8')) phone = '7' + phone.slice(1);
    if (phone.length < 10) {
      setDevError('Введите номер (тест: 71111111111)');
      return;
    }
    setDevError('');
    setDevLoading(true);
    try {
      await requestCallMutation.mutateAsync({ phone });
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500));
        const status = await utils.phoneAuth.checkStatus.fetch({ phone });
        if (status.ok && status.token && status.phone) {
          await loginWithToken(status.phone, status.token);
          setTimeout(() => router.replace('/(tabs)'), 300);
          return;
        }
        if (status.ok === false && (status.error === 'EXPIRED' || status.error === 'NOT_FOUND')) {
          setDevError(status.error === 'EXPIRED' ? 'Сессия истекла' : 'Сессия не найдена');
          break;
        }
        attempts++;
      }
      if (attempts >= maxAttempts) setDevError('Таймаут');
    } catch (e: any) {
      setDevError(e?.message || 'Ошибка');
    } finally {
      setDevLoading(false);
    }
  }, [devPhone, loginWithToken, requestCallMutation, utils.phoneAuth.checkStatus]);

  // Создаём сессию при монтировании (только если не показываем dev-форму)
  useEffect(() => {
    if (showDevForm) return;
    activeRef.current = true;
    createSession();
    return () => {
      activeRef.current = false;
      stopPoll();
    };
  }, [showDevForm]);

  const deepLink = `rork-app://qr-confirm?session=${sessionId}&base=${encodeURIComponent(BASE_URL)}`;

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Shield size={52} color={theme.primary} strokeWidth={1.5} />
            <Text style={styles.title}>Вход в Spy Network Web</Text>
          </View>

          {/* Content */}
          <View style={styles.form}>

            {/* Dev login form */}
            {showDevForm ? (
              <View style={styles.devForm}>
                <Text style={styles.devTitle}>Вход для разработчика</Text>
                <Text style={styles.hintText}>Тестовый номер: 71111111111 (автовход)</Text>
                <TextInput
                  style={styles.devInput}
                  value={devPhone}
                  onChangeText={setDevPhone}
                  placeholder="79XXXXXXXXX"
                  placeholderTextColor={theme.primaryDim}
                  keyboardType="phone-pad"
                  editable={!devLoading}
                />
                {devError ? <Text style={styles.devError}>{devError}</Text> : null}
                <TouchableOpacity
                  style={[styles.button, styles.devButton]}
                  onPress={devLogin}
                  activeOpacity={0.7}
                  disabled={devLoading}
                >
                  <View style={styles.buttonBorder}>
                    {devLoading ? (
                      <ActivityIndicator color={theme.primary} size="small" />
                    ) : (
                      <Text style={styles.buttonText}>ВОЙТИ</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowDevForm(false); setDevError(''); }} style={styles.devBack}>
                  <Text style={styles.footerText}>← Назад к QR-входу</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
            {/* Loading */}
            {step === 'loading' && (
              <View style={styles.centered}>
                <ActivityIndicator color={theme.primary} size="large" />
                <Text style={styles.hintText}>ГЕНЕРАЦИЯ QR-КОДА...</Text>
              </View>
            )}

            {/* QR displayed */}
            {(step === 'qr' || step === 'waiting') && sessionId !== '' && (
              <>
                <View style={styles.instructionRow}>
                  <Smartphone size={18} color={theme.primaryDim} />
                  <Text style={styles.instruction}>
                    Отсканируйте QR с мобильного приложения Spy Network
                  </Text>
                </View>

                <View style={styles.qrContainer}>
                  <QRCode
                    value={deepLink}
                    size={200}
                    color={theme.primary}
                    backgroundColor={theme.background}
                  />
                </View>

                <View style={styles.statusRow}>
                  <ActivityIndicator color={theme.primary} size="small" />
                  <Text style={styles.statusText}>
                    {step === 'waiting'
                      ? 'Ожидаем подтверждения на устройстве...'
                      : 'Ожидаем сканирования QR...'}
                  </Text>
                </View>

                {timeLeft > 0 && (
                  <Text style={styles.timerText}>
                    Действителен ещё {timeLeft} сек.
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={createSession}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={16} color={theme.primaryDim} />
                  <Text style={styles.refreshText}>ОБНОВИТЬ QR</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Done */}
            {step === 'done' && (
              <View style={styles.centered}>
                <CheckCircle size={52} color={theme.success || theme.primary} strokeWidth={1.5} />
                <Text style={styles.doneTitle}>ДОСТУП{'\n'}ПОДТВЕРЖДЁН</Text>
                <Text style={styles.hintText}>Подключение к системе...</Text>
                <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
              </View>
            )}

            {/* Error */}
            {step === 'error' && (
              <>
                <View style={styles.centered}>
                  <AlertTriangle size={44} color={theme.danger} strokeWidth={1.5} />
                  <Text style={[styles.doneTitle, { color: theme.danger }]}>ОШИБКА</Text>
                  <Text style={styles.hintText}>{errorMsg}</Text>
                </View>
                <TouchableOpacity style={styles.button} onPress={createSession} activeOpacity={0.7}>
                  <View style={styles.buttonBorder}>
                    <Text style={styles.buttonText}>{'>'} ПОПРОБОВАТЬ СНОВА</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {!showDevForm && (
              <TouchableOpacity onPress={() => setShowDevForm(true)} style={{ marginBottom: 8 }}>
                <Text style={[styles.footerText, { textDecorationLine: 'underline', color: theme.primary }]}>
                  Для разработчика (вход по номеру)
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.footerText}>SYSTEM STATUS: ACTIVE</Text>
            <Text style={styles.footerText}>ENCRYPTION: AES-256</Text>
            <Text style={styles.footerText}>AUTH: QR CODE</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  background: { flex: 1, backgroundColor: theme.background },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: theme.primary,
    marginTop: 16,
    letterSpacing: 4,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 11,
    color: theme.primaryDim,
    marginTop: 8,
    letterSpacing: 2,
    fontFamily: 'monospace' as const,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
    alignItems: 'center',
  },
  centered: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  instruction: {
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  qrContainer: {
    padding: 16,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
  },
  timerText: {
    fontSize: 11,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  refreshText: {
    fontSize: 11,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: theme.primary,
    letterSpacing: 3,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    lineHeight: 28,
  },
  hintText: {
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  button: { marginBottom: 20, width: '100%' },
  buttonBorder: {
    borderWidth: 2,
    borderColor: theme.primary,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.overlay,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  footer: {
    paddingBottom: 16,
    paddingTop: 8,
    gap: 3,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    textAlign: 'center',
  },
  devForm: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    alignItems: 'center',
  },
  devTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
    marginBottom: 8,
  },
  devInput: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.text,
    fontFamily: 'monospace' as const,
    width: '100%',
  },
  devError: {
    fontSize: 12,
    color: theme.danger,
    fontFamily: 'monospace' as const,
  },
  devButton: { width: '100%' },
  devBack: { marginTop: 12 },
});
