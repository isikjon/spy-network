import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';
import { Shield, Lock, Phone, ArrowLeft, PhoneCall } from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
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

type Step = 'phone' | 'call';

export default function AuthScreen() {
  const { loginWithToken, theme } = useApp();
  const styles = createStyles(theme);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [polling, setPolling] = useState(false);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestCallMutation = trpc.phoneAuth.requestCall.useMutation();

  // Таймер повторной отправки
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown > 0]);

  // Поллинг статуса — проверяем, позвонил ли пользователь
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!polling || step !== 'call' || !phone) return;

    let active = true;

    const check = async () => {
      try {
        const result = await utils.phoneAuth.checkStatus.fetch({ phone });

        if (!active) return;

        if (result.ok) {
          // Авторизация успешна
          setPolling(false);
          await loginWithToken(result.phone, result.token);
          router.replace('/');
          return;
        }

        if (result.error === 'EXPIRED') {
          setPolling(false);
          setError('Время истекло. Запросите новый номер.');
          setStep('phone');
          return;
        }

        if (result.error === 'NOT_FOUND') {
          setPolling(false);
          setError('Сессия не найдена. Попробуйте снова.');
          setStep('phone');
          return;
        }

        // WAITING — продолжаем поллить
      } catch (e: any) {
        console.log('[auth] polling error', e?.message || e);
      }
    };

    // Первая проверка через 3 сек, потом каждые 3 сек
    const timeout = setTimeout(() => {
      check();
      pollRef.current = setInterval(check, 3000);
    }, 3000);

    return () => {
      active = false;
      clearTimeout(timeout);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [polling, step, phone]);

  const handleRequestCall = async () => {
    if (phone.length < 10 || loading) return;
    setError('');
    setLoading(true);

    try {
      const result = await requestCallMutation.mutateAsync({ phone });

      if (result.ok) {
        setDisplayPhone(result.displayPhone);
        setStep('call');
        setCooldown(60);
        setPolling(true);
      } else {
        const err = result as any;
        if (err.retryAfter) {
          setDisplayPhone(err.displayPhone || '');
          if (err.displayPhone) {
            setStep('call');
            setCooldown(err.retryAfter);
            setPolling(true);
          } else {
            setError(`Подождите ${err.retryAfter} сек.`);
            setCooldown(err.retryAfter);
          }
        } else if (err.error === 'INVALID_PHONE') {
          setError('Неверный формат номера телефона');
        } else if (err.error === 'SEND_FAILED') {
          setError('Не удалось запросить звонок. Попробуйте позже.');
        } else {
          setError(err.error || 'Ошибка');
        }
      }
    } catch (e: any) {
      setError('Ошибка сети. Проверьте подключение.');
      console.log('[auth] requestCall error', e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  const handleDialPhone = () => {
    if (!displayPhone) return;
    // Открываем номеронабиратель с номером
    const cleanPhone = displayPhone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      // Если не удалось — ничего
    });
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    setError('');
    setPolling(false);
    handleRequestCall();
  };

  const handleBack = () => {
    setStep('phone');
    setDisplayPhone('');
    setError('');
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
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
          {step === 'phone' ? (
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
                  editable={!loading}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, (phone.length < 10 || loading) && styles.buttonDisabled]}
                onPress={handleRequestCall}
                disabled={phone.length < 10 || loading}
                activeOpacity={0.7}
              >
                <View style={styles.buttonBorder}>
                  {loading ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Text style={styles.buttonText}>{'>'} ПОЛУЧИТЬ НОМЕР</Text>
                  )}
                </View>
              </TouchableOpacity>

              <Text style={styles.hint}>
                Вы получите номер, на который нужно позвонить для подтверждения
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <ArrowLeft size={16} color={theme.primaryDim} />
                <Text style={styles.backText}>ИЗМЕНИТЬ НОМЕР</Text>
              </TouchableOpacity>

              <View style={styles.inputContainer}>
                <Lock size={20} color={theme.primaryDim} style={styles.inputIcon} />
                <Text style={styles.label}>ПОЗВОНИТЕ НА НОМЕР</Text>
              </View>

              <TouchableOpacity onPress={handleDialPhone} activeOpacity={0.7}>
                <View style={styles.displayPhoneBox}>
                  <PhoneCall size={28} color={theme.primary} />
                  <Text style={styles.displayPhoneText}>
                    {displayPhone || '...'}
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.callHint}>
                Нажмите на номер чтобы позвонить.{'\n'}
                После звонка вход произойдёт автоматически.
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {polling && (
                <View style={styles.pollingContainer}>
                  <ActivityIndicator color={theme.primary} size="small" />
                  <Text style={styles.pollingText}>Ожидание звонка...</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleResend}
                disabled={cooldown > 0}
                style={styles.resendButton}
              >
                <Text style={[styles.resendText, cooldown > 0 && { opacity: 0.4 }]}>
                  {cooldown > 0
                    ? `ПОВТОРНЫЙ ЗАПРОС ЧЕРЕЗ ${cooldown} СЕК.`
                    : 'ЗАПРОСИТЬ НОВЫЙ НОМЕР'}
                </Text>
              </TouchableOpacity>
            </>
          )}
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
    marginBottom: 16,
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
    marginBottom: 16,
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
  errorText: {
    fontSize: 12,
    color: theme.danger || '#FF0033',
    textAlign: 'center',
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginBottom: 16,
  },
  hint: {
    fontSize: 11,
    color: theme.primaryDim,
    textAlign: 'center',
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  displayPhoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.overlay,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 16,
  },
  displayPhoneText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 3,
  },
  callHint: {
    fontSize: 12,
    color: theme.primaryDim,
    textAlign: 'center',
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    lineHeight: 20,
    marginBottom: 20,
  },
  pollingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  pollingText: {
    fontSize: 12,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  backText: {
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendText: {
    fontSize: 11,
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
