import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';
import { Shield, Lock, Phone, PhoneCall, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Этапы авторизации:
 * 1. phone    — ввод номера
 * 2. waiting  — запрос отправлен, ждём вебхук от Plusofon с номером для звонка
 * 3. calling  — номер получен, ждём звонок от пользователя
 * 4. done     — авторизация успешна
 * 5. error    — ошибка
 */
type AuthStep = 'phone' | 'calling' | 'done' | 'error';

/**
 * Маска для номера телефона: +7 XXX-XXX-XX-XX
 */
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

export default function AuthScreen() {
  const { loginWithToken, theme } = useApp();
  const [formattedPhone, setFormattedPhone] = useState('');
  const [step, setStep] = useState<AuthStep>('phone');
  const [displayPhone, setDisplayPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const styles = createStyles(theme);
  const rawPhone = extractDigits(formattedPhone);

  const requestCallMutation = trpc.phoneAuth.requestCall.useMutation();
  const utils = trpc.useUtils();

  // Поллинг статуса
  useEffect(() => {
    if (step !== 'calling') return;
    if (rawPhone.length < 11) return;

    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      try {
        const result = await utils.phoneAuth.checkStatus.fetch({ phone: rawPhone });

        if (!active) return;

        if (result.ok === true) {
          // Верифицирован!
          const token = (result as any).token as string;
          const verifiedPhone = (result as any).phone as string;
          setStep('done');

          try {
            await loginWithToken(verifiedPhone, token);
            setTimeout(() => router.replace('/'), 800);
          } catch (e) {
            console.error('[auth] login failed', e);
            setStep('error');
            setErrorMsg('Ошибка сохранения сессии');
          }
          return;
        }

        const error = (result as any).error as string;

        if (error === 'EXPIRED') {
          setStep('error');
          setErrorMsg('Время истекло. Попробуйте снова.');
          return;
        }

        if (error === 'NOT_FOUND') {
          setStep('error');
          setErrorMsg('Запрос не найден. Попробуйте снова.');
          return;
        }

        // WAITING_CALL — продолжаем ждать звонок
      } catch (e: any) {
        console.log('[auth] poll error', e?.message || e);
      }
    };

    // Первая проверка через 2 секунды, потом каждые 2 секунды
    const timeout = setTimeout(() => {
      check();
      interval = setInterval(check, 2500);
    }, 2000);

    return () => {
      active = false;
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [step, rawPhone]);

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

  const handlePhoneChange = useCallback((text: string) => {
    setFormattedPhone(formatPhoneMask(text));
  }, []);

  const handleRequestCall = useCallback(async () => {
    if (rawPhone.length < 11) return;

    setErrorMsg('');

    try {
      const res = await requestCallMutation.mutateAsync({ phone: rawPhone });

      if (res.ok) {
        const resAny = res as any;
        if (resAny.retryAfter) {
          setRetryAfter(resAny.retryAfter);
        }
        // Номер приходит сразу в ответе API
        if (resAny.displayPhone) {
          setDisplayPhone(resAny.displayPhone);
        }
        setStep('calling');
      } else {
        const resAny = res as any;
        setStep('error');
        if (resAny.error === 'INVALID_PHONE') {
          setErrorMsg('Неверный формат номера');
        } else if (resAny.error === 'SEND_FAILED') {
          setErrorMsg(`Ошибка запроса${resAny.detail ? `: ${resAny.detail}` : ''}`);
        } else {
          setErrorMsg(resAny.error || 'Неизвестная ошибка');
        }
      }
    } catch (e: any) {
      console.error('[auth] requestCall failed', e);
      setStep('error');
      setErrorMsg(e?.message || 'Ошибка сети');
    }
  }, [rawPhone, requestCallMutation]);

  const handleCallPress = useCallback(() => {
    if (!displayPhone) return;
    const cleanPhone = displayPhone.replace(/[^0-9+]/g, '');
    const telUri = cleanPhone.startsWith('+') || cleanPhone.startsWith('8')
      ? `tel:${cleanPhone}`
      : `tel:+${cleanPhone}`;
    Linking.openURL(telUri).catch((e) => {
      console.error('[auth] failed to open tel:', e);
    });
  }, [displayPhone]);

  const handleRetry = useCallback(() => {
    setStep('phone');
    setDisplayPhone('');
    setErrorMsg('');
    setRetryAfter(0);
  }, []);

  const isPhoneReady = rawPhone.length === 11;

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
            <Text style={styles.title}>CLASSIFIED{'\n'}ACCESS</Text>
            <Text style={styles.subtitle}>NETWORK INTELLIGENCE SYSTEM</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>

            {/* ШАГ 1: Ввод номера */}
            {step === 'phone' && (
              <>
                <View style={styles.inputContainer}>
                  <Lock size={18} color={theme.primaryDim} style={styles.inputIcon} />
                  <Text style={styles.label}>SECURE LINE AUTHENTICATION</Text>
                </View>

                <View style={styles.phoneInputContainer}>
                  <Phone size={20} color={theme.primary} style={styles.phoneIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="+7 XXX-XXX-XX-XX"
                    placeholderTextColor={theme.primaryDim}
                    keyboardType="phone-pad"
                    value={formattedPhone}
                    onChangeText={handlePhoneChange}
                    maxLength={18}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, (!isPhoneReady || requestCallMutation.isPending) && styles.buttonDisabled]}
                  onPress={handleRequestCall}
                  disabled={!isPhoneReady || requestCallMutation.isPending}
                  activeOpacity={0.7}
                >
                  <View style={styles.buttonBorder}>
                    {requestCallMutation.isPending ? (
                      <ActivityIndicator color={theme.primary} />
                    ) : (
                      <Text style={styles.buttonText}>{'>'} ЗАПРОСИТЬ ЗВОНОК</Text>
                    )}
                  </View>
                </TouchableOpacity>

                <Text style={styles.hint}>
                  Вам будет показан номер,{'\n'}на который нужно позвонить для подтверждения.
                </Text>
              </>
            )}

            {/* ШАГ 2: Номер получен — ждём звонок */}
            {step === 'calling' && (
              <>
                <View style={styles.callingContainer}>
                  <PhoneCall size={44} color={theme.primary} strokeWidth={1.5} />
                  <Text style={styles.callingTitle}>ПОЗВОНИТЕ{'\n'}НА НОМЕР</Text>
                  <Text style={styles.callingSubtitle}>
                    Нажмите на кнопку ниже, чтобы позвонить
                  </Text>

                  <TouchableOpacity
                    style={styles.displayPhoneButton}
                    onPress={handleCallPress}
                    activeOpacity={0.7}
                  >
                    <Phone size={22} color={theme.background} />
                    <Text style={styles.displayPhoneText}>{displayPhone}</Text>
                  </TouchableOpacity>

                  <View style={styles.waitingRow}>
                    <ActivityIndicator color={theme.primary} size="small" />
                    <Text style={styles.waitingText}>Ожидаем подтверждение...</Text>
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
                <CheckCircle size={52} color={theme.success || theme.primary} strokeWidth={1.5} />
                <Text style={styles.callingTitle}>ДОСТУП{'\n'}ПОДТВЕРЖДЁН</Text>
                <Text style={styles.callingSubtitle}>Подключение к системе...</Text>
                <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
              </View>
            )}

            {/* ШАГ 4: Ошибка */}
            {step === 'error' && (
              <>
                <View style={styles.callingContainer}>
                  <AlertTriangle size={44} color={theme.danger} strokeWidth={1.5} />
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
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>SYSTEM STATUS: ACTIVE</Text>
            <Text style={styles.footerText}>ENCRYPTION: AES-256</Text>
            <Text style={styles.footerText}>AUTH: REVERSE FLASH CALL</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: theme.background,
  },
  safeArea: {
    flex: 1,
  },
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
    backgroundColor: theme.overlay,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 24,
  },
  phoneIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  button: {
    marginBottom: 20,
  },
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
  hint: {
    fontSize: 11,
    color: theme.primaryDim,
    textAlign: 'center',
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  callingContainer: {
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },
  callingTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: theme.primary,
    letterSpacing: 3,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    lineHeight: 28,
  },
  callingSubtitle: {
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 20,
  },
  displayPhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 4,
    marginTop: 8,
  },
  displayPhoneText: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: theme.background,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  waitingText: {
    fontSize: 11,
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
    paddingBottom: 16,
    paddingTop: 8,
    gap: 3,
  },
  footerText: {
    fontSize: 10,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    textAlign: 'center',
  },
});
