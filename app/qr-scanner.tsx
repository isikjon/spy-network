import { useApp } from '@/contexts/AppContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { X, QrCode } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function QRScannerScreen() {
  const { theme } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const scannedRef = useRef(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanned(true);

    // Ожидаем deep link вида: rork-app://qr-confirm?session=...&base=...
    // Или просто URL с параметрами
    try {
      const url = new URL(data);
      const session = url.searchParams.get('session');
      const base = url.searchParams.get('base');

      if (session) {
        router.replace({
          pathname: '/qr-confirm',
          params: { session, base: base || '' },
        });
        return;
      }
    } catch {
      // Не URL — пробуем как rork-app://
    }

    // Пробуем открыть как deep link
    if (data.startsWith('rork-app://') || data.includes('qr-confirm')) {
      Linking.openURL(data).catch(() => {
        scannedRef.current = false;
        setScanned(false);
      });
    } else {
      scannedRef.current = false;
      setScanned(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <Text style={styles.permText}>Загрузка...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <SafeAreaView style={styles.noPermContainer}>
          <QrCode size={48} color="#00FF41" strokeWidth={1.5} />
          <Text style={styles.permTitle}>ДОСТУП К КАМЕРЕ</Text>
          <Text style={styles.permText}>
            Для сканирования QR-кода необходим доступ к камере устройства.
          </Text>
          <TouchableOpacity
            style={styles.permButton}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.permButtonText}>РАЗРЕШИТЬ ДОСТУП</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>ОТМЕНА</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Затемнение по краям */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Хедер */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <QrCode size={22} color="#00FF41" strokeWidth={1.5} />
          <Text style={styles.headerTitle}>СКАНЕР QR-КОДА</Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
            <X size={26} color="#00FF41" strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Инструкция */}
      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          Наведите камеру на QR-код на экране{'\n'}
          <Text style={{ color: '#00FF41', fontWeight: 'bold' }}>web-версии</Text>{' '}
          spynetwork.ru/app
        </Text>
        {scanned && (
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => {
              scannedRef.current = false;
              setScanned(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.rescanText}>СКАНИРОВАТЬ СНОВА</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const CORNER = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  noPermContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00FF41',
    fontFamily: 'monospace',
    letterSpacing: 3,
    textAlign: 'center',
  },
  permText: {
    fontSize: 13,
    color: '#4CAF50',
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  permButton: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#00FF41',
    backgroundColor: 'rgba(0,255,65,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  permButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00FF41',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  cancelText: {
    fontSize: 13,
    color: '#4CAF50',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: 260,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  scanArea: {
    width: 260,
    height: 260,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#00FF41',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderBottomWidth: 1,
    borderBottomColor: '#003311',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00FF41',
    fontFamily: 'monospace',
    letterSpacing: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    gap: 16,
  },
  footerHint: {
    fontSize: 13,
    color: '#4CAF50',
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  rescanButton: {
    borderWidth: 2,
    borderColor: '#00FF41',
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,255,65,0.1)',
  },
  rescanText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00FF41',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
});
