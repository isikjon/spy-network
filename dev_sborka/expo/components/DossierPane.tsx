import { useApp } from '@/contexts/AppContext';
import { router } from 'expo-router';
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
  Triangle,
  ArrowRight,
  PhoneCall,
  MessageSquare,
  Globe,
  MoreHorizontal,
  Target,
  ChevronRight,
  Check,
  Heart,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { ContactAssessment, ContactRelation, DiaryEntry, FunctionalCircle, ImportanceLevel, RelationshipLevel, Sector } from '@/types';
import { Star } from 'lucide-react-native';

export type DossierPaneProps = {
  dossierId: string;
  initialEdit?: boolean;
  onBack?: () => void;
  onOpenNetwork?: () => void;
  onOpenGoal?: (goalId: string) => void;
};

export function DossierPane({ dossierId, initialEdit, onBack, onOpenNetwork: _onOpenNetwork, onOpenGoal }: DossierPaneProps) {
  const {
    dossiers,
    updateDossier,
    deleteDossier,
    theme,
    sectors: userSectors,
    powerGroupings,
    addPowerGrouping,
    goals,
    updateGoal,
    t,
  } = useApp();

  const [isAddingEntry, setIsAddingEntry] = useState<boolean>(false);
  const [newEntry, setNewEntry] = useState<string>('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryContent, setEditingEntryContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(!!initialEdit);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedForIdRef = useRef<string | null>(null);
  const dossierRef = useRef<ReturnType<typeof dossiers.find> | undefined>(undefined);
  const skipNextAutoSaveRef = useRef<boolean>(true);

  const [editName, setEditName] = useState<string>('');
  const [editPosition, setEditPosition] = useState<string>('');
  const [editCompany, setEditCompany] = useState<string>('');
  const [editPhones, setEditPhones] = useState<string[]>([]);
  const [editEmails, setEditEmails] = useState<string[]>([]);
  const [editSectors, setEditSectors] = useState<Sector[]>([]);
  const [editCircle, setEditCircle] = useState<FunctionalCircle>('support');
  const [editImportance, setEditImportance] = useState<ImportanceLevel>('medium');
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);
  const [editRelations, setEditRelations] = useState<ContactRelation[]>([]);
  const [editNoDirectConnection, setEditNoDirectConnection] = useState<boolean>(false);
  const [editRelationshipLevel, setEditRelationshipLevel] = useState<RelationshipLevel | undefined>(undefined);
  const [isConnectionsExpanded, setIsConnectionsExpanded] = useState<boolean>(false);

  const [searchConnection, setSearchConnection] = useState<string>('');
  const [isPowerGroupingExpanded, setIsPowerGroupingExpanded] = useState<boolean>(false);
  const [editPowerGroupName, setEditPowerGroupName] = useState<string>('');
  const [editSuzerainId, setEditSuzerainId] = useState<string | undefined>(undefined);
  const [editVassalIds, setEditVassalIds] = useState<string[]>([]);
  const [searchPowerContact, setSearchPowerContact] = useState<string>('');
  const [isAddingNewGroupName, setIsAddingNewGroupName] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [isAssessmentOpen, setIsAssessmentOpen] = useState<boolean>(false);
  const [isNextStepOpen, setIsNextStepOpen] = useState<boolean>(false);
  const [stepInteractionType, setStepInteractionType] = useState<string>('meeting');
  const [stepResult, setStepResult] = useState<string>('');
  const [stepNextAction, setStepNextAction] = useState<string>('');
  const [stepNextDate, setStepNextDate] = useState<string>('');
  const [assessResource, setAssessResource] = useState<number>(3);
  const [assessMutual, setAssessMutual] = useState<number>(3);
  const [assessOpenness, setAssessOpenness] = useState<number>(3);
  const [assessInfluence, setAssessInfluence] = useState<number>(3);
  const [assessLongTerm, setAssessLongTerm] = useState<number>(3);
  const [assessImpressions, setAssessImpressions] = useState<string>('');
  const [trustLevel, setTrustLevel] = useState<number>(0);
  const [trustTrackWidth, setTrustTrackWidth] = useState<number>(200);
  const trustTrackRef = useRef<View>(null);

  const dossier = useMemo(() => dossiers.find((d) => d.contact.id === dossierId), [dossierId, dossiers]);


  useEffect(() => {
    dossierRef.current = dossier;
  }, [dossier]);

  useEffect(() => {
    setIsEditing(!!initialEdit);
  }, [initialEdit]);

  const sectors: Sector[] = useMemo(() => userSectors as Sector[], [userSectors]);
  const circles: FunctionalCircle[] = useMemo(() => ['support', 'productivity', 'development'], []);
  const importanceLevels: ImportanceLevel[] = useMemo(() => ['critical', 'high', 'medium', 'low'], []);
  const relationshipLevels: RelationshipLevel[] = useMemo(() => ['acquaintance', 'contact', 'useful_connection', 'trusted_person', 'ally'], []);

  const getImportanceColor = useCallback(
    (importance: string) => {
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
    },
    [theme.danger, theme.primary, theme.primaryDim, theme.warning]
  );

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!dossier || !dossierId) return;

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
    setEditRelations(dossier.relations || []);
    setEditNoDirectConnection(dossier.noDirectConnection ?? false);
    setEditRelationshipLevel(dossier.relationshipLevel);

    setEditPowerGroupName(dossier.powerGrouping?.groupName || '');
    setEditSuzerainId(dossier.powerGrouping?.suzerainId);
    setEditVassalIds(dossier.powerGrouping?.vassalIds || []);
  }, [dossier, dossierId]);

  const autoSave = useCallback(() => {
    if (!dossierId) return;

    const currentDossier = dossierRef.current;
    if (!currentDossier) return;

    updateDossier(dossierId, {
      contact: {
        ...currentDossier.contact,
        name: editName,
        position: editPosition || undefined,
        company: editCompany || undefined,

        phoneNumbers: editPhones.filter((p) => p.trim()),
        emails: editEmails.filter((e) => e.trim()),
        photo: editPhoto,
      },
      sectors: editSectors,
      functionalCircle: editCircle,
      importance: editImportance,
      relations: editRelations,
      noDirectConnection: editNoDirectConnection,
      relationshipLevel: editRelationshipLevel,
      powerGrouping: editPowerGroupName
        ? {
            groupName: editPowerGroupName,
            suzerainId: editSuzerainId,
            vassalIds: editVassalIds,
          }
        : undefined,
    });
  }, [dossierId, editCircle, editCompany, editEmails, editImportance, editName, editNoDirectConnection, editRelationshipLevel, editPhones, editPhoto, editPowerGroupName, editRelations, editSectors, editPosition, editSuzerainId, editVassalIds, updateDossier]);

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

  useEffect(() => {
    if (isEditing) return;
    if (!dossierId || !dossierRef.current) return;
    if (initializedForIdRef.current !== dossierId) return;

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
  }, [editRelations, editPowerGroupName, editSuzerainId, editVassalIds, isEditing, dossierId, autoSave]);

  const handleAddEntry = useCallback(() => {
    if (!dossier) return;
    if (newEntry.trim()) {
      const entry: DiaryEntry = {
        id: `entry_${Date.now()}`,
        date: new Date(),
        type: 'manual',
        content: newEntry.trim(),
      };

      updateDossier(dossierId, {
        diary: [...(dossier.diary || []), entry],
        lastInteraction: new Date(),
      });
      setNewEntry('');
      setIsAddingEntry(false);
    }
  }, [dossier, dossierId, newEntry, updateDossier]);

  const interactionTypes = useMemo(() => [
    { key: 'meeting', icon: Users, label: t.contact.typeMeeting },
    { key: 'call', icon: PhoneCall, label: t.contact.typeCall },
    { key: 'message', icon: MessageSquare, label: t.contact.typeMessage },
    { key: 'email', icon: Mail, label: t.contact.typeEmail },
    { key: 'event', icon: Globe, label: t.contact.typeEvent },
    { key: 'other', icon: MoreHorizontal, label: t.contact.typeOther },
    { key: 'likes', icon: Heart, label: t.contact.typeLikes },
  ], [t]);

  const handleSaveNextStep = useCallback(() => {
    if (!dossier || !stepResult.trim()) return;
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
    }
    if (stepNextDate) {
      updates.nextActionDate = stepNextDate;
    }
    updateDossier(dossierId, updates);
    setIsNextStepOpen(false);
    setStepInteractionType('meeting');
    setStepResult('');
    setStepNextAction('');
    setStepNextDate('');
  }, [dossier, dossierId, stepResult, stepInteractionType, stepNextAction, stepNextDate, interactionTypes, t, updateDossier]);

  const handleAddPreparationEntry = useCallback(() => {
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
  }, []);

  const handleStartEditEntry = useCallback((entry: DiaryEntry) => {
    setEditingEntryId(entry.id);
    setEditingEntryContent(entry.content);
    setIsAddingEntry(false);
  }, []);

  const handleSaveEditEntry = useCallback(() => {
    if (!dossier) return;
    if (editingEntryContent.trim() && editingEntryId) {
      const updatedDiary = (dossier.diary || []).map((entry) =>
        entry.id === editingEntryId ? { ...entry, content: editingEntryContent.trim() } : entry
      );
      updateDossier(dossierId, {
        diary: updatedDiary,
      });
      setEditingEntryId(null);
      setEditingEntryContent('');
    }
  }, [dossier, dossierId, editingEntryContent, editingEntryId, updateDossier]);

  const handleCancelEditEntry = useCallback(() => {
    setEditingEntryId(null);
    setEditingEntryContent('');
  }, []);

  const handleDeleteEntry = useCallback(
    (entryId: string) => {
      Alert.alert(t.contact.deleteEntry, t.contact.removeEntry, [
        { text: t.contact.cancel, style: 'cancel' },
        {
          text: t.contact.delete,
          style: 'destructive',
          onPress: () => {
            if (!dossier) return;
            const updatedDiary = (dossier.diary || []).filter((entry) => entry.id !== entryId);
            updateDossier(dossierId, {
              diary: updatedDiary,
            });
          },
        },
      ]);
    },
    [dossier, dossierId, t.contact.cancel, t.contact.delete, t.contact.deleteEntry, t.contact.removeEntry, updateDossier]
  );

  const handleDelete = useCallback(() => {
    if (!dossier) return;
    Alert.alert(t.contact.deleteDossier, t.contact.removeDossierMessage.replace('{{name}}', dossier.contact.name), [
      { text: t.contact.cancel, style: 'cancel' },
      {
        text: t.contact.delete,
        style: 'destructive',
        onPress: () => {
          deleteDossier(dossierId);
          if (onBack) {
            onBack();
          } else {
            router.back();
          }
        },
      },
    ]);
  }, [deleteDossier, dossier, dossierId, onBack, t.contact.cancel, t.contact.delete, t.contact.deleteDossier, t.contact.removeDossierMessage]);

  const pickImage = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert(t.contact.notAvailable, t.contact.imagePickerNotWeb);
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
      quality: 0.5,
    });

    if (!result.canceled) {
      const newPhotoUri = result.assets[0]?.uri;
      if (!newPhotoUri) return;

      setEditPhoto(newPhotoUri);

      if (dossier) {
        updateDossier(dossierId, {
          contact: {
            ...dossier.contact,
            photo: newPhotoUri,
          },
        });
      }
    }
  }, [dossier, dossierId, t.contact.cameraRollPermission, t.contact.imagePickerNotWeb, t.contact.notAvailable, t.contact.permissionRequired, updateDossier]);

  const removePhoto = useCallback(() => {
    Alert.alert(t.contact.removePhoto, t.contact.removeContactPhoto, [
      { text: t.contact.cancel, style: 'cancel' },
      {
        text: t.contact.remove,
        style: 'destructive',
        onPress: () => setEditPhoto(undefined),
      },
    ]);
  }, [t.contact.cancel, t.contact.remove, t.contact.removeContactPhoto, t.contact.removePhoto]);

  const handleSetPowerGroup = useCallback(
    (groupName: string) => {
      setEditPowerGroupName(groupName);
      if (!powerGroupings.includes(groupName)) {
        addPowerGrouping(groupName);
      }
    },
    [addPowerGrouping, powerGroupings]
  );

  const handleSetSuzerain = useCallback(
    (suzerainId: string) => {
      setEditSuzerainId(suzerainId);

      const hasRelation = editRelations.find((r) => r.contactId === suzerainId);
      if (!hasRelation) {
        setEditRelations([...editRelations, { contactId: suzerainId, strength: 5 }]);
      }

      const suzerainDossier = dossiers.find((d) => d.contact.id === suzerainId);
      if (suzerainDossier && suzerainDossier.powerGrouping?.groupName) {
        setEditPowerGroupName(suzerainDossier.powerGrouping.groupName);
        if (!powerGroupings.includes(suzerainDossier.powerGrouping.groupName)) {
          addPowerGrouping(suzerainDossier.powerGrouping.groupName);
        }
      }

      setTimeout(() => {
        if (suzerainDossier) {
          const updatedVassals = suzerainDossier.powerGrouping?.vassalIds || [];
          if (!updatedVassals.includes(dossierId)) {
            updateDossier(suzerainId, {
              powerGrouping: {
                groupName: suzerainDossier.powerGrouping?.groupName || editPowerGroupName,
                suzerainId: suzerainDossier.powerGrouping?.suzerainId,
                vassalIds: [...updatedVassals, dossierId],
              },
            });
          }

          const hasReciprocalRelation = suzerainDossier.relations.find((r) => r.contactId === dossierId);
          if (!hasReciprocalRelation) {
            updateDossier(suzerainId, {
              relations: [...suzerainDossier.relations, { contactId: dossierId, strength: 5 }],
            });
          }
        }
      }, 100);
    },
    [addPowerGrouping, dossiers, dossierId, editPowerGroupName, editRelations, powerGroupings, updateDossier]
  );

  const handleRemoveSuzerain = useCallback(() => {
    const oldSuzerainId = editSuzerainId;
    setEditSuzerainId(undefined);

    if (oldSuzerainId) {
      setTimeout(() => {
        const suzerainDossier = dossiers.find((d) => d.contact.id === oldSuzerainId);
        if (suzerainDossier && suzerainDossier.powerGrouping) {
          updateDossier(oldSuzerainId, {
            powerGrouping: {
              ...suzerainDossier.powerGrouping,
              vassalIds: suzerainDossier.powerGrouping.vassalIds.filter((vid) => vid !== dossierId),
            },
          });
        }
      }, 100);
    }
  }, [dossiers, dossierId, editSuzerainId, updateDossier]);

  const handleAddVassal = useCallback(
    (vassalId: string) => {
      setEditVassalIds([...editVassalIds, vassalId]);

      const hasRelation = editRelations.find((r) => r.contactId === vassalId);
      if (!hasRelation) {
        setEditRelations([...editRelations, { contactId: vassalId, strength: 5 }]);
      }

      setTimeout(() => {
        const vassalDossier = dossiers.find((d) => d.contact.id === vassalId);
        if (vassalDossier) {
          updateDossier(vassalId, {
            powerGrouping: {
              groupName: editPowerGroupName,
              suzerainId: dossierId,
              vassalIds: vassalDossier.powerGrouping?.vassalIds || [],
            },
          });

          const hasReciprocalRelation = vassalDossier.relations.find((r) => r.contactId === dossierId);
          if (!hasReciprocalRelation) {
            updateDossier(vassalId, {
              relations: [...vassalDossier.relations, { contactId: dossierId, strength: 5 }],
            });
          }
        }
      }, 100);
    },
    [dossiers, dossierId, editPowerGroupName, editRelations, editVassalIds, updateDossier]
  );

  const handleRemoveVassal = useCallback(
    (vassalId: string) => {
      setEditVassalIds(editVassalIds.filter((vid) => vid !== vassalId));

      setTimeout(() => {
        const vassalDossier = dossiers.find((d) => d.contact.id === vassalId);
        if (vassalDossier && vassalDossier.powerGrouping?.suzerainId === dossierId) {
          updateDossier(vassalId, {
            powerGrouping: undefined,
          });
        }
      }, 100);
    },
    [dossiers, dossierId, editVassalIds, updateDossier]
  );

  const handleAddNewGroupName = useCallback(() => {
    const next = newGroupName.trim();
    if (next && !powerGroupings.includes(next)) {
      addPowerGrouping(next);
      setEditPowerGroupName(next);
      setNewGroupName('');
      setIsAddingNewGroupName(false);
    }
  }, [addPowerGrouping, newGroupName, powerGroupings]);

  const calculateValueIndex = useCallback(() => {
    const weights = { resource: 0.25, mutual: 0.20, openness: 0.15, influence: 0.25, longTerm: 0.15 };
    const raw =
      assessResource * weights.resource +
      assessMutual * weights.mutual +
      assessOpenness * weights.openness +
      assessInfluence * weights.influence +
      assessLongTerm * weights.longTerm;
    return Math.round(raw * 20);
  }, [assessResource, assessMutual, assessOpenness, assessInfluence, assessLongTerm]);

  const getAssessmentCategory = useCallback(
    (index: number) => {
      if (index >= 75) return { label: t.contact.highPotential, advice: t.contact.highAdvice, tactic: t.contact.highTactic, color: '#059669' };
      if (index >= 50) return { label: t.contact.promising, advice: t.contact.promisingAdvice, tactic: t.contact.promisingTactic, color: '#d97706' };
      if (index >= 30) return { label: t.contact.neutral, advice: t.contact.neutralAdvice, tactic: t.contact.neutralTactic, color: '#6b7280' };
      return { label: t.contact.lowPriority, advice: t.contact.lowAdvice, tactic: t.contact.lowTactic, color: '#dc2626' };
    },
    [t.contact]
  );

  const handleOpenAssessment = useCallback(() => {
    if (dossier?.assessment) {
      setAssessResource(dossier.assessment.resourcePotential);
      setAssessMutual(dossier.assessment.mutualInterests);
      setAssessOpenness(dossier.assessment.openness);
      setAssessInfluence(dossier.assessment.influence);
      setAssessLongTerm(dossier.assessment.longTermPotential);
      setAssessImpressions(dossier.assessment.impressions);
    } else {
      setAssessResource(3);
      setAssessMutual(3);
      setAssessOpenness(3);
      setAssessInfluence(3);
      setAssessLongTerm(3);
      setAssessImpressions('');
    }
    setIsAssessmentOpen(true);
  }, [dossier]);

  useEffect(() => {
    if (dossier?.trustLevel !== undefined) {
      const val = dossier.trustLevel;
      setTrustLevel(val <= 10 && val > 0 ? val * 10 : val);
    }
  }, [dossier?.trustLevel]);

  const handleTrustLevelChange = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setTrustLevel(clamped);
    if (dossier) {
      updateDossier(dossierId, { trustLevel: clamped });
    }
  }, [dossier, dossierId, updateDossier]);

  const trustPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const pct = Math.max(0, Math.min(100, Math.round((x / trustTrackWidth) * 100)));
      handleTrustLevelChange(pct);
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const pct = Math.max(0, Math.min(100, Math.round((x / trustTrackWidth) * 100)));
      handleTrustLevelChange(pct);
    },
  }), [trustTrackWidth, handleTrustLevelChange]);

  const onTrustTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrustTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const handleSaveAssessment = useCallback(() => {
    if (!dossier) return;
    const valueIndex = calculateValueIndex();
    const assessment: ContactAssessment = {
      resourcePotential: assessResource,
      mutualInterests: assessMutual,
      openness: assessOpenness,
      influence: assessInfluence,
      longTermPotential: assessLongTerm,
      impressions: assessImpressions,
      valueIndex,
      date: new Date().toISOString(),
    };
    updateDossier(dossierId, { assessment });
    setIsAssessmentOpen(false);
  }, [dossier, dossierId, calculateValueIndex, assessResource, assessMutual, assessOpenness, assessInfluence, assessLongTerm, assessImpressions, updateDossier]);

  const getMaintenanceInfo = useCallback(() => {
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
      return { status: 'red' as const, daysLeft: -recommendedDays, recommendedDays };
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
  }, [dossier]);

  const maintenanceInfo = useMemo(() => getMaintenanceInfo(), [getMaintenanceInfo]);

  const getMaintenanceBadgeColor = useCallback((status: 'green' | 'yellow' | 'red' | 'inactive') => {
    switch (status) {
      case 'green': return '#059669';
      case 'yellow': return '#d97706';
      case 'red': return '#dc2626';
      case 'inactive': return theme.primaryDim;
    }
  }, [theme.primaryDim]);

  const getMaintenanceBadgeText = useCallback(() => {
    if (!maintenanceInfo) return '';
    if (maintenanceInfo.status === 'inactive') {
      return t.contact.maintainInactive;
    }
    const dl = maintenanceInfo.daysLeft;
    if (dl <= 0) {
      return `${t.contact.maintainBadge} (${Math.abs(dl)}${t.contact.maintainDaysLeft} ${t.contact.maintainOverdue})`;
    }
    return `${t.contact.maintainBadge} (${dl}${t.contact.maintainDaysLeft})`;
  }, [maintenanceInfo, t.contact]);

  const handleToggleStepCompletedFromDossier = useCallback((goalId: string, step: { id: string; type: string; content: string; result: string; contactIds: string[]; completed?: boolean }) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const newCompleted = !step.completed;
    const updatedSteps = (goal.steps || []).map(s =>
      s.id === step.id ? { ...s, completed: newCompleted } : s
    );
    updateGoal(goalId, { steps: updatedSteps });

    if (newCompleted && step.contactIds.length > 0) {
      const stepTypeLabel = step.type === 'meeting' ? (t.contact?.typeMeeting ?? 'Meeting')
        : step.type === 'call' ? (t.contact?.typeCall ?? 'Call')
        : step.type === 'write' ? (t.contact?.typeMessage ?? 'Write')
        : (t.contact?.typeEvent ?? 'Event');
      const diaryContent = `[${t.strategy?.stepCompletedDiary ?? 'Step completed'}] ${goal.title}: [${stepTypeLabel}] ${step.content}${step.result ? '\n' + (t.strategy?.stepResult ?? 'Result') + ': ' + step.result : ''}`;

      for (const contactId of step.contactIds) {
        const d = dossiers.find(x => x.contact.id === contactId);
        if (d) {
          const entry: DiaryEntry = {
            id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            date: new Date(),
            type: 'auto',
            content: diaryContent,
          };
          updateDossier(contactId, {
            diary: [...(d.diary || []), entry],
            lastInteraction: new Date(),
          });
        }
      }
    }
  }, [goals, updateGoal, dossiers, updateDossier, t]);

  if (!dossier) {
    return (
      <View style={styles.background} testID="dossierPaneNotFoundRoot">
        <SafeAreaView style={styles.container} edges={['top']}>
          <Text style={styles.errorText}>{t.contact.dossierNotFound}</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.background} testID="dossierPaneRoot">
      <StatusBar barStyle={theme.background === '#000000' ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header} testID="dossierPaneHeader">
          <TouchableOpacity
            onPress={() => {
              if (onBack) {
                onBack();
              } else {
                router.back();
              }
            }}
            activeOpacity={0.7}
            testID="dossierBack"
          >
            <ArrowLeft size={24} color={theme.primary} />
          </TouchableOpacity>
          <FileText size={24} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>{t.contact.dossier}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => setIsEditing((v) => !v)}
            activeOpacity={0.7}
            testID="dossierToggleEdit"
          >
            <Edit3 size={20} color={isEditing ? theme.warning : theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7} testID="dossierDelete">
            <Trash2 size={20} color={theme.danger} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            testID="dossierScroll"
          >
            <View style={styles.profileSection} testID="dossierProfileSection">
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
                          testID="dossierPhotoEdit"
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
                        testID="dossierPhotoChange"
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
                          testID="dossierPhotoRemove"
                        >
                          <Text style={[styles.photoActionText, { color: theme.danger }]}>
                            {t.contact.remove}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {!isEditing && (
                  <View style={styles.contactInfoSide}>
                    {(dossier.contact.phoneNumbers || []).map((phone, idx) => (
                      <View key={`phone_${idx}`} style={styles.contactInfoSideRow}>
                        <Text style={styles.contactInfoSideText}>{phone}</Text>
                        <Phone size={14} color={theme.primary} />
                      </View>
                    ))}
                    {(dossier.contact.emails || []).map((email, idx) => (
                      <View key={`email_${idx}`} style={styles.contactInfoSideRow}>
                        <Text style={styles.contactInfoSideText} numberOfLines={1}>{email}</Text>
                        <Mail size={14} color={theme.primary} />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {isEditing ? (
                <>
                  <Text style={styles.editLabel}>{t.contact.name}</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholderTextColor={theme.primaryDim}
                    testID="dossierEditName"
                  />
                  <Text style={styles.editLabel}>{t.contact.position}</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editPosition}
                    onChangeText={setEditPosition}
                    placeholderTextColor={theme.primaryDim}
                    placeholder={t.contact.optional}
                    testID="dossierEditPosition"
                  />
                  <Text style={styles.editLabel}>{t.contact.company}</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editCompany}
                    onChangeText={setEditCompany}
                    placeholderTextColor={theme.primaryDim}
                    placeholder={t.contact.optional}
                    testID="dossierEditCompany"
                  />

                </>
              ) : (
                <>
                  <View style={styles.nameContainer}>
                    <Text style={styles.name}>{dossier.contact.name}</Text>
                    <View
                      style={[styles.importanceBadge, { borderColor: getImportanceColor(dossier.importance) }]}
                    >
                      <Text
                        style={[styles.importanceText, { color: getImportanceColor(dossier.importance) }]}
                      >
                        {dossier.importance.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {dossier.contact.position ? (
                    <View style={styles.metaRow}>
                      <Briefcase size={16} color={theme.primaryDim} />
                      <Text style={styles.metaText}>{dossier.contact.position}</Text>
                    </View>
                  ) : null}
                  {dossier.contact.company ? <Text style={styles.company}>{dossier.contact.company}</Text> : null}
                  {dossier.noDirectConnection && (
                    <View style={styles.noConnectionBadge}>
                      <Text style={styles.noConnectionText}>{t.contact.noDirectConnection}</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {isEditing && (
              <View
                style={styles.section}
                testID="dossierContactInfo"
              >
                <Text style={styles.sectionTitle}>{t.contact.contactInfo}</Text>
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
                      testID={`dossierPhone_${idx}`}
                    />
                    <TouchableOpacity
                      onPress={() => setEditPhones(editPhones.filter((_, i) => i !== idx))}
                      activeOpacity={0.7}
                      testID={`dossierPhoneRemove_${idx}`}
                    >
                      <X size={16} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addFieldButton}
                  onPress={() => setEditPhones([...editPhones, ''])}
                  activeOpacity={0.7}
                  testID="dossierAddPhone"
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
                      testID={`dossierEmail_${idx}`}
                    />
                    <TouchableOpacity
                      onPress={() => setEditEmails(editEmails.filter((_, i) => i !== idx))}
                      activeOpacity={0.7}
                      testID={`dossierEmailRemove_${idx}`}
                    >
                      <X size={16} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addFieldButton}
                  onPress={() => setEditEmails([...editEmails, ''])}
                  activeOpacity={0.7}
                  testID="dossierAddEmail"
                >
                  <Text style={styles.addFieldText}>{t.contact.addEmail}</Text>
                </TouchableOpacity>
              </View>
            )}

            {(() => {
              const contactId = dossierId;
              if (!contactId) return null;
              const linkedGoals = goals.filter(g => (g.contactIds || []).includes(contactId));
              return (
                <View style={styles.section}>
                  <View style={styles.goalsSectionHeader}>
                    <Target size={16} color={theme.primary} />
                    <Text style={styles.sectionTitle}>{t.contact?.goal ?? 'ЦЕЛИ'}</Text>
                  </View>
                  {linkedGoals.length > 0 ? (
                    <View style={styles.goalCardsContainer}>
                      {linkedGoals.map(g => {
                        const contactSteps = (g.steps || []).filter(s =>
                          s.contactIds.includes(contactId) && !s.completed
                        ).sort((a, b) => a.order - b.order);
                        return (
                          <View key={g.id}>
                            <TouchableOpacity
                              style={styles.goalCard}
                              activeOpacity={0.7}
                              onPress={() => {
                                if (onOpenGoal) {
                                  onOpenGoal(g.id);
                                } else {
                                  router.push('/(tabs)/strategy');
                                }
                              }}
                              testID={`goalCard_${g.id}`}
                            >
                              <View style={styles.goalCardContent}>
                                <View style={styles.goalCardTop}>
                                  <Text style={styles.goalCardTitle} numberOfLines={1}>{g.title}</Text>
                                  {g.progress > 0 ? (
                                    <Text style={styles.goalCardProgress}>{g.progress}%</Text>
                                  ) : null}
                                </View>
                                {g.description ? (
                                  <Text style={styles.goalCardDescription} numberOfLines={1}>{g.description}</Text>
                                ) : null}
                              </View>
                              <ChevronRight size={14} color={theme.primaryDim} />
                            </TouchableOpacity>
                            {contactSteps.length > 0 && (
                              <View style={styles.dossierStepsContainer}>
                                {contactSteps.map(step => (
                                  <View key={step.id} style={styles.dossierStepCard}>
                                    <View style={styles.dossierStepHeader}>
                                      <View style={styles.dossierStepTypeBadge}>
                                        <Text style={styles.dossierStepTypeText}>
                                          {step.type === 'meeting' ? (t.contact?.typeMeeting ?? 'Meeting')
                                            : step.type === 'call' ? (t.contact?.typeCall ?? 'Call')
                                            : step.type === 'write' ? (t.contact?.typeMessage ?? 'Write')
                                            : (t.contact?.typeEvent ?? 'Event')}
                                        </Text>
                                      </View>
                                      <TouchableOpacity
                                        style={styles.dossierStepCompletedBtn}
                                        onPress={() => handleToggleStepCompletedFromDossier(g.id, step)}
                                        activeOpacity={0.7}
                                      >
                                        <View style={styles.dossierStepCheckbox}>
                                          {step.completed && <Check size={10} color="#fff" />}
                                        </View>
                                        <Text style={styles.dossierStepCompletedText}>
                                          {t.strategy?.stepCompleted ?? 'Completed'}
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                    <Text style={styles.dossierStepContent} numberOfLines={2}>{step.content}</Text>
                                    {step.result ? (
                                      <Text style={styles.dossierStepResult} numberOfLines={1}>{step.result}</Text>
                                    ) : null}
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.noContactsText}>{t.contact?.linkedGoals ?? 'Добавьте контакт в цели на вкладке ЦЕЛЬ'}</Text>
                  )}
                </View>
              );
            })()}

            <View style={styles.section} testID="dossierClassification">
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
                        testID={`dossierImportance_${level}`}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            { color: getImportanceColor(level) },
                            editImportance === level && styles.optionTextActive,
                          ]}
                        >
                          {level.toUpperCase()}
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
                          style={[styles.optionButton, isSelected && styles.optionButtonActive]}
                          onPress={() => {
                            setEditSectors([sector]);
                          }}
                          activeOpacity={0.7}
                          testID={`dossierSector_${sector}`}
                        >
                          <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
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
                        style={[styles.optionButton, editCircle === circle && styles.optionButtonActive]}
                        onPress={() => setEditCircle(circle)}
                        activeOpacity={0.7}
                        testID={`dossierCircle_${circle}`}
                      >
                        <Text style={[styles.optionText, editCircle === circle && styles.optionTextActive]}>
                          {circle.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.editLabel}>{t.contact.relationshipLevel}</Text>
                  <View style={styles.optionsRow}>
                    {relationshipLevels.map((level) => {
                      const isSelected = editRelationshipLevel === level;
                      const labelKey = level === 'contact' ? 'contact_level' : level;
                      const label = (t.contact as Record<string, string>)[labelKey] ?? level;
                      return (
                        <TouchableOpacity
                          key={level}
                          style={[styles.optionButton, isSelected && styles.optionButtonActive]}
                          onPress={() => setEditRelationshipLevel(isSelected ? undefined : level)}
                          activeOpacity={0.7}
                          testID={`dossierRelLevel_${level}`}
                        >
                          <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setEditNoDirectConnection(!editNoDirectConnection)}
                    activeOpacity={0.7}
                    testID="dossierNoDirectConnection"
                  >
                    <View style={[styles.checkbox, editNoDirectConnection && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                      {editNoDirectConnection && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>{t.contact.noDirectConnection}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                <View style={styles.classificationGrid}>
                  <View style={[styles.classItem, { flex: 2 }]}>
                    <Text style={styles.classLabel}>{t.contact.sector}</Text>
                    <Text style={styles.classValue}>
                      {(dossier.sectors || []).length > 0 ? (dossier.sectors || [])[0].toUpperCase() : t.contact.none}
                    </Text>
                  </View>
                  <View style={styles.classItem}>
                    <Text style={styles.classLabel}>{t.contact.circle}</Text>
                    <Text style={styles.classValue}>{dossier.functionalCircle.toUpperCase()}</Text>
                  </View>
                  <View style={styles.classItem}>
                    <Text style={styles.classLabel}>{t.contact.relations}</Text>
                    <Text style={styles.classValue}>{(dossier.relations || []).length}</Text>
                  </View>
                </View>
                {!!dossier.relationshipLevel && (
                  <View style={styles.classificationGrid}>
                    <View style={[styles.classItem, { flex: 1 }]}>
                      <Text style={styles.classLabel}>{t.contact.relationshipLevel}</Text>
                      <Text style={styles.classValue}>
                        {(t.contact as Record<string, string>)[dossier.relationshipLevel === 'contact' ? 'contact_level' : dossier.relationshipLevel] ?? dossier.relationshipLevel}
                      </Text>
                    </View>
                  </View>
                )}
                </>
              )}
            </View>

            <View style={styles.section} testID="dossierAssessment">
              <View style={styles.assessmentHeaderRow}>
                <View style={styles.sectionHeader}>
                  <Star size={20} color={theme.primary} />
                  <Text style={styles.sectionTitle}>{t.contact.assessment}</Text>
                </View>
                {!isAssessmentOpen && dossier.assessment ? (
                  <TouchableOpacity
                    style={styles.reassessButtonSmall}
                    onPress={handleOpenAssessment}
                    activeOpacity={0.7}
                    testID="dossierReassess"
                  >
                    <Text style={styles.reassessButtonSmallText}>{t.contact.reassess}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {!isAssessmentOpen && dossier.assessment ? (
                <View>
                  <View style={styles.assessmentResultCard}>
                    <View style={styles.assessmentDateTopRow}>
                      <View style={{ flex: 1 }} />
                      <Text style={styles.assessmentDateTextTop}>
                        {t.contact.assessmentDate}: {new Date(dossier.assessment.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.assessmentScoreRow}>
                      <View style={[
                        styles.assessmentScoreBadge,
                        { backgroundColor: getAssessmentCategory(dossier.assessment.valueIndex).color },
                      ]}>
                        <Text style={styles.assessmentScoreText}>{dossier.assessment.valueIndex}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assessmentCategoryLabel}>
                          {getAssessmentCategory(dossier.assessment.valueIndex).label}
                        </Text>
                        <Text style={styles.assessmentTacticText}>
                          {t.contact.tactic}: {getAssessmentCategory(dossier.assessment.valueIndex).tactic}
                        </Text>
                      </View>
                    </View>
                    {dossier.assessment.impressions ? (
                      <View style={styles.assessmentImpressionsBlock}>
                        <Text style={styles.assessmentImpressionsLabel}>{t.contact.impressions}</Text>
                        <Text style={styles.assessmentImpressionsText}>{dossier.assessment.impressions}</Text>
                      </View>
                    ) : null}
                    <View style={styles.trustLevelSection} testID="dossierTrustLevel">
                      <View style={styles.trustLevelHeader}>
                        <Text style={styles.trustLevelTitle}>{t.contact.trustLevel}</Text>
                        <Text style={styles.trustLevelValue}>{trustLevel}%</Text>
                      </View>
                      <Text style={styles.trustLevelHint}>{t.contact.trustLevelHint}</Text>
                      <View style={styles.trustSliderRow}>
                        <Text style={styles.assessSliderEnd}>0%</Text>
                        <View
                          ref={trustTrackRef}
                          style={styles.trustTrack}
                          onLayout={onTrustTrackLayout}
                          {...trustPanResponder.panHandlers}
                        >
                          <View style={[styles.trustTrackFill, { width: `${trustLevel}%` as any }]} />
                          <View style={[styles.trustThumb, { left: `${trustLevel}%` as any }]} />
                        </View>
                        <Text style={styles.assessSliderEnd}>100%</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : !isAssessmentOpen ? (
                <TouchableOpacity
                  style={styles.assessButton}
                  onPress={handleOpenAssessment}
                  activeOpacity={0.7}
                  testID="dossierAssessBtn"
                >
                  <Star size={16} color={theme.primary} />
                  <Text style={styles.assessButtonText}>{t.contact.assess}</Text>
                </TouchableOpacity>
              ) : null}

              {isAssessmentOpen && (
                <View style={styles.assessmentForm}>
                  {[
                    { label: t.contact.resourcePotential, hint: t.contact.resourceHint, value: assessResource, setter: setAssessResource },
                    { label: t.contact.mutualInterests, hint: t.contact.mutualHint, value: assessMutual, setter: setAssessMutual },
                    { label: t.contact.openness, hint: t.contact.opennessHint, value: assessOpenness, setter: setAssessOpenness },
                    { label: t.contact.influence, hint: t.contact.influenceHint, value: assessInfluence, setter: setAssessInfluence },
                    { label: t.contact.longTermPotential, hint: t.contact.longTermHint, value: assessLongTerm, setter: setAssessLongTerm },
                  ].map((criterion) => (
                    <View key={criterion.label} style={styles.assessCriterion}>
                      <View style={styles.assessCriterionHeader}>
                        <Text style={styles.assessCriterionLabel}>{criterion.label}</Text>
                        <Text style={styles.assessCriterionValue}>{criterion.value}/5</Text>
                      </View>
                      <Text style={styles.assessCriterionHint}>{criterion.hint}</Text>
                      <View style={styles.assessSliderRow}>
                        <Text style={styles.assessSliderEnd}>{t.contact.assessLow}</Text>
                        <View style={styles.assessDotsRow}>
                          {[1, 2, 3, 4, 5].map((val) => (
                            <TouchableOpacity
                              key={val}
                              onPress={() => criterion.setter(val)}
                              activeOpacity={0.7}
                              style={[
                                styles.assessDot,
                                val <= criterion.value && styles.assessDotActive,
                                val <= criterion.value && {
                                  backgroundColor: theme.primary,
                                },
                              ]}
                              testID={`assess_${criterion.label}_${val}`}
                            />
                          ))}
                        </View>
                        <Text style={styles.assessSliderEnd}>{t.contact.assessHigh}</Text>
                      </View>
                    </View>
                  ))}

                  <Text style={styles.editLabel}>{t.contact.impressions}</Text>
                  <TextInput
                    style={[styles.editInput, { minHeight: 80, textAlignVertical: 'top' as const }]}
                    value={assessImpressions}
                    onChangeText={setAssessImpressions}
                    placeholder={t.contact.impressionsPlaceholder}
                    placeholderTextColor={theme.primaryDim}
                    multiline
                    testID="dossierAssessImpressions"
                  />

                  <View style={styles.assessmentPreview}>
                    <Text style={styles.assessmentPreviewTitle}>
                      {t.contact.valueIndex}: {calculateValueIndex()} / 100
                    </Text>
                    <Text style={[
                      styles.assessmentPreviewCategory,
                      { color: getAssessmentCategory(calculateValueIndex()).color },
                    ]}>
                      {getAssessmentCategory(calculateValueIndex()).label}
                    </Text>
                    <Text style={styles.assessmentPreviewAdvice}>
                      {getAssessmentCategory(calculateValueIndex()).advice}
                    </Text>
                  </View>

                  <View style={styles.formButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setIsAssessmentOpen(false)}
                      activeOpacity={0.7}
                      testID="dossierAssessCancel"
                    >
                      <Text style={styles.cancelButtonText}>{t.contact.cancel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleSaveAssessment}
                      activeOpacity={0.7}
                      testID="dossierAssessSave"
                    >
                      <Text style={styles.saveButtonText}>{t.contact.saveAssessment}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {(!dossier.assessment) && (
                <View style={styles.trustLevelSection} testID="dossierTrustLevel">
                  <View style={styles.trustLevelHeader}>
                    <Text style={styles.trustLevelTitle}>{t.contact.trustLevel}</Text>
                    <Text style={styles.trustLevelValue}>{trustLevel}%</Text>
                  </View>
                  <Text style={styles.trustLevelHint}>{t.contact.trustLevelHint}</Text>
                  <View style={styles.trustSliderRow}>
                    <Text style={styles.assessSliderEnd}>0%</Text>
                    <View
                      ref={trustTrackRef}
                      style={styles.trustTrack}
                      onLayout={onTrustTrackLayout}
                      {...trustPanResponder.panHandlers}
                    >
                      <View style={[styles.trustTrackFill, { width: `${trustLevel}%` as any }]} />
                      <View style={[styles.trustThumb, { left: `${trustLevel}%` as any }]} />
                    </View>
                    <Text style={styles.assessSliderEnd}>100%</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.section} testID="dossierConnections">
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => {
                  setIsConnectionsExpanded(!isConnectionsExpanded);
                  if (!isConnectionsExpanded) {
                    setSearchConnection('');
                  }
                }}
                activeOpacity={0.7}
                testID="dossierConnectionsToggle"
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
                    testID="dossierConnectionsSearch"
                  />
                  {editRelations.map((relation, idx) => {
                    const relatedContact = dossiers.find((d) => d.contact.id === relation.contactId);
                    if (
                      searchConnection &&
                      !relatedContact?.contact.name.toLowerCase().includes(searchConnection.toLowerCase())
                    ) {
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
                            testID={`dossierRelationRemove_${idx}`}
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
                            testID={`dossierRelationMinus_${idx}`}
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
                            testID={`dossierRelationPlus_${idx}`}
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
                          d.contact.id !== dossierId &&
                          !editRelations.find((r) => r.contactId === d.contact.id) &&
                          (!searchConnection ||
                            d.contact.name.toLowerCase().includes(searchConnection.toLowerCase()))
                      )
                      .map((d) => (
                        <TouchableOpacity
                          key={d.contact.id}
                          style={styles.availableContactRow}
                          onPress={() => {
                            const newRelation = { contactId: d.contact.id, strength: 5 };
                            setEditRelations([...editRelations, newRelation]);

                            setTimeout(() => {
                              const targetDossier = dossiers.find((x) => x.contact.id === d.contact.id);
                              if (targetDossier) {
                                const hasReciprocal = targetDossier.relations.find(
                                  (r) => r.contactId === dossierId
                                );
                                if (!hasReciprocal) {
                                  updateDossier(d.contact.id, {
                                    relations: [...targetDossier.relations, { contactId: dossierId, strength: 5 }],
                                  });
                                }
                              }
                            }, 100);
                          }}
                          activeOpacity={0.7}
                          testID={`dossierAddRelation_${d.contact.id}`}
                        >
                          <Text style={styles.availableContactName}>{d.contact.name}</Text>
                          <Plus size={16} color={theme.primary} />
                        </TouchableOpacity>
                      ))}
                    {dossiers.filter(
                      (d) =>
                        d.contact.id !== dossierId &&
                        !editRelations.find((r) => r.contactId === d.contact.id) &&
                        (!searchConnection ||
                          d.contact.name.toLowerCase().includes(searchConnection.toLowerCase()))
                    ).length === 0 && (
                      <Text style={styles.noContactsText}>
                        {searchConnection
                          ? t.contact.noMatchesFound
                          : editRelations.length === dossiers.length - 1
                            ? t.contact.allContactsConnected
                            : t.contact.noOtherContacts}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.section} testID="dossierPowerGrouping">
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => {
                  setIsPowerGroupingExpanded(!isPowerGroupingExpanded);
                  if (!isPowerGroupingExpanded) {
                    setSearchPowerContact('');
                  }
                }}
                activeOpacity={0.7}
                testID="dossierPowerToggle"
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
                        testID="dossierNewGroupName"
                      />
                      <View style={styles.formButtons}>
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => {
                            setIsAddingNewGroupName(false);
                            setNewGroupName('');
                          }}
                          activeOpacity={0.7}
                          testID="dossierNewGroupCancel"
                        >
                          <Text style={styles.cancelButtonText}>{t.contact.cancel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={handleAddNewGroupName}
                          activeOpacity={0.7}
                          disabled={!newGroupName.trim()}
                          testID="dossierNewGroupSave"
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
                            style={[styles.optionButton, editPowerGroupName === grouping && styles.optionButtonActive]}
                            onPress={() => handleSetPowerGroup(grouping)}
                            activeOpacity={0.7}
                            testID={`dossierPowerGroup_${grouping}`}
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
                        testID="dossierCreateNewGroup"
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
                        testID="dossierPowerSearch"
                      />
                      {editSuzerainId && (
                        <View style={styles.editRelationRow}>
                          <View style={styles.editRelationHeader}>
                            <Text style={styles.relationName}>
                              {dossiers.find((d) => d.contact.id === editSuzerainId)?.contact.name || t.dossiers.unknown}
                            </Text>
                            <TouchableOpacity
                              onPress={handleRemoveSuzerain}
                              activeOpacity={0.7}
                              testID="dossierSuzerainRemove"
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
                                d.contact.id !== dossierId &&
                                (!searchPowerContact ||
                                  d.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase()))
                            )
                            .map((d) => (
                              <TouchableOpacity
                                key={d.contact.id}
                                style={styles.availableContactRow}
                                onPress={() => handleSetSuzerain(d.contact.id)}
                                activeOpacity={0.7}
                                testID={`dossierSetSuzerain_${d.contact.id}`}
                              >
                                <Text style={styles.availableContactName}>{d.contact.name}</Text>
                                <Plus size={16} color={theme.primary} />
                              </TouchableOpacity>
                            ))}
                          {dossiers.filter(
                            (d) =>
                              d.contact.id !== dossierId &&
                              (!searchPowerContact ||
                                d.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase()))
                          ).length === 0 && (
                            <Text style={styles.noContactsText}>
                              {searchPowerContact ? t.contact.noMatchesFound : t.contact.noOtherContacts}
                            </Text>
                          )}
                        </ScrollView>
                      )}

                      <Text style={[styles.editLabel, { marginTop: 24 }]}>{t.contact.vassals}</Text>
                      {editVassalIds.map((vassalId) => {
                        const vassalContact = dossiers.find((d) => d.contact.id === vassalId);
                        if (
                          searchPowerContact &&
                          !vassalContact?.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase())
                        ) {
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
                                testID={`dossierVassalRemove_${vassalId}`}
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
                                d.contact.id !== dossierId &&
                                !editVassalIds.includes(d.contact.id) &&
                                d.contact.id !== editSuzerainId &&
                                (!d.powerGrouping ||
                                  !d.powerGrouping.groupName ||
                                  d.powerGrouping.groupName === editPowerGroupName) &&
                                (!searchPowerContact ||
                                  d.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase()))
                            )
                            .map((d) => (
                              <TouchableOpacity
                                key={d.contact.id}
                                style={styles.availableContactRow}
                                onPress={() => handleAddVassal(d.contact.id)}
                                activeOpacity={0.7}
                                testID={`dossierAddVassal_${d.contact.id}`}
                              >
                                <Text style={styles.availableContactName}>{d.contact.name}</Text>
                                <Plus size={16} color={theme.primary} />
                              </TouchableOpacity>
                            ))}
                          {dossiers.filter(
                            (d) =>
                              d.contact.id !== dossierId &&
                              !editVassalIds.includes(d.contact.id) &&
                              d.contact.id !== editSuzerainId &&
                              (!d.powerGrouping ||
                                !d.powerGrouping.groupName ||
                                d.powerGrouping.groupName === editPowerGroupName) &&
                              (!searchPowerContact ||
                                d.contact.name.toLowerCase().includes(searchPowerContact.toLowerCase()))
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

            <View style={styles.section} testID="dossierDiary">
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
                      testID="dossierDiaryAdd"
                    >
                      <Edit3 size={16} color={theme.primary} />
                      <Text style={styles.addEntryText}>{t.contact.addEntry}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.addEntryButton}
                      onPress={handleAddPreparationEntry}
                      activeOpacity={0.7}
                      testID="dossierDiaryPrep"
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

              {(dossier.diary || [])
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((entry) => (
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
                          testID={`dossierDiaryEdit_${entry.id}`}
                        />
                        <View style={styles.formButtons}>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleCancelEditEntry}
                            activeOpacity={0.7}
                            testID={`dossierDiaryEditCancel_${entry.id}`}
                          >
                            <Text style={styles.cancelButtonText}>{t.contact.cancel}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSaveEditEntry}
                            activeOpacity={0.7}
                            disabled={!editingEntryContent.trim()}
                            testID={`dossierDiaryEditSave_${entry.id}`}
                          >
                            <Text style={styles.saveButtonText}>{t.contact.save}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.diaryEntry}>
                        <View style={styles.diaryHeader}>
                          <View style={styles.diaryHeaderLeft}>
                            <Text style={styles.diaryType}>[{entry.type.toUpperCase()}]</Text>
                            <Text style={styles.diaryDate}>{new Date(entry.date).toLocaleDateString()}</Text>
                          </View>
                          <View style={styles.diaryActions}>
                            <TouchableOpacity
                              onPress={() => handleStartEditEntry(entry)}
                              activeOpacity={0.7}
                              testID={`dossierDiaryEditBtn_${entry.id}`}
                            >
                              <Edit3 size={14} color={theme.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteEntry(entry.id)}
                              activeOpacity={0.7}
                              testID={`dossierDiaryDeleteBtn_${entry.id}`}
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
                    testID="dossierDiaryNewInput"
                  />
                  <View style={styles.formButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setIsAddingEntry(false);
                        setNewEntry('');
                      }}
                      activeOpacity={0.7}
                      testID="dossierDiaryNewCancel"
                    >
                      <Text style={styles.cancelButtonText}>{t.contact.cancel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleAddEntry}
                      activeOpacity={0.7}
                      disabled={!newEntry.trim()}
                      testID="dossierDiaryNewSave"
                    >
                      <Text style={styles.saveButtonText}>{t.contact.save}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    },
    contactInfoSide: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: 8,
    },
    contactInfoSideRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    contactInfoSideText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      textAlign: 'right' as const,
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
    linkedGoalsRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      marginTop: 6,
    },
    linkedGoalsText: {
      fontSize: 13,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      flex: 1,
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
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
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
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
      gap: 10,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmark: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700' as const,
      lineHeight: 18,
    },
    checkboxLabel: {
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    noConnectionBadge: {
      marginTop: 10,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: theme.danger ?? theme.primary,
      borderRadius: 4,
      alignSelf: 'flex-start',
    },
    noConnectionText: {
      fontSize: 11,
      color: theme.danger ?? theme.primary,
      fontFamily: 'monospace' as const,
      fontWeight: '600' as const,
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
    diaryButtonsColumn: {
      gap: 12,
    },
    diaryButtonsContainer: {
      flexDirection: 'row',
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
    relationName: {
      fontSize: 12,
      color: theme.text,
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
    goalCardDescription: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 4,
    },
    assessmentHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 0,
    },
    reassessButtonSmall: {
      borderWidth: 1,
      borderColor: theme.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    reassessButtonSmallText: {
      fontSize: 9,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    assessButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.primary,
      paddingVertical: 12,
      gap: 8,
    },
    assessButtonText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    assessmentResultCard: {
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 14,
      marginBottom: 12,
    },
    assessmentScoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    assessmentScoreBadge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    assessmentScoreText: {
      fontSize: 18,
      fontWeight: '800' as const,
      color: '#FFFFFF',
      fontFamily: 'monospace' as const,
    },
    assessmentCategoryLabel: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    assessmentTacticText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },

    assessmentImpressionsBlock: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 10,
      marginBottom: 8,
    },
    assessmentImpressionsLabel: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
      marginBottom: 4,
    },
    assessmentImpressionsText: {
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 18,
    },
    assessmentDateText: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      textAlign: 'right' as const,
      marginTop: 4,
    },
    assessmentDateTopRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 8,
    },
    assessmentDateTextTop: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      textAlign: 'right' as const,
    },
    assessmentForm: {
      marginTop: 12,
    },
    assessCriterion: {
      marginBottom: 16,
    },
    assessCriterionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    assessCriterionLabel: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    assessCriterionValue: {
      fontSize: 14,
      fontWeight: '800' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
    },
    assessCriterionHint: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginBottom: 8,
    },
    assessSliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    assessSliderEnd: {
      fontSize: 8,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      width: 32,
    },
    assessDotsRow: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    assessDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
    },
    assessDotActive: {
      borderColor: 'transparent',
    },
    assessmentPreview: {
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 14,
      marginBottom: 16,
      alignItems: 'center',
    },
    assessmentPreviewTitle: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
      marginBottom: 4,
    },
    assessmentPreviewCategory: {
      fontSize: 16,
      fontWeight: '800' as const,
      fontFamily: 'monospace' as const,
      marginBottom: 4,
    },
    assessmentPreviewAdvice: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      textAlign: 'center' as const,
      lineHeight: 16,
    },
    trustLevelSection: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 14,
      marginTop: 12,
    },
    trustLevelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    trustLevelTitle: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    trustLevelValue: {
      fontSize: 14,
      fontWeight: '800' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
    },
    trustLevelHint: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginBottom: 8,
    },
    trustSliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    trustTrack: {
      flex: 1,
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      justifyContent: 'center',
      position: 'relative' as const,
    },
    trustTrackFill: {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: theme.primary,
      borderRadius: 3,
    },
    trustThumb: {
      position: 'absolute' as const,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.primary,
      marginLeft: -10,
      top: -7,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3,
    },
    dossierStepsContainer: {
      marginLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: theme.border,
      paddingLeft: 10,
      marginTop: 4,
      marginBottom: 4,
    },
    dossierStepCard: {
      backgroundColor: theme.overlay,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 8,
      marginBottom: 4,
      borderRadius: 4,
    },
    dossierStepHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginBottom: 4,
    },
    dossierStepTypeBadge: {
      borderWidth: 1,
      borderColor: theme.primary,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 3,
    },
    dossierStepTypeText: {
      fontSize: 9,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    dossierStepContent: {
      fontSize: 11,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 16,
    },
    dossierStepResult: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
      fontStyle: 'italic' as const,
    },
    dossierStepCompletedBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      marginLeft: 'auto' as const,
    },
    dossierStepCheckbox: {
      width: 16,
      height: 16,
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 3,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    dossierStepCompletedText: {
      fontSize: 8,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
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
