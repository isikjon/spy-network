import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { Redirect, router } from 'expo-router';
import { User, Phone, LogOut, Shield, Tag, Plus, Edit2, Trash2, X, Globe, Palette, BookOpen, Download, Upload, CreditCard, Lock, QrCode, Monitor, Loader } from 'lucide-react-native';

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
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

type ProfileScreenProps = {
  embedded?: boolean;
};

export default function ProfileScreen({ embedded }: ProfileScreenProps) {
  const { phoneNumber, logout, dossiers, sectors, addSector, removeSector, updateSector, theme, currentTheme, switchTheme, t, currentLanguage, switchLanguage, resetTutorial, createBackup, restoreBackup, subscriptionLevel, changeSubscription } = useApp();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [editingSector, setEditingSector] = useState<string | null>(null);
  const [editedSectorName, setEditedSectorName] = useState('');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [cardDeleteLoading, setCardDeleteLoading] = useState(false);

  const createPaymentMutation = trpc.payment.createPayment.useMutation();
  const deleteCardMutation = trpc.payment.deleteCard.useMutation();
  const cardInfoQuery = trpc.payment.getCardInfo.useQuery(undefined, { enabled: !!phoneNumber });

  const handleSubscribe = async () => {
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const result = await createPaymentMutation.mutateAsync();
      if (result.ok && result.paymentUrl) {
        if (Platform.OS === 'web') {
          window.open(result.paymentUrl, '_blank');
        } else {
          Linking.openURL(result.paymentUrl);
        }
      } else {
        setPaymentError('Ошибка создания платежа. Попробуйте позже.');
      }
    } catch {
      setPaymentError('Ошибка соединения. Попробуйте позже.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDeleteCard = () => {
    Alert.alert(
      'Отвязать карту',
      'После отвязки карты автоматическое продление подписки будет отключено. Продолжить?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отвязать',
          style: 'destructive',
          onPress: async () => {
            setCardDeleteLoading(true);
            try {
              await deleteCardMutation.mutateAsync();
              cardInfoQuery.refetch();
            } catch {
              Alert.alert('Ошибка', 'Не удалось отвязать карту. Попробуйте позже.');
            } finally {
              setCardDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  const shouldRedirectToSplitView = Platform.OS === 'web' && !embedded;

  if (shouldRedirectToSplitView) {
    console.log('[ProfileScreen] web standalone route opened; redirecting to split view');
    return <Redirect href="/" />;
  }

  const styles = createStyles(theme);

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
            router.replace('/auth' as any);
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
          {Platform.OS === 'web' ? (
            <View style={[styles.profileCard, styles.webBlockSpacing, styles.webBlockMinHeight]}>
              <View style={styles.webProfileRow}>
                <View style={styles.webProfileColLeft}>
                  <View style={styles.avatar}>
                    <Shield size={48} color={theme.primary} strokeWidth={1.5} />
                  </View>
                  <Text style={styles.webClearanceLabel}>{t.profile.clearanceSection || 'ДОПУСК'}</Text>
                </View>
                <View style={styles.webProfileColRight}>
                  <View style={styles.webPhoneLast3Wrap}>
                    <Text style={styles.webPhoneLast3}>{phoneNumber ? phoneNumber.slice(-3) : '---'}</Text>
                  </View>
                  <Text style={styles.webClearanceLevel}>УРОВЕНЬ {subscriptionLevel === 'working' ? '2' : '1'}</Text>
                </View>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.profileCard}>
                <View style={styles.avatar}>
                  <Shield size={48} color={theme.primary} strokeWidth={1.5} />
                </View>
                <View style={styles.phoneContainer}>
                  <Phone size={16} color={theme.primaryDim} />
                  <Text style={styles.phoneText}>{phoneNumber}</Text>
                </View>

                <View style={styles.clearanceInline}>
                  <View style={styles.clearanceLevelRow}>
                    <Text style={styles.clearanceLevelLabel}>ДОПУСК</Text>
                    <View style={[
                      styles.clearanceLevelBadge,
                      subscriptionLevel === 'working' && styles.clearanceLevelBadgeActive,
                    ]}>
                      <Text style={[
                        styles.clearanceLevelValue,
                        subscriptionLevel === 'working' && styles.clearanceLevelValueActive,
                      ]}>
                        {subscriptionLevel === 'working' ? 'УРОВЕНЬ 2' : 'УРОВЕНЬ 1'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.linkWebButton}
                onPress={() => router.push('/qr-scanner' as any)}
                activeOpacity={0.7}
              >
                <QrCode size={20} color={theme.primary} />
                <Text style={styles.linkWebText}>ПЕРЕЙТИ НА ВЕБ ВЕРСИЮ</Text>
                <Monitor size={16} color={theme.primaryDim} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </>
          )}

          {Platform.OS !== 'web' && (
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
          )}

          {Platform.OS === 'web' && (
            <View style={[styles.subscriptionContainer, styles.webBlockSpacing, styles.webBlockMinHeight]}>
              <View style={styles.subscriptionHeader}>
                <View style={styles.subscriptionHeaderLeft}>
                  <CreditCard size={20} color={theme.primary} strokeWidth={1.5} />
                  <Text style={styles.subscriptionTitle}>{t.profile.subscription}</Text>
                </View>
                <View style={[
                  styles.subscriptionBadge,
                  subscriptionLevel === 'working' && styles.subscriptionBadgeActive,
                ]}>
                  <Text style={[
                    styles.subscriptionBadgeText,
                    subscriptionLevel === 'working' && styles.subscriptionBadgeTextActive,
                  ]}>
                    {subscriptionLevel === 'working' ? (currentLanguage === 'ru' ? 'УРОВЕНЬ 2' : 'LEVEL 2') : (currentLanguage === 'ru' ? 'УРОВЕНЬ 1' : 'LEVEL 1')}
                  </Text>
                </View>
              </View>

              <View style={styles.subscriptionPlans}>
                <View style={[
                  styles.planCard,
                  subscriptionLevel === 'basic' && styles.planCardActive,
                ]}>
                  <View style={styles.planHeader}>
                    <Text style={[
                      styles.planName,
                      subscriptionLevel === 'basic' && styles.planNameActive,
                    ]}>{currentLanguage === 'ru' ? 'УРОВЕНЬ 1' : 'LEVEL 1'}</Text>
                    {subscriptionLevel === 'basic' && (
                      <View style={styles.currentPlanTag}>
                        <Text style={styles.currentPlanTagText}>{t.profile.subscriptionCurrentPlan}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planDesc}>{t.profile.subscriptionBasicDesc}</Text>
                  <Text style={styles.planPrice}>{currentLanguage === 'ru' ? 'Бесплатно' : 'Free'}</Text>
                </View>

                <View style={[
                  styles.planCard,
                  styles.planCardPremium,
                  subscriptionLevel === 'working' && styles.planCardActive,
                ]}>
                  <View style={styles.planHeader}>
                    <Text style={[
                      styles.planName,
                      subscriptionLevel === 'working' && styles.planNameActive,
                    ]}>{currentLanguage === 'ru' ? 'УРОВЕНЬ 2' : 'LEVEL 2'}</Text>
                    {subscriptionLevel === 'working' && (
                      <View style={styles.currentPlanTag}>
                        <Text style={styles.currentPlanTagText}>{t.profile.subscriptionActive}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planDesc}>{t.profile.subscriptionWorkingDesc}</Text>
                  <View style={styles.planPriceRow}>
                    <Text style={styles.planPricePremium}>{t.profile.subscriptionPrice}</Text>
                    <Text style={styles.planAutoRenew}>{t.profile.subscriptionAutoRenew}</Text>
                  </View>

                  {subscriptionLevel === 'basic' ? (
                    <>
                      {paymentError && (
                        <Text style={{ color: theme.danger, fontFamily: 'monospace', fontSize: 11, marginBottom: 8, textAlign: 'center' }}>
                          {paymentError}
                        </Text>
                      )}
                      <TouchableOpacity
                        style={[styles.subscribeButton, paymentLoading && { opacity: 0.6 }]}
                        onPress={handleSubscribe}
                        activeOpacity={0.7}
                        disabled={paymentLoading}
                      >
                        <Text style={styles.subscribeButtonText}>
                          {paymentLoading ? 'ЗАГРУЗКА...' : t.profile.subscriptionActivate}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.cancelSubscriptionButton}
                      onPress={() => {
                        Alert.alert(
                          t.profile.subscriptionCancelConfirmTitle,
                          t.profile.subscriptionCancelConfirmMessage,
                          [
                            { text: t.profile.cancel, style: 'cancel' },
                            {
                              text: t.profile.subscriptionConfirm,
                              style: 'destructive',
                              onPress: () => changeSubscription('basic'),
                            },
                          ]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelSubscriptionText}>{t.profile.subscriptionCancel}</Text>
                    </TouchableOpacity>
                  )}

                  {/* Блок карты — показывается всегда когда карта сохранена */}
                  {cardInfoQuery.data?.ok && cardInfoQuery.data.card && (
                    <View style={styles.savedCardBlock}>
                      <Text style={styles.savedCardLabel}>КАРТА ДЛЯ АВТОПРОДЛЕНИЯ</Text>
                      <View style={styles.savedCardRow}>
                        <Text style={styles.savedCardNumber}>
                          {cardInfoQuery.data.card.cardType} •••• {cardInfoQuery.data.card.cardLast4}
                        </Text>
                        <TouchableOpacity
                          onPress={handleDeleteCard}
                          disabled={cardDeleteLoading}
                          activeOpacity={0.7}
                          style={styles.deleteCardButton}
                        >
                          <Text style={styles.deleteCardText}>
                            {cardDeleteLoading ? '...' : 'ОТВЯЗАТЬ'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {cardInfoQuery.data.subscribedUntil && (
                        <Text style={styles.nextBillingText}>
                          {'СЛЕДУЮЩЕЕ СПИСАНИЕ: ' + new Date(cardInfoQuery.data.subscribedUntil).toLocaleDateString('ru-RU')}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {Platform.OS === 'web' && (
            <View style={[styles.sectorsContainer, styles.webBlockSpacing, styles.webBlockMinHeight]}>
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
          )}

          <View style={[styles.themeContainer, Platform.OS === 'web' && styles.webBlockSpacing]}>
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

          {Platform.OS !== 'web' && (
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
          )}

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
  webProfileRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 24,
  },
  webProfileColLeft: {
    alignItems: 'center' as const,
  },
  webProfileColRight: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  webBlockSpacing: {
    marginBottom: 24,
  },
  webBlockMinHeight: {
    minHeight: 240,
  },
  webPhoneLast3Wrap: {
    height: 100,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  webPhoneLast3: {
    fontSize: 72,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 4,
    lineHeight: 100,
  },
  webClearanceLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
    marginTop: 4,
  },
  webClearanceLevel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
    marginTop: 20,
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
  subscriptionContainer: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 20,
    marginBottom: 20,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  subscriptionBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  subscriptionBadgeActive: {
    borderColor: theme.warning,
    backgroundColor: 'rgba(253, 180, 88, 0.15)',
  },
  subscriptionBadgeText: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    fontWeight: '700' as const,
  },
  subscriptionBadgeTextActive: {
    color: theme.warning,
  },
  subscriptionPlans: {
    gap: 12,
  },
  planCard: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    padding: 16,
  },
  planCardPremium: {
    borderColor: theme.border,
  },
  planCardActive: {
    borderColor: theme.primary,
    borderWidth: 2,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  planName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  planNameActive: {
    color: theme.text,
  },
  currentPlanTag: {
    marginLeft: 'auto' as const,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  currentPlanTagText: {
    fontSize: 8,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    fontWeight: '700' as const,
  },
  planDesc: {
    fontSize: 11,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    marginBottom: 8,
    lineHeight: 16,
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  planPricePremium: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
  },
  planAutoRenew: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: theme.primary,
  },
  subscribeButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: theme.background,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  cancelSubscriptionButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  cancelSubscriptionText: {
    fontSize: 10,
    color: theme.danger,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    fontWeight: '700' as const,
  },
  savedCardBlock: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    padding: 12,
    marginBottom: 10,
  },
  savedCardLabel: {
    fontSize: 9,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginBottom: 8,
  },
  savedCardRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  savedCardNumber: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  deleteCardButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  deleteCardText: {
    fontSize: 9,
    color: theme.danger,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    fontWeight: '700' as const,
  },
  nextBillingText: {
    fontSize: 9,
    color: theme.primaryDim,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginTop: 6,
  },
  clearanceInline: {
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  clearanceLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    marginBottom: 12,
  },
  clearanceLevelLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  clearanceLevelBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
  },
  clearanceLevelBadgeActive: {
    borderColor: theme.warning,
    backgroundColor: 'rgba(253, 180, 88, 0.15)',
  },
  clearanceLevelValue: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  clearanceLevelValueActive: {
    color: theme.warning,
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
  linkWebButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.overlay,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  linkWebText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
});
