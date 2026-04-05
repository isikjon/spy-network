import { useApp } from '@/contexts/AppContext';
import { router } from 'expo-router';
import {
  BookOpen,
  Network as NetworkIcon,
  Palette,
  Cigarette,
  Search,
  Shield,
  FileText,
  Users,
  X,
  User,
  Globe,
  MessageSquare,
  Bell,
  Lightbulb,
  Crown,
  Brain,
  PenTool,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  StatusBar,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DossierPane } from '@/components/DossierPane';
import { ContactDossier } from '@/types';
import NetworkScreen from './network';
import ProfileScreen from './profile';
import StrategyScreen from './strategy';
import AnalysisScreen from './analysis';
import ActionsScreen from './actions';
import ClubScreen from './club';

type OpenDossierHandler = (payload: { id: string; edit?: boolean }) => void;

function getMaintenanceInfoForDossier(dossier: ContactDossier): { status: 'green' | 'yellow' | 'red' | 'inactive'; daysLeft: number; recommendedDays: number } | null {
  if (dossier.noDirectConnection) {
    return { status: 'inactive', daysLeft: 0, recommendedDays: 0 };
  }

  const importanceWeights: Record<string, number> = {
    critical: 14,
    high: 21,
    medium: 45,
    low: 90,
  };
  let recommendedDays = importanceWeights[dossier.importance] ?? 45;

  if (dossier.assessment) {
    const vi = dossier.assessment.valueIndex;
    if (vi >= 75) {
      recommendedDays = Math.min(recommendedDays, 14);
    } else if (vi >= 50) {
      recommendedDays = Math.min(recommendedDays, 28);
    } else if (vi >= 30) {
      recommendedDays = Math.max(recommendedDays, 45);
    }
  }

  const lastDate = dossier.lastInteraction
    ? new Date(dossier.lastInteraction)
    : dossier.diary && dossier.diary.length > 0
      ? new Date(Math.max(...dossier.diary.map(e => new Date(e.date).getTime())))
      : null;

  if (!lastDate) {
    return { status: 'red', daysLeft: -recommendedDays, recommendedDays };
  }

  const now = new Date();
  const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = recommendedDays - daysSinceLast;

  let status: 'green' | 'yellow' | 'red';
  if (daysLeft <= 0) {
    status = 'red';
  } else if (daysLeft <= Math.ceil(recommendedDays * 0.3)) {
    status = 'yellow';
  } else {
    status = 'green';
  }

  return { status, daysLeft, recommendedDays };
}

