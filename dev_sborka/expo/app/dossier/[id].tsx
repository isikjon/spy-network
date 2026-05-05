import { useApp } from '@/contexts/AppContext';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import {
  FileText,
  Phone,
  Mail,
  Briefcase,
  Edit3,
  Trash2,
  BookOpen,
  Users,
  ArrowLeft,
  X,
  Camera,
  UserCircle2,
  Plus,
  Minus,
  Network,
  Triangle,
  ArrowRight,
  PhoneCall,
  MessageSquare,
  Globe,
  MoreHorizontal,
  Target,
  ChevronRight,
  Heart,
} from 'lucide-react-native';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiaryEntry, Sector, FunctionalCircle, ImportanceLevel, ContactRelation } from '@/types';
import { OsintBlock } from '@/components/OsintBlock';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';

export default function DossierScreen() {
  const { id, edit, section } = useLocalSearchParams<{ id: string; edit?: string; section?: string }>();
  const { dossiers, updateDossier, deleteDossier, theme, sectors: userSectors, powerGroupings, addPowerGrouping, goals, t } = useApp();
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [newEntry, setNewEntry] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryContent, setEditingEntryContent] = useState('');
  const [isEditing, setIsEditing] = useState(edit === 'true');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const maintenanceSectionY = useRef<number>(0);
  const hasScrolledToMaintenance = useRef<boolean>(false);

  const initializedForIdRef = useRef<string | null>(null);
  const dossierRef = useRef<typeof dossier | undefined>(undefined);
  const skipNextAutoSaveRef = useRef<boolean>(true);

  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPhones, setEditPhones] = useState<string[]>([]);
  const [editEmails, setEditEmails] = useState<string[]>([]);
  const [editSectors, setEditSectors] = useState<Sector[]>([]);
  const [editCircle, setEditCircle] = useState<FunctionalCircle>('support');
  const [editImportance, setEditImportance] = useState<ImportanceLevel>('medium');
  const [editPhoto, setEditPhoto] = useState<string | undefined>();
  const [editBirthday, setEditBirthday] = useState<string>('');
  const [editRelations, setEditRelations] = useState<ContactRelation[]>([]);
  const [isConnectionsExpanded, setIsConnectionsExpanded] = useState(false);
  const [editGoal, setEditGoal] = useState('');
  const [searchConnection, setSearchConnection] = useState('');
  const [isPowerGroupingExpanded, setIsPowerGroupingExpanded] = useState(false);
  const [editPowerGroupName, setEditPowerGroupName] = useState('');
  const [editSuzerainId, setEditSuzerainId] = useState<string | undefined>();
  const [editVassalIds, setEditVassalIds] = useState<string[]>([]);
  const [searchPowerContact, setSearchPowerContact] = useState('');
  const [isAddingNewGroupName, setIsAddingNewGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editNextAction, setEditNextAction] = useState('');
  const [editNextActionDate, setEditNextActionDate] = useState('');
  const [isNextStepOpen, setIsNextStepOpen] = useState(false);
  const [stepInteractionType, setStepInteractionType] = useState<string>('meeting');
  const [stepResult, setStepResult] = useState('');
  const [stepNextAction, setStepNextAction] = useState('');
  const [stepNextDate, setStepNextDate] = useState('');

  const dossier = dossiers.find((d) => d.contact.id === id);

  useEffect(() => {
    dossierRef.current = dossier;
  }, [dossier]);

  const allContactNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    dossiers.forEach(d => { map[d.contact.id] = d.contact.name; });
    return map;
  }, [dossiers]);

  const sectors: Sector[] = userSectors as Sector[];
  const circles: FunctionalCircle[] = ['support', 'productivity', 'development'];
  const importanceLevels: ImportanceLevel[] = ['critical', 'high', 'medium', 'low'];

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

  const styles = createStyles(theme);

  useEffect(() => {
    if (!dossier || !id) return;

    if (initializedForIdRef.current === dossier.contact.id) return;

    initializedForIdRef.current = dossier.contact.id;
    skipNextAutoSaveRef.current = true;

    setEditName(dossier.contact.name);
    setEditPosition(dossier.contact.position || '');
    setEditCompany(dossier.contact.company || '');
    setEditPhones(dossier.contact.phoneNumbers || []);
    setEditEmails(dossier.contact.emails || []);
    setEditSectors(dossier.sectors || []);
    setEditCircle(dossier.functionalCircle);
    setEditImportance(dossier.importance);
    setEditPhoto(dossier.contact.photo);
    setEditBirthday(dossier.contact.birthday || '');
    setEditRelations(dossier.relations || []);
    setEditGoal(dossier.contact.goal || '');
    setEditPowerGroupName(dossier.powerGrouping?.groupName || '');
    setEditSuzerainId(dossier.powerGrouping?.suzerainId);
    setEditVassalIds(dossier.powerGrouping?.vassalIds || []);
    setEditNextAction(dossier.nextAction || '');
    setEditNextActionDate(dossier.nextActionDate || '');
  }, [dossier, id]);

  const autoSave = useCallback(() => {
    if (!id) return;

    const currentDossier = dossierRef.current;
    if (!currentDossier) return;

    updateDossier(id, {
      contact: {
        ...currentDossier.contact,
        name: editName,
        position: editPosition || undefined,
        company: editCompany || undefined,
        goal: editGoal || undefined,
        birthday: editBirthday || undefined,
        phoneNumbers: editPhones.filter((p) => p.trim()),
        emails: editEmails.filter((e) => e.trim()),
        photo: editPhoto,
      },
      sectors: editSectors,
      functionalCircle: editCircle,
      importance: editImportance,
      relations: editRelations,
      powerGrouping: editPowerGroupName
        ? {
            groupName: editPowerGroupName,
            suzerainId: editSuzerainId,
            vassalIds: editVassalIds,
          }
        : undefined,
      nextAction: editNextAction || undefined,
      nextActionDate: editNextActionDate || undefined,
    });
  }, [editBirthday, editCircle, editCompany, editEmails, editGoal, editImportance, editName, editNextAction, editNextActionDate, editPhones, editPhoto, editPowerGroupName, editRelations, editSectors, editPosition, editSuzerainId, editVassalIds, id, updateDossier]);

  // Автосохранение при изменении полей в режиме редактирования
  useEffect(() => {
    if (!isEditing) return;

    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [autoSave, isEditing]);

  // Автосохранение связей и группировок без режима редактирования
  useEffect(() => {
    if (isEditing) return;
    if (!id || !dossierRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editRelations, editPowerGroupName, editSuzerainId, editVassalIds, isEditing, id, autoSave]);

  const getMaintenanceInfo = () => {
    if (!dossier) return null;
    if (dossier.noDirectConnection) {
      return { status: 'inactive' as const, daysLeft: 0, recommendedDays: 0 };
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
      if (vi >= 75) recommendedDays = Math.min(recommendedDays, 14);
      else if (vi >= 50) recommendedDays = Math.min(recommendedDays, 28);
      else if (vi >= 30) recommendedDays = Math.max(recommendedDays, 45);
    }
    const lastDate = dossier.lastInteraction
      ? new Date(dossier.lastInteraction)
      : dossier.diary && dossier.diary.length > 0
        ? new Date(Math.max(...dossier.diary.map(e => new Date(e.date).getTime())))
        : null;
    if (!lastDate) {
      return { status: 'red' as const, daysLeft: -recommendedDays, recommendedDays };
    }
    const now = new Date();
    const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysLeft = recommendedDays - daysSinceLast;
    let status: 'green' | 'yellow' | 'red';
    if (daysLeft <= 0) status = 'red';
    else if (daysLeft <= Math.ceil(recommendedDays * 0.3)) status = 'yellow';
    else status = 'green';
    return { status, daysLeft, recommendedDays };
  };

  const maintenanceInfo = dossier ? getMaintenanceInfo() : null;

  const getMaintenanceBadgeColor = (status: 'green' | 'yellow' | 'red' | 'inactive') => {
    switch (status) {
      case 'green': return '#059669';
      case 'yellow': return '#d97706';
      case 'red': return '#dc2626';
      case 'inactive': return theme.primaryDim;
    }
  };

  const getMaintenanceBadgeText = () => {
    if (!maintenanceInfo) return '';
    if (maintenanceInfo.status === 'inactive') return t.contact.maintainInactive;
    const dl = maintenanceInfo.daysLeft;
    if (dl <= 0) return `${t.contact.maintainBadge} (${Math.abs(dl)}${t.contact.maintainDaysLeft} ${t.contact.maintainOverdue})`;
    return `${t.contact.maintainBadge} (${dl}${t.contact.maintainDaysLeft})`;
  };

  if (!dossier) {
    return (
      <View style={styles.background}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.errorText}>{t.contact.dossierNotFound}</Text>
        </SafeAreaView>
      </View>
    );
  }

  const handleAddEntry = () => {
    if (newEntry.trim()) {
      const entry: DiaryEntry = {
        id: `entry_${Date.now()}`,
        date: new Date(),
        type: 'manual',
        content: newEntry.trim(),
      };
      updateDossier(id!, {
        diary: [...(dossier.diary || []), entry],
        lastInteraction: new Date(),
      });
      setNewEntry('');
      setIsAddingEntry(false);
    }
  };

  const interactionTypes = [
    { key: 'meeting', icon: Users, label: t.contact.typeMeeting },
    { key: 'call', icon: PhoneCall, label: t.contact.typeCall },
    { key: 'message', icon: MessageSquare, label: t.contact.typeMessage },
    { key: 'email', icon: Mail, label: t.contact.typeEmail },
    { key: 'event', icon: Globe, label: t.contact.typeEvent },
    { key: 'other', icon: MoreHorizontal, label: t.contact.typeOther },
    { key: 'likes', icon: Heart, label: t.contact.typeLikes },
  ];

  const handleSaveNextStep = () => {
    if (!stepResult.trim()) return;

    const typeLabel = interactionTypes.find(it => it.key === stepInteractionType)?.label || stepInteractionType;
    const nextStepLine = stepNextAction.trim() ? '\n\n\u27A1 ' + t.contact.plannedNextStep + ': ' + stepNextAction.trim() : '';
    const dateLine = stepNextDate ? '\n\uD83D\uDCC5 ' + stepNextDate : '';
    const content = '[' + typeLabel + '] ' + stepResult.trim() + nextStepLine + dateLine;

    const entry: DiaryEntry = {
      id: `entry_${Date.now()}`,
      date: new Date(),
      type: 'manual',
      content,
    };

    const updates: Partial<{ diary: DiaryEntry[]; lastInteraction: Date; nextAction: string; nextActionDate: string }> = {
      diary: [...(dossier.diary || []), entry],
      lastInteraction: new Date(),
    };

    if (stepNextAction.trim()) {
      updates.nextAction = stepNextAction.trim();
      setEditNextAction(stepNextAction.trim());
    }
    if (stepNextDate) {
      updates.nextActionDate = stepNextDate;
      setEditNextActionDate(stepNextDate);
    }

    updateDossier(id!, updates);

    setIsNextStepOpen(false);
    setStepInteractionType('meeting');
    setStepResult('');
    setStepNextAction('');
    setStepNextDate('');
  };

  const handleAddPreparationEntry = () => {
    const preparationTemplate = `1. Что сделать для развития отношений?
План:
Результат:

2. Как узнать о человеке больше
План:
Результат:

3. Что я могу дать?
План:
Результат:

4. Что попросить?
План:
Результат:

5. Как обеспечить следующею встречу?
План:
Результат:`;
    setNewEntry(preparationTemplate);
    setIsAddingEntry(true);
  };

  const handleStartEditEntry = (entry: DiaryEntry) => {
    setEditingEntryId(entry.id);
    setEditingEntryContent(entry.content);
    setIsAddingEntry(false);
  };

  const handleSaveEditEntry = () => {
    if (editingEntryContent.trim() && editingEntryId) {
      const updatedDiary = (dossier.diary || []).map((entry) =>
        entry.id === editingEntryId
          ? { ...entry, content: editingEntryContent.trim() }
          : entry
      );
      updateDossier(id!, {
        diary: updatedDiary,
      });
      setEditingEntryId(null);
      setEditingEntryContent('');
    }
  };

  const handleCancelEditEntry = () => {
    setEditingEntryId(null);
    setEditingEntryContent('');
  };

  const handleDeleteEntry = (entryId: string) => {
    Alert.alert(
      t.contact.deleteEntry,
      t.contact.removeEntry,
      [
        { text: t.contact.cancel, style: 'cancel' },
        {
          text: t.contact.delete,
          style: 'destructive',
          onPress: () => {
            const updatedDiary = (dossier.diary || []).filter(
              (entry) => entry.id !== entryId
            );
            updateDossier(id!, {
              diary: updatedDiary,
            });
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t.contact.deleteDossier,
      t.contact.removeDossierMessage.replace('{{name}}', dossier.contact.name),
      [
        { text: t.contact.cancel, style: 'cancel' },
        {
          text: t.contact.delete,
          style: 'destructive',
          onPress: () => {
            deleteDossier(id!);
            router.back();
          },
        },
      ]
    );
  };

  const pickImageWeb = useCallback(() => {
    return new Promise<string | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }, []);

  const pickImage = async () => {
    try {
      if (Platform.OS === 'web') {
        const dataUrl = await pickImageWeb();
        if (!dataUrl) return;
        setEditPhoto(dataUrl);
        console.log('[Dossier] Photo picked via web file input');
        if (dossier && id) {
          updateDossier(id, {
            contact: { ...dossier.contact, photo: dataUrl },
          });
        }
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(t.contact.permissionRequired, t.contact.cameraRollPermission);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newPhotoUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setEditPhoto(newPhotoUri);
        console.log('[Dossier] Photo picked, base64:', !!asset.base64);
        
        if (dossier && id) {
          updateDossier(id, {
            contact: {
              ...dossier.contact,
              photo: newPhotoUri,
            },
          });
        }
      }
    } catch (e) {
      console.log('[Dossier] pickImage error', e);
    }
  };

  const removePhoto = () => {
    Alert.alert(
      t.contact.removePhoto,
      t.contact.removeContactPhoto,
      [
        { text: t.contact.cancel, style: 'cancel' },
        {
          text: t.contact.remove,
          style: 'destructive',
          onPress: () => setEditPhoto(undefined),
        },
      ]
    );
  };

  const handleSetPowerGroup = (groupName: string) => {
    setEditPowerGroupName(groupName);
    if (!powerGroupings.includes(groupName)) {
      addPowerGrouping(groupName);
    }
  };

  const handleSetSuzerain = (suzerainId: string) => {
    setEditSuzerainId(suzerainId);
    
    const hasRelation = editRelations.find(r => r.contactId === suzerainId);
    if (!hasRelation) {
      setEditRelations([...editRelations, { contactId: suzerainId, strength: 5 }]);
    }
    
    const suzerainDossier = dossiers.find(d => d.contact.id === suzerainId);
    if (suzerainDossier && suzerainDossier.powerGrouping?.groupName) {
      setEditPowerGroupName(suzerainDossier.powerGrouping.groupName);
      if (!powerGroupings.includes(suzerainDossier.powerGrouping.groupName)) {
        addPowerGrouping(suzerainDossier.powerGrouping.groupName);
      }
    }

    setTimeout(() => {
      if (suzerainDossier) {
        const updatedVassals = suzerainDossier.powerGrouping?.vassalIds || [];
        const needsVassalUpdate = !updatedVassals.includes(id!);
        const hasReciprocalRelation = suzerainDossier.relations.find(r => r.contactId === id);

        if (needsVassalUpdate || !hasReciprocalRelation) {
          const updatedRelations = hasReciprocalRelation
            ? suzerainDossier.relations
            : [...suzerainDossier.relations, { contactId: id!, strength: 5 }];

          updateDossier(suzerainId, {
            powerGrouping: {
              groupName: suzerainDossier.powerGrouping?.groupName || editPowerGroupName,
              suzerainId: suzerainDossier.powerGrouping?.suzerainId,
              vassalIds: needsVassalUpdate ? [...updatedVassals, id!] : updatedVassals,
            },
            relations: updatedRelations,
          });
          console.log('[Dossier] handleSetSuzerain: updated suzerain', suzerainId, 'added vassal:', id);
        }
      }
    }, 100);
  };

  const handleRemoveSuzerain = () => {
    const oldSuzerainId = editSuzerainId;
    setEditSuzerainId(undefined);

    if (oldSuzerainId) {
      setTimeout(() => {
        const suzerainDossier = dossiers.find(d => d.contact.id === oldSuzerainId);
        if (suzerainDossier && suzerainDossier.powerGrouping) {
          updateDossier(oldSuzerainId, {
            powerGrouping: {
              ...suzerainDossier.powerGrouping,
              vassalIds: suzerainDossier.powerGrouping.vassalIds.filter(vid => vid !== id),
            },
          });
        }
      }, 100);
    }
  };

  const handleAddVassal = (vassalId: string) => {
    setEditVassalIds([...editVassalIds, vassalId]);

    const hasRelation = editRelations.find(r => r.contactId === vassalId);
    if (!hasRelation) {
      setEditRelations([...editRelations, { contactId: vassalId, strength: 5 }]);
    }

    setTimeout(() => {
      const vassalDossier = dossiers.find(d => d.contact.id === vassalId);
      if (vassalDossier) {
        const hasReciprocalRelation = vassalDossier.relations.find(r => r.contactId === id);
        const updatedRelations = hasReciprocalRelation
          ? vassalDossier.relations
          : [...vassalDossier.relations, { contactId: id!, strength: 5 }];

        updateDossier(vassalId, {
          powerGrouping: {
            groupName: editPowerGroupName,
            suzerainId: id,
            vassalIds: vassalDossier.powerGrouping?.vassalIds || [],
          },
          relations: updatedRelations,
        });
        console.log('[Dossier] handleAddVassal: assigned vassal', vassalId, 'group:', editPowerGroupName, 'suzerain:', id);
      }
    }, 100);
  };

  const handleRemoveVassal = (vassalId: string) => {
    setEditVassalIds(editVassalIds.filter(vid => vid !== vassalId));

    setTimeout(() => {
      const vassalDossier = dossiers.find(d => d.contact.id === vassalId);
      if (vassalDossier && vassalDossier.powerGrouping?.suzerainId === id) {
        updateDossier(vassalId, {
          powerGrouping: undefined,
        });
      }
    }, 100);
  };

  const handleAddNewGroupName = () => {
    if (newGroupName.trim() && !powerGroupings.includes(newGroupName.trim())) {
      addPowerGrouping(newGroupName.trim());
      setEditPowerGroupName(newGroupName.trim());
      setNewGroupName('');
      setIsAddingNewGroupName(false);
    }
  };

  return (
    <View style={styles.background}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={theme.background === '#000000' ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={24} color={theme.primary} />
          </TouchableOpacity>
          <FileText size={24} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>{t.contact.dossier}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)} activeOpacity={0.7}>
            <Edit3 size={20} color={isEditing ? theme.warning : theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
            <Trash2 size={20} color={theme.danger} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.profileSection}>
            <View style={styles.photoAndMapRow}>
              <View style={styles.photoSection}>
                {editPhoto || dossier.contact.photo ? (
                  <View style={styles.photoContainer}>
                    <Image
                      source={{ uri: editPhoto || dossier.contact.photo }}
                      style={styles.photo}
                      contentFit="cover"
                    />
                    {isEditing && (
                      <TouchableOpacity
                        style={styles.photoEditButton}
                        onPress={pickImage}
                        activeOpacity={0.7}
                      >
                        <Camera size={16} color={theme.background} />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <UserCircle2 size={60} color={theme.primaryDim} strokeWidth={1} />
                  </View>
                )}
                {isEditing && (
                  <View style={styles.photoActions}>
                    <TouchableOpacity
                      style={styles.photoActionButton}
                      onPress={pickImage}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.photoActionText}>
                        {editPhoto || dossier.contact.photo ? t.contact.change : t.contact.addPhoto}
                      </Text>
                    </TouchableOpacity>
                    {(editPhoto || dossier.contact.photo) && (
                      <TouchableOpacity
                        style={styles.photoActionButton}
                        onPress={removePhoto}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.photoActionText, { color: theme.danger }]}>
                          {t.contact.remove}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.networkMapSection}>
                <TouchableOpacity
                  style={styles.networkMapButton}
                  onPress={() => router.push('/network')}
                  activeOpacity={0.7}
                >
                  <Network size={24} color={theme.primary} strokeWidth={1.5} />
                  <Text style={styles.networkMapText}>{t.contact.networkMap}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {isEditing ? (
              <>
                <Text style={styles.editLabel}>{t.contact.name}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholderTextColor={theme.primaryDim}
                />
                <Text style={styles.editLabel}>{t.contact.position}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editPosition}
                  onChangeText={setEditPosition}
                  placeholderTextColor={theme.primaryDim}
                  placeholder={t.contact.optional}
                />
                <Text style={styles.editLabel}>{t.contact.company}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editCompany}
                  onChangeText={setEditCompany}
                  placeholderTextColor={theme.primaryDim}
                  placeholder={t.contact.optional}
                />
                <Text style={styles.editLabel}>{(t.contact as any).birthday ?? 'BIRTHDAY'}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editBirthday}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    let formatted = cleaned;
                    const prev = editBirthday;
                    if (cleaned.length === 2 && prev.length < 2) formatted = cleaned + '.';
                    else if (cleaned.length === 5 && prev.length < 5 && cleaned[2] === '.') formatted = cleaned + '.';
                    if (formatted.length > 10) formatted = formatted.slice(0, 10);
                    setEditBirthday(formatted);
                  }}
                  placeholderTextColor={theme.primaryDim}
                  placeholder={(t.contact as any).birthdayPlaceholder ?? 'DD.MM.YYYY'}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <Text style={styles.editLabel}>{t.contact.nextAction ?? 'NEXT ACTION'}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editNextAction}
                  onChangeText={setEditNextAction}
                  placeholderTextColor={theme.primaryDim}
                  placeholder={t.contact.nextActionPlaceholder ?? 'What to do next...'}
                />
                <Text style={styles.editLabel}>{t.contact.nextActionDate ?? 'ACTION DATE'}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editNextActionDate}
                  onChangeText={setEditNextActionDate}
                  placeholderTextColor={theme.primaryDim}
                  placeholder="2026-06-01"
                />
              </>
            ) : (
              <>
                <View style={styles.nameContainer}>
                  <Text style={styles.name}>{dossier.contact.name}</Text>
                  <View
                    style={[
                      styles.importanceBadge,
                      { borderColor: getImportanceColor(dossier.importance) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.importanceText,
                        { color: getImportanceColor(dossier.importance) },
                      ]}
                    >
                      {(t.contact as any)[dossier.importance]?.toUpperCase() ?? dossier.importance.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {dossier.contact.position ? (
                  <View style={styles.metaRow}>
                    <Briefcase size={16} color={theme.primaryDim} />
                    <Text style={styles.metaText}>{dossier.contact.position}</Text>
                  </View>
                ) : null}
                {dossier.contact.company ? (
                  <Text style={styles.company}>{dossier.contact.company}</Text>
                ) : null}
                {dossier.contact.birthday ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{(t.contact as any).birthday ?? 'BIRTHDAY'}: {dossier.contact.birthday}</Text>
                  </View>
                ) : null}
                {dossier.nextAction ? (
                  <View style={styles.nextActionContainer}>
                    <Text style={styles.nextActionLabel}>{t.contact.nextAction ?? 'NEXT ACTION'}</Text>
                    <Text style={styles.nextActionText}>{dossier.nextAction}</Text>
                    {dossier.nextActionDate ? (
                      <Text style={styles.nextActionDate}>{dossier.nextActionDate}</Text>
                    ) : null}
                  </View>
                ) : null}

              </>
            )}
          </View>

          <View style={styles.section}>
            {Platform.OS !== 'web' && !isEditing && dossier.contact.phoneNumbers.length > 0 && (
              <TouchableOpacity
                style={styles.openInPhoneButton}
                onPress={async () => {
                  try {
                    const { status } = await Contacts.requestPermissionsAsync();
                    if (status === 'granted') {
                      const { data } = await Contacts.getContactsAsync({
                        fields: [Contacts.Fields.PhoneNumbers],
                      });
                      const existingContact = data.find(c =>
                        c.phoneNumbers?.some(p =>
                          dossier.contact.phoneNumbers.includes(p.number || '')
                        )
                      );
                      if (existingContact && existingContact.id) {
                        if (Platform.OS === 'ios') {
                          void Linking.openURL(`contacts://${existingContact.id}`);
                        } else {
                          void Linking.openURL(`content://contacts/people/${existingContact.id}`);
                        }
                      } else {
                        Alert.alert(t.contact.contactNotFound, t.contact.contactNotFoundMessage);
                      }
                    }
                  } catch (error) {
                    console.error('Failed to open contact:', error);
                  }
                }}
                activeOpacity={0.7}
                testID="openInPhoneButton"
              >
                <PhoneCall size={14} color={theme.primary} />
                <Text style={styles.openInPhoneText}>{t.contact.openInPhone}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.sectionTitle}>{t.contact.contactInfo}</Text>
            {isEditing ? (
              <>
                <Text style={styles.editLabel}>{t.contact.phones}</Text>
                {editPhones.map((phone, idx) => (
                  <View key={idx} style={styles.editRowContainer}>
                    <TextInput
                      style={[styles.editInput, { flex: 1 }]}
                      value={phone}
                      onChangeText={(text) => {
                        const newPhones = [...editPhones];
                        newPhones[idx] = text;
                        setEditPhones(newPhones);
                      }}
                      placeholderTextColor={theme.primaryDim}
                      keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                      onPress={() => setEditPhones(editPhones.filter((_, i) => i !== idx))}
                      activeOpacity={0.7}
                    >
                      <X size={16} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addFieldButton}
                  onPress={() => setEditPhones([...editPhones, ''])}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addFieldText}>{t.contact.addPhone}</Text>
                </TouchableOpacity>

                <Text style={styles.editLabel}>{t.contact.emails}</Text>
                {editEmails.map((email, idx) => (
                  <View key={idx} style={styles.editRowContainer}>
                    <TextInput
                      style={[styles.editInput, { flex: 1 }]}
                      value={email}
                      onChangeText={(text) => {
                        const newEmails = [...editEmails];
                        newEmails[idx] = text;
                        setEditEmails(newEmails);
                      }}
                      placeholderTextColor={theme.primaryDim}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setEditEmails(editEmails.filter((_, i) => i !== idx))}
                      activeOpacity={0.7}
                    >
                      <X size={16} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addFieldButton}
                  onPress={() => setEditEmails([...editEmails, ''])}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addFieldText}>{t.contact.addEmail}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {(dossier.contact.phoneNumbers || []).map((phone, idx) => (
                  <View key={idx} style={styles.infoRow}>
                    <Phone size={16} color={theme.primary} />
                    <Text style={styles.infoText}>{phone}</Text>
                  </View>
                ))}
                {dossier.contact.emails?.map((email, idx) => (
                  <View key={idx} style={styles.infoRow}>
                    <Mail size={16} color={theme.primary} />
                    <Text style={styles.infoText}>{email}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          {(() => {
            const contactId = Array.isArray(id) ? id[0] : id;
            if (!contactId) return null;
            const linkedGoals = goals.filter(g => (g.contactIds || []).includes(contactId));
            return (
              <View style={styles.section}>
                <View style={styles.goalsSectionHeader}>
                  <Target size={16} color={theme.primary} />
                  <Text style={styles.sectionTitle}>{t.contact.goal ?? 'ЦЕЛИ'}</Text>
                </View>
                {linkedGoals.length > 0 ? (
                  <View style={styles.goalCardsContainer}>
                    {linkedGoals.map(g => (
                      <TouchableOpacity
                        key={g.id}
                        style={styles.goalCard}
                        activeOpacity={0.7}
                        onPress={() => router.push({ pathname: '/(tabs)/strategy', params: { goalId: g.id } })}
                        testID={`goalCard_${g.id}`}
                      >
                        <View style={styles.goalCardContent}>
                          <View style={styles.goalCardTop}>
                            <Text style={styles.goalCardTitle} numberOfLines={1}>{g.title}</Text>
                            {g.priority > 0 ? (
                              <View style={styles.goalCardDotsRow}>
                                {Array.from({ length: 10 }, (_, i) => {
                                  const color = g.priority >= 8 ? theme.danger : g.priority >= 5 ? (theme.warning ?? '#f59e0b') : (theme.success ?? '#10b981');
                                  return (
                                    <View
                                      key={i}
                                      style={[
                                        styles.goalCardDot,
                                        i < g.priority
                                          ? { backgroundColor: color }
                                          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
                                      ]}
                                    />
                                  );
                                })}
                              </View>
                            ) : null}
                          </View>
                          {g.description ? (
                            <Text style={styles.goalCardDescription} numberOfLines={1}>{g.description}</Text>
                          ) : null}
                        </View>
                        <ChevronRight size={14} color={theme.primaryDim} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noContactsText}>{t.contact.linkedGoals ?? 'Добавьте контакт в цели на вкладке ЦЕЛЬ'}</Text>
                )}
              </View>
            );
          })()}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.contact.classification}</Text>
            {isEditing ? (
              <>
                <Text style={styles.editLabel}>{t.contact.importance}</Text>
                <View style={styles.optionsRow}>
                  {importanceLevels.map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.optionButton,
                        editImportance === level && styles.optionButtonActive,
                        { borderColor: getImportanceColor(level) },
                      ]}
                      onPress={() => setEditImportance(level)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: getImportanceColor(level) },
                          editImportance === level && styles.optionTextActive,
                        ]}
                      >
                        {(t.contact as any)[level]?.toUpperCase() ?? level.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.editLabel}>{t.contact.sector}</Text>
                <View style={styles.optionsRow}>
                  {sectors.map((sector) => {
                    const isSelected = editSectors.includes(sector);
                    return (
                      <TouchableOpacity
                        key={sector}
                        style={[
                          styles.optionButton,
                          isSelected && styles.optionButtonActive,
                        ]}
                        onPress={() => {
                          setEditSectors([sector]);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            isSelected && styles.optionTextActive,
                          ]}
                        >
                          {sector.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.editLabel}>{t.contact.circle}</Text>
                <View style={styles.optionsRow}>
                  {circles.map((circle) => (
                    <TouchableOpacity
                      key={circle}
                      style={[
                        styles.optionButton,
                        editCircle === circle && styles.optionButtonActive,
                      ]}
                      onPress={() => setEditCircle(circle)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          editCircle === circle && styles.optionTextActive,
                        ]}
                      >
                        {circle.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.classificationGrid}>
                <View style={[styles.classItem, { flex: 2 }]}>
                  <Text style={styles.classLabel}>{t.contact.sector}</Text>
                  <Text style={styles.classValue}>
                    {(dossier.sectors || []).length > 0 
                      ? (dossier.sectors || [])[0].toUpperCase()
                      : t.contact.none}
                  </Text>
                </View>
                <View style={styles.classItem}>
                  <Text style={styles.classLabel}>{t.contact.circle}</Text>
                  <Text style={styles.classValue}>
                    {dossier.functionalCircle.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.classItem}>
                  <Text style={styles.classLabel}>{t.contact.relations}</Text>
                  <Text style={styles.classValue}>{(dossier.relations || []).length}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => {
                setIsConnectionsExpanded(!isConnectionsExpanded);
                if (!isConnectionsExpanded) {
                  setSearchConnection('');
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeader}>
                <Users size={20} color={theme.primary} />
                <Text style={styles.sectionTitle}>{t.contact.knownConnections}</Text>
              </View>
              <Text style={styles.expandIcon}>{isConnectionsExpanded ? '−' : '+'}</Text>
            </TouchableOpacity>
            {isConnectionsExpanded && (
              <View style={styles.collapsibleContent}>
                <TextInput
                  style={styles.searchInput}
                  placeholder={t.contact.searchByName}
                  placeholderTextColor={theme.primaryDim}
                  value={searchConnection}
                  onChangeText={setSearchConnection}
                  autoFocus
                />
                {editRelations.map((relation, idx) => {
                  const relatedContact = dossiers.find(
                    (d) => d.contact.id === relation.contactId
                  );
                  if (searchConnection && !relatedContact?.contact.name.toLowerCase().includes(searchConnection.toLowerCase())) {
                    return null;
                  }
                  return (
                    <View key={idx} style={styles.editRelationRow}>
                      <View style={styles.editRelationHeader}>
                        <Text style={styles.relationName}>
                          {relatedContact?.contact.name || t.dossiers.unknown}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setEditRelations(editRelations.filter((_, i) => i !== idx));
                          }}
                          activeOpacity={0.7}
                        >
                          <X size={16} color={theme.danger} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.strengthControl}>
                        <Text style={styles.strengthLabel}>{t.contact.strength}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const newRelations = [...editRelations];
                            newRelations[idx] = {
                              ...newRelations[idx],
                              strength: Math.max(1, newRelations[idx].strength - 1),
                            };
                            setEditRelations(newRelations);
                          }}
                          activeOpacity={0.7}
                          disabled={relation.strength <= 1}
                        >
                          <Minus
                            size={16}
                            color={relation.strength <= 1 ? theme.border : theme.primary}
                          />
                        </TouchableOpacity>
                        <Text style={styles.strengthValue}>{relation.strength}/10</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const newRelations = [...editRelations];
                            newRelations[idx] = {
                              ...newRelations[idx],
                              strength: Math.min(10, newRelations[idx].strength + 1),
                            };
                            setEditRelations(newRelations);
                          }}
                          activeOpacity={0.7}
                          disabled={relation.strength >= 10}
                        >
                          <Plus
                            size={16}
                            color={relation.strength >= 10 ? theme.border : theme.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
                <View style={styles.addRelationSection}>
                  <Text style={styles.editLabel}>{t.contact.addConnection}</Text>
                  {dossiers
                    .filter(
                      (d) =>
                        d.contact.id !== id &&
                        !editRelations.find((r) => r.contactId === d.contact.id) &&
                        (!searchConnection || d.contact.name.toLowerCase().includes(searchConnection.toLowerCase()))
                    )
                    .map((d) => (
                      <TouchableOpacity
                        key={d.contact.id}
                        style={styles.availableContactRow}
                        onPress={() => {
                          const newRelation = { contactId: d.contact.id, strength: 5 };
                          setEditRelations([...editRelations, newRelation]);
                          
                          setTimeout(() => {
                            const targetDossier = dossiers.find(dossier => dossier.contact.id === d.contact.id);
                            if (targetDossier && id) {
                              const hasReciprocal = targetDossier.relations.find(r => r.contactId === id);
                              if (!hasReciprocal) {
                                updateDossier(d.contact.id, {
                                  relations: [...targetDossier.relations, { contactId: id, strength: 5 }],
                                });
                              }
                            }
                          }, 100);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.availableContactName}>
                          {d.contact.name}
                        </Text>
                        <Plus size={16} color={theme.primary} />
                      </TouchableOpacity>
                    ))}
                  {dossiers.filter(
                    (d) =>
                      d.contact.id !== id &&
                      !editRelations.find((r) => r.contactId === d.contact.id) &&
                      (!searchConnection || d.contact.name.toLowerCase().includes(searchConnection.toLowerCase()))
                  ).length === 0 && (
                    <Text style={styles.noContactsText}>
                      {searchConnection ? t.contact.noMatchesFound : editRelations.length === dossiers.length - 1
                        ? t.contact.allContactsConnected
                        : t.contact.noOtherContacts}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => {
                setIsPowerGroupingExpanded(!isPowerGroupingExpanded);
                if (!isPowerGroupingExpanded) {
                  setSearchPowerContact('');
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeader}>
                <Triangle size={20} color="#8B0000" />
                <Text style={styles.sectionTitle}>{t.contact.powerGrouping}</Text>
              </View>
              <Text style={styles.expandIcon}>{isPowerGroupingExpanded ? '−' : '+'}</Text>
            </TouchableOpacity>
            {!isPowerGroupingExpanded && editPowerGroupName && (
              <Text style={styles.powerGroupCollapsedName}>{editPowerGroupName.toUpperCase()}</Text>
            )}
            {isPowerGroupingExpanded && (
              <View style={styles.collapsibleContent}>
                <Text style={styles.editLabel}>{t.contact.groupingName}</Text>
                {isAddingNewGroupName ? (
                  <View>
                    <TextInput
                      style={styles.editInput}
                      value={newGroupName}
                      onChangeText={setNewGroupName}
                      placeholder={t.contact.enterNewGroupingName}
                      placeholderTextColor={theme.primaryDim}
                      autoFocus
                    />
                    <View style={styles.formButtons}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setIsAddingNewGroupName(false);
                          setNewGroupName('');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cancelButtonText}>{t.contact.cancel}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleAddNewGroupName}
                        activeOpacity={0.7}
                        disabled={!newGroupName.trim()}
                      >
                        <Text style={styles.saveButtonText}>{t.profile.add}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.optionsRow}>
                      {powerGroupings.map((grouping) => (
                        <TouchableOpacity
                          key={grouping}
                          style={[
                            styles.optionButton,
                            editPowerGroupName === grouping && styles.optionButtonActive,
                          ]}
                          onPress={() => handleSetPowerGroup(grouping)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              editPowerGroupName === grouping && styles.optionTextActive,
                            ]}
                          >
                            {grouping.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={styles.addFieldButton}
                      onPress={() => setIsAddingNewGroupName(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addFieldText}>{t.contact.createNewGrouping}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {editPowerGroupName && (
                  <>
                    <Text style={[styles.editLabel, { marginTop: 24 }]}>{t.contact.suzerain}</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder={t.contact.searchByName}
                      placeholderTextColor={theme.primaryDim}
                      value={searchPowerContact}
                      onChangeText={setSearchPowerContact}
                    />
                    {editSuzerainId && (
                      <View style={styles.editRelationRow}>
                        <View style={styles.editRelationHeader}>
                          <Text style={styles.relationName}>
                            {dossiers.find(d => d.contact.id === editSuzerainId)?.contact.name || t.dossiers.unknown}
                          </Text>
                          <TouchableOpacity
                            onPress={handleRemoveSuzerain}
                            activeOpacity={0.7}
                          >
                            <X size={16} color={theme.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    {!editSuzerainId && (
                      <ScrollView style={styles.contactsList} nestedScrollEnabled>
                        {dossiers
                          .filter(
                            (d) =>
                              d.contact.id !== id &&
                              (!searchPowerContact || d.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase()))
                          )
                          .map((d) => (
                            <TouchableOpacity
                              key={d.contact.id}
                              style={styles.availableContactRow}
                              onPress={() => handleSetSuzerain(d.contact.id)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.availableContactName}>
                                {d.contact.name}
                              </Text>
                              <Plus size={16} color={theme.primary} />
                            </TouchableOpacity>
                          ))}
                        {dossiers.filter(
                          (d) =>
                            d.contact.id !== id &&
                            (!searchPowerContact || d.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase()))
                        ).length === 0 && (
                          <Text style={styles.noContactsText}>
                            {searchPowerContact ? t.contact.noMatchesFound : t.contact.noOtherContacts}
                          </Text>
                        )}
                      </ScrollView>
                    )}

                    <Text style={[styles.editLabel, { marginTop: 24 }]}>{t.contact.vassals}</Text>
                    {editVassalIds.map((vassalId) => {
                      const vassalContact = dossiers.find(d => d.contact.id === vassalId);
                      if (searchPowerContact && !vassalContact?.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase())) {
                        return null;
                      }
                      return (
                        <View key={vassalId} style={styles.editRelationRow}>
                          <View style={styles.editRelationHeader}>
                            <Text style={styles.relationName}>
                              {vassalContact?.contact.name || t.dossiers.unknown}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleRemoveVassal(vassalId)}
                              activeOpacity={0.7}
                            >
                              <X size={16} color={theme.danger} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                    <View style={styles.addRelationSection}>
                      <Text style={styles.editLabel}>{t.contact.addVassal}</Text>
                      <ScrollView style={styles.contactsList} nestedScrollEnabled>
                        {dossiers
                          .filter(
                            (d) =>
                              d.contact.id !== id &&
                              !editVassalIds.includes(d.contact.id) &&
                              d.contact.id !== editSuzerainId &&
                              (!d.powerGrouping || !d.powerGrouping.groupName || d.powerGrouping.groupName === editPowerGroupName) &&
                              (!searchPowerContact || d.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase()))
                          )
                          .map((d) => (
                            <TouchableOpacity
                              key={d.contact.id}
                              style={styles.availableContactRow}
                              onPress={() => handleAddVassal(d.contact.id)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.availableContactName}>
                                {d.contact.name}
                              </Text>
                              <Plus size={16} color={theme.primary} />
                            </TouchableOpacity>
                          ))}
                        {dossiers.filter(
                          (d) =>
                            d.contact.id !== id &&
                            !editVassalIds.includes(d.contact.id) &&
                            d.contact.id !== editSuzerainId &&
                            (!d.powerGrouping || !d.powerGrouping.groupName || d.powerGrouping.groupName === editPowerGroupName) &&
                            (!searchPowerContact || d.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase()))
                        ).length === 0 && (
                          <Text style={styles.noContactsText}>
                            {searchPowerContact ? t.contact.noMatchesFound : t.contact.noAvailableContacts}
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          <View
            style={styles.section}
            onLayout={(e) => {
              maintenanceSectionY.current = e.nativeEvent.layout.y;
              if ((section === 'maintenance' || section === 'diary') && !hasScrolledToMaintenance.current) {
                hasScrolledToMaintenance.current = true;
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: true });
                }, 300);
              }
            }}
          >
            <View style={styles.maintenanceHeaderRow}>
              <View style={styles.sectionHeader}>
                <BookOpen size={20} color={theme.primary} />
                <Text style={styles.sectionTitle}>{t.contact.maintainConnection}</Text>
              </View>
              {maintenanceInfo && (
                <View style={[
                  styles.maintenanceBadge,
                  {
                    borderColor: getMaintenanceBadgeColor(maintenanceInfo.status),
                    opacity: maintenanceInfo.status === 'inactive' ? 0.5 : 1,
                  },
                ]}>
                  <Text style={[
                    styles.maintenanceBadgeText,
                    { color: getMaintenanceBadgeColor(maintenanceInfo.status) },
                  ]}>
                    {getMaintenanceBadgeText()}
                  </Text>
                </View>
              )}
            </View>
            
            {!isAddingEntry && !isNextStepOpen && (
              <View style={styles.diaryButtonsColumn}>
                <TouchableOpacity
                  style={styles.nextStepButton}
                  onPress={() => setIsNextStepOpen(true)}
                  activeOpacity={0.7}
                >
                  <ArrowRight size={18} color={theme.background} />
                  <Text style={styles.nextStepButtonText}>{t.contact.nextStepButton}</Text>
                </TouchableOpacity>
                <View style={styles.diaryButtonsContainer}>
                  <TouchableOpacity
                    style={styles.addEntryButton}
                    onPress={() => setIsAddingEntry(true)}
                    activeOpacity={0.7}
                  >
                    <Edit3 size={16} color={theme.primary} />
                    <Text style={styles.addEntryText}>{t.contact.addEntry}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addEntryButton}
                    onPress={handleAddPreparationEntry}
                    activeOpacity={0.7}
                  >
                    <Edit3 size={16} color={theme.primary} />
                    <Text style={styles.addEntryText}>{t.contact.preparation}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isNextStepOpen && (
              <View style={styles.nextStepForm}>
                <Text style={styles.nextStepFormTitle}>{t.contact.nextStepButton}</Text>

                <Text style={styles.nextStepLabel}>{t.contact.interactionType}</Text>
                <View style={styles.interactionTypeGrid}>
                  {interactionTypes.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = stepInteractionType === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.interactionTypeItem,
                          isSelected && styles.interactionTypeItemSelected,
                        ]}
                        onPress={() => setStepInteractionType(item.key)}
                        activeOpacity={0.7}
                      >
                        <IconComp size={16} color={isSelected ? theme.background : theme.primary} />
                        <Text
                          style={[
                            styles.interactionTypeLabel,
                            isSelected && styles.interactionTypeLabelSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.nextStepLabel}>{t.contact.interactionResult}</Text>
                <TextInput
                  style={styles.nextStepInput}
                  placeholder={t.contact.resultPlaceholder}
                  placeholderTextColor={theme.primaryDim}
                  value={stepResult}
                  onChangeText={setStepResult}
                  multiline
                />

                <Text style={styles.nextStepLabel}>{t.contact.plannedNextStep}</Text>
                <TextInput
                  style={styles.nextStepInputSmall}
                  placeholder={t.contact.nextActionPlaceholder}
                  placeholderTextColor={theme.primaryDim}
                  value={stepNextAction}
                  onChangeText={setStepNextAction}
                />

                <Text style={styles.nextStepLabel}>{t.contact.nextStepDateLabel}</Text>
                <TextInput
                  style={styles.nextStepInputSmall}
                  placeholder="DD.MM.YYYY"
                  placeholderTextColor={theme.primaryDim}
                  value={stepNextDate}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    let formatted = cleaned;
                    const prev = stepNextDate;
                    if (cleaned.length === 2 && prev.length < 2) formatted = cleaned + '.';
                    else if (cleaned.length === 5 && prev.length < 5 && cleaned[2] === '.') formatted = cleaned + '.';
                    if (formatted.length > 10) formatted = formatted.slice(0, 10);
                    setStepNextDate(formatted);
                  }}
                  maxLength={10}
                  keyboardType="numeric"
                />

                <View style={[styles.formButtons, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setIsNextStepOpen(false);
                      setStepResult('');
                      setStepNextAction('');
                      setStepNextDate('');
                      setStepInteractionType('meeting');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>{t.contact.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, !stepResult.trim() && { opacity: 0.4 }]}
                    onPress={handleSaveNextStep}
                    activeOpacity={0.7}
                    disabled={!stepResult.trim()}
                  >
                    <Text style={styles.saveButtonText}>{t.contact.saveStep}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {(dossier.diary || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry) => (
              <View key={entry.id}>
                {editingEntryId === entry.id ? (
                  <View style={styles.addEntryForm}>
                    <TextInput
                      style={styles.entryInput}
                      placeholder={t.contact.enterInteractionDetails}
                      placeholderTextColor={theme.primaryDim}
                      value={editingEntryContent}
                      onChangeText={setEditingEntryContent}
                      multiline
                      autoFocus
                    />
                    <View style={styles.formButtons}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancelEditEntry}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cancelButtonText}>{t.contact.cancel}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSaveEditEntry}
                        activeOpacity={0.7}
                        disabled={!editingEntryContent.trim()}
                      >
                        <Text style={styles.saveButtonText}>{t.contact.save}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.diaryEntry}>
                    <View style={styles.diaryHeader}>
                      <View style={styles.diaryHeaderLeft}>
                        <Text style={styles.diaryType}>
                          [{entry.type.toUpperCase()}]
                        </Text>
                        <Text style={styles.diaryDate}>
                          {new Date(entry.date).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.diaryActions}>
                        <TouchableOpacity
                          onPress={() => handleStartEditEntry(entry)}
                          activeOpacity={0.7}
                        >
                          <Edit3 size={14} color={theme.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteEntry(entry.id)}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={14} color={theme.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.diaryContent}>{entry.content}</Text>
                  </View>
                )}
              </View>
            ))}

            {isAddingEntry && (
              <View style={styles.addEntryForm}>
                <TextInput
                  style={styles.entryInput}
                  placeholder={t.contact.enterInteractionDetails}
                  placeholderTextColor={theme.primaryDim}
                  value={newEntry}
                  onChangeText={setNewEntry}
                  multiline
                  autoFocus
                />
                <View style={styles.formButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setIsAddingEntry(false);
                      setNewEntry('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>{t.contact.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleAddEntry}
                    activeOpacity={0.7}
                    disabled={!newEntry.trim()}
                  >
                    <Text style={styles.saveButtonText}>{t.contact.save}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <OsintBlock
            contactId={id!}
            contact={dossier.contact}
            relations={dossier.relations}
            powerGrouping={dossier.powerGrouping}
            allContactNames={allContactNamesMap}
          />

          </ScrollView>
        </KeyboardAvoidingView>
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
  },
  flex: {
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
    fontSize: 20,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
    padding: 20,
    backgroundColor: theme.overlay,
  },
  photoAndMapRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 16,
  },
  photoSection: {
    alignItems: 'center',
    flex: 1,
  },
  networkMapSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkMapButton: {
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.overlay,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  networkMapText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1.5,
    textAlign: 'center' as const,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.primary,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.overlay,
  },
  photoEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.background,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  photoActionButton: {
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  photoActionText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    flex: 1,
  },
  importanceBadge: {
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: '700' as const,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  company: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  goal: {
    fontSize: 14,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  goalLabel: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
  },
  goalValue: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    flex: 1,
    flexWrap: 'wrap' as const,
  },
  section: {
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitleContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  openInPhoneButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.primary,
    alignSelf: 'flex-start' as const,
  },
  openInPhoneText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  classificationGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  classItem: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 12,
    alignItems: 'center',
  },
  classLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  classValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
  },
  diaryEntry: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 12,
    marginBottom: 12,
  },
  diaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  diaryHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  diaryActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  diaryType: {
    fontSize: 10,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
  },
  diaryDate: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  diaryContent: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    lineHeight: 18,
  },
  diaryButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  diaryButtonsColumn: {
    gap: 12,
  },
  nextStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingVertical: 14,
    gap: 8,
  },
  nextStepButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: theme.background,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  nextStepForm: {
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.overlay,
    padding: 16,
    marginBottom: 12,
  },
  nextStepFormTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  nextStepLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 12,
  },
  interactionTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interactionTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: theme.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  interactionTypeItemSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.primary,
  },
  interactionTypeLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
  },
  interactionTypeLabelSelected: {
    color: theme.background,
  },
  nextStepInput: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 2,
    borderColor: theme.border,
    padding: 10,
    backgroundColor: theme.background,
  },
  nextStepInputSmall: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 10,
    backgroundColor: theme.background,
  },
  addEntryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
    paddingVertical: 12,
    gap: 8,
  },
  addEntryText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  addEntryForm: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 12,
  },
  entryInput: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    minHeight: 240,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
  },
  saveButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.primary,
    paddingVertical: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
  },
  relationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 12,
    marginBottom: 8,
  },
  relationName: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
  },
  relationStrength: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  editRelationRow: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 12,
    marginBottom: 8,
  },
  editRelationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  strengthControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  strengthLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  strengthValue: {
    fontSize: 14,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    minWidth: 40,
    textAlign: 'center' as const,
  },
  addRelationSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: theme.border,
  },
  availableContactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed' as const,
    backgroundColor: theme.overlay,
    padding: 12,
    marginBottom: 8,
  },
  availableContactName: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
  },
  noContactsText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    textAlign: 'center' as const,
    paddingVertical: 16,
  },
  noConnectionsText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    textAlign: 'center' as const,
    paddingVertical: 16,
  },
  searchInput: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.text,
    fontFamily: 'monospace' as const,
    marginBottom: 16,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandIcon: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    marginLeft: 'auto' as const,
  },
  collapsibleContent: {
    marginTop: 16,
  },
  errorText: {
    fontSize: 20,
    color: theme.danger,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    marginTop: 100,
  },
  editLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  editInput: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.text,
    fontFamily: 'monospace' as const,
    marginBottom: 8,
  },
  editRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  addFieldButton: {
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed' as const,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  addFieldText: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.overlay,
  },
  optionButtonActive: {
    backgroundColor: theme.primary,
  },
  optionText: {
    fontSize: 10,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    fontWeight: '700' as const,
    color: theme.background === '#000000' || theme.background === '#171717' ? '#FFFFFF' : theme.text,
  },
  optionTextActive: {
    color: theme.background,
  },
  powerGroupCollapsedName: {
    fontSize: 12,
    color: '#8B0000',
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  contactsList: {
    maxHeight: 240,
  },
  goalsSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
  },
  goalCardsContainer: {
    gap: 8,
  },
  goalCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 12,
  },
  goalCardContent: {
    flex: 1,
    marginRight: 8,
  },
  goalCardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  goalCardTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: theme.primary,
    fontFamily: 'monospace' as const,
    flex: 1,
  },
  goalCardProgress: {
    fontSize: 11,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    marginLeft: 8,
  },
  goalCardDotsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    marginLeft: 8,
  },
  goalCardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  goalCardDescription: {
    fontSize: 11,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    marginTop: 4,
  },
  nextActionContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.warning,
    padding: 10,
    backgroundColor: theme.overlay,
  },
  nextActionLabel: {
    fontSize: 10,
    color: theme.warning,
    fontFamily: 'monospace' as const,
    letterSpacing: 1.5,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  nextActionText: {
    fontSize: 13,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '600' as const,
  },
  nextActionDate: {
    fontSize: 11,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    marginTop: 4,
  },
  maintenanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
    gap: 8,
  },
  maintenanceBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    flexShrink: 1,
  },
  maintenanceBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
  },
});
