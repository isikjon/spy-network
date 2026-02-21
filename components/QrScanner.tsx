import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, QrCode, Camera } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';

type QrScannerProps = {
  visible: boolean;
  onClose: () => void;
};

const QR_AUTH_PREFIX = 'spynetwork://qr-auth/';

export function QrScanner({ visible, onClose }: QrScannerProps) {
  const { theme, currentLanguage } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const processedRef = useRef<string | null>(null);

  const confirmMutation = trpc.qrAuth.confirmSession.useMutation();

  const handleBarCodeScanned = useCallback(
    async (result: { data: string }) => {
      if (scanned || confirming) return;
      if (!result.data.startsWith(QR_AUTH_PREFIX)) return;
      if (processedRef.current === result.data) return;

      processedRef.current = result.data;
      setScanned(true);
      setConfirming(true);

      const sessionId = result.data.replace(QR_AUTH_PREFIX, '');

      try {
        const res = await confirmMutation.mutateAsync({ sessionId });

        if (res.ok) {
          Alert.alert(
            currentLanguage === 'ru' ? 'ДОСТУП ПОДТВЕРЖДЁН' : 'ACCESS CONFIRMED',
            currentLanguage === 'ru'
              ? 'Веб-сессия успешно авторизована. Вы можете продолжить в браузере.'
              : 'Web session authorized. You can continue in the browser.',
            [{ text: 'OK', onPress: onClose }]
          );
        } else {
          const errorMap: Record<string, string> = currentLanguage === 'ru'
            ? {
                UNAUTHENTICATED: 'Вы не авторизованы в приложении',
                NOT_FOUND: 'QR-код недействителен или истёк',
                EXPIRED: 'QR-код истёк. Обновите код на веб-странице.',
                ALREADY_CONFIRMED: 'Этот QR-код уже был использован',
              }
            : {
                UNAUTHENTICATED: 'You are not authenticated',
                NOT_FOUND: 'QR code is invalid or expired',
                EXPIRED: 'QR code expired. Refresh the code on the web page.',
                ALREADY_CONFIRMED: 'This QR code was already used',
              };
          const msg = errorMap[(res as any).error] ||
            (currentLanguage === 'ru' ? 'Не удалось подтвердить' : 'Failed to confirm');
          Alert.alert(
            currentLanguage === 'ru' ? 'ОШИБКА' : 'ERROR',
            msg,
            [{ text: 'OK' }]
          );
        }
      } catch (e: any) {
        Alert.alert(
          currentLanguage === 'ru' ? 'ОШИБКА СЕТИ' : 'NETWORK ERROR',
          e.message || (currentLanguage === 'ru' ? 'Попробуйте ещё раз' : 'Try again'),
          [{ text: 'OK' }]
        );
      } finally {
        setConfirming(false);
        setScanned(false);
        processedRef.current = null;
      }
    },
    [confirmMutation, confirming, currentLanguage, onClose, scanned]
  );

  const handleClose = useCallback(() => {
    setScanned(false);
    setConfirming(false);
    processedRef.current = null;
    onClose();
  }, [onClose]);

  if (Platform.OS === 'web') {
    return null;
  }

  const styles = createStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <QrCode size={24} color={theme.primary} />
          <Text style={styles.title}>
            {currentLanguage === 'ru' ? 'СКАНЕР QR-КОДА' : 'QR CODE SCANNER'}
          </Text>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
            <X size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraContainer}>
          {!permission?.granted ? (
            <View style={styles.permissionBox}>
              <Camera size={48} color={theme.primaryDim} strokeWidth={1} />
              <Text style={styles.permissionText}>
                {currentLanguage === 'ru'
                  ? 'Для сканирования QR-кода необходим доступ к камере'
                  : 'Camera access is required to scan QR codes'}
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermission}
                activeOpacity={0.7}
              >
                <Text style={styles.permissionButtonText}>
                  {currentLanguage === 'ru' ? 'РАЗРЕШИТЬ КАМЕРУ' : 'ALLOW CAMERA'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              />
              <View style={styles.overlay}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
              </View>
              {confirming && (
                <View style={styles.confirmingOverlay}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={styles.confirmingText}>
                    {currentLanguage === 'ru' ? 'ПОДТВЕРЖДЕНИЕ...' : 'CONFIRMING...'}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.hint}>
            {currentLanguage === 'ru'
              ? 'Наведите камеру на QR-код на экране веб-версии'
              : 'Point the camera at the QR code on the web page'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      fontFamily: 'monospace',
      letterSpacing: 2,
      flex: 1,
      marginLeft: 12,
    },
    cameraContainer: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanFrame: {
      width: 250,
      height: 250,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderColor: theme.primary,
    },
    cornerTL: {
      top: 0,
      left: 0,
      borderTopWidth: 3,
      borderLeftWidth: 3,
    },
    cornerTR: {
      top: 0,
      right: 0,
      borderTopWidth: 3,
      borderRightWidth: 3,
    },
    cornerBL: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
    },
    cornerBR: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 3,
      borderRightWidth: 3,
    },
    confirmingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.8)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    confirmingText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      fontFamily: 'monospace',
      letterSpacing: 2,
    },
    permissionBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 20,
    },
    permissionText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontFamily: 'monospace',
      textAlign: 'center',
      lineHeight: 22,
    },
    permissionButton: {
      borderWidth: 2,
      borderColor: theme.primary,
      paddingVertical: 14,
      paddingHorizontal: 28,
    },
    permissionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      fontFamily: 'monospace',
      letterSpacing: 2,
    },
    footer: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderTopWidth: 2,
      borderTopColor: theme.border,
      alignItems: 'center',
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'monospace',
      textAlign: 'center',
      letterSpacing: 1,
    },
  });
