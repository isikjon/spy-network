import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';
import { X, CheckCircle, AlertTriangle, ScanLine } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

type ScanState = 'scanning' | 'confirming' | 'success' | 'error';

function QrScannerContent() {
  const { theme } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const hasScanned = useRef(false);

  const confirmMutation = trpc.qrAuth.confirmSession.useMutation({
    onSuccess: (data) => {
      console.log('[QrScanner] confirmSession result', data);
      if (data.ok) {
        setScanState('success');
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        const errorMap: Record<string, string> = {
          NOT_AUTHENTICATED: 'Вы не авторизованы',
          SESSION_NOT_FOUND: 'Сессия не найдена',
          SESSION_EXPIRED: 'Сессия истекла',
        };
        setErrorMessage(errorMap[data.error] || 'Неизвестная ошибка');
        setScanState('error');
      }
    },
    onError: (err) => {
      console.log('[QrScanner] confirmSession error', err);
      setErrorMessage('Ошибка связи с сервером');
      setScanState('error');
    },
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanLineAnim]);

  const handleBarCodeScanned = useCallback((result: { data: string; type: string }) => {
    if (hasScanned.current) return;
    if (scanState !== 'scanning') return;

    const sessionId = result.data?.trim();
    if (!sessionId || sessionId.length < 10) {
      console.log('[QrScanner] invalid QR data', { data: result.data });
      return;
    }

    console.log('[QrScanner] scanned', { sessionId });
    hasScanned.current = true;
    setScanState('confirming');
    confirmMutation.mutate({ sessionId });
  }, [scanState, confirmMutation]);

  const handleRetry = useCallback(() => {
    hasScanned.current = false;
    setErrorMessage('');
    setScanState('scanning');
  }, []);

  const styles = createScannerStyles(theme);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.permissionContainer} edges={['top', 'bottom']}>
          <ScanLine size={48} color={theme.primary} />
          <Text style={styles.permissionTitle}>ДОСТУП К КАМЕРЕ</Text>
          <Text style={styles.permissionText}>
            Для сканирования QR-кода необходим доступ к камере
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>РАЗРЕШИТЬ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButtonBottom} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>НАЗАД</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanState === 'scanning' ? handleBarCodeScanned : undefined}
      />

      <View style={styles.overlay}>
        <SafeAreaView style={styles.overlayContent} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>СКАНЕР QR</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />

              {scanState === 'scanning' && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanLineTranslateY }] },
                  ]}
                />
              )}

              {scanState === 'confirming' && (
                <View style={styles.stateOverlay}>
                  <ActivityIndicator color={theme.primary} size="large" />
                  <Text style={styles.stateText}>ПОДТВЕРЖДЕНИЕ...</Text>
                </View>
              )}

              {scanState === 'success' && (
                <View style={styles.stateOverlay}>
                  <CheckCircle size={48} color={theme.primary} />
                  <Text style={styles.stateText}>АВТОРИЗОВАНО!</Text>
                </View>
              )}

              {scanState === 'error' && (
                <View style={styles.stateOverlay}>
                  <AlertTriangle size={48} color={theme.danger || '#ff4444'} />
                  <Text style={[styles.stateText, { color: theme.danger || '#ff4444' }]}>
                    {errorMessage}
                  </Text>
                  <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryButtonText}>ПОВТОРИТЬ</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.bottomHint}>
            <Text style={styles.hintText}>
              Наведите камеру на QR-код{'\n'}на экране компьютера
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

export default function QrScannerScreen() {
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' }}>
        <Text style={{ color: '#666', fontFamily: 'monospace' as const }}>
          QR-сканер доступен только в мобильном приложении
        </Text>
      </View>
    );
  }

  return <QrScannerContent />;
}

const createScannerStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  scanArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 260,
    height: 260,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  cornerTL: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: theme.primary,
  },
  cornerTR: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: theme.primary,
  },
  cornerBL: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: theme.primary,
  },
  cornerBR: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: theme.primary,
  },
  scanLine: {
    position: 'absolute' as const,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: theme.primary,
    opacity: 0.8,
  },
  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stateText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  bottomHint: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
    marginTop: 8,
  },
  permissionText: {
    fontSize: 13,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    borderWidth: 2,
    borderColor: theme.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 12,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  closeButtonBottom: {
    borderWidth: 1,
    borderColor: theme.primaryDim,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 20,
  },
  closeButtonText: {
    fontSize: 12,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 14,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    marginBottom: 20,
  },
});