function DossiersTab({ onOpenDossier }: { onOpenDossier?: OpenDossierHandler }) {
  const { dossiers, addDossier, theme, t, goals } = useApp();
  const [search, setSearch] = useState('');
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<any[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  const styles = createStyles(theme);

  const filteredDossiers = dossiers.filter((d) => {
    if (!search) return true;
    
    const searchLower = search.toLowerCase();
    
    return (
      d.contact.name.toLowerCase().includes(searchLower) ||
      d.contact.phoneNumbers.some(p => p.toLowerCase().includes(searchLower)) ||
      d.contact.emails.some(e => e.toLowerCase().includes(searchLower)) ||
      (d.contact.company && d.contact.company.toLowerCase().includes(searchLower)) ||
      (d.contact.position && d.contact.position.toLowerCase().includes(searchLower)) ||
      (d.contact.notes && d.contact.notes.toLowerCase().includes(searchLower)) ||
      d.sectors.some(s => s.toLowerCase().includes(searchLower)) ||
      d.functionalCircle.toLowerCase().includes(searchLower) ||
      d.importance.toLowerCase().includes(searchLower) ||
      d.diary.some(entry => entry.content.toLowerCase().includes(searchLower))
    );
  });

  const loadContacts = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(t.dossiers.notAvailable, t.dossiers.contactAccessWeb);
      return;
    }

    setIsLoadingContacts(true);
    try {
      const Contacts = await import('expo-contacts');
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Image, Contacts.Fields.Company, Contacts.Fields.JobTitle],
        });
        setPhoneContacts(data);
        setShowContactsModal(true);
      } else {
        Alert.alert(t.dossiers.permissionDenied, t.dossiers.contactPermissionRequired);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
      Alert.alert(t.dossiers.error, t.dossiers.failedLoadContacts);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleSelectPhoneContact = (contact: any) => {
    const newDossier: ContactDossier = {
      contact: {
        id: `contact_${Date.now()}`,
        name: contact.name || t.dossiers.unknown,
        phoneNumbers: contact.phoneNumbers?.map((p: any) => p.number || '') || [],
        emails: contact.emails?.map((e: any) => e.email || '') || [],
        company: contact.company,
        position: contact.jobTitle,
        photo: contact.image?.uri,
      },
      sectors: [],
      functionalCircle: 'productivity',
      importance: 'medium',
      relations: [],
      diary: [
        {
          id: `diary_${Date.now()}`,
          date: new Date(),
          type: 'auto',
          content: t.dossiers.contactImported,
        },
      ],
      addedDate: new Date(),
    };
    const result = addDossier(newDossier);
    if (!result.ok && result.error === 'DUPLICATE') {
      setShowContactsModal(false);
      setContactSearch('');
      Alert.alert(
        t.dossiers.duplicateTitle || 'Контакт уже существует',
        (t.dossiers.duplicateMessage || 'Контакт с таким номером уже есть в досье:') + ` "${result.existingName}"`,
        [
          { text: t.dossiers.cancel || 'Отмена', style: 'cancel' },
          {
            text: t.dossiers.openExisting || 'Открыть',
            onPress: () => {
              if (onOpenDossier) {
                onOpenDossier({ id: result.existingId });
              } else {
                router.push({ pathname: '/dossier/[id]' as any, params: { id: result.existingId } });
              }
            },
          },
        ],
      );
      return;
    }
    setShowContactsModal(false);
    setContactSearch('');
    if (onOpenDossier) {
      onOpenDossier({ id: newDossier.contact.id, edit: true });
    } else {
      router.push({ pathname: '/dossier/[id]' as any, params: { id: newDossier.contact.id, edit: 'true' } });
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'critical':
        return theme.danger;
      case 'high':
        return theme.warning;
      case 'medium':
        return theme.primary;
      default:
        return theme.primaryDim;
    }
  };

  const renderDossier = ({ item }: { item: ContactDossier }) => (
    <TouchableOpacity
      style={styles.dossierCard}
      onPress={() => {
        if (onOpenDossier) {
          onOpenDossier({ id: item.contact.id });
        } else {
          router.push({ pathname: '/dossier/[id]' as any, params: { id: item.contact.id } });
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.dossierHeader}>
        <View style={styles.dossierIcon}>
          <FileText size={20} color={theme.primary} />
        </View>
        <View style={styles.dossierInfo}>
          <Text style={styles.dossierName}>{item.contact.name}</Text>
          {item.powerGrouping?.groupName ? (
            <Text style={styles.powerGroupingName}>{item.powerGrouping.groupName.toUpperCase()}</Text>
          ) : null}
          <Text style={styles.dossierMeta}>
            {item.contact.position || t.dossiers.unknownPosition}
          </Text>
        </View>
        <View style={styles.badgesColumn}>
          <View
            style={[
              styles.importanceBadge,
              { borderColor: getImportanceColor(item.importance) },
            ]}
          >
            <Text
              style={[
                styles.importanceText,
                { color: getImportanceColor(item.importance) },
              ]}
            >
              {item.importance.toUpperCase()}
            </Text>
          </View>
          {item.noDirectConnection && (
            <View style={styles.noConnectionBadge}>
              <Text style={styles.noConnectionText}>{t.contact.noDirectConnection}</Text>
            </View>
          )}
          {(() => {
            const mInfo = getMaintenanceInfoForDossier(item);
            if (!mInfo || mInfo.status === 'inactive') return null;
            if (mInfo.daysLeft > 5) return null;
            const badgeColor = mInfo.daysLeft <= 0 ? '#dc2626' : mInfo.daysLeft <= 3 ? '#d97706' : '#059669';
            const badgeLabel = mInfo.daysLeft <= 0
              ? `${t.contact?.maintainBadge ?? 'Поддержи связь'} (${Math.abs(mInfo.daysLeft)}${t.contact?.maintainDaysLeft ?? 'д'} ${t.contact?.maintainOverdue ?? 'просроч.'})`
              : `${t.contact?.maintainBadge ?? 'Поддержи связь'} (${mInfo.daysLeft}${t.contact?.maintainDaysLeft ?? 'д'})`;
            return (
              <View style={[styles.maintenanceListBadge, { borderColor: badgeColor }]}>
                <Text style={[styles.maintenanceListBadgeText, { color: badgeColor }]}>
                  {badgeLabel}
                </Text>
              </View>
            );
          })()}
        </View>
      </View>
      <View style={styles.dossierFooter}>
        {(() => {
          const linkedGoals = goals.filter(g => (g.contactIds || []).includes(item.contact.id));
          if (linkedGoals.length === 0) return null;
          return (
            <Text style={styles.dossierGoal}>
              {linkedGoals.map(g => g.title).join(', ')}
            </Text>
          );
        })()}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.background} testID="dossiersTabRoot">
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Shield size={28} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>{t.dossiers.title}</Text>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={theme.primaryDim} />
          <TextInput
            style={styles.searchInput}
            placeholder={t.dossiers.searchPlaceholder}
            placeholderTextColor={theme.primaryDim}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {dossiers.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={64} color={theme.primaryDim} strokeWidth={1} />
            <Text style={styles.emptyTitle}>{t.dossiers.noDossiers}</Text>
            <Text style={styles.emptyText}>
              {t.dossiers.beginBuilding}
            </Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={loadContacts}
                activeOpacity={0.7}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Users size={20} color={theme.primary} />
                )}
                <Text style={styles.addButtonText}>{t.dossiers.importFromPhone}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <FlatList
              data={filteredDossiers}
              renderItem={renderDossier}
              keyExtractor={(item) => item.contact.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
            <View style={styles.fabContainer}>
              <TouchableOpacity
                style={styles.fab}
                onPress={loadContacts}
                activeOpacity={0.8}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Users size={24} color={theme.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <Modal
          visible={showContactsModal}
          animationType="slide"
          onRequestClose={() => setShowContactsModal(false)}
        >
          <View style={styles.modalContainer}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.modalContent} edges={['top']}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Users size={24} color={theme.primary} />
                  <Text style={styles.modalTitle}>{t.dossiers.addressBook}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowContactsModal(false)}
                  activeOpacity={0.7}
                >
                  <X size={24} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Search size={18} color={theme.primaryDim} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t.dossiers.searchContacts}
                  placeholderTextColor={theme.primaryDim}
                  value={contactSearch}
                  onChangeText={setContactSearch}
                />
              </View>

              <FlatList
                data={phoneContacts.filter(c => 
                  !contactSearch || 
                  (c.name && c.name.toLowerCase().includes(contactSearch.toLowerCase())) ||
                  (c.phoneNumbers && c.phoneNumbers.some((p: any) => p.number?.includes(contactSearch))) ||
                  (c.emails && c.emails.some((e: any) => e.email?.toLowerCase().includes(contactSearch.toLowerCase())))
                )}
                keyExtractor={(item, index) => `contact_${index}_${item.name || 'unknown'}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => handleSelectPhoneContact(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contactIcon}>
                      <Users size={20} color={theme.primary} />
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{item.name || t.dossiers.unknown}</Text>
                      {item.phoneNumbers && item.phoneNumbers.length > 0 && (
                        <Text style={styles.contactDetail}>{item.phoneNumbers[0].number}</Text>
                      )}
                      {item.company ? (
                        <Text style={styles.contactDetail}>{item.company}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.contactsList}
                showsVerticalScrollIndicator={false}
              />
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

type WebDossierPaneMode = 'list' | 'dossier';
type WebRightPaneTab = 'network' | 'strategy' | 'analysis' | 'actions';


function WebSplitView() {
  const { theme, t } = useApp();
  const { width } = useWindowDimensions();
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isClubOpen, setIsClubOpen] = useState<boolean>(false);

  const clubOverlayWidth = Math.min(480, Math.max(340, Math.floor(width * 0.38)));
  const clubTranslateX = useRef<Animated.Value>(new Animated.Value(-(clubOverlayWidth + 24))).current;
  const clubOpacity = useRef<Animated.Value>(new Animated.Value(0)).current;
  const [paneMode, setPaneMode] = useState<WebDossierPaneMode>('list');
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [selectedDossierEditing, setSelectedDossierEditing] = useState<boolean>(false);
  const [rightPaneTab, setRightPaneTab] = useState<WebRightPaneTab>('network');
  const [webGoalId, setWebGoalId] = useState<string | null>(null);

  const overlayWidth = Math.min(520, Math.max(360, Math.floor(width * 0.42)));
  const translateX = useRef<Animated.Value>(new Animated.Value(overlayWidth + 24)).current;
  const overlayOpacity = useRef<Animated.Value>(new Animated.Value(0)).current;

  const openClub = useCallback(() => {
    setIsClubOpen(true);
    clubTranslateX.setValue(-(clubOverlayWidth + 24));
    clubOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(clubTranslateX, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(clubOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [clubOpacity, clubOverlayWidth, clubTranslateX]);

  const closeClub = useCallback(() => {
    Animated.parallel([
      Animated.timing(clubTranslateX, {
        toValue: -(clubOverlayWidth + 24),
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(clubOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setIsClubOpen(false);
    });
  }, [clubOpacity, clubOverlayWidth, clubTranslateX]);

  const openProfile = useCallback(() => {
    setIsProfileOpen(true);
    translateX.setValue(overlayWidth + 24);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlayOpacity, overlayWidth, translateX]);

  const closeProfile = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: overlayWidth + 24,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setIsProfileOpen(false);
    });
  }, [overlayOpacity, overlayWidth, translateX]);

  const railItems = useMemo(
    () => [
      { key: 'profile', icon: User },
      { key: 'theme', icon: Palette },
      { key: 'language', icon: Globe },
      { key: 'tutorial', icon: BookOpen },
    ],
    []
  );

  const clubRailItems = useMemo(
    () => [
      { key: 'networking_theory', icon: MessageSquare },
      { key: 'practice_cases', icon: Lightbulb },
      { key: 'strategic_center', icon: Shield },
      { key: 'analytical_node', icon: Brain },
      { key: 'club_elite', icon: Crown },
      { key: 'authors_column', icon: PenTool },
      { key: 'notifications', icon: Bell },
      { key: 'my_profile', icon: User },
      { key: 'rules', icon: BookOpen },
    ],
    []
  );

  const styles = createWebSplitStyles(theme);

  return (
    <View style={styles.root} testID="webSplitRoot">
      <View style={styles.clubRail} testID="webClubRail">
        <TouchableOpacity
          style={styles.clubRailLogo}
          onPress={isClubOpen ? closeClub : openClub}
          activeOpacity={0.7}
          testID="webClubToggle"
        >
          <Cigarette size={20} color={theme.primary} />
        </TouchableOpacity>
        <View style={styles.clubRailDivider} />
        {clubRailItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.clubRailButton}
            onPress={isClubOpen ? closeClub : openClub}
            activeOpacity={0.7}
            testID={`clubRailBtn_${item.key}`}
          >
            <item.icon size={18} color={theme.primaryDim} />
          </TouchableOpacity>
        ))}
      </View>

      {isClubOpen && (
        <View style={styles.clubOverlayHost} testID="clubOverlayHost">
          <Pressable style={styles.backdrop} onPress={closeClub} testID="clubOverlayBackdrop" />
          <Animated.View
            style={[
              styles.clubOverlay,
              {
                width: clubOverlayWidth,
                transform: [{ translateX: clubTranslateX }],
                opacity: clubOpacity,
              },
            ]}
            testID="clubOverlay"
          >
            <View style={styles.clubOverlayHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Cigarette size={16} color={theme.primary} />
                <Text style={styles.clubOverlayTitle}>{t.tabs.club}</Text>
              </View>
              <TouchableOpacity onPress={closeClub} activeOpacity={0.7} testID="clubOverlayClose">
                <X size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.clubOverlayBody}>
              <ClubScreen />
            </View>
          </Animated.View>
        </View>
      )}

      <View style={styles.leftPane} testID="webSplitLeftPane">
        {paneMode === 'list' || !selectedDossierId ? (
          <DossiersTab
            onOpenDossier={({ id, edit }) => {
              console.log('[WebSplitView] open dossier in-pane', { id, edit });
              setSelectedDossierId(id);
              setSelectedDossierEditing(!!edit);
              setPaneMode('dossier');
            }}
          />
        ) : (
          <DossierPane
            dossierId={selectedDossierId}
            initialEdit={selectedDossierEditing}
            onBack={() => {
              console.log('[WebSplitView] back to dossier list');
              setPaneMode('list');
              setSelectedDossierEditing(false);
            }}
            onOpenNetwork={() => {
              console.log('[WebSplitView] dossier requested open network; map is already visible');
            }}
            onOpenGoal={(goalId) => {
              console.log('[WebSplitView] open goal in strategy pane', { goalId });
              setWebGoalId(goalId);
              setRightPaneTab('strategy');
            }}
          />
        )}
      </View>

      <View style={styles.rightPane} testID="webSplitRightPane">
        <View style={styles.rightPaneContent}>
          <View style={styles.webTabBar}>
            {(['network', 'strategy', 'analysis', 'actions'] as WebRightPaneTab[]).map(tab => {
              const isActive = rightPaneTab === tab;
              const labels: Record<WebRightPaneTab, string> = {
                network: t.tabs.network,
                strategy: t.tabs.strategy,
                analysis: t.tabs.analysis,
                actions: t.tabs.actions,
              };
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.webTabItem, isActive && styles.webTabItemActive]}
                  onPress={() => setRightPaneTab(tab)}
                  activeOpacity={0.7}
                  testID={`webTab_${tab}`}
                >
                  <Text style={[styles.webTabText, isActive && styles.webTabTextActive]}>
                    {labels[tab]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.mapPane} testID="webSplitMapPane">
            {rightPaneTab === 'network' && (
              <NetworkScreen
                onOpenDossier={({ id, edit }) => {
                  console.log('[WebSplitView] open dossier from map', { id, edit });
                  setSelectedDossierId(id);
                  setSelectedDossierEditing(!!edit);
                  setPaneMode('dossier');
                }}
              />
            )}
            {rightPaneTab === 'strategy' && <StrategyScreen initialGoalId={webGoalId ?? undefined} />}
            {rightPaneTab === 'analysis' && <AnalysisScreen />}
            {rightPaneTab === 'actions' && <ActionsScreen />}
          </View>
        </View>

        <View style={styles.rail} testID="webSplitProfileRail">
          <View style={styles.railTop}>
            <NetworkIcon size={18} color={theme.primaryDim} />
          </View>
          <View style={styles.railDivider} />
          {railItems.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.railButton, idx === 0 && styles.railButtonFirst]}
              onPress={openProfile}
              activeOpacity={0.7}
              testID={`profileRailBtn_${item.key}`}
            >
              <item.icon size={20} color={theme.primary} />
            </TouchableOpacity>
          ))}
        </View>

        {isProfileOpen && (
          <View style={styles.overlayHost} testID="profileOverlayHost">
            <Pressable style={styles.backdrop} onPress={closeProfile} testID="profileOverlayBackdrop" />
            <Animated.View
              style={[
                styles.profileOverlay,
                {
                  width: overlayWidth,
                  transform: [{ translateX }],
                  opacity: overlayOpacity,
                },
              ]}
              testID="profileOverlay"
            >
              <View style={styles.profileOverlayHeader}>
                <Text style={styles.profileOverlayTitle}>PROFILE</Text>
                <TouchableOpacity onPress={closeProfile} activeOpacity={0.7} testID="profileOverlayClose">
                  <X size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.profileOverlayBody}>
                <ProfileScreen embedded />
              </View>
            </Animated.View>
          </View>
        )}
      </View>
    </View>
  );
}

export default function DossiersScreen() {
  if (Platform.OS === 'web') {
    return <WebSplitView />;
  }
  return <DossiersTab />;
}

const createStyles = (theme: any) => StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: theme.background,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  dossierCard: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 16,
    marginBottom: 12,
  },
  dossierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dossierIcon: {
    marginRight: 12,
  },
  dossierInfo: {
    flex: 1,
  },
  dossierName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  dossierMeta: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  powerGroupingName: {
    fontSize: 12,
    color: '#8B0000',
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  importanceBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: '700' as const,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  badgesColumn: {
    alignItems: 'flex-end' as const,
    gap: 4,
  },
  noConnectionBadge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: theme.danger ?? theme.primary,
    borderRadius: 4,
    alignSelf: 'flex-end' as const,
  },
  noConnectionText: {
    fontSize: 10,
    color: theme.danger ?? theme.primary,
    fontFamily: 'monospace' as const,
    fontWeight: '600' as const,
  },
  maintenanceListBadge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 4,
  },
  maintenanceListBadgeText: {
    fontSize: 9,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  dossierFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  dossierTag: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  dossierGoal: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
    marginTop: 24,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 32,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.background,
    borderWidth: 2,
    borderColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 20,
  },
  emptyActions: {
    gap: 16,
    marginTop: 32,
    width: '100%',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  contactsList: {
    padding: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 16,
    marginBottom: 12,
  },
  contactIcon: {
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
});

const createWebSplitStyles = (theme: any) => {
  const railWidth = 54;
  return StyleSheet.create({
    root: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.background,
    },
    leftPane: {
      flex: 1,
      minWidth: 380,
      borderRightWidth: 2,
      borderRightColor: theme.border,
      backgroundColor: theme.background,
    },
    rightPane: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.background,
    },
    rightPaneContent: {
      flex: 1,
      flexDirection: 'column',
    },
    webTabBar: {
      flexDirection: 'row',
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
      backgroundColor: theme.overlay,
    },
    webTabItem: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    webTabItemActive: {
      borderBottomColor: theme.primary,
      backgroundColor: theme.background,
    },
    webTabText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    webTabTextActive: {
      color: theme.primary,
    },
    mapPane: {
      flex: 1,
      borderRightWidth: 2,
      borderRightColor: theme.border,
      backgroundColor: theme.background,
    },
    rail: {
      width: railWidth,
      backgroundColor: theme.background,
      borderLeftWidth: 2,
      borderLeftColor: theme.border,
      alignItems: 'center',
      paddingTop: 10,
    },
    railTop: {
      width: railWidth - 16,
      height: 32,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    railDivider: {
      width: railWidth - 18,
      height: 2,
      backgroundColor: theme.border,
      marginVertical: 10,
    },
    railButton: {
      width: railWidth - 16,
      height: 42,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    railButtonFirst: {
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 2,
    },
    overlayHost: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    profileOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.background,
      borderLeftWidth: 2,
      borderLeftColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: -8, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
      elevation: 8,
    },
    profileOverlayHeader: {
      height: 56,
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      backgroundColor: theme.overlay,
    },
    profileOverlayTitle: {
      fontSize: 12,
      fontWeight: '800' as const,
      letterSpacing: 3,
      color: theme.primary,
      fontFamily: 'monospace' as const,
    },
    profileOverlayBody: {
      flex: 1,
    },
    clubRail: {
      width: railWidth,
      backgroundColor: theme.background,
      borderRightWidth: 2,
      borderRightColor: theme.border,
      alignItems: 'center',
      paddingTop: 10,
    },
    clubRailLogo: {
      width: railWidth - 16,
      height: 38,
      borderWidth: 2,
      borderColor: theme.primary,
      backgroundColor: theme.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 2,
    },
    clubRailDivider: {
      width: railWidth - 18,
      height: 2,
      backgroundColor: theme.border,
      marginVertical: 10,
    },
    clubRailButton: {
      width: railWidth - 16,
      height: 38,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    clubOverlayHost: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 20,
    },
    clubOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: theme.background,
      borderRightWidth: 2,
      borderRightColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 8, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
      elevation: 8,
    },
    clubOverlayHeader: {
      height: 56,
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      backgroundColor: theme.overlay,
    },
    clubOverlayTitle: {
      fontSize: 12,
      fontWeight: '800' as const,
      letterSpacing: 3,
      color: theme.primary,
      fontFamily: 'monospace' as const,
    },
    clubOverlayBody: {
      flex: 1,
    },
  });
};
