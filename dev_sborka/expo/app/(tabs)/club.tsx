import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  StatusBar,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Cigarette,
  MessageSquare,
  ChevronRight,
  ArrowLeft,
  Plus,
  Send,
  Bell,
  BellOff,
  Settings,
  Pin,
  Lock,
  Trash2,
  Shield,
  X,
  MessageCircle,
  Check,
  BookOpen,
  Reply,
  CornerDownRight,
  User,
  FileText,
  FilePlus,
  Edit3,
  Camera,
  UserCircle2,
  ThumbsUp,
  ThumbsDown,
  Search,
  Eye,
  Pencil,
  Users,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/contexts/AppContext';
import * as ForumService from '@/services/forum';
import type {
  ForumCategory,
  ForumTopic,
  ForumMessage,
  ForumNotification,
  ForumNotificationSettings,
  ForumProfile,
  AccessLevel,
  BanType,
} from '@/types';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type ClubView = 'categories' | 'topics' | 'messages' | 'notifications' | 'notifSettings' | 'modPanel' | 'search';
type OnboardingStep = 'none' | 'welcome' | 'rules' | 'profile';

export default function ClubScreen() {
  const { theme, t, phoneNumber, userUid, subscriptionLevel, dossiers, addDossier } = useApp();
  const router = useRouter();
  const queryClient = useQueryClient();

  const baseLevel = ForumService.getUserAccessLevel(subscriptionLevel);

  const moderatorQuery = useQuery({
    queryKey: ['forum_is_moderator', userUid],
    queryFn: () => ForumService.isModerator(userUid ?? ''),
    enabled: !!userUid,
  });

  const effectiveLevelQuery = useQuery({
    queryKey: ['forum_effective_level', userUid, subscriptionLevel],
    queryFn: () => ForumService.getEffectiveAccessLevel(userUid ?? '', subscriptionLevel),
    enabled: !!userUid,
  });

  const bansQuery = useQuery({
    queryKey: ['forum_bans'],
    queryFn: ForumService.getBans,
  });

  const allProfilesQuery = useQuery({
    queryKey: ['forum_all_profiles'],
    queryFn: ForumService.getAllProfiles,
  });

  const isModeratorUser = moderatorQuery.data === true;
  const userLevel = effectiveLevelQuery.data ?? baseLevel;

  const [view, setView] = useState<ClubView>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ForumCategory | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);

  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('none');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [viewingProfilePhone, setViewingProfilePhone] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    networkingGoals: '',
    competencies: '',
    canBeUseful: '',
    lookingFor: '',
    photoBase64: '' as string | undefined,
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicFirstMessage, setNewTopicFirstMessage] = useState('');
  const [messageText, setMessageText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<ForumMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ForumMessage | null>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchText, setSearchText] = useState('');

  const [showModSectionModal, setShowModSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<ForumCategory | null>(null);
  const [sectionForm, setSectionForm] = useState({
    name: '',
    description: '',
    readLevel: 1 as AccessLevel,
    writeLevel: 1 as AccessLevel,
    createTopicLevel: 1 as AccessLevel,
    order: 0,
  });
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTargetPhone, setBanTargetPhone] = useState('');
  const [banType, setBanType] = useState<BanType>('write');
  const [banPermanent, setBanPermanent] = useState(true);
  const [banDays, setBanDays] = useState('7');
  const [banReason, setBanReason] = useState('');
  const [showAssignLevelModal, setShowAssignLevelModal] = useState(false);
  const [assignTargetPhone, setAssignTargetPhone] = useState('');
  const [assignLevel, setAssignLevel] = useState<AccessLevel>(3);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const club = t.club;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const welcomeSeenQuery = useQuery({
    queryKey: ['forum_welcome_seen'],
    queryFn: ForumService.hasSeenWelcome,
  });

  const rulesAcceptedQuery = useQuery({
    queryKey: ['forum_rules_accepted'],
    queryFn: ForumService.hasAcceptedRules,
  });

  const forumProfileQuery = useQuery({
    queryKey: ['forum_profile', userUid],
    queryFn: () => ForumService.getForumProfile(userUid ?? ''),
    enabled: !!userUid,
  });

  const myProfile = forumProfileQuery.data ?? null;
  const userName = useMemo(() => {
    if (myProfile && userUid) {
      return ForumService.getForumNickname(myProfile, userUid);
    }
    return phoneNumber ? phoneNumber.slice(-4) : 'Anon';
  }, [myProfile, userUid, phoneNumber]);

  useEffect(() => {
    if (welcomeSeenQuery.data === undefined || rulesAcceptedQuery.data === undefined) return;
    if (forumProfileQuery.isLoading) return;
    if (onboardingChecked) return;
    setOnboardingChecked(true);
    if (!welcomeSeenQuery.data) {
      setOnboardingStep('welcome');
    } else if (!rulesAcceptedQuery.data) {
      setOnboardingStep('rules');
    } else if (!forumProfileQuery.data && phoneNumber) {
      setOnboardingStep('profile');
    }
  }, [welcomeSeenQuery.data, rulesAcceptedQuery.data, forumProfileQuery.data, forumProfileQuery.isLoading, onboardingChecked, phoneNumber]);

  const markWelcomeSeenMutation = useMutation({
    mutationFn: ForumService.markWelcomeSeen,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_welcome_seen'] });
    },
  });

  const markRulesAcceptedMutation = useMutation({
    mutationFn: ForumService.markRulesAccepted,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_rules_accepted'] });
    },
  });

  const handleWelcomeContinue = useCallback(() => {
    markWelcomeSeenMutation.mutate();
    setOnboardingStep('rules');
  }, [markWelcomeSeenMutation]);

  const handleRulesAcknowledge = useCallback(() => {
    markRulesAcceptedMutation.mutate();
    if (onboardingStep === 'rules' && !forumProfileQuery.data && userUid) {
      setOnboardingStep('profile');
    } else {
      setOnboardingStep('none');
    }
    setShowRulesModal(false);
  }, [markRulesAcceptedMutation, onboardingStep, forumProfileQuery.data, userUid]);

  const saveProfileMutation = useMutation({
    mutationFn: async (profile: ForumProfile) => {
      await ForumService.saveForumProfile(userUid ?? '', profile);
      return profile;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_profile', userUid] });
      setOnboardingStep('none');
      setShowProfileModal(false);
      setIsEditingProfile(false);
    },
  });

  const handleSaveProfile = useCallback(() => {
    if (!profileForm.fullName.trim() || !profileForm.networkingGoals.trim() || !profileForm.competencies.trim()) {
      Alert.alert(club.profileRequired);
      return;
    }
    const profile: ForumProfile = {
      uid: userUid ?? '',
      fullName: profileForm.fullName.trim(),
      networkingGoals: profileForm.networkingGoals.trim(),
      competencies: profileForm.competencies.trim(),
      canBeUseful: profileForm.canBeUseful.trim(),
      lookingFor: profileForm.lookingFor.trim(),
      phone: phoneNumber ?? '',
      createdAt: myProfile?.createdAt ?? new Date().toISOString(),
      photoBase64: profileForm.photoBase64 || undefined,
      accessLevel: userLevel,
    };
    saveProfileMutation.mutate(profile);
  }, [profileForm, phoneNumber, userUid, saveProfileMutation, club.profileRequired, myProfile, userLevel]);

  const pickProfilePhoto = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert(club.accessDenied, 'Permission required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfileForm(prev => ({ ...prev, photoBase64: base64Uri }));
        console.log('[Club] Profile photo picked, base64 length:', result.assets[0].base64.length);
      }
    } catch (e) {
      console.log('[Club] pickProfilePhoto error', e);
    }
  }, [club.accessDenied]);

  const removeProfilePhoto = useCallback(() => {
    Alert.alert(club.removeProfilePhoto, club.removeProfilePhotoConfirm, [
      { text: club.cancel, style: 'cancel' },
      { text: club.delete, style: 'destructive', onPress: () => setProfileForm(prev => ({ ...prev, photoBase64: undefined })) },
    ]);
  }, [club]);

  const viewingProfileQuery = useQuery({
    queryKey: ['forum_profile_view', viewingProfilePhone],
    queryFn: () => ForumService.getForumProfileByAuthorPhone(viewingProfilePhone!),
    enabled: !!viewingProfilePhone,
  });

  const handleOpenAuthorProfile = useCallback((authorPhone: string) => {
    if (!authorPhone || authorPhone === 'system') return;
    setViewingProfilePhone(authorPhone);
    setShowProfileModal(true);
  }, []);

  const handleOpenMyProfile = useCallback(() => {
    if (!phoneNumber) return;
    if (myProfile) {
      setProfileForm({
        fullName: myProfile.fullName,
        networkingGoals: myProfile.networkingGoals,
        competencies: myProfile.competencies,
        canBeUseful: myProfile.canBeUseful,
        lookingFor: myProfile.lookingFor,
        photoBase64: myProfile.photoBase64,
      });
    }
    setViewingProfilePhone(phoneNumber);
    setShowProfileModal(true);
  }, [phoneNumber, myProfile]);

  const findDossierByPhone = useCallback((phone: string) => {
    const normalizePhone = (p: string) => p.replace(/\D/g, '');
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return dossiers.find(d => {
      const phones = (d.contact.phoneNumbers || []).map(normalizePhone);
      return phones.some(p => p === normalized || p.endsWith(normalized) || normalized.endsWith(p));
    }) ?? null;
  }, [dossiers]);

  const handleDossierAction = useCallback((phone: string, profileName: string) => {
    const existing = findDossierByPhone(phone);
    if (existing) {
      router.push(`/dossier/${existing.contact.id}`);
    } else {
      const result = addDossier({
        contact: {
          id: `contact_${Date.now()}`,
          name: profileName,
          phoneNumbers: [phone],
          emails: [],
        },
        sectors: [],
        functionalCircle: 'support',
        importance: 'medium',
        relations: [],
        diary: [],
        addedDate: new Date(),
      });
      if (result.ok) {
        router.push(`/dossier/contact_${Date.now() - 1}`);
      }
    }
    setShowProfileModal(false);
  }, [findDossierByPhone, addDossier, router]);

  const categoriesQuery = useQuery({
    queryKey: ['forum_categories'],
    queryFn: ForumService.getCategories,
  });

  const categoryStatsQuery = useQuery({
    queryKey: ['forum_category_stats'],
    queryFn: ForumService.getCategoryStats,
  });

  const onlineCountQuery = useQuery({
    queryKey: ['forum_online_count'],
    queryFn: ForumService.getOnlineCount,
    refetchInterval: 60000,
  });

  const searchResultsQuery = useQuery({
    queryKey: ['forum_search', searchQuery],
    queryFn: () => ForumService.searchTopics(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const heartbeatMutation = useMutation({
    mutationFn: () => ForumService.heartbeat(userUid ?? ''),
  });

  useEffect(() => {
    if (!userUid) return;
    heartbeatMutation.mutate();
    const interval = setInterval(() => {
      heartbeatMutation.mutate();
    }, 120000);
    return () => clearInterval(interval);
  }, [userUid]);

  const topicsQuery = useQuery({
    queryKey: ['forum_topics', selectedCategoryId],
    queryFn: () => ForumService.getTopicsByCategory(selectedCategoryId!),
    enabled: !!selectedCategoryId,
  });

  const messagesQuery = useQuery({
    queryKey: ['forum_messages', selectedTopicId],
    queryFn: () => ForumService.getMessagesByTopic(selectedTopicId!),
    enabled: !!selectedTopicId,
  });

  const notificationsQuery = useQuery({
    queryKey: ['forum_notifications'],
    queryFn: () => ForumService.getNotifications(userUid ?? ''),
  });

  const unreadCountQuery = useQuery({
    queryKey: ['forum_unread_count'],
    queryFn: ForumService.getUnreadCount,
  });

  const notifSettingsQuery = useQuery({
    queryKey: ['forum_notif_settings'],
    queryFn: () => ForumService.getNotificationSettings(userUid ?? ''),
  });

  const trackViewMutation = useMutation({
    mutationFn: (topicId: string) => ForumService.trackTopicView(topicId, userUid ?? ''),
  });

  const editMessageMutation = useMutation({
    mutationFn: async ({ msgId, content }: { msgId: string; content: string }) => {
      return ForumService.editMessage(msgId, content, phoneNumber ?? '');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_messages', selectedTopicId] });
      setEditingMessage(null);
      setEditMessageText('');
    },
  });

  const addTopicMutation = useMutation({
    mutationFn: async ({ title, firstMsg }: { title: string; firstMsg: string }) => {
      const now = new Date().toISOString();
      const topicId = `topic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const topic: ForumTopic = {
        id: topicId,
        categoryId: selectedCategoryId!,
        title,
        authorPhone: phoneNumber ?? '',
        authorName: userName,
        isPinned: false,
        isLocked: false,
        messageCount: 1,
        lastMessageAt: now,
        createdAt: now,
      };
      await ForumService.addTopic(topic, firstMsg);
      return topic;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_topics', selectedCategoryId] });
      void queryClient.invalidateQueries({ queryKey: ['forum_category_stats'] });
      setShowNewTopicModal(false);
      setNewTopicTitle('');
      setNewTopicFirstMessage('');
    },
  });

  const addMessageMutation = useMutation({
    mutationFn: async ({ content, replyTo }: { content: string; replyTo: ForumMessage | null }) => {
      const now = new Date().toISOString();
      const msg: ForumMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        topicId: selectedTopicId!,
        authorPhone: phoneNumber ?? '',
        authorName: userName,
        content,
        createdAt: now,
        ...(replyTo ? {
          replyToId: replyTo.id,
          replyToAuthor: replyTo.authorName,
          replyToContent: replyTo.content.slice(0, 120),
        } : {}),
      };
      await ForumService.addMessage(
        msg,
        selectedCategory?.id,
        selectedTopic?.title,
      );
      return msg;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_messages', selectedTopicId] });
      void queryClient.invalidateQueries({ queryKey: ['forum_topics', selectedCategoryId] });
      void queryClient.invalidateQueries({ queryKey: ['forum_unread_count'] });
      void queryClient.invalidateQueries({ queryKey: ['forum_category_stats'] });
      setMessageText('');
      setReplyToMessage(null);
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: (topicId: string) => ForumService.deleteTopicAndMessages(topicId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_topics', selectedCategoryId] });
      void queryClient.invalidateQueries({ queryKey: ['forum_category_stats'] });
      setView('topics');
      setSelectedTopicId(null);
      setSelectedTopic(null);
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (msgId: string) => ForumService.deleteMessage(msgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_messages', selectedTopicId] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: (msgId: string) => ForumService.toggleMessageLike(msgId, userUid ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_messages', selectedTopicId] });
    },
  });

  const dislikeMutation = useMutation({
    mutationFn: (msgId: string) => ForumService.toggleMessageDislike(msgId, userUid ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_messages', selectedTopicId] });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await ForumService.updateTopic(id, { isPinned: pinned });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_topics', selectedCategoryId] });
    },
  });

  const toggleLockMutation = useMutation({
    mutationFn: async ({ id, locked }: { id: string; locked: boolean }) => {
      await ForumService.updateTopic(id, { isLocked: locked });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_topics', selectedCategoryId] });
      if (selectedTopic) {
        setSelectedTopic({ ...selectedTopic, isLocked: !selectedTopic.isLocked });
      }
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: ForumService.markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['forum_unread_count'] });
    },
  });

  const saveNotifSettingsMutation = useMutation({
    mutationFn: (settings: ForumNotificationSettings) =>
      ForumService.saveNotificationSettings(userUid ?? '', settings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_notif_settings'] });
    },
  });

  const saveSectionMutation = useMutation({
    mutationFn: async (data: { isNew: boolean; id?: string }) => {
      if (data.isNew) {
        const cat: ForumCategory = {
          id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: sectionForm.name.trim(),
          description: sectionForm.description.trim(),
          readLevel: sectionForm.readLevel,
          createTopicLevel: sectionForm.createTopicLevel,
          writeLevel: sectionForm.writeLevel,
          order: sectionForm.order,
          createdAt: new Date().toISOString(),
        };
        await ForumService.addCategory(cat);
      } else if (data.id) {
        await ForumService.updateCategory(data.id, {
          name: sectionForm.name.trim(),
          description: sectionForm.description.trim(),
          readLevel: sectionForm.readLevel,
          createTopicLevel: sectionForm.createTopicLevel,
          writeLevel: sectionForm.writeLevel,
          order: sectionForm.order,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_categories'] });
      setShowModSectionModal(false);
      setEditingSection(null);
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => ForumService.deleteCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_categories'] });
    },
  });

  const banMutation = useMutation({
    mutationFn: async () => {
      const days = banPermanent ? null : parseInt(banDays, 10) || 7;
      await ForumService.banUser(banTargetPhone.trim(), banType, banReason.trim() || '-', userUid ?? '', days);
      if (banType === 'app') {
        console.log('[Club] App ban applied, subscription should be cancelled for:', banTargetPhone);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_bans'] });
      setShowBanModal(false);
      setBanTargetPhone('');
      setBanReason('');
      Alert.alert(club.banned);
    },
  });

  const unbanMutation = useMutation({
    mutationFn: ({ phone, type }: { phone: string; type: BanType }) =>
      ForumService.unbanUser(phone, type),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_bans'] });
    },
  });

  const assignLevelMutation = useMutation({
    mutationFn: async () => {
      await ForumService.setAssignedAccessLevel(assignTargetPhone.trim(), assignLevel);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_effective_level'] });
      void queryClient.invalidateQueries({ queryKey: ['forum_all_profiles'] });
      setShowAssignLevelModal(false);
      setAssignTargetPhone('');
      Alert.alert(club.levelAssigned);
    },
  });

  const assignModeratorMutation = useMutation({
    mutationFn: (phone: string) => ForumService.addModerator(phone, userUid ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_is_moderator'] });
      Alert.alert(club.moderatorAssigned);
    },
  });

  const removeModeratorMutation = useMutation({
    mutationFn: (phone: string) => ForumService.removeModerator(phone),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum_is_moderator'] });
      Alert.alert(club.moderatorRemoved);
    },
  });

  const animateTransition = useCallback(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const openCategory = useCallback((cat: ForumCategory) => {
    if (!isModeratorUser && userLevel < cat.readLevel) {
      Alert.alert(club.accessDenied, club.accessDeniedRead.replace('%d', String(cat.readLevel)));
      return;
    }
    setSelectedCategoryId(cat.id);
    setSelectedCategory(cat);
    setView('topics');
    animateTransition();
  }, [userLevel, isModeratorUser, club, animateTransition]);

  const openTopic = useCallback((topic: ForumTopic) => {
    setSelectedTopicId(topic.id);
    setSelectedTopic(topic);
    setView('messages');
    animateTransition();
    if (userUid) {
      trackViewMutation.mutate(topic.id);
    }
  }, [animateTransition, userUid]);

  const goBack = useCallback(() => {
    if (view === 'messages') {
      setView('topics');
      setSelectedTopicId(null);
      setSelectedTopic(null);
      setEditingMessage(null);
      setEditMessageText('');
    } else if (view === 'topics') {
      setView('categories');
      setSelectedCategoryId(null);
      setSelectedCategory(null);
    } else if (view === 'notifications' || view === 'notifSettings' || view === 'modPanel' || view === 'search') {
      setView('categories');
      setSearchQuery('');
      setSearchText('');
    }
    animateTransition();
  }, [view, animateTransition]);

  const handleSearch = useCallback(() => {
    if (searchText.trim().length >= 2) {
      setSearchQuery(searchText.trim());
    }
  }, [searchText]);

  const getCategoryDisplayName = useCallback((name: string) => {
    const key = name as keyof typeof club;
    if (club[key]) return club[key] as string;
    return name;
  }, [club]);

  const formatDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString();
  }, []);

  const unreadCount = unreadCountQuery.data ?? 0;

  const renderHeader = () => (
    <View style={styles.header}>
      {view !== 'categories' ? (
        <TouchableOpacity onPress={goBack} style={styles.headerBackBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.primary} />
        </TouchableOpacity>
      ) : (
        <Cigarette size={26} color={theme.primary} strokeWidth={1.5} />
      )}
      <Text style={styles.headerTitle} numberOfLines={1}>
        {view === 'categories' && club.title}
        {view === 'topics' && (selectedCategory ? getCategoryDisplayName(selectedCategory.name) : club.topics)}
        {view === 'messages' && (selectedTopic?.title ?? club.messages)}
        {view === 'notifications' && club.notifications}
        {view === 'notifSettings' && club.notificationSettings}
        {view === 'modPanel' && club.modPanel}
        {view === 'search' && club.searchResults}
      </Text>
      <View style={styles.headerRight}>
        {view === 'categories' && (
          <>
            <TouchableOpacity
              onPress={() => { setView('search'); animateTransition(); }}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
              testID="clubSearchBtn"
            >
              <Search size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenMyProfile}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
              testID="clubProfileBtn"
            >
              <User size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowRulesModal(true)}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
              testID="clubRulesBtn"
            >
              <BookOpen size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setView('notifications'); animateTransition(); }}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <Bell size={20} color={theme.primary} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            {isModeratorUser && (
              <TouchableOpacity
                onPress={() => { setView('modPanel'); animateTransition(); }}
                style={styles.headerIconBtn}
                activeOpacity={0.7}
                testID="modPanelBtn"
              >
                <Shield size={20} color={theme.warning ?? '#F5A623'} />
              </TouchableOpacity>
            )}
          </>
        )}
        {view === 'notifications' && (
          <TouchableOpacity
            onPress={() => { setView('notifSettings'); animateTransition(); }}
            style={styles.headerIconBtn}
            activeOpacity={0.7}
          >
            <Settings size={20} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );



  const categoryStats = categoryStatsQuery.data ?? {};
  const onlineCount = onlineCountQuery.data ?? 0;

  const renderCategoryItem = ({ item }: { item: ForumCategory }) => {
    const isLocked = !isModeratorUser && userLevel < item.readLevel;
    const stats = categoryStats[item.id];
    return (
      <TouchableOpacity
        style={[styles.categoryCard, isLocked && styles.categoryCardLocked]}
        onPress={() => openCategory(item)}
        activeOpacity={0.7}
        testID={`forumCategory_${item.id}`}
      >
        <View style={styles.categoryLeft}>
          <View style={styles.categoryIconWrap}>
            {isLocked ? (
              <Lock size={22} color={theme.danger} />
            ) : (
              <MessageSquare size={22} color={theme.primary} />
            )}
          </View>
          <View style={styles.categoryInfo}>
            <Text style={[styles.categoryName, isLocked && { color: theme.textSecondary }]}>
              {getCategoryDisplayName(item.name)}
            </Text>
            <Text style={styles.categoryDesc} numberOfLines={1}>
              {getCategoryDisplayName(item.description)}
            </Text>
            <View style={styles.categoryStatsRow}>
              {stats ? (
                <>
                  <Text style={styles.categoryStatText}>{stats.topicCount} {club.topicsCount}</Text>
                  <Text style={styles.categoryStatDot}>{' \u2022 '}</Text>
                  <Text style={styles.categoryStatText}>{stats.messageCount} {club.messagesCount}</Text>
                  <Text style={styles.categoryStatDot}>{' \u2022 '}</Text>
                  <Text style={styles.categoryStatText}>{formatDate(stats.lastActivity)}</Text>
                </>
              ) : (
                <Text style={styles.categoryStatText}>0 {club.topicsCount}</Text>
              )}
            </View>
          </View>
        </View>
        <ChevronRight size={18} color={isLocked ? theme.textSecondary : theme.primaryDim} />
      </TouchableOpacity>
    );
  };

  const renderTopicItem = ({ item }: { item: ForumTopic }) => (
    <TouchableOpacity
      style={styles.topicCard}
      onPress={() => openTopic(item)}
      activeOpacity={0.7}
      onLongPress={() => {
        const actions: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }[] = [];
        actions.push({
          text: item.isPinned ? club.unpin : club.pin,
          onPress: () => togglePinMutation.mutate({ id: item.id, pinned: !item.isPinned }),
        });
        actions.push({
          text: item.isLocked ? club.unlock : club.lock,
          onPress: () => toggleLockMutation.mutate({ id: item.id, locked: !item.isLocked }),
        });
        actions.push({
          text: club.delete,
          style: 'destructive',
          onPress: () => {
            Alert.alert(club.deleteTopic, club.deleteTopicConfirm, [
              { text: club.cancel, style: 'cancel' },
              { text: club.delete, style: 'destructive', onPress: () => deleteTopicMutation.mutate(item.id) },
            ]);
          },
        });
        actions.push({ text: club.cancel, style: 'cancel' });
        Alert.alert(item.title, undefined, actions);
      }}
      testID={`forumTopic_${item.id}`}
    >
      <View style={styles.topicHeader}>
        {item.isPinned && (
          <View style={styles.topicBadge}>
            <Pin size={10} color={theme.warning} />
            <Text style={[styles.topicBadgeText, { color: theme.warning }]}>{club.pinned}</Text>
          </View>
        )}
        {item.isLocked && (
          <View style={styles.topicBadge}>
            <Lock size={10} color={theme.danger} />
            <Text style={[styles.topicBadgeText, { color: theme.danger }]}>{club.locked}</Text>
          </View>
        )}
      </View>
      <Text style={styles.topicTitle} numberOfLines={2}>{item.title}</Text>
      <View style={styles.topicFooter}>
        <Text style={styles.topicMeta}>{item.authorName}</Text>
        <Text style={styles.topicMeta}>{item.messageCount} {club.replies}</Text>
        <Text style={styles.topicMeta}>{formatDate(item.lastMessageAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  const allProfiles = allProfilesQuery.data ?? {};

  const getAuthorAccessLevel = useCallback((authorPhone: string, isOwn: boolean): AccessLevel => {
    if (isOwn) return userLevel;
    for (const profile of Object.values(allProfiles)) {
      if (profile.phone === authorPhone || profile.uid === authorPhone) {
        return profile.accessLevel ?? 1;
      }
    }
    return 1;
  }, [allProfiles, userLevel]);

  const renderMessageItem = ({ item }: { item: ForumMessage }) => {
    const isOwn = item.authorPhone === phoneNumber;
    const authorAccessLevel = getAuthorAccessLevel(item.authorPhone, isOwn);
    const isEditing = editingMessage?.id === item.id;
    return (
      <View style={[styles.messageCard, isOwn && styles.messageCardOwn]} testID={`forumMsg_${item.id}`}>
        {item.replyToId && item.replyToAuthor ? (
          <View style={styles.replyQuote}>
            <CornerDownRight size={12} color={theme.primary} style={{ marginRight: 4 }} />
            <View style={styles.replyQuoteContent}>
              <Text style={styles.replyQuoteAuthor} numberOfLines={1}>{item.replyToAuthor}</Text>
              <Text style={styles.replyQuoteText} numberOfLines={2}>{item.replyToContent}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.messageMeta}>
          <View style={styles.messageAuthorRow}>
            <TouchableOpacity
              onPress={() => handleOpenAuthorProfile(item.authorPhone)}
              activeOpacity={0.7}
            >
              <Text style={[styles.messageAuthor, isOwn && styles.messageAuthorOwn]}>
                {item.authorName}
              </Text>
            </TouchableOpacity>
            <View style={styles.accessLevelBadge}>
              <Shield size={9} color={theme.primary} />
              <Text style={styles.accessLevelBadgeText}>{club.accessLevelShort}{authorAccessLevel}</Text>
            </View>
            {item.editedAt && (
              <Text style={styles.editedLabel}>{club.edited}</Text>
            )}
          </View>
          <Text style={styles.messageTime}>{formatDate(item.createdAt)}</Text>
        </View>
        {isEditing ? (
          <View style={styles.editMessageContainer}>
            <TextInput
              style={styles.editMessageInput}
              value={editMessageText}
              onChangeText={setEditMessageText}
              multiline
              maxLength={2000}
              autoFocus
            />
            <View style={styles.editMessageActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => { setEditingMessage(null); setEditMessageText(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.editCancelBtnText}>{club.cancelEdit}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, !editMessageText.trim() && styles.createBtnDisabled]}
                onPress={() => {
                  if (editMessageText.trim()) {
                    editMessageMutation.mutate({ msgId: item.id, content: editMessageText.trim() });
                  }
                }}
                disabled={!editMessageText.trim() || editMessageMutation.isPending}
                activeOpacity={0.7}
              >
                <Text style={styles.editSaveBtnText}>{club.saveEdit}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.messageContent}>{item.content}</Text>
        )}
        <View style={styles.messageActions}>
          <View style={styles.messageReactionsRow}>
            <TouchableOpacity
              style={[
                styles.reactionBtn,
                (item.likes ?? []).includes(phoneNumber ?? '') && styles.reactionBtnActive,
              ]}
              onPress={() => likeMutation.mutate(item.id)}
              activeOpacity={0.7}
              testID={`likeBtn_${item.id}`}
            >
              <ThumbsUp
                size={13}
                color={(item.likes ?? []).includes(phoneNumber ?? '') ? theme.primary : theme.primaryDim}
              />
              {(item.likes ?? []).length > 0 && (
                <Text
                  style={[
                    styles.reactionCount,
                    (item.likes ?? []).includes(phoneNumber ?? '') && styles.reactionCountActive,
                  ]}
                >
                  {(item.likes ?? []).length}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.reactionBtn,
                (item.dislikes ?? []).includes(phoneNumber ?? '') && styles.reactionBtnDislikeActive,
              ]}
              onPress={() => dislikeMutation.mutate(item.id)}
              activeOpacity={0.7}
              testID={`dislikeBtn_${item.id}`}
            >
              <ThumbsDown
                size={13}
                color={(item.dislikes ?? []).includes(phoneNumber ?? '') ? theme.danger : theme.primaryDim}
              />
              {(item.dislikes ?? []).length > 0 && (
                <Text
                  style={[
                    styles.reactionCount,
                    (item.dislikes ?? []).includes(phoneNumber ?? '') && styles.reactionCountDislikeActive,
                  ]}
                >
                  {(item.dislikes ?? []).length}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.messageActionButtons}>
            {canWrite && !selectedTopic?.isLocked && (
              <TouchableOpacity
                style={styles.messageReplyBtn}
                onPress={() => setReplyToMessage(item)}
                activeOpacity={0.7}
                testID={`replyBtn_${item.id}`}
              >
                <Reply size={13} color={theme.primaryDim} />
                <Text style={styles.messageReplyText}>{club.reply}</Text>
              </TouchableOpacity>
            )}
            {isOwn && !isEditing && !selectedTopic?.isLocked && (
              <TouchableOpacity
                style={styles.messageReplyBtn}
                onPress={() => {
                  setEditingMessage(item);
                  setEditMessageText(item.content);
                }}
                activeOpacity={0.7}
                testID={`editBtn_${item.id}`}
              >
                <Pencil size={13} color={theme.primaryDim} />
              </TouchableOpacity>
            )}
            {(isOwn || isModeratorUser) && (
              <TouchableOpacity
                style={styles.messageDeleteBtn}
                onPress={() => {
                  Alert.alert(club.deleteMessage, club.deleteMessageConfirm, [
                    { text: club.cancel, style: 'cancel' },
                    { text: club.delete, style: 'destructive', onPress: () => deleteMessageMutation.mutate(item.id) },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Trash2 size={13} color={theme.danger} />
              </TouchableOpacity>
            )}
            {isModeratorUser && !isOwn && item.authorPhone !== 'system' && (
              <TouchableOpacity
                style={styles.messageDeleteBtn}
                onPress={() => {
                  setBanTargetPhone(item.authorPhone);
                  setShowBanModal(true);
                }}
                activeOpacity={0.7}
              >
                <Shield size={13} color={theme.warning ?? '#F5A623'} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderNotificationItem = ({ item }: { item: ForumNotification }) => (
    <TouchableOpacity
      style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
      onPress={async () => {
        await ForumService.markNotificationRead(item.id);
        void queryClient.invalidateQueries({ queryKey: ['forum_notifications'] });
        void queryClient.invalidateQueries({ queryKey: ['forum_unread_count'] });
        const cat = categoriesQuery.data?.find(c => c.id === item.categoryId);
        if (cat) {
          setSelectedCategoryId(cat.id);
          setSelectedCategory(cat);
        }
        const topic = await ForumService.getTopic(item.topicId);
        if (topic) {
          setSelectedTopicId(topic.id);
          setSelectedTopic(topic);
          setView('messages');
          animateTransition();
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.notifDot}>
        {!item.isRead && <View style={styles.notifDotActive} />}
      </View>
      <View style={styles.notifContent}>
        <Text style={styles.notifAuthor}>{item.authorName}</Text>
        <Text style={styles.notifTopic} numberOfLines={1}>{item.topicTitle}</Text>
        <Text style={styles.notifPreview} numberOfLines={2}>{item.preview}</Text>
        <Text style={styles.notifTime}>{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  const canCreateTopic = selectedCategory ? (isModeratorUser || userLevel >= selectedCategory.createTopicLevel) : false;
  const canWrite = selectedCategory ? (isModeratorUser || userLevel >= selectedCategory.writeLevel) : false;

  const renderCategories = () => (
    <View style={styles.content}>
      <View style={styles.levelIndicatorRow}>
        <View style={styles.levelIndicator}>
          <Shield size={14} color={theme.primary} />
          <Text style={styles.levelIndicatorText}>
            {club.yourLevel}: {userLevel}{isModeratorUser ? ` | ${club.moderator}` : ''}
          </Text>
        </View>
        {onlineCount > 0 && (
          <View style={styles.onlineIndicator}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{onlineCount} {club.online}</Text>
          </View>
        )}
      </View>
      <FlatList
        data={categoriesQuery.data ?? []}
        renderItem={renderCategoryItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const renderSearch = () => (
    <View style={styles.content}>
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputRow}>
          <Search size={16} color={theme.primaryDim} />
          <TextInput
            style={styles.searchInput}
            placeholder={club.searchPlaceholder}
            placeholderTextColor={theme.primaryDim}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            maxLength={100}
            autoFocus
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); setSearchQuery(''); }} activeOpacity={0.7}>
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, searchText.trim().length < 2 && styles.createBtnDisabled]}
          onPress={handleSearch}
          disabled={searchText.trim().length < 2}
          activeOpacity={0.7}
        >
          <Text style={styles.searchBtnText}>{club.search}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={searchResultsQuery.data ?? []}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.topicCard}
            onPress={() => {
              const cat = categoriesQuery.data?.find(c => c.id === item.categoryId);
              if (cat) {
                setSelectedCategoryId(cat.id);
                setSelectedCategory(cat);
              }
              openTopic(item);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.topicTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.topicFooter}>
              <Text style={styles.topicMeta}>{item.authorName}</Text>
              <Text style={styles.topicMeta}>{item.messageCount} {club.replies}</Text>
              <Text style={styles.topicMeta}>{formatDate(item.lastMessageAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          searchQuery.length >= 2 ? (
            <View style={styles.emptyState}>
              <Search size={48} color={theme.primaryDim} strokeWidth={1} />
              <Text style={styles.emptyTitle}>{club.noSearchResults}</Text>
              <Text style={styles.emptyText}>{club.noSearchResultsDesc}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );

  const renderTopics = () => (
    <View style={styles.content}>
      {canCreateTopic && (
        <TouchableOpacity
          style={styles.newTopicBtn}
          onPress={() => setShowNewTopicModal(true)}
          activeOpacity={0.7}
        >
          <Plus size={18} color={theme.primary} />
          <Text style={styles.newTopicBtnText}>{club.newTopic}</Text>
        </TouchableOpacity>
      )}
      {!canCreateTopic && selectedCategory && (
        <View style={styles.accessNote}>
          <Lock size={14} color={theme.textSecondary} />
          <Text style={styles.accessNoteText}>
            {club.accessDeniedCreate.replace('%d', String(selectedCategory.createTopicLevel))}
          </Text>
        </View>
      )}
      <FlatList
        data={topicsQuery.data ?? []}
        renderItem={renderTopicItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MessageCircle size={48} color={theme.primaryDim} strokeWidth={1} />
            <Text style={styles.emptyTitle}>{club.noTopics}</Text>
            <Text style={styles.emptyText}>{club.noTopicsDesc}</Text>
          </View>
        }
      />
    </View>
  );

  const messagesListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messagesQuery.data && messagesQuery.data.length > 0) {
      setTimeout(() => {
        messagesListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messagesQuery.data]);

  const renderMessages = () => (
    <KeyboardAvoidingView
      style={styles.content}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <FlatList
        ref={messagesListRef}
        data={messagesQuery.data ?? []}
        renderItem={renderMessageItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MessageCircle size={48} color={theme.primaryDim} strokeWidth={1} />
            <Text style={styles.emptyTitle}>{club.noMessages}</Text>
            <Text style={styles.emptyText}>{club.noMessagesDesc}</Text>
          </View>
        }
      />
      {selectedTopic?.isLocked ? (
        <View style={styles.lockedBar}>
          <Lock size={14} color={theme.textSecondary} />
          <Text style={styles.lockedBarText}>{club.topicLocked}</Text>
        </View>
      ) : canWrite ? (
        <View>
          {replyToMessage && (
            <View style={styles.replyPreviewBar}>
              <View style={styles.replyPreviewLeft}>
                <Reply size={14} color={theme.primary} />
                <View style={styles.replyPreviewInfo}>
                  <Text style={styles.replyPreviewAuthor} numberOfLines={1}>
                    {club.replyTo} {replyToMessage.authorName}
                  </Text>
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    {replyToMessage.content}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setReplyToMessage(null)}
                style={styles.replyPreviewClose}
                activeOpacity={0.7}
              >
                <X size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.messageInputBar}>
            <TextInput
              style={styles.messageInput}
              placeholder={club.messagePlaceholder}
              placeholderTextColor={theme.primaryDim}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !messageText.trim() && styles.sendBtnDisabled]}
              onPress={() => {
                if (messageText.trim()) {
                  addMessageMutation.mutate({ content: messageText.trim(), replyTo: replyToMessage });
                }
              }}
              disabled={!messageText.trim() || addMessageMutation.isPending}
              activeOpacity={0.7}
            >
              <Send size={18} color={messageText.trim() ? theme.primary : theme.primaryDim} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.lockedBar}>
          <Lock size={14} color={theme.textSecondary} />
          <Text style={styles.lockedBarText}>
            {club.accessDeniedWrite.replace('%d', String(selectedCategory?.writeLevel ?? 1))}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );

  const renderNotifications = () => {
    const notifications = notificationsQuery.data ?? [];
    return (
      <View style={styles.content}>
        {notifications.length > 0 && (
          <TouchableOpacity
            style={styles.markAllReadBtn}
            onPress={() => markAllReadMutation.mutate()}
            activeOpacity={0.7}
          >
            <Check size={16} color={theme.primary} />
            <Text style={styles.markAllReadText}>{club.markAllRead}</Text>
          </TouchableOpacity>
        )}
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Bell size={48} color={theme.primaryDim} strokeWidth={1} />
              <Text style={styles.emptyTitle}>{club.noNotifications}</Text>
            </View>
          }
        />
      </View>
    );
  };

  const renderNotifSettings = () => {
    const settings = notifSettingsQuery.data ?? {
      enabled: true,
      subscribedCategoryIds: [],
      subscribedTopicIds: [],
      muteAll: false,
    };

    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.settingsContent}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            saveNotifSettingsMutation.mutate({ ...settings, enabled: !settings.enabled });
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingLeft}>
            <Bell size={18} color={theme.primary} />
            <Text style={styles.settingLabel}>{club.enableNotifications}</Text>
          </View>
          <View style={[styles.toggleTrack, settings.enabled && styles.toggleTrackActive]}>
            <View style={[styles.toggleThumb, settings.enabled && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            saveNotifSettingsMutation.mutate({ ...settings, muteAll: !settings.muteAll });
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingLeft}>
            <BellOff size={18} color={theme.danger} />
            <Text style={styles.settingLabel}>{club.muteAll}</Text>
          </View>
          <View style={[styles.toggleTrack, settings.muteAll && styles.toggleTrackDanger]}>
            <View style={[styles.toggleThumb, settings.muteAll && styles.toggleThumbDanger]} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderModPanel = () => {
    const bans = bansQuery.data ?? [];
    const profiles = allProfilesQuery.data ?? {};
    const categories = categoriesQuery.data ?? [];

    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.settingsContent}>
        <View style={styles.modSectionBlock}>
          <Text style={styles.modSectionTitle}>{club.manageSections}</Text>
          {categories.map(cat => (
            <View key={cat.id} style={styles.modSectionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modSectionName}>{getCategoryDisplayName(cat.name)}</Text>
                <Text style={styles.modSectionMeta}>
                  R:{cat.readLevel} W:{cat.writeLevel} T:{cat.createTopicLevel}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modSmallBtn}
                onPress={() => {
                  setEditingSection(cat);
                  setSectionForm({
                    name: cat.name,
                    description: cat.description,
                    readLevel: cat.readLevel,
                    writeLevel: cat.writeLevel,
                    createTopicLevel: cat.createTopicLevel,
                    order: cat.order,
                  });
                  setShowModSectionModal(true);
                }}
                activeOpacity={0.7}
              >
                <Edit3 size={14} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modSmallBtn}
                onPress={() => {
                  Alert.alert(club.deleteSection, club.deleteSectionConfirm, [
                    { text: club.cancel, style: 'cancel' },
                    { text: club.delete, style: 'destructive', onPress: () => deleteSectionMutation.mutate(cat.id) },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Trash2 size={14} color={theme.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={styles.modAddBtn}
            onPress={() => {
              setEditingSection(null);
              setSectionForm({ name: '', description: '', readLevel: 1, writeLevel: 1, createTopicLevel: 1, order: categories.length });
              setShowModSectionModal(true);
            }}
            activeOpacity={0.7}
          >
            <Plus size={16} color={theme.primary} />
            <Text style={styles.modAddBtnText}>{club.addSection}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modSectionBlock}>
          <Text style={styles.modSectionTitle}>{club.banManagement}</Text>
          <TouchableOpacity
            style={styles.modAddBtn}
            onPress={() => {
              setBanTargetPhone('');
              setBanType('write');
              setBanPermanent(true);
              setBanDays('7');
              setBanReason('');
              setShowBanModal(true);
            }}
            activeOpacity={0.7}
          >
            <Shield size={16} color={theme.danger} />
            <Text style={[styles.modAddBtnText, { color: theme.danger }]}>{club.banUser}</Text>
          </TouchableOpacity>
          {bans.length === 0 ? (
            <Text style={styles.modEmptyText}>{club.noBans}</Text>
          ) : (
            <>
              <Text style={styles.modSubTitle}>{club.activeBans} ({bans.length})</Text>
              {bans.map((ban, idx) => {
                const profile = profiles[ban.phone];
                const displayName = profile ? profile.fullName : ban.phone;
                return (
                  <View key={`${ban.phone}_${ban.type}_${idx}`} style={styles.modBanRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modBanName}>{displayName}</Text>
                      <Text style={styles.modBanMeta}>
                        {ban.type === 'write' ? club.banTypeWrite : ban.type === 'forum' ? club.banTypeForum : club.banTypeApp}
                        {' • '}
                        {ban.permanent ? club.bannedPermanent : `${club.bannedUntil} ${new Date(ban.expiresAt ?? '').toLocaleDateString()}`}
                      </Text>
                      {ban.reason && ban.reason !== '-' && (
                        <Text style={styles.modBanReason}>{ban.reason}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.modSmallBtn}
                      onPress={() => unbanMutation.mutate({ phone: ban.phone, type: ban.type })}
                      activeOpacity={0.7}
                    >
                      <X size={14} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </View>

        <View style={styles.modSectionBlock}>
          <Text style={styles.modSectionTitle}>{club.assignLevel}</Text>
          <Text style={styles.modDescText}>{club.assignLevelDesc}</Text>
          <TouchableOpacity
            style={styles.modAddBtn}
            onPress={() => {
              setAssignTargetPhone('');
              setAssignLevel(3);
              setShowAssignLevelModal(true);
            }}
            activeOpacity={0.7}
          >
            <Shield size={16} color={theme.primary} />
            <Text style={styles.modAddBtnText}>{club.assignLevel}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.background} testID="clubTabRoot">
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
          {view === 'categories' && renderCategories()}
          {view === 'topics' && renderTopics()}
          {view === 'messages' && renderMessages()}
          {view === 'notifications' && renderNotifications()}
          {view === 'notifSettings' && renderNotifSettings()}
          {view === 'modPanel' && renderModPanel()}
          {view === 'search' && renderSearch()}
        </Animated.View>
      </SafeAreaView>

      <Modal
        visible={onboardingStep === 'welcome'}
        animationType="fade"
        transparent
        onRequestClose={() => {}}
      >
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.onboardingScroll}>
              <Cigarette size={40} color={theme.primary} strokeWidth={1.5} style={styles.onboardingIcon} />
              <Text style={styles.onboardingTitle}>{club.welcomeTitle}</Text>
              <Text style={styles.onboardingSubtitle}>{club.welcomeSubtitle}</Text>
              <View style={styles.onboardingDivider} />
              <Text style={styles.onboardingText}>{club.welcomeText}</Text>
              <View style={styles.onboardingDivider} />
              <View style={styles.principleBlock}>
                <Text style={styles.principleTitle}>{club.welcomePrinciple1Title}</Text>
                <Text style={styles.principleText}>{club.welcomePrinciple1Text}</Text>
              </View>
              <View style={styles.principleBlock}>
                <Text style={styles.principleTitle}>{club.welcomePrinciple2Title}</Text>
                <Text style={styles.principleText}>{club.welcomePrinciple2Text}</Text>
              </View>
              <View style={styles.principleBlock}>
                <Text style={styles.principleTitle}>{club.welcomePrinciple3Title}</Text>
                <Text style={styles.principleText}>{club.welcomePrinciple3Text}</Text>
              </View>
              <View style={styles.onboardingDivider} />
              <Text style={styles.onboardingFooter}>{club.welcomeFooter}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.onboardingBtn}
              onPress={handleWelcomeContinue}
              activeOpacity={0.7}
              testID="welcomeContinueBtn"
            >
              <Text style={styles.onboardingBtnText}>{club.continueToRules}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={onboardingStep === 'rules' || showRulesModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (onboardingStep === 'rules') return;
          setShowRulesModal(false);
        }}
      >
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingCard}>
            {onboardingStep !== 'rules' && (
              <TouchableOpacity
                style={styles.rulesCloseBtn}
                onPress={() => setShowRulesModal(false)}
                activeOpacity={0.7}
              >
                <X size={20} color={theme.primary} />
              </TouchableOpacity>
            )}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.onboardingScroll}>
              <Shield size={36} color={theme.primary} strokeWidth={1.5} style={styles.onboardingIcon} />
              <Text style={styles.onboardingTitle}>{club.rulesTitle}</Text>
              <View style={styles.onboardingDivider} />
              {([1,2,3,4,5,6,7,8,9,10] as const).map(n => {
                const titleKey = `rule${n}Title` as keyof typeof club;
                const textKey = `rule${n}Text` as keyof typeof club;
                return (
                  <View key={n} style={styles.ruleBlock}>
                    <Text style={styles.ruleTitle}>{club[titleKey] as string}</Text>
                    <Text style={styles.ruleText}>{club[textKey] as string}</Text>
                  </View>
                );
              })}
            </ScrollView>
            {onboardingStep === 'rules' ? (
              <TouchableOpacity
                style={styles.onboardingBtn}
                onPress={handleRulesAcknowledge}
                activeOpacity={0.7}
                testID="rulesAcknowledgeBtn"
              >
                <Text style={styles.onboardingBtnText}>{club.acknowledged}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.onboardingBtn}
                onPress={() => setShowRulesModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.onboardingBtnText}>{club.acknowledged}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNewTopicModal}
        animationType="slide"
        onRequestClose={() => setShowNewTopicModal(false)}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalContent} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{club.newTopic}</Text>
              <TouchableOpacity onPress={() => setShowNewTopicModal(false)} activeOpacity={0.7}>
                <X size={22} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{club.topicTitle}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={club.topicTitlePlaceholder}
                placeholderTextColor={theme.primaryDim}
                value={newTopicTitle}
                onChangeText={setNewTopicTitle}
                maxLength={200}
              />
              <Text style={styles.fieldLabel}>{club.messages}</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                placeholder={club.messagePlaceholder}
                placeholderTextColor={theme.primaryDim}
                value={newTopicFirstMessage}
                onChangeText={setNewTopicFirstMessage}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[
                  styles.createBtn,
                  (!newTopicTitle.trim() || !newTopicFirstMessage.trim()) && styles.createBtnDisabled,
                ]}
                onPress={() => {
                  if (newTopicTitle.trim() && newTopicFirstMessage.trim()) {
                    addTopicMutation.mutate({ title: newTopicTitle.trim(), firstMsg: newTopicFirstMessage.trim() });
                  }
                }}
                disabled={!newTopicTitle.trim() || !newTopicFirstMessage.trim() || addTopicMutation.isPending}
                activeOpacity={0.7}
              >
                <Text style={styles.createBtnText}>{club.create}</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      <Modal
        visible={onboardingStep === 'profile'}
        animationType="fade"
        transparent
        onRequestClose={() => {}}
      >
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.onboardingScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.profilePhotoSection}>
                {profileForm.photoBase64 ? (
                  <View>
                    <Image
                      source={{ uri: profileForm.photoBase64 }}
                      style={styles.profilePhotoLarge}
                      contentFit="cover"
                    />
                    <View style={styles.profilePhotoActions}>
                      <TouchableOpacity onPress={pickProfilePhoto} activeOpacity={0.7}>
                        <Text style={styles.profilePhotoActionText}>{club.changePhoto}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={removeProfilePhoto} activeOpacity={0.7}>
                        <Text style={[styles.profilePhotoActionText, { color: theme.danger }]}>{club.removeProfilePhoto}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.profilePhotoPlaceholder} onPress={pickProfilePhoto} activeOpacity={0.7}>
                    <Camera size={28} color={theme.primaryDim} />
                    <Text style={styles.profilePhotoPlaceholderText}>{club.addProfilePhoto}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.onboardingTitle}>{club.fillProfile}</Text>
              <View style={styles.onboardingDivider} />
              <Text style={styles.fieldLabel}>{club.profileFullName}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={club.profileFullNamePlaceholder}
                placeholderTextColor={theme.primaryDim}
                value={profileForm.fullName}
                onChangeText={(v) => setProfileForm(prev => ({ ...prev, fullName: v }))}
                maxLength={100}
                testID="profileFullName"
              />
              <Text style={styles.fieldLabel}>{club.profileNetworkingGoals}</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                placeholder={club.profileNetworkingGoalsPlaceholder}
                placeholderTextColor={theme.primaryDim}
                value={profileForm.networkingGoals}
                onChangeText={(v) => setProfileForm(prev => ({ ...prev, networkingGoals: v }))}
                multiline
                maxLength={500}
                testID="profileNetworkingGoals"
              />
              <Text style={styles.fieldLabel}>{club.profileCompetencies}</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                placeholder={club.profileCompetenciesPlaceholder}
                placeholderTextColor={theme.primaryDim}
                value={profileForm.competencies}
                onChangeText={(v) => setProfileForm(prev => ({ ...prev, competencies: v }))}
                multiline
                maxLength={500}
                testID="profileCompetencies"
              />
              <Text style={styles.fieldLabel}>{club.profileCanBeUseful}</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                placeholder={club.profileCanBeUsefulPlaceholder}
                placeholderTextColor={theme.primaryDim}
                value={profileForm.canBeUseful}
                onChangeText={(v) => setProfileForm(prev => ({ ...prev, canBeUseful: v }))}
                multiline
                maxLength={500}
              />
              <Text style={styles.fieldLabel}>{club.profileLookingFor}</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                placeholder={club.profileLookingForPlaceholder}
                placeholderTextColor={theme.primaryDim}
                value={profileForm.lookingFor}
                onChangeText={(v) => setProfileForm(prev => ({ ...prev, lookingFor: v }))}
                multiline
                maxLength={500}
              />
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.onboardingBtn,
                (!profileForm.fullName.trim() || !profileForm.networkingGoals.trim() || !profileForm.competencies.trim()) && styles.createBtnDisabled,
              ]}
              onPress={handleSaveProfile}
              disabled={saveProfileMutation.isPending}
              activeOpacity={0.7}
              testID="profileSaveBtn"
            >
              <Text style={styles.onboardingBtnText}>{club.profileSave}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowProfileModal(false); setViewingProfilePhone(null); setIsEditingProfile(false); }}
      >
        <View style={styles.onboardingOverlay}>
          <View style={styles.profileCard}>
            <View style={styles.profileCardHeader}>
              <Text style={styles.onboardingTitle}>{club.profileTitle}</Text>
              <TouchableOpacity
                onPress={() => { setShowProfileModal(false); setViewingProfilePhone(null); setIsEditingProfile(false); }}
                activeOpacity={0.7}
              >
                <X size={22} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {isEditingProfile ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.profilePhotoSection}>
                  {profileForm.photoBase64 ? (
                    <View>
                      <Image
                        source={{ uri: profileForm.photoBase64 }}
                        style={styles.profilePhotoLarge}
                        contentFit="cover"
                      />
                      <View style={styles.profilePhotoActions}>
                        <TouchableOpacity onPress={pickProfilePhoto} activeOpacity={0.7}>
                          <Text style={styles.profilePhotoActionText}>{club.changePhoto}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={removeProfilePhoto} activeOpacity={0.7}>
                          <Text style={[styles.profilePhotoActionText, { color: theme.danger }]}>{club.removeProfilePhoto}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.profilePhotoPlaceholder} onPress={pickProfilePhoto} activeOpacity={0.7}>
                      <Camera size={28} color={theme.primaryDim} />
                      <Text style={styles.profilePhotoPlaceholderText}>{club.addProfilePhoto}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.fieldLabel}>{club.profileFullName}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={profileForm.fullName}
                  onChangeText={(v) => setProfileForm(prev => ({ ...prev, fullName: v }))}
                  maxLength={100}
                />
                <Text style={styles.fieldLabel}>{club.profileNetworkingGoals}</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldInputMulti]}
                  value={profileForm.networkingGoals}
                  onChangeText={(v) => setProfileForm(prev => ({ ...prev, networkingGoals: v }))}
                  multiline
                  maxLength={500}
                />
                <Text style={styles.fieldLabel}>{club.profileCompetencies}</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldInputMulti]}
                  value={profileForm.competencies}
                  onChangeText={(v) => setProfileForm(prev => ({ ...prev, competencies: v }))}
                  multiline
                  maxLength={500}
                />
                <Text style={styles.fieldLabel}>{club.profileCanBeUseful}</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldInputMulti]}
                  value={profileForm.canBeUseful}
                  onChangeText={(v) => setProfileForm(prev => ({ ...prev, canBeUseful: v }))}
                  multiline
                  maxLength={500}
                />
                <Text style={styles.fieldLabel}>{club.profileLookingFor}</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldInputMulti]}
                  value={profileForm.lookingFor}
                  onChangeText={(v) => setProfileForm(prev => ({ ...prev, lookingFor: v }))}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[
                    styles.createBtn,
                    (!profileForm.fullName.trim() || !profileForm.networkingGoals.trim() || !profileForm.competencies.trim()) && styles.createBtnDisabled,
                  ]}
                  onPress={handleSaveProfile}
                  disabled={saveProfileMutation.isPending}
                  activeOpacity={0.7}
                >
                  <Text style={styles.createBtnText}>{club.profileSave}</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScrollContent}>
                {(() => {
                  const viewProfile = viewingProfilePhone === phoneNumber ? myProfile : viewingProfileQuery.data;
                  if (!viewProfile) {
                    return <Text style={styles.emptyText}>{club.profileRequired}</Text>;
                  }
                  const nickname = ForumService.getForumNickname(viewProfile, viewingProfilePhone ?? '');
                  const isOwnProfile = viewingProfilePhone === phoneNumber;
                  const existingDossier = viewingProfilePhone ? findDossierByPhone(viewingProfilePhone) : null;
                  return (
                    <>
                      <View style={styles.profilePhotoSection}>
                        {viewProfile.photoBase64 ? (
                          <Image
                            source={{ uri: viewProfile.photoBase64 }}
                            style={styles.profilePhotoLarge}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.profilePhotoPlaceholder}>
                            <UserCircle2 size={48} color={theme.primaryDim} strokeWidth={1} />
                          </View>
                        )}
                      </View>

                      <View style={styles.profileNicknameRow}>
                        <User size={20} color={theme.primary} />
                        <Text style={styles.profileNickname}>{nickname}</Text>
                      </View>

                      <View style={styles.profileAccessRow}>
                        <Shield size={14} color={theme.primary} />
                        <Text style={styles.profileAccessText}>{club.accessLevelLabel} {viewProfile.accessLevel ?? 1}</Text>
                      </View>

                      {!isOwnProfile && viewingProfilePhone && (
                        <TouchableOpacity
                          style={styles.dossierBtn}
                          onPress={() => handleDossierAction(viewingProfilePhone, viewProfile.fullName)}
                          activeOpacity={0.7}
                        >
                          {existingDossier ? (
                            <>
                              <FileText size={16} color={theme.primary} />
                              <Text style={styles.dossierBtnText}>{club.openDossier}</Text>
                            </>
                          ) : (
                            <>
                              <FilePlus size={16} color={theme.primary} />
                              <Text style={styles.dossierBtnText}>{club.createDossier}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {isOwnProfile && (
                        <TouchableOpacity
                          style={styles.editProfileBtn}
                          onPress={() => {
                            setProfileForm({
                              fullName: viewProfile.fullName,
                              networkingGoals: viewProfile.networkingGoals,
                              competencies: viewProfile.competencies,
                              canBeUseful: viewProfile.canBeUseful,
                              lookingFor: viewProfile.lookingFor,
                              photoBase64: viewProfile.photoBase64,
                            });
                            setIsEditingProfile(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Edit3 size={14} color={theme.primary} />
                          <Text style={styles.editProfileBtnText}>{club.editProfile}</Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.onboardingDivider} />

                      <Text style={styles.profileFieldLabel}>{club.profileFullName.replace(' *', '')}</Text>
                      <Text style={styles.profileFieldValue}>{viewProfile.fullName}</Text>

                      <Text style={styles.profileFieldLabel}>{club.profileNetworkingGoals.replace(' *', '')}</Text>
                      <Text style={styles.profileFieldValue}>{viewProfile.networkingGoals}</Text>

                      <Text style={styles.profileFieldLabel}>{club.profileCompetencies.replace(' *', '')}</Text>
                      <Text style={styles.profileFieldValue}>{viewProfile.competencies}</Text>

                      {viewProfile.canBeUseful ? (
                        <>
                          <Text style={styles.profileFieldLabel}>{club.profileCanBeUseful}</Text>
                          <Text style={styles.profileFieldValue}>{viewProfile.canBeUseful}</Text>
                        </>
                      ) : null}

                      {viewProfile.lookingFor ? (
                        <>
                          <Text style={styles.profileFieldLabel}>{club.profileLookingFor}</Text>
                          <Text style={styles.profileFieldValue}>{viewProfile.lookingFor}</Text>
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showModSectionModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowModSectionModal(false); setEditingSection(null); }}
      >
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingCard}>
            <View style={styles.profileCardHeader}>
              <Text style={styles.onboardingTitle}>{editingSection ? club.editSection : club.addSection}</Text>
              <TouchableOpacity
                onPress={() => { setShowModSectionModal(false); setEditingSection(null); }}
                activeOpacity={0.7}
              >
                <X size={22} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScrollContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{club.sectionName}</Text>
              <TextInput
                style={styles.fieldInput}
                value={sectionForm.name}
                onChangeText={(v) => setSectionForm(prev => ({ ...prev, name: v }))}
                placeholder="section_key"
                placeholderTextColor={theme.primaryDim}
                maxLength={100}
              />
              <Text style={styles.fieldLabel}>{club.sectionDesc}</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                value={sectionForm.description}
                onChangeText={(v) => setSectionForm(prev => ({ ...prev, description: v }))}
                placeholder="section_desc_key"
                placeholderTextColor={theme.primaryDim}
                multiline
                maxLength={300}
              />
              <Text style={styles.fieldLabel}>{club.sectionReadLevel}</Text>
              <View style={styles.modLevelRow}>
                {([1, 2, 3, 4, 5] as AccessLevel[]).map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.modLevelPill, sectionForm.readLevel === l && styles.modLevelPillActive]}
                    onPress={() => setSectionForm(prev => ({ ...prev, readLevel: l }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modLevelPillText, sectionForm.readLevel === l && styles.modLevelPillTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>{club.sectionWriteLevel}</Text>
              <View style={styles.modLevelRow}>
                {([1, 2, 3, 4, 5] as AccessLevel[]).map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.modLevelPill, sectionForm.writeLevel === l && styles.modLevelPillActive]}
                    onPress={() => setSectionForm(prev => ({ ...prev, writeLevel: l }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modLevelPillText, sectionForm.writeLevel === l && styles.modLevelPillTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>{club.sectionCreateLevel}</Text>
              <View style={styles.modLevelRow}>
                {([1, 2, 3, 4, 5] as AccessLevel[]).map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.modLevelPill, sectionForm.createTopicLevel === l && styles.modLevelPillActive]}
                    onPress={() => setSectionForm(prev => ({ ...prev, createTopicLevel: l }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modLevelPillText, sectionForm.createTopicLevel === l && styles.modLevelPillTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>{club.sectionOrder}</Text>
              <TextInput
                style={styles.fieldInput}
                value={String(sectionForm.order)}
                onChangeText={(v) => setSectionForm(prev => ({ ...prev, order: parseInt(v, 10) || 0 }))}
                keyboardType="numeric"
                maxLength={3}
              />
              <TouchableOpacity
                style={[styles.createBtn, !sectionForm.name.trim() && styles.createBtnDisabled]}
                onPress={() => saveSectionMutation.mutate({ isNew: !editingSection, id: editingSection?.id })}
                disabled={!sectionForm.name.trim() || saveSectionMutation.isPending}
                activeOpacity={0.7}
              >
                <Text style={styles.createBtnText}>{club.saveSectionChanges}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBanModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBanModal(false)}
      >
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingCard}>
            <View style={styles.profileCardHeader}>
              <Text style={styles.onboardingTitle}>{club.banUser}</Text>
              <TouchableOpacity
                onPress={() => setShowBanModal(false)}
                activeOpacity={0.7}
              >
                <X size={22} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScrollContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{club.userPhone}</Text>
              <TextInput
                style={styles.fieldInput}
                value={banTargetPhone}
                onChangeText={setBanTargetPhone}
                placeholder="+7..."
                placeholderTextColor={theme.primaryDim}
                maxLength={20}
              />
              <Text style={styles.fieldLabel}>{club.banDuration}</Text>
              <View style={styles.modBanTypeRow}>
                {(['write', 'forum', 'app'] as BanType[]).map(bt => (
                  <TouchableOpacity
                    key={bt}
                    style={[styles.modBanTypePill, banType === bt && styles.modBanTypePillActive]}
                    onPress={() => setBanType(bt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modBanTypePillText, banType === bt && styles.modBanTypePillTextActive]}>
                      {bt === 'write' ? club.banTypeWrite : bt === 'forum' ? club.banTypeForum : club.banTypeApp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>{club.banDuration}</Text>
              <View style={styles.modBanTypeRow}>
                <TouchableOpacity
                  style={[styles.modBanTypePill, banPermanent && styles.modBanTypePillActive]}
                  onPress={() => setBanPermanent(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modBanTypePillText, banPermanent && styles.modBanTypePillTextActive]}>{club.banPermanent}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modBanTypePill, !banPermanent && styles.modBanTypePillActive]}
                  onPress={() => setBanPermanent(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modBanTypePillText, !banPermanent && styles.modBanTypePillTextActive]}>{club.banDays}</Text>
                </TouchableOpacity>
              </View>
              {!banPermanent && (
                <TextInput
                  style={[styles.fieldInput, { marginTop: 8 }]}
                  value={banDays}
                  onChangeText={setBanDays}
                  placeholder="7"
                  placeholderTextColor={theme.primaryDim}
                  keyboardType="numeric"
                  maxLength={5}
                />
              )}
              <Text style={styles.fieldLabel}>{club.banReason}</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                value={banReason}
                onChangeText={setBanReason}
                placeholder={club.banReasonPlaceholder}
                placeholderTextColor={theme.primaryDim}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.createBtn, { borderColor: theme.danger }, !banTargetPhone.trim() && styles.createBtnDisabled]}
                onPress={() => banMutation.mutate()}
                disabled={!banTargetPhone.trim() || banMutation.isPending}
                activeOpacity={0.7}
              >
                <Text style={[styles.createBtnText, { color: theme.danger }]}>{club.banConfirm}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAssignLevelModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAssignLevelModal(false)}
      >
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingCard}>
            <View style={styles.profileCardHeader}>
              <Text style={styles.onboardingTitle}>{club.assignLevel}</Text>
              <TouchableOpacity
                onPress={() => setShowAssignLevelModal(false)}
                activeOpacity={0.7}
              >
                <X size={22} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScrollContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{club.userPhone}</Text>
              <TextInput
                style={styles.fieldInput}
                value={assignTargetPhone}
                onChangeText={setAssignTargetPhone}
                placeholder="+7..."
                placeholderTextColor={theme.primaryDim}
                maxLength={20}
              />
              <Text style={styles.fieldLabel}>{club.assignLevel}</Text>
              <View style={styles.modLevelRow}>
                {([3, 4, 5] as AccessLevel[]).map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.modLevelPill, assignLevel === l && styles.modLevelPillActive]}
                    onPress={() => setAssignLevel(l)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modLevelPillText, assignLevel === l && styles.modLevelPillTextActive]}>{club.accessLevelShort}{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.createBtn, !assignTargetPhone.trim() && styles.createBtnDisabled]}
                onPress={() => assignLevelMutation.mutate()}
                disabled={!assignTargetPhone.trim() || assignLevelMutation.isPending}
                activeOpacity={0.7}
              >
                <Text style={styles.createBtnText}>{club.assignLevel}</Text>
              </TouchableOpacity>
              <View style={styles.onboardingDivider} />
              <Text style={styles.fieldLabel}>{club.assignModerator}</Text>
              <TouchableOpacity
                style={[styles.createBtn, !assignTargetPhone.trim() && styles.createBtnDisabled]}
                onPress={() => {
                  if (assignTargetPhone.trim()) {
                    assignModeratorMutation.mutate(assignTargetPhone.trim());
                  }
                }}
                disabled={!assignTargetPhone.trim() || assignModeratorMutation.isPending}
                activeOpacity={0.7}
              >
                <Text style={styles.createBtnText}>{club.assignModerator}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, { borderColor: theme.danger, marginTop: 8 }, !assignTargetPhone.trim() && styles.createBtnDisabled]}
                onPress={() => {
                  if (assignTargetPhone.trim()) {
                    removeModeratorMutation.mutate(assignTargetPhone.trim());
                  }
                }}
                disabled={!assignTargetPhone.trim() || removeModeratorMutation.isPending}
                activeOpacity={0.7}
              >
                <Text style={[styles.createBtnText, { color: theme.danger }]}>{club.removeModerator}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
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
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
      gap: 10,
    },
    headerBackBtn: {
      padding: 4,
    },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
    },
    headerRight: {
      flexDirection: 'row',
      gap: 8,
    },
    headerIconBtn: {
      padding: 6,
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: theme.danger,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: '800' as const,
      color: '#FFFFFF',
      fontFamily: 'monospace' as const,
    },
    body: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    listContent: {
      padding: 16,
      paddingBottom: 40,
    },
    messagesListContent: {
      padding: 16,
      paddingBottom: 8,
    },
    levelIndicatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    levelIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    levelIndicatorText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
    },
    onlineIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.success + '50',
      backgroundColor: theme.success + '10',
    },
    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.success,
    },
    onlineText: {
      fontSize: 9,
      fontWeight: '800' as const,
      color: theme.success,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
    },
    categoryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 16,
      marginBottom: 10,
    },
    categoryCardLocked: {
      opacity: 0.6,
      borderColor: theme.danger + '40',
    },
    categoryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 14,
    },
    categoryIconWrap: {
      width: 44,
      height: 44,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    categoryInfo: {
      flex: 1,
    },
    categoryName: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
      marginBottom: 2,
    },
    categoryDesc: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginBottom: 6,
    },
    categoryStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    categoryStatText: {
      fontSize: 9,
      fontWeight: '600' as const,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    categoryStatDot: {
      fontSize: 9,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    categoryLevels: {
      flexDirection: 'row',
      gap: 8,
    },
    levelLabel: {
      fontSize: 9,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
    },
    levelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      borderWidth: 1,
      borderColor: theme.primary,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    levelBadgeLocked: {
      borderColor: theme.danger,
    },
    levelBadgeText: {
      fontSize: 9,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
    },
    topicCard: {
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 14,
      marginBottom: 8,
    },
    topicHeader: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 4,
    },
    topicBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    topicBadgeText: {
      fontSize: 8,
      fontWeight: '800' as const,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    topicTitle: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    topicFooter: {
      flexDirection: 'row',
      gap: 12,
    },
    topicMeta: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    newTopicBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 12,
      borderWidth: 2,
      borderColor: theme.primary,
      borderStyle: 'dashed',
    },
    newTopicBtnText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
    },
    accessNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
    },
    accessNoteText: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    messageCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 12,
      marginBottom: 8,
      borderLeftWidth: 3,
      borderLeftColor: theme.primaryDim,
    },
    messageCardOwn: {
      borderLeftColor: theme.primary,
      backgroundColor: theme.primary + '0A',
    },
    messageMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    messageAuthor: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
    },
    messageAuthorOwn: {
      color: theme.primary,
    },
    messageTime: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    messageContent: {
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 20,
    },
    editedLabel: {
      fontSize: 9,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      fontStyle: 'italic' as const,
    },
    editMessageContainer: {
      marginBottom: 4,
    },
    editMessageInput: {
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.overlay,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
      maxHeight: 120,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    editMessageActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 6,
    },
    editCancelBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    editCancelBtnText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    editSaveBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.primary + '15',
    },
    editSaveBtnText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    searchBarContainer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 8,
    },
    searchInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
      padding: 0,
    },
    searchBtn: {
      borderWidth: 2,
      borderColor: theme.primary,
      paddingVertical: 10,
      alignItems: 'center',
    },
    searchBtnText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
    },
    messageActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },
    messageReactionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    messageActionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    reactionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 3,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
    },
    reactionBtnActive: {
      borderColor: theme.primary + '60',
      backgroundColor: theme.primary + '10',
    },
    reactionBtnDislikeActive: {
      borderColor: theme.danger + '60',
      backgroundColor: theme.danger + '10',
    },
    reactionCount: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
    },
    reactionCountActive: {
      color: theme.primary,
    },
    reactionCountDislikeActive: {
      color: theme.danger,
    },
    messageReplyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: 4,
    },
    messageReplyText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
    },
    messageDeleteBtn: {
      padding: 4,
    },
    replyQuote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.primary + '0C',
      borderLeftWidth: 2,
      borderLeftColor: theme.primary,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginBottom: 8,
    },
    replyQuoteContent: {
      flex: 1,
    },
    replyQuoteAuthor: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    replyQuoteText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      lineHeight: 16,
    },
    replyPreviewBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.primary + '08',
    },
    replyPreviewLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    replyPreviewInfo: {
      flex: 1,
    },
    replyPreviewAuthor: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
    },
    replyPreviewText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    replyPreviewClose: {
      padding: 4,
      marginLeft: 8,
    },
    messageInputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 2,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    messageInput: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      maxHeight: 100,
      backgroundColor: theme.overlay,
    },
    sendBtn: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.primary,
    },
    sendBtnDisabled: {
      borderColor: theme.border,
    },
    lockedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderTopWidth: 2,
      borderTopColor: theme.border,
      backgroundColor: theme.overlay,
    },
    lockedBarText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 8,
      textAlign: 'center',
    },
    notifCard: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 12,
      marginBottom: 8,
    },
    notifCardUnread: {
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
    },
    notifDot: {
      width: 20,
      alignItems: 'center',
      paddingTop: 4,
    },
    notifDotActive: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primary,
    },
    notifContent: {
      flex: 1,
    },
    notifAuthor: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      marginBottom: 2,
    },
    notifTopic: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      marginBottom: 4,
    },
    notifPreview: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      lineHeight: 16,
      marginBottom: 4,
    },
    notifTime: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    markAllReadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      marginHorizontal: 16,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    markAllReadText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    settingsContent: {
      padding: 16,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 16,
      marginBottom: 8,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    settingLabel: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    toggleTrack: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.border,
      padding: 2,
      justifyContent: 'center',
    },
    toggleTrackActive: {
      backgroundColor: theme.primary + '40',
    },
    toggleTrackDanger: {
      backgroundColor: theme.danger + '40',
    },
    toggleThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.textSecondary,
    },
    toggleThumbActive: {
      backgroundColor: theme.primary,
      alignSelf: 'flex-end',
    },
    toggleThumbDanger: {
      backgroundColor: theme.danger,
      alignSelf: 'flex-end',
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
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
    },
    modalBody: {
      flex: 1,
      padding: 16,
    },
    fieldLabel: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
      marginBottom: 6,
      marginTop: 16,
    },
    fieldInput: {
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    fieldInputMulti: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    createBtn: {
      marginTop: 24,
      borderWidth: 2,
      borderColor: theme.primary,
      paddingVertical: 14,
      alignItems: 'center',
    },
    createBtnDisabled: {
      borderColor: theme.border,
      opacity: 0.5,
    },
    createBtnText: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
    },
    onboardingOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    onboardingCard: {
      backgroundColor: theme.background,
      borderWidth: 2,
      borderColor: theme.primary,
      width: '100%',
      maxWidth: 440,
      maxHeight: '88%',
      overflow: 'hidden',
    },
    onboardingScroll: {
      padding: 24,
      paddingBottom: 16,
    },
    onboardingIcon: {
      alignSelf: 'center',
      marginBottom: 16,
    },
    onboardingTitle: {
      fontSize: 18,
      fontWeight: '800' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 3,
      textAlign: 'center',
      marginBottom: 6,
    },
    onboardingSubtitle: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      textAlign: 'center',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    onboardingDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 16,
    },
    onboardingText: {
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 20,
    },
    onboardingFooter: {
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 20,
      fontStyle: 'italic',
    },
    principleBlock: {
      marginBottom: 14,
    },
    principleTitle: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
      marginBottom: 4,
    },
    principleText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      lineHeight: 18,
    },
    onboardingBtn: {
      borderTopWidth: 2,
      borderTopColor: theme.primary,
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: theme.primary + '10',
    },
    onboardingBtnText: {
      fontSize: 14,
      fontWeight: '800' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 3,
    },
    rulesCloseBtn: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 10,
      padding: 4,
    },
    ruleBlock: {
      marginBottom: 16,
    },
    ruleTitle: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    ruleText: {
      fontSize: 11,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 18,
    },
    profileCard: {
      backgroundColor: theme.background,
      borderWidth: 2,
      borderColor: theme.primary,
      width: '100%',
      maxWidth: 440,
      maxHeight: '90%',
      overflow: 'hidden',
    },
    profileCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
    },
    profileScrollContent: {
      padding: 20,
      paddingBottom: 30,
    },
    profileNicknameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    profileNickname: {
      fontSize: 16,
      fontWeight: '800' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
    },
    dossierBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderWidth: 2,
      borderColor: theme.primary,
      marginBottom: 8,
    },
    dossierBtnText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
    },
    editProfileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 4,
    },
    editProfileBtnText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    profileFieldLabel: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
      marginTop: 14,
      marginBottom: 4,
    },
    profileFieldValue: {
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 20,
    },
    messageAuthorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    accessLevelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      borderWidth: 1,
      borderColor: theme.primary + '60',
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    accessLevelBadgeText: {
      fontSize: 8,
      fontWeight: '800' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
    },
    profilePhotoSection: {
      alignItems: 'center',
      marginBottom: 16,
    },
    profilePhotoLarge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: theme.primary,
    },
    profilePhotoPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.overlay,
    },
    profilePhotoPlaceholderText: {
      fontSize: 8,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
      marginTop: 4,
    },
    profilePhotoActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      marginTop: 8,
    },
    profilePhotoActionText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
    },
    profileAccessRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 8,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: theme.primary + '40',
      alignSelf: 'center',
    },
    profileAccessText: {
      fontSize: 11,
      fontWeight: '800' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
    },
    modSectionBlock: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 14,
      marginBottom: 12,
    },
    modSectionTitle: {
      fontSize: 12,
      fontWeight: '800' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
      marginBottom: 12,
    },
    modSubTitle: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
      marginBottom: 8,
      marginTop: 4,
    },
    modDescText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      lineHeight: 16,
      marginBottom: 10,
    },
    modSectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modSectionName: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    modSectionMeta: {
      fontSize: 9,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },
    modSmallBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    modAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.primary,
      borderStyle: 'dashed',
      marginTop: 8,
    },
    modAddBtnText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    modEmptyText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      textAlign: 'center' as const,
      paddingVertical: 12,
    },
    modBanRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modBanName: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    modBanMeta: {
      fontSize: 9,
      color: theme.danger,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },
    modBanReason: {
      fontSize: 9,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      fontStyle: 'italic' as const,
      marginTop: 2,
    },
    modLevelRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    modLevelPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 2,
      borderColor: theme.border,
    },
    modLevelPillActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '15',
    },
    modLevelPillText: {
      fontSize: 11,
      fontWeight: '800' as const,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    modLevelPillTextActive: {
      color: theme.primary,
    },
    modBanTypeRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 8,
      flexWrap: 'wrap',
    },
    modBanTypePill: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 2,
      borderColor: theme.border,
    },
    modBanTypePillActive: {
      borderColor: theme.danger,
      backgroundColor: theme.danger + '15',
    },
    modBanTypePillText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    modBanTypePillTextActive: {
      color: theme.danger,
    },
  });
