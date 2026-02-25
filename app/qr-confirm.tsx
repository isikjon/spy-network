import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { useLocalSearchParams, router } from 'expo-router';
import { Shield, Monitor, CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Step = 'confirm' | 'loading' | 'done' | 'error';

export default function QrConfirmScreen() {
  const { session } = useLocalSearchParams<{ session: string }>();
  const { theme, phoneNumber } = useApp();
  const [step, setStep] = useState<Step>('confirm');
  const [errorMsg, setErrorMsg] = useState('');

  const confirmMutation = trpc.qrAuth.confirmSession.useMutation();
  const rejectMutation = trpc.qrAuth.rejectSession.useMutation();

  const styles = createStyles(theme);

  const handleConfirm = useCallback(async () => {
    if (!session) {
      setStep('error');
      setErrorMsg('Неверный QR-код');
      return;
    }

    setStep('loading');

    try {
      const res = await confirmMutation.mutateAsync({ sessionId: session });
      if (res.ok) {
        setStep('done');
        setTimeout(() => router.back(), 1500);
      } else {
        setStep('error');
        setErrorMsg(
          res.error === 'EXPIRED' ? 'QR-код истёк' :
          res.error === 'ALREADY_USED' ? 'QR-код уже использован' :
          res.error === 'UNAUTHENTICATED' ? 'Необходима авторизация' :
          'Ошибка подтверждения',
        );
      }
    } catch (e: any) {
      setStep('error');
      setErrorMsg(e?.message || 'Ошибка сети');
    }
  }, [session, confirmMutation]);

  const handleReject = useCallback(async () => {
    if (session) {
      try {
        await rejectMutation.mutateAsync({ sessionId: session });
      } catch {}
    }
    router.back();
  }, [session, rejectMutation]);

  if (!session) {
    return (
      <View style={[styles.bg, { justifyContent: 'center', alignItems: 'center' }]}>
        <AlertTriangle size={48} color={theme.danger} />
        <Text style={[styles.title, { color: theme.danger, marginTop: 16 }]}>
          НЕВЕРНЫЙ QR-КОД
        </Text>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => router.back()}>
          <Text style={styles.btnSecondaryText}>← НАЗАД</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>

          {/* Confirm step */}
          {step === 'confirm' && (
            <>
              <View style={styles.iconRow}>
                <Shield size={48} color={theme.primary} strokeWidth={1.5} />
                <View style={styles.arrowContainer}>
                  <Text style={styles.arrow}>→</Text>
                </View>
                <Monitor size={48} color={theme.primary} strokeWidth={1.5} />
              </View>

              <Text style={styles.title}>ЗАПРОС{'\n'}ВЕБ-ДОСТУПА</Text>
              <Text style={styles.subtitle}>
                Кто-то хочет войти в веб-версию Spy Network с вашего аккаунта
              </Text>

              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>АККАУНТ</Text>
                <Text style={styles.infoValue}>{phoneNumber || '—'}</Text>
              </View>

              <Text style={styles.warning}>
                Разрешайте только если вы лично открываете веб-версию
              </Text>

              <TouchableOpacity style={styles.btn} onPress={handleConfirm} activeOpacity={0.7}>
                <View style={styles.btnBorder}>
                  <Text style={styles.btnText}>{'>'} РАЗРЕШИТЬ ВХОД</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={handleReject}
                activeOpacity={0.7}
              >
                <Text style={styles.btnSecondaryText}>✕ ОТКЛОНИТЬ</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Loading */}
          {step === 'loading' && (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.primary} size="large" />
              <Text style={styles.subtitle}>Подтверждение...</Text>
            </View>
          )}

          {/* Done */}
          {step === 'done' && (
            <View style={styles.centered}>
              <CheckCircle size={64} color={theme.success || theme.primary} strokeWidth={1.5} />
              <Text style={styles.title}>ДОСТУП{'\n'}ОТКРЫТ</Text>
              <Text style={styles.subtitle}>Веб-версия авторизована</Text>
            </View>
          )}

          {/* Error */}
          {step === 'error' && (
            <View style={styles.centered}>
              <XCircle size={64} color={theme.danger} strokeWidth={1.5} />
              <Text style={[styles.title, { color: theme.danger }]}>ОШИБКА</Text>
              <Text style={styles.subtitle}>{errorMsg}</Text>
              <TouchableOpacity
                style={[styles.btn, { marginTop: 24 }]}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <View style={styles.btnBorder}>
                  <Text style={styles.btnText}>{'>'} НАЗАД</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: theme.background },
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
  },
  arrowContainer: {
    paddingHorizontal: 8,
  },
  arrow: {
    fontSize: 24,
    color: theme.primary,
    fontFamily: 'monospace' as const,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: theme.primary,
    letterSpacing: 3,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.5,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  infoBox: {
    width: '100%',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 16,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
  },
  warning: {
    fontSize: 11,
    color: theme.warning,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 28,
    lineHeight: 18,
  },
  btn: { width: '100%', marginBottom: 12 },
  btnBorder: {
    borderWidth: 2,
    borderColor: theme.primary,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.overlay,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  btnSecondary: { borderWidth: 0 },
  btnSecondaryText: {
    fontSize: 13,
    color: theme.danger,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
});
