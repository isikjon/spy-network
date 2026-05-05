import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';
import { Shield, RefreshCw, CheckCircle, AlertTriangle, Smartphone, Phone, Lock, QrCode } from 'lucide-react-native';
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

type AuthStep = 'idle' | 'loading' | 'qr' | 'waiting' | 'done' | 'error' | 'dev' | 'phoneLogin';

const BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://spynetwork.ru';

function formatPhoneMask(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('8') && digits.length > 1) {
    digits = '7' + digits.slice(1);
  }
  if (digits.length > 0 && !digits.startsWith('7')) {
    digits = '7' + digits;
  }
  digits = digits.slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 1) return '+7';
  if (digits.length <= 4) return `+7 ${digits.slice(1)}`;
  if (digits.length <= 7) return `+7 ${digits.slice(1, 4)}-${digits.slice(4)}`;
  if (digits.length <= 9) return `+7 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return `+7 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

function extractDigits(formatted: string): string {
  return formatted.replace(/[^0-9]/g, '');
}

export default function WebAuthScreen() {
  const { login, loginWithToken, theme } = useApp();
  const [step, setStep] = useState<AuthStep>('idle');
  const [sessionId, setSessionId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [formattedPhone, setFormattedPhone] = useState<string>('');
  const activeRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createSessionMutation = trpc.qrAuth.createSession.useMutation();
  const devLoginMutation = trpc.qrAuth.devLogin.useMutation();
  const webLoginMutation = trpc.phoneAuth.webLogin.useMutation();
  const utils = trpc.useUtils();
  const styles = createStyles(theme);
  const rawPhone = extractDigits(formattedPhone);
  const isPhoneReady = rawPhone.length === 11;

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
            await loginWithToken(result.phone, result.token, (result as any).uid);
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

    void check();
    pollRef.current = setInterval(() => {
      void check();
    }, 2500);
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

  const handlePhoneChange = useCallback((text: string) => {
    setFormattedPhone(formatPhoneMask(text));
  }, []);

  const handleWebPhoneLogin = useCallback(async () => {
    if (!isPhoneReady) {
      setErrorMsg('Введите номер полностью');
      setStep('error');
      return;
    }

    console.log('[web-auth] direct phone login', { phone: rawPhone });
    setErrorMsg('');
    setStep('phoneLogin');

    try {
      const result = await webLoginMutation.mutateAsync({ phone: rawPhone });
      console.log('[web-auth] webLogin result', JSON.stringify(result));
      if (result.ok) {
        await loginWithToken(result.phone, result.token, result.uid);
        console.log('[web-auth] loginWithToken done, waiting for navigation guard');
        setStep('done');
      } else {
        setStep('error');
        setErrorMsg('Сервер отклонил вход: ' + ((result as any).error || 'unknown'));
      }
    } catch (e: any) {
      console.log('[web-auth] direct phone login failed', e?.message, e);
      setStep('error');
      setErrorMsg('Ошибка сети: ' + (e?.message || 'Сервер недоступен'));
    }
  }, [isPhoneReady, rawPhone, webLoginMutation, loginWithToken]);

  useEffect(() => {
    activeRef.current = true;

    // Проверяем dev-параметр в URL: /app/auth?dev=SECRET
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const devSecret = params.get('dev');
      if (devSecret) {
        setStep('dev');
        devLoginMutation.mutateAsync({ secret: devSecret }).then(async (result) => {
          if (!activeRef.current) return;
          if (result.ok) {
            setStep('done');
            try {
              await loginWithToken(result.phone, result.token, (result as any).uid);
              setTimeout(() => router.replace('/(tabs)/profile'), 600);
            } catch {
              setStep('error');
              setErrorMsg('Ошибка сохранения dev-сессии');
            }
          } else {
            setStep('error');
            setErrorMsg('Неверный ключ разработчика');
          }
        }).catch(() => {
          if (!activeRef.current) return;
          setStep('error');
          setErrorMsg('Ошибка dev-входа');
        });
        return () => { activeRef.current = false; };
      }
    }

    return () => {
      activeRef.current = false;
      stopPoll();
    };
  }, [devLoginMutation, loginWithToken, stopPoll]);

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
            <View style={styles.phonePanel}>
              <View style={styles.phoneHeaderRow}>
                <Lock size={18} color={theme.primaryDim} />
                <Text style={styles.phoneLabel}>БЫСТРЫЙ ВХОД ПО НОМЕРУ</Text>
              </View>

              <View style={styles.phoneInputContainer}>
                <Phone size={20} color={theme.primary} style={styles.phoneIcon} />
                <TextInput
                  style={styles.phoneInput}
                  placeholder="+7 XXX-XXX-XX-XX"
                  placeholderTextColor={theme.primaryDim}
                  keyboardType="phone-pad"
                  value={formattedPhone}
                  onChangeText={handlePhoneChange}
                  maxLength={18}
                  autoFocus
                  testID="web-auth.phoneInput"
                />
              </View>

              <TouchableOpacity
                style={[styles.button, (!isPhoneReady || step === 'phoneLogin') && styles.buttonDisabled]}
                onPress={handleWebPhoneLogin}
                disabled={!isPhoneReady || step === 'phoneLogin'}
                activeOpacity={0.7}
                testID="web-auth.phoneSubmitButton"
              >
                <View style={styles.buttonBorder}>
                  {step === 'phoneLogin' ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Text style={styles.buttonText}>{'>'} ВОЙТИ БЕЗ ПРОВЕРКИ</Text>
                  )}
                </View>
              </TouchableOpacity>

              <Text style={styles.phoneHint}>
                Для web-версии вход выполняется сразу после ввода номера.
              </Text>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ИЛИ</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Dev login */}
            {step === 'dev' && (
              <View style={styles.centered}>
                <ActivityIndicator color={theme.primary} size="large" />
                <Text style={styles.hintText}>DEV ACCESS...</Text>
              </View>
            )}

            {/* Idle — show QR button */}
            {step === 'idle' && (
              <TouchableOpacity
                style={styles.qrStartButton}
                onPress={createSession}
                activeOpacity={0.7}
                testID="web-auth.startQrButton"
              >
                <View style={styles.qrStartButtonBorder}>
                  <QrCode size={28} color={theme.primary} />
                  <Text style={styles.qrStartButtonText}>ВОЙТИ ПО QR-КОДУ</Text>
                </View>
              </TouchableOpacity>
            )}

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
                  testID="web-auth.refreshQrButton"
                >
                  <RefreshCw size={16} color={theme.primaryDim} />
                  <Text style={styles.refreshText}>ОБНОВИТЬ QR</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Done */}
            {step === 'phoneLogin' && (
              <View style={styles.centered}>
                <ActivityIndicator color={theme.primary} size="large" />
                <Text style={styles.hintText}>ВХОД В WEB-ВЕРСИЮ...</Text>
              </View>
            )}

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
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>SYSTEM STATUS: ACTIVE</Text>
            <Text style={styles.footerText}>ENCRYPTION: AES-256</Text>
            <Text style={styles.footerText}>AUTH: PHONE / QR CODE</Text>
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
    width: '100%',
  },
  phonePanel: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 18,
    marginBottom: 24,
  },
  phoneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  phoneLabel: {
    fontSize: 11,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    width: '100%',
  },
  phoneIcon: {
    marginRight: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  phoneHint: {
    fontSize: 11,
    color: theme.primaryDim,
    textAlign: 'center',
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  dividerRow: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  dividerText: {
    fontSize: 11,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
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
  qrStartButton: {
    width: '100%',
    maxWidth: 420,
    marginBottom: 20,
  },
  qrStartButtonBorder: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    borderWidth: 2,
    borderColor: theme.border,
    paddingVertical: 16,
    backgroundColor: theme.overlay,
  },
  qrStartButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
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
  button: { marginBottom: 20, width: '100%', maxWidth: 420 },
  buttonDisabled: {
    opacity: 0.4,
  },
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
});
