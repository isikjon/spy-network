import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';
import { Shield, Lock, Phone, PhoneCall, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AuthStep = 'phone' | 'calling' | 'done' | 'error';

export default function AuthScreen() {
  const { loginWithToken, theme, t } = useApp();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<AuthStep>('phone');
  const [displayPhone, setDisplayPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const styles = createStyles(theme);

  const requestCallMutation = trpc.phoneAuth.requestCall.useMutation();
  const checkStatusQuery = trpc.phoneAuth.checkStatus.useQuery(
    { phone },
    {
      enabled: step === 'calling' && phone.length >= 10,
      refetchInterval: step === 'calling' ? 3000 : false,
      retry: false,
    },
  );

  // Следим за результатом polling
  useEffect(() => {
    if (step !== 'calling') return;
    const data = checkStatusQuery.data;
    if (!data) return;

    if (data.ok === true) {
      // Верифицирован — сохраняем токен и логинимся
      const token = (data as any).token as string;
      const verifiedPhone = (data as any).phone as string;

      setStep('done');

      (async () => {
        try {
          // Логиним пользователя с токеном (сохраняет phone + session token)
          await loginWithToken(verifiedPhone, token);
          // Переходим на главную
          setTimeout(() => {
            router.replace('/');
          }, 800);
        } catch (e) {
          console.error('[auth] login after verify failed', e);
          setStep('error');
          setErrorMsg('Ошибка сохранения сессии');
        }
      })();
    }

    if (data.ok === false) {
      const error = (data as any).error as string;
      if (error === 'EXPIRED') {
        setStep('error');
        setErrorMsg('Время истекло. Попробуйте снова.');
      }
      // WAITING — продолжаем поллить (ничего не делаем)
      // NOT_FOUND — тоже ошибка
      if (error === 'NOT_FOUND') {
        setStep('error');
        setErrorMsg('Запрос не найден. Попробуйте снова.');
      }
    }
  }, [checkStatusQuery.data, step, loginWithToken]);

  // Таймер retryAfter
  useEffect(() => {
    if (retryAfter <= 0) return;
    retryTimerRef.current = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev <= 1) {
          if (retryTimerRef.current) clearInterval(retryTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    };
  }, [retryAfter]);

  const handleRequestCall = useCallback(async () => {
    if (phone.length < 10) return;

    setStep('phone');
    setErrorMsg('');

    try {
      const res = await requestCallMutation.mutateAsync({ phone });

      if (res.ok) {
        const dp = (res as any).displayPhone as string;
        setDisplayPhone(dp);
        setStep('calling');

        if ((res as any).retryAfter) {
          setRetryAfter((res as any).retryAfter as number);
        }
      } else {
        const error = (res as any).error as string;
        const detail = (res as any).detail as string | undefined;
        setStep('error');
        if (error === 'INVALID_PHONE') {
          setErrorMsg('Неверный формат номера');
        } else if (error === 'SEND_FAILED') {
          setErrorMsg(`Не удалось отправить запрос${detail ? `: ${detail}` : ''}`);
        } else {
          setErrorMsg(error || 'Неизвестная ошибка');
        }
      }
    } catch (e: any) {
      console.error('[auth] requestCall failed', e);
      setStep('error');
      setErrorMsg(e?.message || 'Ошибка сети');
    }
  }, [phone, requestCallMutation]);

  const handleCallPress = useCallback(() => {
    if (!displayPhone) return;
    // Открываем набор номера
    const cleanPhone = displayPhone.replace(/[^0-9+]/g, '');
    const telUrl = `tel:${cleanPhone}`;
    Linking.openURL(telUrl).catch((e) => {
      console.error('[auth] failed to open tel:', e);
    });
  }, [displayPhone]);

  const handleRetry = useCallback(() => {
    setStep('phone');
    setDisplayPhone('');
    setErrorMsg('');
    setRetryAfter(0);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    };
  }, []);

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Shield size={60} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>CLASSIFIED ACCESS</Text>
          <Text style={styles.subtitle}>NETWORK INTELLIGENCE SYSTEM</Text>
        </View>

        <View style={styles.form}>
          {/* ШАГ 1: Ввод номера */}
          {step === 'phone' && (
            <>
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
                style={[styles.button, (phone.length < 10 || requestCallMutation.isPending) && styles.buttonDisabled]}
                onPress={handleRequestCall}
                disabled={phone.length < 10 || requestCallMutation.isPending}
                activeOpacity={0.7}
              >
                <View style={styles.buttonBorder}>
                  {requestCallMutation.isPending ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Text style={styles.buttonText}>
                      {'>'} ЗАПРОСИТЬ ЗВОНОК
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              <Text style={styles.hint}>
                На указанный номер будет отправлен запрос.{'\n'}
                Вам нужно будет позвонить на номер для подтверждения.
              </Text>
            </>
          )}

          {/* ШАГ 2: Ожидание звонка */}
          {step === 'calling' && (
            <>
              <View style={styles.callingContainer}>
                <PhoneCall size={48} color={theme.primary} strokeWidth={1.5} />
                <Text style={styles.callingTitle}>ПОЗВОНИТЕ НА НОМЕР</Text>
                <Text style={styles.callingSubtitle}>
                  Нажмите на номер ниже, чтобы позвонить
                </Text>

                <TouchableOpacity
                  style={styles.displayPhoneButton}
                  onPress={handleCallPress}
                  activeOpacity={0.7}
                >
                  <Phone size={24} color={theme.background} />
                  <Text style={styles.displayPhoneText}>{displayPhone}</Text>
                </TouchableOpacity>

                <View style={styles.waitingRow}>
                  <ActivityIndicator color={theme.primary} size="small" />
                  <Text style={styles.waitingText}>Ожидаем подтверждение звонка...</Text>
                </View>

                {retryAfter > 0 && (
                  <Text style={styles.retryText}>
                    Повторный запрос через {retryAfter} сек.
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleRetry}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>← ВВЕСТИ ДРУГОЙ НОМЕР</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ШАГ 3: Успех */}
          {step === 'done' && (
            <View style={styles.callingContainer}>
              <CheckCircle size={60} color={theme.success || theme.primary} strokeWidth={1.5} />
              <Text style={styles.callingTitle}>ДОСТУП ПОДТВЕРЖДЁН</Text>
              <Text style={styles.callingSubtitle}>Подключение к системе...</Text>
              <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
            </View>
          )}

          {/* ШАГ 4: Ошибка */}
          {step === 'error' && (
            <>
              <View style={styles.callingContainer}>
                <AlertTriangle size={48} color={theme.danger} strokeWidth={1.5} />
                <Text style={[styles.callingTitle, { color: theme.danger }]}>ОШИБКА</Text>
                <Text style={styles.callingSubtitle}>{errorMsg}</Text>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleRetry}
                activeOpacity={0.7}
              >
                <View style={styles.buttonBorder}>
                  <Text style={styles.buttonText}>{'>'} ПОПРОБОВАТЬ СНОВА</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {step === 'phone' && (
            <Text style={styles.warning}>
              ⚠ UNAUTHORIZED ACCESS PROHIBITED
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SYSTEM STATUS: ACTIVE</Text>
          <Text style={styles.footerText}>ENCRYPTION: AES-256</Text>
          <Text style={styles.footerText}>AUTH: FLASH CALL VERIFICATION</Text>
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
    paddingBottom: 60,
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
  hint: {
    fontSize: 11,
    color: theme.primaryDim,
    textAlign: 'center',
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  warning: {
    fontSize: 11,
    color: theme.danger,
    textAlign: 'center',
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginTop: 16,
  },
  // Calling step
  callingContainer: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  callingTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: theme.primary,
    letterSpacing: 3,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
  },
  callingSubtitle: {
    fontSize: 13,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 20,
  },
  displayPhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.primary,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 4,
    marginTop: 8,
  },
  displayPhoneText: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: theme.background,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  waitingText: {
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
  },
  retryText: {
    fontSize: 11,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 12,
    color: theme.primaryDim,
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
