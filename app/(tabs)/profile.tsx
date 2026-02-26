import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';
import { User, Phone, LogOut, Shield, Tag, Plus, Edit2, Trash2, X, Globe, Palette, BookOpen, Download, Upload, Crown, AlertTriangle, CreditCard, QrCode, Monitor } from 'lucide-react-native';
import Tutorial from '@/components/Tutorial';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

export default function ProfileScreen() {
  const { phoneNumber, logout, dossiers, sectors, addSector, removeSector, updateSector, theme, currentTheme, switchTheme, t, currentLanguage, switchLanguage, resetTutorial, createBackup, restoreBackup } = useApp();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [editingSector, setEditingSector] = useState<string | null>(null);
  const [editedSectorName, setEditedSectorName] = useState('');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Запрос уровня пользователя
  const levelQuery = trpc.appData.getMyLevel.useQuery(undefined, {
    enabled: !!phoneNumber,
    staleTime: 30_000,
  });

  const userLevel = levelQuery.data?.ok ? levelQuery.data.level : 1;
  const maxContacts = levelQuery.data?.ok ? levelQuery.data.maxContacts : 20;
  const currentContacts = dossiers.length;
  const showAds = levelQuery.data?.ok ? levelQuery.data.showAds : true;
  const subscribedUntil = levelQuery.data?.ok ? levelQuery.data.subscribedUntil : null;
  const isAtLimit = maxContacts !== null && currentContacts >= maxContacts;

  const styles = createStyles(theme);
  const createPaymentMutation = trpc.payment.createPayment.useMutation();

  const handleGetAccess = async () => {
    // На вебе — запускаем оплату напрямую
    if (Platform.OS === 'web') {
      setPaymentLoading(true);
      try {
        const res = await createPaymentMutation.mutateAsync();
        if (res.ok && res.paymentUrl) {
          // Открываем страницу оплаты YooKassa в новой вкладке
          window.open(res.paymentUrl, '_blank');
        } else {
          const errCode = (res as any).error;
          const msg = errCode === 'NOT_CONFIGURED'
            ? 'Оплата временно недоступна. Обратитесь в поддержку.'
            : `Ошибка создания платежа: ${errCode || 'неизвестно'}`;
          Alert.alert('ОШИБКА', msg, [{ text: 'OK' }]);
        }
      } catch (e: any) {
        Alert.alert('ОШИБКА', e?.message || 'Ошибка сети', [{ text: 'OK' }]);
      } finally {
        setPaymentLoading(false);
      }
      return;
    }

    // На мобиле — информируем, что оплата в веб-версии
    Alert.alert(
      currentLanguage === 'ru' ? 'ПОЛУЧИТЬ ДОПУСК' : 'GET ACCESS',
      currentLanguage === 'ru'
        ? 'Уровень 2 снимает лимит контактов и убирает рекламу. Подписка 99 руб./неделя. Оформить можно в веб-версии spynetwork.ru'
        : 'Level 2 removes the contact limit and ads. Subscription 99 RUB/week. Available at spynetwork.ru',
      [
        { text: 'OK', style: 'default' },
        {
          text: currentLanguage === 'ru' ? 'ОТКРЫТЬ' : 'OPEN',
          onPress: () => Linking.openURL('https://spynetwork.ru'),
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      t.profile.terminateSessionTitle,
      t.profile.terminateSessionMessage,
      [
        {
          text: t.profile.cancel,
          style: 'cancel',
        },
        {
          text: t.profile.logout,
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/auth');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleAddSector = () => {
    if (newSectorName.trim()) {
      addSector(newSectorName);
      setNewSectorName('');
      setShowAddModal(false);
    }
  };

  const handleEditSector = (sector: string) => {
    setEditingSector(sector);
    setEditedSectorName(sector);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (editingSector && editedSectorName.trim()) {
      updateSector(editingSector, editedSectorName);
      setEditingSector(null);
      setEditedSectorName('');
      setShowEditModal(false);
    }
  };

  const handleDeleteSector = (sector: string) => {
    Alert.alert(
      t.profile.deleteSector,
      `${t.profile.deleteSectorMessage} "${sector.toUpperCase()}"?`,
      [
        { text: t.profile.cancel, style: 'cancel' },
        {
          text: t.profile.delete,
          style: 'destructive',
          onPress: () => {
            const result = removeSector(sector);
            if (result?.error) {
              Alert.alert(
                t.profile.cannotDeleteSector || 'Невозможно удалить сектор',
                t.profile.sectorInUseMessage || 'Перед удалением Сектора уберите его у всех Контактов, где он используется.',
                [{ text: 'OK', style: 'default' }]
              );
            }
          },
        },
      ]
    );
  };

  const handleLanguageChange = (language: 'ru' | 'en') => {
    switchLanguage(language);
    setShowLanguageModal(false);
  };

  const handleStartTutorial = () => {
    resetTutorial();
    setShowTutorial(true);
  };

  const handleCreateBackup = async () => {
    try {
      const success = await createBackup();
      if (success) {
        Alert.alert(
          t.profile.backupSuccess,
          t.profile.backupSuccessMessage,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Backup error:', error);
    }
  };

  const handleRestoreBackup = async () => {
    try {
      const success = await restoreBackup();
      if (success) {
        Alert.alert(
          t.profile.restoreSuccess,
          t.profile.restoreSuccessMessage,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          t.profile.restoreFailed,
          t.profile.restoreFailedMessage,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert(
        t.profile.restoreFailed,
        t.profile.restoreFailedMessage,
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  return (
    <View style={[styles.background, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={currentTheme === 'spy' ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <User size={28} color={theme.primary} strokeWidth={1.5} />
            <Text style={styles.title}>{t.profile.title}</Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Shield size={48} color={theme.primary} strokeWidth={1.5} />
            </View>
            <View style={styles.phoneContainer}>
              <Phone size={16} color={theme.primaryDim} />
              <Text style={styles.phoneText}>{phoneNumber}</Text>
            </View>
          </View>

          {/* Инфо-блок про веб-версию + кнопка QR */}
          <View style={styles.webInfoBlock}>
            <View style={styles.webInfoHeader}>
              <Monitor size={18} color={theme.primary} strokeWidth={1.5} />
              <Text style={styles.webInfoTitle}>ВЕБ-ВЕРСИЯ</Text>
            </View>
            <Text style={styles.webInfoText}>
              Для запуска программы на компьютере войдите на сайт{' '}
              <Text style={styles.webInfoLink}>www.spynetwork.ru</Text>{' '}
              и авторизуйтесь в системе, отсканировав QR код. В Web версии доступно расширенное управление профилем.
            </Text>
            <TouchableOpacity
              style={styles.qrScanButton}
              onPress={() => router.push('/qr-scanner')}
              activeOpacity={0.7}
            >
              <QrCode size={20} color={theme.background} strokeWidth={2} />
              <Text style={styles.qrScanButtonText}>СКАНИРОВАТЬ QR КОД</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{dossiers.length}</Text>
              <Text style={styles.statLabel}>{t.profile.dossiers}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {dossiers.reduce((sum, d) => sum + d.relations.length, 0)}
              </Text>
              <Text style={styles.statLabel}>{t.profile.connections}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {dossiers.reduce((sum, d) => sum + d.diary.length, 0)}
              </Text>
              <Text style={styles.statLabel}>{t.profile.entries}</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.profile.status}</Text>
              <Text style={styles.infoValue}>{t.profile.statusValue}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{currentLanguage === 'ru' ? 'ДОПУСК' : 'CLEARANCE'}</Text>
              <Text style={[styles.infoValue, userLevel >= 2 && { color: theme.primary }]}>
                {currentLanguage === 'ru'
                  ? (userLevel >= 2 ? 'УРОВЕНЬ 2' : 'УРОВЕНЬ 1')
                  : (userLevel >= 2 ? 'LEVEL 2' : 'LEVEL 1')}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{currentLanguage === 'ru' ? 'КОНТАКТЫ' : 'CONTACTS'}</Text>
              <Text style={[styles.infoValue, isAtLimit && { color: theme.danger }]}>
                {maxContacts !== null
                  ? `${currentContacts} / ${maxContacts}`
                  : `${currentContacts} / ∞`}
              </Text>
            </View>
            {subscribedUntil && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{currentLanguage === 'ru' ? 'ПОДПИСКА ДО' : 'SUBSCRIBED UNTIL'}</Text>
                <Text style={styles.infoValue}>
                  {new Date(subscribedUntil).toLocaleDateString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US')}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.profile.encryption}</Text>
              <Text style={styles.infoValue}>{t.profile.encryptionValue}</Text>
            </View>
          </View>

          {userLevel < 2 && (
            <TouchableOpacity
              style={[styles.accessButton, paymentLoading && { opacity: 0.6 }]}
              onPress={handleGetAccess}
              activeOpacity={0.7}
              disabled={paymentLoading}
            >
              {paymentLoading ? (
                <ActivityIndicator color={theme.primary} size="small" />
              ) : (
                <CreditCard size={20} color={theme.primary} strokeWidth={1.5} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.accessButtonTitle}>
                  {currentLanguage === 'ru' ? 'ПОЛУЧИТЬ ДОПУСК' : 'GET ACCESS'}
                </Text>
                <Text style={styles.accessButtonSubtitle}>
                  {currentLanguage === 'ru'
                    ? Platform.OS === 'web'
                      ? 'Оплатить онлайн — 99 руб./нед. • Безлимит контактов'
                      : 'Безлимит контактов, без рекламы — 99 руб./нед.'
                    : Platform.OS === 'web'
                      ? 'Pay online — 99 RUB/week • Unlimited contacts'
                      : 'Unlimited contacts, no ads — 99 RUB/week'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {isAtLimit && (
            <View style={styles.limitWarning}>
              <AlertTriangle size={16} color={theme.danger} strokeWidth={1.5} />
              <Text style={styles.limitWarningText}>
                {currentLanguage === 'ru'
                  ? `Лимит контактов достигнут (${maxContacts}). Получите ДОПУСК уровня 2 для снятия ограничения.`
                  : `Contact limit reached (${maxContacts}). Get Level 2 ACCESS to remove the limit.`}
              </Text>
            </View>
          )}

          <View style={styles.themeContainer}>
            <View style={styles.themeHeader}>
              <View style={styles.themeHeaderLeft}>
                <Palette size={20} color={theme.primary} strokeWidth={1.5} />
                <Text style={styles.themeTitle}>{t.profile.theme}</Text>
              </View>
              <TouchableOpacity
                style={styles.themeButton}
                onPress={() => setShowThemeModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.themeButtonText}>
                  {currentTheme === 'spy' ? t.profile.spy : currentTheme === 'business' ? t.profile.business : t.profile.genesis}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.languageContainer}>
            <View style={styles.languageHeader}>
              <View style={styles.languageHeaderLeft}>
                <Globe size={20} color={theme.primary} strokeWidth={1.5} />
                <Text style={styles.languageTitle}>{t.profile.language}</Text>
              </View>
              <TouchableOpacity
                style={styles.languageButton}
                onPress={() => setShowLanguageModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.languageButtonText}>{currentLanguage === 'ru' ? t.profile.russian : t.profile.english}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectorsContainer}>
            <View style={styles.sectorsHeader}>
              <View style={styles.sectorsHeaderLeft}>
                <Tag size={20} color={theme.primary} strokeWidth={1.5} />
                <Text style={styles.sectorsTitle}>{t.profile.sectors}</Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.7}
              >
                <Plus size={18} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.sectorsList}>
              {sectors.map((sector) => (
                <View key={sector} style={styles.sectorItem}>
                  <Text style={styles.sectorName}>{sector.toUpperCase()}</Text>
                  <View style={styles.sectorActions}>
                    <TouchableOpacity
                      onPress={() => handleEditSector(sector)}
                      activeOpacity={0.7}
                      style={styles.sectorActionButton}
                    >
                      <Edit2 size={14} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteSector(sector)}
                      activeOpacity={0.7}
                      style={styles.sectorActionButton}
                    >
                      <Trash2 size={14} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.backupContainer}>
            <View style={styles.backupHeader}>
              <View style={styles.backupHeaderLeft}>
                <Shield size={20} color={theme.primary} strokeWidth={1.5} />
                <Text style={styles.backupTitle}>{t.profile.backup}</Text>
              </View>
            </View>
            <View style={styles.backupButtons}>
              <TouchableOpacity
                style={styles.backupButton}
                onPress={handleCreateBackup}
                activeOpacity={0.7}
              >
                <Download size={18} color={theme.primary} />
                <Text style={styles.backupButtonText}>{t.profile.createBackup}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backupButton}
                onPress={handleRestoreBackup}
                activeOpacity={0.7}
              >
                <Upload size={18} color={theme.primary} />
                <Text style={styles.backupButtonText}>{t.profile.restoreBackup}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.tutorialButton}
            onPress={handleStartTutorial}
            activeOpacity={0.7}
          >
            <BookOpen size={20} color={theme.primary} />
            <Text style={styles.tutorialText}>{t.tutorial.startTutorial}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LogOut size={20} color={theme.danger} />
            <Text style={styles.logoutText}>{t.profile.terminateSession}</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal
          visible={showAddModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.profile.addSector}</Text>
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  activeOpacity={0.7}
                >
                  <X size={24} color={theme.primary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={newSectorName}
                onChangeText={setNewSectorName}
                placeholder={t.profile.sectorName}
                placeholderTextColor={theme.primaryDim}
                autoFocus
              />
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleAddSector}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonText}>{t.profile.add}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showEditModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.profile.editSector}</Text>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  activeOpacity={0.7}
                >
                  <X size={24} color={theme.primary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={editedSectorName}
                onChangeText={setEditedSectorName}
                placeholder={t.profile.sectorName}
                placeholderTextColor={theme.primaryDim}
                autoFocus
              />
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleSaveEdit}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonText}>{t.profile.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showLanguageModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLanguageModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.profile.language}</Text>
                <TouchableOpacity
                  onPress={() => setShowLanguageModal(false)}
                  activeOpacity={0.7}
                >
                  <X size={24} color={theme.primary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  currentLanguage === 'ru' && styles.languageOptionActive,
                ]}
                onPress={() => handleLanguageChange('ru')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    currentLanguage === 'ru' && styles.languageOptionTextActive,
                  ]}
                >
                  {t.profile.russian}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  currentLanguage === 'en' && styles.languageOptionActive,
                ]}
                onPress={() => handleLanguageChange('en')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    currentLanguage === 'en' && styles.languageOptionTextActive,
                  ]}
                >
                  {t.profile.english}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showThemeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowThemeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.profile.theme}</Text>
                <TouchableOpacity
                  onPress={() => setShowThemeModal(false)}
                  activeOpacity={0.7}
                >
                  <X size={24} color={theme.primary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  currentTheme === 'spy' && styles.languageOptionActive,
                ]}
                onPress={() => {
                  switchTheme('spy');
                  setShowThemeModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    currentTheme === 'spy' && styles.languageOptionTextActive,
                  ]}
                >
                  {t.profile.spy}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  currentTheme === 'business' && styles.languageOptionActive,
                ]}
                onPress={() => {
                  switchTheme('business');
                  setShowThemeModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    currentTheme === 'business' && styles.languageOptionTextActive,
                  ]}
                >
                  {t.profile.business}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  currentTheme === 'genesis' && styles.languageOptionActive,
                ]}
                onPress={() => {
                  switchTheme('genesis');
                  setShowThemeModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    currentTheme === 'genesis' && styles.languageOptionTextActive,
                  ]}
                >
                  {t.profile.genesis}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Tutorial
          visible={showTutorial}
          onClose={() => setShowTutorial(false)}
          theme={theme}
          t={t}
        />
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 3,
  },
  themeContainer: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 20,
    marginBottom: 20,
  },
  themeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  themeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.background,
  },
  themeButtonText: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileCard: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
    marginBottom: 16,
  },
  agentTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 3,
    marginBottom: 8,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  webInfoBlock: {
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.overlay,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  webInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webInfoTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  webInfoText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  webInfoLink: {
    color: theme.primary,
    fontWeight: '700' as const,
  },
  qrScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  qrScanButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: theme.background,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
  },
  statLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginTop: 4,
  },
  infoSection: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 20,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  accessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.overlay,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 20,
  },
  accessButtonTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  accessButtonSubtitle: {
    fontSize: 11,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  limitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.danger,
    backgroundColor: theme.overlay,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  limitWarningText: {
    flex: 1,
    fontSize: 11,
    color: theme.danger,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
  },
  tutorialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.overlay,
    paddingVertical: 16,
    gap: 12,
    marginBottom: 12,
  },
  tutorialText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.danger,
    backgroundColor: theme.overlay,
    paddingVertical: 16,
    gap: 12,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.danger,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  sectorsContainer: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 20,
    marginBottom: 20,
  },
  sectorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectorsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectorsTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  addButton: {
    padding: 4,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.background,
  },
  sectorsList: {
    gap: 8,
  },
  sectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  sectorName: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  sectorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  sectorActionButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: theme.text,
    fontFamily: 'monospace' as const,
    marginBottom: 16,
  },
  modalButton: {
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.overlay,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  languageContainer: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 20,
    marginBottom: 20,
  },
  languageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  languageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  languageButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.background,
  },
  languageButtonText: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  languageOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    marginBottom: 12,
  },
  languageOptionActive: {
    borderColor: theme.primary,
    backgroundColor: theme.background,
  },
  languageOptionText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    textAlign: 'center',
  },
  languageOptionTextActive: {
    color: theme.text,
    fontWeight: '700' as const,
  },
  backupContainer: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 20,
    marginBottom: 20,
  },
  backupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backupTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  backupButtons: {
    gap: 12,
  },
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.background,
  },
  backupButtonText: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
});
