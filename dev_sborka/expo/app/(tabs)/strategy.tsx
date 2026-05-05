import { useApp } from '@/contexts/AppContext';
import { GoalDirection, GoalStep, GoalStepType, StrategicGoal, DiaryEntry, ContactDossier, OsintData, OsintSourcedField } from '@/types';
import { loadOsintData } from '@/services/osint';
import {
  Target,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  X,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  Users,
  Calendar,
  Phone,
  MessageSquare,
  Footprints,
  Check,
  Search,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StrategyScreen({ initialGoalId }: { initialGoalId?: string } = {}) {
  const {
    goals, addGoal, updateGoal, deleteGoal,
    goalDirections, addGoalDirection, updateGoalDirection, deleteGoalDirection, reorderGoalDirections,
    dossiers, updateDossier, theme, t,
  } = useApp();

  const [expandedDirectionIds, setExpandedDirectionIds] = useState<string[]>(
    () => goalDirections.map(d => d.id)
  );
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const dirIdsRestoredRef = useRef(false);
  const goalIdRestoredRef = useRef(false);

  useEffect(() => {
    void AsyncStorage.getItem('strategy_expandedDirectionIds').then(stored => {
      if (stored) {
        try {
          setExpandedDirectionIds(JSON.parse(stored));
        } catch {}
      }
      dirIdsRestoredRef.current = true;
    });
    void AsyncStorage.getItem('strategy_expandedGoalId').then(stored => {
      if (stored !== null) {
        setExpandedGoalId(stored === '__null__' ? null : stored);
      }
      goalIdRestoredRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (dirIdsRestoredRef.current) {
      void AsyncStorage.setItem('strategy_expandedDirectionIds', JSON.stringify(expandedDirectionIds));
    }
  }, [expandedDirectionIds]);

  useEffect(() => {
    if (goalIdRestoredRef.current) {
      void AsyncStorage.setItem('strategy_expandedGoalId', expandedGoalId ?? '__null__');
    }
  }, [expandedGoalId]);

  const { goalId: paramGoalId } = useLocalSearchParams<{ goalId?: string }>();
  const activeGoalId = initialGoalId || paramGoalId;

  useEffect(() => {
    if (activeGoalId) {
      setExpandedGoalId(activeGoalId);
      const goal = goals.find(g => g.id === activeGoalId);
      if (goal?.directionId) {
        setExpandedDirectionIds(prev =>
          prev.includes(goal.directionId!) ? prev : [...prev, goal.directionId!]
        );
      }
    }
  }, [activeGoalId, goals]);

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [creatingGoalForDirection, setCreatingGoalForDirection] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formPriority, setFormPriority] = useState('5');
  const [formNextStep, setFormNextStep] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formContactIds, setFormContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [stepContactSearch, setStepContactSearch] = useState('');
  const [osintMap, setOsintMap] = useState<Record<string, OsintData | null>>({});
  const [formDirectionId, setFormDirectionId] = useState<string | undefined>(undefined);

  const [showDirectionModal, setShowDirectionModal] = useState(false);
  const [editingDirection, setEditingDirection] = useState<GoalDirection | null>(null);
  const [directionName, setDirectionName] = useState('');


  const [stepGoalId, setStepGoalId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [isCreatingStep, setIsCreatingStep] = useState(false);
  const [stepType, setStepType] = useState<GoalStepType>('meeting');
  const [stepContent, setStepContent] = useState('');
  const [stepResult, setStepResult] = useState('');
  const [stepContactIds, setStepContactIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      const map: Record<string, OsintData | null> = {};
      for (const d of dossiers) {
        try {
          map[d.contact.id] = await loadOsintData(d.contact.id);
        } catch {
          map[d.contact.id] = null;
        }
      }
      if (!cancelled) setOsintMap(map);
    };
    loadAll();
    return () => { cancelled = true; };
  }, [dossiers.length]);

  const TERM_OPTIONS = ['day', 'week', 'month', 'quarter', 'year'] as const;
  const getTermLabel = useCallback((term: string) => {
    const map: Record<string, string> = {
      day: t.strategy?.termDay ?? 'День',
      week: t.strategy?.termWeek ?? 'Неделя',
      month: t.strategy?.termMonth ?? 'Месяц',
      quarter: t.strategy?.termQuarter ?? 'Квартал',
      year: t.strategy?.termYear ?? 'Год',
    };
    return map[term] ?? term;
  }, [t]);

  const matchDossierFullText = useCallback((d: ContactDossier, query: string): boolean => {
    const q = query.toLowerCase();
    const c = d.contact;
    if (c.name.toLowerCase().includes(q)) return true;
    if (c.phoneNumbers?.some(p => p.toLowerCase().includes(q))) return true;
    if (c.emails?.some(e => e.toLowerCase().includes(q))) return true;
    if (c.company?.toLowerCase().includes(q)) return true;
    if (c.position?.toLowerCase().includes(q)) return true;
    if (c.goal?.toLowerCase().includes(q)) return true;
    if (c.notes?.toLowerCase().includes(q)) return true;
    if (c.birthday?.toLowerCase().includes(q)) return true;
    if (d.powerGrouping?.groupName?.toLowerCase().includes(q)) return true;
    if (d.sectors?.some(s => s.toLowerCase().includes(q))) return true;
    if (d.functionalCircle?.toLowerCase().includes(q)) return true;
    if (d.importance?.toLowerCase().includes(q)) return true;
    if (d.relationshipLevel?.toLowerCase().includes(q)) return true;
    if (d.nextAction?.toLowerCase().includes(q)) return true;
    if (d.relations?.some(r => {
      const relContact = dossiers.find(dd => dd.contact.id === r.contactId);
      return relContact?.contact.name.toLowerCase().includes(q);
    })) return true;
    if (d.powerGrouping?.vassalIds?.some(vid => {
      const vassal = dossiers.find(dd => dd.contact.id === vid);
      return vassal?.contact.name.toLowerCase().includes(q);
    })) return true;
    if (d.powerGrouping?.suzerainId) {
      const suzerain = dossiers.find(dd => dd.contact.id === d.powerGrouping!.suzerainId);
      if (suzerain?.contact.name.toLowerCase().includes(q)) return true;
    }
    if (d.assessment?.impressions?.toLowerCase().includes(q)) return true;
    const osint = osintMap[d.contact.id];
    if (osint) {
      const matchStr = (f?: OsintSourcedField<string>) => f?.value?.toLowerCase().includes(q);
      const matchArr = (f?: OsintSourcedField<string[]>) => Array.isArray(f?.value) ? f.value.some(v => v.toLowerCase().includes(q)) : typeof f?.value === 'string' ? (f.value as string).toLowerCase().includes(q) : false;
      const inp = osint.input;
      if (inp.nicknames?.toLowerCase().includes(q)) return true;
      if (inp.profileLinks?.toLowerCase().includes(q)) return true;
      if (inp.interests?.toLowerCase().includes(q)) return true;
      if (inp.city?.toLowerCase().includes(q)) return true;
      if (inp.freeformText?.toLowerCase().includes(q)) return true;
      if (inp.socialParsed) {
        const sp = inp.socialParsed;
        if (sp.instagram?.toLowerCase().includes(q)) return true;
        if (sp.telegram?.toLowerCase().includes(q)) return true;
        if (sp.vk?.toLowerCase().includes(q)) return true;
        if (sp.twitter?.toLowerCase().includes(q)) return true;
        if (sp.linkedin?.toLowerCase().includes(q)) return true;
      }
      const a = osint.analysis;
      if (a) {
        if (matchStr(a.facts.contacts)) return true;
        if (matchStr(a.facts.home)) return true;
        if (matchStr(a.facts.work)) return true;
        if (matchStr(a.facts.family)) return true;
        if (matchArr(a.facts.hobbies)) return true;
        if (matchArr(a.facts.friends)) return true;
        if (matchArr(a.facts.enemies)) return true;
        if (matchArr(a.facts.assets)) return true;
        if (matchArr(a.facts.debts)) return true;
        if (matchStr(a.traits.relationshipHistory)) return true;
        if (matchStr(a.traits.honesty)) return true;
        if (matchStr(a.traits.helpfulness)) return true;
        if (matchStr(a.traits.emotionalStability)) return true;
        if (matchArr(a.motivation.goals)) return true;
        if (matchArr(a.motivation.fears)) return true;
        if (matchArr(a.motivation.dreams)) return true;
        if (matchStr(a.motivation.politicalViews)) return true;
        if (matchStr(a.aiSummary.profile)) return true;
        if (matchStr(a.aiSummary.behaviorPrediction)) return true;
        if (matchArr(a.aiSummary.risks)) return true;
        if (matchArr(a.aiSummary.opportunities)) return true;
      }
    }
    return false;
  }, [dossiers, osintMap]);

  const filteredDossiers = useMemo(() => {
    if (!contactSearch.trim()) return dossiers;
    return dossiers.filter(d => matchDossierFullText(d, contactSearch));
  }, [dossiers, contactSearch, matchDossierFullText]);

  const filteredStepDossiers = useMemo(() => {
    if (!stepContactSearch.trim()) return dossiers;
    return dossiers.filter(d => matchDossierFullText(d, stepContactSearch));
  }, [dossiers, stepContactSearch, matchDossierFullText]);

  const styles = createStyles(theme);

  const sortedDirections = useMemo(() =>
    [...goalDirections].sort((a, b) => a.order - b.order),
    [goalDirections]
  );

  const goalsByDirection = useMemo(() => {
    const map: Record<string, StrategicGoal[]> = {};
    for (const dir of sortedDirections) {
      map[dir.id] = [];
    }
    map['__uncategorized'] = [];
    for (const g of goals) {
      if (g.directionId && map[g.directionId]) {
        map[g.directionId].push(g);
      } else {
        map['__uncategorized'].push(g);
      }
    }
    return map;
  }, [goals, sortedDirections]);

  const toggleDirection = useCallback((id: string) => {
    setExpandedDirectionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const openCreateGoalForm = useCallback((directionId?: string) => {
    setEditingGoalId(null);
    setCreatingGoalForDirection(directionId ?? '__uncategorized');
    setFormTitle('');
    setFormDesc('');
    setFormDeadline('');
    setFormPriority('5');
    setFormNextStep('');
    setFormNotes('');
    setFormContactIds([]);
    setFormDirectionId(directionId);
    setContactSearch('');
    if (directionId) {
      setExpandedDirectionIds(prev =>
        prev.includes(directionId) ? prev : [...prev, directionId]
      );
    }
  }, []);

  const openEditGoalInline = useCallback((goal: StrategicGoal) => {
    setCreatingGoalForDirection(null);
    setEditingGoalId(goal.id);
    setExpandedGoalId(goal.id);
    setFormTitle(goal.title);
    setFormDesc(goal.description);
    setFormDeadline(goal.deadline);
    setFormPriority(String(goal.priority));
    setFormNextStep(goal.nextStep);
    setFormNotes(goal.notes);
    setFormContactIds(goal.contactIds);
    setFormDirectionId(goal.directionId);
    setContactSearch('');
  }, []);

  const closeGoalForm = useCallback(() => {
    setEditingGoalId(null);
    setCreatingGoalForDirection(null);
  }, []);

  const handleSaveGoal = useCallback(() => {
    const title = formTitle.trim();
    if (!title) {
      Alert.alert(t.common.error, t.strategy?.enterTitle ?? 'Enter a title');
      return;
    }
    const priority = Math.min(10, Math.max(1, parseInt(formPriority, 10) || 5));

    if (editingGoalId) {
      updateGoal(editingGoalId, {
        title,
        description: formDesc,
        deadline: formDeadline,
        priority,
        nextStep: formNextStep,
        notes: formNotes,
        contactIds: formContactIds,
        directionId: formDirectionId,
      });
    } else {
      const newGoal: StrategicGoal = {
        id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        description: formDesc,
        deadline: formDeadline,
        priority,
        nextStep: formNextStep,
        notes: formNotes,
        contactIds: formContactIds,
        createdAt: new Date().toISOString(),
        directionId: formDirectionId,
      };
      addGoal(newGoal);
    }
    closeGoalForm();
  }, [editingGoalId, formTitle, formDesc, formDeadline, formPriority, formNextStep, formNotes, formContactIds, formDirectionId, addGoal, updateGoal, closeGoalForm, t]);

  const handleDeleteGoal = useCallback((id: string) => {
    Alert.alert(
      t.strategy?.deleteGoal ?? 'Delete Goal',
      t.strategy?.deleteGoalConfirm ?? 'Are you sure?',
      [
        { text: t.contact.cancel, style: 'cancel' },
        { text: t.contact.delete, style: 'destructive', onPress: () => deleteGoal(id) },
      ],
    );
  }, [deleteGoal, t]);

  const toggleContact = useCallback((contactId: string) => {
    setFormContactIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId],
    );
  }, []);

  const STEP_TYPES: GoalStepType[] = ['meeting', 'call', 'write', 'event'];

  const getStepTypeLabel = useCallback((type: GoalStepType) => {
    const map: Record<GoalStepType, string> = {
      meeting: t.strategy?.stepTypeMeeting ?? 'Meeting',
      call: t.strategy?.stepTypeCall ?? 'Call',
      write: t.strategy?.stepTypeWrite ?? 'Write',
      event: t.strategy?.stepTypeEvent ?? 'Event',
    };
    return map[type];
  }, [t]);

  const getStepTypeIcon = useCallback((type: GoalStepType) => {
    switch (type) {
      case 'meeting': return Calendar;
      case 'call': return Phone;
      case 'write': return MessageSquare;
      case 'event': return Users;
    }
  }, []);

  const openCreateStepInline = useCallback((goalId: string) => {
    setStepGoalId(goalId);
    setEditingStepId(null);
    setIsCreatingStep(true);
    setStepType('meeting');
    setStepContent('');
    setStepResult('');
    setStepContactIds([]);
    setStepContactSearch('');
  }, []);

  const openEditStepInline = useCallback((goalId: string, step: GoalStep) => {
    setStepGoalId(goalId);
    setEditingStepId(step.id);
    setIsCreatingStep(false);
    setStepType(step.type);
    setStepContent(step.content);
    setStepResult(step.result);
    setStepContactIds(step.contactIds);
    setStepContactSearch('');
  }, []);

  const closeStepForm = useCallback(() => {
    setStepGoalId(null);
    setEditingStepId(null);
    setIsCreatingStep(false);
    setStepType('meeting');
    setStepContent('');
    setStepResult('');
    setStepContactIds([]);
  }, []);

  const handleSaveStep = useCallback(() => {
    if (!stepGoalId) return;
    const content = stepContent.trim();
    if (!content) {
      Alert.alert(t.common.error, t.strategy?.stepContentPlaceholder ?? 'Describe the step');
      return;
    }

    const goal = goals.find(g => g.id === stepGoalId);
    if (!goal) return;

    const existingSteps = goal.steps || [];

    let updatedSteps: GoalStep[];
    if (editingStepId) {
      updatedSteps = existingSteps.map(s =>
        s.id === editingStepId
          ? { ...s, type: stepType, content, result: stepResult, contactIds: stepContactIds }
          : s
      );
    } else {
      const maxOrder = existingSteps.length > 0
        ? Math.max(...existingSteps.map(s => s.order)) + 1
        : 0;
      const newStep: GoalStep = {
        id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: stepType,
        content,
        result: stepResult,
        contactIds: stepContactIds,
        order: maxOrder,
      };
      updatedSteps = [...existingSteps, newStep];
    }

    const allStepContactIds = updatedSteps.flatMap(s => s.contactIds);
    const mergedContactIds = Array.from(new Set([...goal.contactIds, ...allStepContactIds]));

    updateGoal(stepGoalId, { steps: updatedSteps, contactIds: mergedContactIds });
    closeStepForm();
  }, [stepGoalId, stepContent, stepResult, stepType, stepContactIds, editingStepId, goals, updateGoal, t, closeStepForm]);

  const handleToggleStepCompleted = useCallback((goalId: string, stepId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const step = (goal.steps || []).find(s => s.id === stepId);
    if (!step) return;

    const newCompleted = !step.completed;
    const updatedSteps = (goal.steps || []).map(s =>
      s.id === stepId ? { ...s, completed: newCompleted } : s
    );
    updateGoal(goalId, { steps: updatedSteps });

    if (newCompleted && step.contactIds.length > 0) {
      const stepTypeLabel = {
        meeting: t.strategy?.stepTypeMeeting ?? 'Meeting',
        call: t.strategy?.stepTypeCall ?? 'Call',
        write: t.strategy?.stepTypeWrite ?? 'Write',
        event: t.strategy?.stepTypeEvent ?? 'Event',
      }[step.type];
      const diaryContent = `[${t.strategy?.stepCompletedDiary ?? 'Step completed'}] ${goal.title}: [${stepTypeLabel}] ${step.content}${step.result ? '\n' + (t.strategy?.stepResult ?? 'Result') + ': ' + step.result : ''}`;

      for (const contactId of step.contactIds) {
        const dossier = dossiers.find(d => d.contact.id === contactId);
        if (dossier) {
          const entry: DiaryEntry = {
            id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            date: new Date(),
            type: 'auto',
            content: diaryContent,
          };
          updateDossier(contactId, {
            diary: [...(dossier.diary || []), entry],
            lastInteraction: new Date(),
          });
        }
      }
    }
  }, [goals, updateGoal, dossiers, updateDossier, t]);

  const handleDeleteStep = useCallback((goalId: string, stepId: string) => {
    Alert.alert(
      t.strategy?.deleteStep ?? 'Delete Step',
      t.strategy?.deleteStepConfirm ?? 'Are you sure?',
      [
        { text: t.contact.cancel, style: 'cancel' },
        {
          text: t.contact.delete,
          style: 'destructive',
          onPress: () => {
            const goal = goals.find(g => g.id === goalId);
            if (!goal) return;
            const updatedSteps = (goal.steps || []).filter(s => s.id !== stepId);
            updateGoal(goalId, { steps: updatedSteps });
          },
        },
      ],
    );
  }, [goals, updateGoal, t]);

  const moveStep = useCallback((goalId: string, stepId: string, direction: 'up' | 'down') => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const sorted = [...(goal.steps || [])].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === stepId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const tempOrder = sorted[idx].order;
    sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
    sorted[swapIdx] = { ...sorted[swapIdx], order: tempOrder };
    updateGoal(goalId, { steps: sorted });
  }, [goals, updateGoal]);

  const toggleStepContact = useCallback((contactId: string) => {
    setStepContactIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId],
    );
  }, []);

  const openCreateDirectionModal = useCallback(() => {
    setEditingDirection(null);
    setDirectionName('');
    setShowDirectionModal(true);
  }, []);

  const openEditDirectionModal = useCallback((dir: GoalDirection) => {
    setEditingDirection(dir);
    setDirectionName(dir.name);
    setShowDirectionModal(true);
  }, []);

  const handleSaveDirection = useCallback(() => {
    const name = directionName.trim();
    if (!name) return;

    if (editingDirection) {
      updateGoalDirection(editingDirection.id, { name });
    } else {
      const maxOrder = sortedDirections.length > 0
        ? Math.max(...sortedDirections.map(d => d.order)) + 1
        : 0;
      addGoalDirection({
        id: `dir_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        order: maxOrder,
      });
    }
    setShowDirectionModal(false);
  }, [directionName, editingDirection, sortedDirections, addGoalDirection, updateGoalDirection]);

  const handleDeleteDirection = useCallback((dir: GoalDirection) => {
    Alert.alert(
      t.strategy?.deleteDirection ?? 'Delete Direction',
      t.strategy?.deleteDirectionConfirm ?? 'Delete direction? Goals inside won\'t be deleted.',
      [
        { text: t.contact.cancel, style: 'cancel' },
        { text: t.contact.delete, style: 'destructive', onPress: () => deleteGoalDirection(dir.id) },
      ],
    );
  }, [deleteGoalDirection, t]);

  const moveDirection = useCallback((dirId: string, direction: 'up' | 'down') => {
    const idx = sortedDirections.findIndex(d => d.id === dirId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedDirections.length) return;

    const reordered = [...sortedDirections];
    const tempOrder = reordered[idx].order;
    reordered[idx] = { ...reordered[idx], order: reordered[swapIdx].order };
    reordered[swapIdx] = { ...reordered[swapIdx], order: tempOrder };
    reorderGoalDirections(reordered);
  }, [sortedDirections, reorderGoalDirections]);

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return theme.danger;
    if (priority >= 5) return theme.warning;
    return theme.success;
  };

  const renderPriorityDots = (priority: number, size: number = 8, onSelect?: (value: number) => void) => {
    const color = getPriorityColor(priority);
    return (
      <View style={styles.priorityDotsRow}>
        {Array.from({ length: 10 }, (_, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={onSelect ? 0.6 : 1}
            onPress={onSelect ? () => onSelect(i + 1) : undefined}
            disabled={!onSelect}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            <View
              style={[
                styles.priorityDot,
                { width: size, height: size, borderRadius: size / 2 },
                i < priority
                  ? { backgroundColor: color }
                  : { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderInlineGoalCreateForm = () => (
    <View style={styles.inlineGoalForm}>
      <View style={styles.inlineStepFormHeader}>
        <Text style={styles.inlineStepFormTitle}>
          {t.strategy?.newGoal ?? 'NEW GOAL'}
        </Text>
        <TouchableOpacity onPress={closeGoalForm} activeOpacity={0.7}>
          <X size={16} color={theme.primaryDim} />
        </TouchableOpacity>
      </View>

      <View style={styles.inlineField}>
        <Text style={styles.fieldLabel}>{t.strategy?.goalTitle ?? 'TITLE'}</Text>
        <TextInput
          style={styles.inlineInput}
          value={formTitle}
          onChangeText={setFormTitle}
          placeholder="В двух словах..."
          placeholderTextColor={theme.primaryDim}
          autoFocus
        />
      </View>

      <View style={styles.inlineField}>
        <Text style={styles.fieldLabel}>{t.strategy?.selectDirection ?? 'DIRECTION'}</Text>
        <View style={styles.directionPicker}>
          <TouchableOpacity
            style={[
              styles.inlinePickerItem,
              !formDirectionId && styles.dirPickerItemActive,
            ]}
            onPress={() => setFormDirectionId(undefined)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.dirPickerText,
              !formDirectionId && styles.dirPickerTextActive,
            ]}>—</Text>
          </TouchableOpacity>
          {sortedDirections.map(dir => (
            <TouchableOpacity
              key={dir.id}
              style={[
                styles.inlinePickerItem,
                formDirectionId === dir.id && styles.dirPickerItemActive,
              ]}
              onPress={() => setFormDirectionId(dir.id)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dirPickerText,
                formDirectionId === dir.id && styles.dirPickerTextActive,
              ]}>{dir.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inlineField}>
        <Text style={styles.fieldLabel}>{t.strategy?.description ?? 'DESCRIPTION'}</Text>
        <TextInput
          style={[styles.inlineInput, styles.inlineTextArea]}
          value={formDesc}
          onChangeText={setFormDesc}
          placeholder={t.strategy?.descPlaceholder ?? 'Describe your goal...'}
          placeholderTextColor={theme.primaryDim}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={[styles.formRow, { gap: 8 }]}>
        <View style={[styles.inlineField, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>{t.strategy?.priority ?? 'PRIORITY'}</Text>
          <View style={styles.priorityDotsInput}>
            {renderPriorityDots(parseInt(formPriority, 10) || 5, 10, (val) => setFormPriority(String(val)))}
          </View>
        </View>
        <View style={[styles.inlineField, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>{t.strategy?.deadline ?? 'СРОК'}</Text>
          <View style={styles.termPicker}>
            {TERM_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.termPickerItem,
                  formDeadline === opt && styles.termPickerItemActive,
                ]}
                onPress={() => setFormDeadline(formDeadline === opt ? '' : opt)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.termPickerText,
                  formDeadline === opt && styles.termPickerTextActive,
                ]}>{getTermLabel(opt)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {dossiers.length > 0 && (
        <View style={styles.inlineField}>
          <Text style={styles.fieldLabel}>{t.strategy?.keyContacts ?? 'KEY CONTACTS'}</Text>
          <View style={styles.contactSearchRow}>
            <Search size={14} color={theme.primaryDim} />
            <TextInput
              style={styles.contactSearchInput}
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder={t.strategy?.searchContacts ?? 'Поиск...'}
              placeholderTextColor={theme.primaryDim}
            />
          </View>
          <ScrollView style={styles.inlineContactPicker} contentContainerStyle={styles.inlineContactPickerContent} nestedScrollEnabled>
            {filteredDossiers.map(d => {
              const isSelected = formContactIds.includes(d.contact.id);
              return (
                <TouchableOpacity
                  key={d.contact.id}
                  style={[
                    styles.inlineContactItem,
                    isSelected && styles.contactPickerItemActive,
                  ]}
                  onPress={() => toggleContact(d.contact.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.contactPickerText,
                      isSelected && styles.contactPickerTextActive,
                    ]}
                  >
                    {d.contact.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={[styles.formRow, { marginTop: 6 }]}>
        <TouchableOpacity style={[styles.inlineSaveBtn, { flex: 1 }]} onPress={closeGoalForm} activeOpacity={0.7}>
          <Text style={[styles.inlineSaveBtnText, { color: theme.primaryDim }]}>{t.contact.cancel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.inlineSaveBtn, { flex: 1 }]} onPress={handleSaveGoal} activeOpacity={0.7}>
          <Text style={styles.inlineSaveBtnText}>{t.contact.save}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGoal = (goal: StrategicGoal) => {
    const isExpanded = expandedGoalId === goal.id;
    const linkedContacts = dossiers.filter(d => goal.contactIds.includes(d.contact.id));
    const priorityColor = getPriorityColor(goal.priority);

    return (
      <View key={goal.id} style={styles.goalCard}>
        <TouchableOpacity
          style={styles.goalHeader}
          onPress={() => setExpandedGoalId(isExpanded ? null : goal.id)}
          activeOpacity={0.7}
          testID={`strategy-goal-${goal.id}`}
        >
          <View style={styles.goalHeaderLeft}>
            <Text style={styles.goalTitle}>{goal.title}</Text>
            {goal.description ? (
              <Text style={styles.goalDesc} numberOfLines={1}>{goal.description}</Text>
            ) : null}
            <View style={styles.priorityContainer}>
              {renderPriorityDots(goal.priority)}
              {goal.deadline ? (
                <Text style={styles.deadlineText}>
                  {t.strategy?.deadline ?? 'СРОК'}: {getTermLabel(goal.deadline)}
                </Text>
              ) : null}
            </View>
          </View>
          {isExpanded ? (
            <ChevronUp size={16} color={theme.primaryDim} />
          ) : (
            <ChevronDown size={16} color={theme.primaryDim} />
          )}
        </TouchableOpacity>

        {isExpanded && editingGoalId !== goal.id && (
          <View style={styles.goalDetail}>
            {goal.description ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>{t.strategy?.description ?? 'DESCRIPTION'}</Text>
                <Text style={styles.detailText}>{goal.description}</Text>
              </View>
            ) : null}

            {linkedContacts.length > 0 && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>{t.strategy?.keyContacts ?? 'KEY CONTACTS'}</Text>
                <View style={styles.contactBadges}>
                  {linkedContacts.map(d => (
                    <View key={d.contact.id} style={styles.contactBadge}>
                      <Text style={styles.contactBadgeText}>{d.contact.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Steps block */}
            <View style={styles.stepsBlock}>
              <View style={styles.stepsHeader}>
                <View style={styles.stepsHeaderLeft}>
                  <Footprints size={14} color={theme.primary} />
                  <Text style={[styles.detailLabel, { color: theme.primary, marginBottom: 0 }]}>
                    {t.strategy?.steps ?? 'NEXT STEPS'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addStepHeaderBtn}
                  onPress={() => openCreateStepInline(goal.id)}
                  activeOpacity={0.7}
                >
                  <Plus size={14} color={theme.primary} />
                </TouchableOpacity>
              </View>
              {(() => {
                const sortedSteps = [...(goal.steps || [])].sort((a, b) => a.order - b.order);
                if (sortedSteps.length === 0 && !(stepGoalId === goal.id && isCreatingStep)) {
                  return (
                    <Text style={styles.noStepsText}>
                      {t.strategy?.noSteps ?? 'No steps'}
                    </Text>
                  );
                }
                return sortedSteps.map((step, sIdx) => {
                  const StepIcon = getStepTypeIcon(step.type);
                  const sContacts = dossiers.filter(d => step.contactIds.includes(d.contact.id));
                  const isEditingThis = stepGoalId === goal.id && editingStepId === step.id;

                  if (isEditingThis) {
                    return (
                      <View key={step.id} style={[styles.stepCard, { borderColor: theme.primary }]}>
                        <View style={styles.inlineField}>
                          <Text style={styles.fieldLabel}>{t.strategy?.stepType ?? 'TYPE'}</Text>
                          <View style={styles.directionPicker}>
                            {STEP_TYPES.map(st => (
                              <TouchableOpacity
                                key={st}
                                style={[
                                  styles.inlinePickerItem,
                                  stepType === st && styles.dirPickerItemActive,
                                ]}
                                onPress={() => setStepType(st)}
                                activeOpacity={0.7}
                              >
                                <Text style={[
                                  styles.dirPickerText,
                                  stepType === st && styles.dirPickerTextActive,
                                ]}>{getStepTypeLabel(st)}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View style={styles.inlineField}>
                          <Text style={styles.fieldLabel}>{t.strategy?.stepContent ?? 'CONTENT'}</Text>
                          <TextInput
                            style={[styles.inlineInput, styles.inlineTextArea]}
                            value={stepContent}
                            onChangeText={setStepContent}
                            placeholder={t.strategy?.stepContentPlaceholder ?? 'Describe the step...'}
                            placeholderTextColor={theme.primaryDim}
                            multiline
                            numberOfLines={2}
                          />
                        </View>
                        <View style={styles.inlineField}>
                          <Text style={styles.fieldLabel}>{t.strategy?.stepResult ?? 'RESULT'}</Text>
                          <TextInput
                            style={[styles.inlineInput, styles.inlineTextArea]}
                            value={stepResult}
                            onChangeText={setStepResult}
                            placeholder={t.strategy?.stepResultPlaceholder ?? 'Step result...'}
                            placeholderTextColor={theme.primaryDim}
                            multiline
                            numberOfLines={2}
                          />
                        </View>
                        {dossiers.length > 0 && (
                          <View style={styles.inlineField}>
                            <Text style={styles.fieldLabel}>{t.strategy?.stepContacts ?? 'STEP CONTACTS'}</Text>
                            <View style={styles.contactSearchRow}>
                              <Search size={14} color={theme.primaryDim} />
                              <TextInput
                                style={styles.contactSearchInput}
                                value={stepContactSearch}
                                onChangeText={setStepContactSearch}
                                placeholder={t.strategy?.searchContacts ?? 'Поиск...'}
                                placeholderTextColor={theme.primaryDim}
                              />
                            </View>
                            <ScrollView style={styles.inlineContactPicker} contentContainerStyle={styles.inlineContactPickerContent} nestedScrollEnabled>
                              {filteredStepDossiers.map(d => {
                                const isSelected = stepContactIds.includes(d.contact.id);
                                return (
                                  <TouchableOpacity
                                    key={d.contact.id}
                                    style={[
                                      styles.inlineContactItem,
                                      isSelected && styles.contactPickerItemActive,
                                    ]}
                                    onPress={() => toggleStepContact(d.contact.id)}
                                    activeOpacity={0.7}
                                  >
                                    <Text
                                      style={[
                                        styles.contactPickerText,
                                        isSelected && styles.contactPickerTextActive,
                                      ]}
                                    >
                                      {d.contact.name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          </View>
                        )}
                        <View style={[styles.formRow, { marginTop: 6 }]}>
                          <TouchableOpacity style={[styles.inlineSaveBtn, { flex: 1 }]} onPress={closeStepForm} activeOpacity={0.7}>
                            <Text style={[styles.inlineSaveBtnText, { color: theme.primaryDim }]}>{t.contact.cancel}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.inlineSaveBtn, { flex: 1 }]} onPress={handleSaveStep} activeOpacity={0.7}>
                            <Text style={styles.inlineSaveBtnText}>{t.contact.save}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={step.id} style={[styles.stepCard, step.completed && styles.stepCardCompleted]}>
                      <View style={styles.stepCardHeader}>
                        <View style={styles.stepCardLeft}>
                          <View style={styles.stepTypeBadgeRow}>
                            <View style={styles.stepTypeBadge}>
                              <StepIcon size={12} color={step.completed ? theme.primaryDim : theme.primary} />
                              <Text style={[styles.stepTypeText, step.completed && { color: theme.primaryDim }]}>{getStepTypeLabel(step.type)}</Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.completedCheckbox, step.completed && { backgroundColor: theme.success ?? '#059669', borderColor: theme.success ?? '#059669' }]}
                              onPress={() => handleToggleStepCompleted(goal.id, step.id)}
                              activeOpacity={0.7}
                            >
                              {step.completed && <Check size={12} color="#fff" />}
                            </TouchableOpacity>
                            <Text style={[styles.completedLabel, step.completed && { color: theme.success ?? '#059669' }]}>
                              {t.strategy?.stepCompleted ?? 'Completed'}
                            </Text>
                          </View>
                          <Text style={[styles.stepContentText, step.completed && { textDecorationLine: 'line-through' as const, color: theme.primaryDim }]} numberOfLines={2}>{step.content}</Text>
                        </View>
                        <View style={styles.stepCardActions}>
                          <TouchableOpacity
                            onPress={() => moveStep(goal.id, step.id, 'up')}
                            style={styles.stepActionBtn}
                            disabled={sIdx === 0}
                            activeOpacity={0.6}
                          >
                            <ArrowUp size={12} color={sIdx === 0 ? theme.border : theme.primaryDim} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => moveStep(goal.id, step.id, 'down')}
                            style={styles.stepActionBtn}
                            disabled={sIdx === sortedSteps.length - 1}
                            activeOpacity={0.6}
                          >
                            <ArrowDown size={12} color={sIdx === sortedSteps.length - 1 ? theme.border : theme.primaryDim} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => openEditStepInline(goal.id, step)}
                            style={styles.stepActionBtn}
                            activeOpacity={0.6}
                          >
                            <Edit3 size={12} color={theme.primaryDim} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteStep(goal.id, step.id)}
                            style={styles.stepActionBtn}
                            activeOpacity={0.6}
                          >
                            <Trash2 size={12} color={theme.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {step.result ? (
                        <Text style={[styles.stepResultText, step.completed && { color: theme.primaryDim }]}>{step.result}</Text>
                      ) : null}
                      {sContacts.length > 0 && (
                        <View style={styles.stepContactBadges}>
                          {sContacts.map(d => (
                            <View key={d.contact.id} style={styles.stepContactBadge}>
                              <Text style={styles.stepContactBadgeText}>{d.contact.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                });
              })()}
              {stepGoalId === goal.id && isCreatingStep && (
                <View style={styles.inlineStepForm}>
                  <View style={styles.inlineStepFormHeader}>
                    <Text style={styles.inlineStepFormTitle}>
                      {t.strategy?.addStep ?? 'ADD STEP'}
                    </Text>
                    <TouchableOpacity onPress={closeStepForm} activeOpacity={0.7}>
                      <X size={16} color={theme.primaryDim} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inlineField}>
                    <Text style={styles.fieldLabel}>{t.strategy?.stepType ?? 'TYPE'}</Text>
                    <View style={styles.directionPicker}>
                      {STEP_TYPES.map(st => (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.inlinePickerItem,
                            stepType === st && styles.dirPickerItemActive,
                          ]}
                          onPress={() => setStepType(st)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.dirPickerText,
                            stepType === st && styles.dirPickerTextActive,
                          ]}>{getStepTypeLabel(st)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inlineField}>
                    <Text style={styles.fieldLabel}>{t.strategy?.stepContent ?? 'CONTENT'}</Text>
                    <TextInput
                      style={[styles.inlineInput, styles.inlineTextArea]}
                      value={stepContent}
                      onChangeText={setStepContent}
                      placeholder={t.strategy?.stepContentPlaceholder ?? 'Describe the step...'}
                      placeholderTextColor={theme.primaryDim}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  <View style={styles.inlineField}>
                    <Text style={styles.fieldLabel}>{t.strategy?.stepResult ?? 'RESULT'}</Text>
                    <TextInput
                      style={[styles.inlineInput, styles.inlineTextArea]}
                      value={stepResult}
                      onChangeText={setStepResult}
                      placeholder={t.strategy?.stepResultPlaceholder ?? 'Step result...'}
                      placeholderTextColor={theme.primaryDim}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  {dossiers.length > 0 && (
                    <View style={styles.inlineField}>
                      <Text style={styles.fieldLabel}>{t.strategy?.stepContacts ?? 'STEP CONTACTS'}</Text>
                      <View style={styles.contactSearchRow}>
                        <Search size={14} color={theme.primaryDim} />
                        <TextInput
                          style={styles.contactSearchInput}
                          value={stepContactSearch}
                          onChangeText={setStepContactSearch}
                          placeholder={t.strategy?.searchContacts ?? 'Поиск...'}
                          placeholderTextColor={theme.primaryDim}
                        />
                      </View>
                      <ScrollView style={styles.inlineContactPicker} contentContainerStyle={styles.inlineContactPickerContent} nestedScrollEnabled>
                        {filteredStepDossiers.map(d => {
                          const isSelected = stepContactIds.includes(d.contact.id);
                          return (
                            <TouchableOpacity
                              key={d.contact.id}
                              style={[
                                styles.inlineContactItem,
                                isSelected && styles.contactPickerItemActive,
                              ]}
                              onPress={() => toggleStepContact(d.contact.id)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.contactPickerText,
                                  isSelected && styles.contactPickerTextActive,
                                ]}
                              >
                                {d.contact.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  <TouchableOpacity style={styles.inlineSaveBtn} onPress={handleSaveStep} activeOpacity={0.7}>
                    <Text style={styles.inlineSaveBtnText}>{t.contact.save}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.goalActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => openEditGoalInline(goal)}
                activeOpacity={0.7}
              >
                <Edit3 size={14} color={theme.primary} />
                <Text style={styles.actionBtnText}>{t.contact.edit}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={() => handleDeleteGoal(goal.id)}
                activeOpacity={0.7}
              >
                <Trash2 size={14} color={theme.danger} />
                <Text style={[styles.actionBtnText, { color: theme.danger }]}>{t.contact.delete}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isExpanded && editingGoalId === goal.id && (
          <View style={styles.inlineGoalForm}>
            <View style={styles.inlineStepFormHeader}>
              <Text style={styles.inlineStepFormTitle}>
                {t.strategy?.editGoal ?? 'EDIT GOAL'}
              </Text>
              <TouchableOpacity onPress={closeGoalForm} activeOpacity={0.7}>
                <X size={16} color={theme.primaryDim} />
              </TouchableOpacity>
            </View>

            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>{t.strategy?.goalTitle ?? 'TITLE'}</Text>
              <TextInput
                style={styles.inlineInput}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="В двух словах..."
                placeholderTextColor={theme.primaryDim}
              />
            </View>

            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>{t.strategy?.selectDirection ?? 'DIRECTION'}</Text>
              <View style={styles.directionPicker}>
                <TouchableOpacity
                  style={[
                    styles.inlinePickerItem,
                    !formDirectionId && styles.dirPickerItemActive,
                  ]}
                  onPress={() => setFormDirectionId(undefined)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dirPickerText,
                    !formDirectionId && styles.dirPickerTextActive,
                  ]}>—</Text>
                </TouchableOpacity>
                {sortedDirections.map(dir => (
                  <TouchableOpacity
                    key={dir.id}
                    style={[
                      styles.inlinePickerItem,
                      formDirectionId === dir.id && styles.dirPickerItemActive,
                    ]}
                    onPress={() => setFormDirectionId(dir.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dirPickerText,
                      formDirectionId === dir.id && styles.dirPickerTextActive,
                    ]}>{dir.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>{t.strategy?.description ?? 'DESCRIPTION'}</Text>
              <TextInput
                style={[styles.inlineInput, styles.inlineTextArea]}
                value={formDesc}
                onChangeText={setFormDesc}
                placeholder={t.strategy?.descPlaceholder ?? 'Describe your goal...'}
                placeholderTextColor={theme.primaryDim}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={[styles.formRow, { gap: 8 }]}>
              <View style={[styles.inlineField, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t.strategy?.priority ?? 'PRIORITY'}</Text>
                <View style={styles.priorityDotsInput}>
                  {renderPriorityDots(parseInt(formPriority, 10) || 5, 10, (val) => setFormPriority(String(val)))}
                </View>
              </View>
              <View style={[styles.inlineField, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t.strategy?.deadline ?? 'СРОК'}</Text>
                <View style={styles.termPicker}>
                  {TERM_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.termPickerItem,
                        formDeadline === opt && styles.termPickerItemActive,
                      ]}
                      onPress={() => setFormDeadline(formDeadline === opt ? '' : opt)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.termPickerText,
                        formDeadline === opt && styles.termPickerTextActive,
                      ]}>{getTermLabel(opt)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {dossiers.length > 0 && (
              <View style={styles.inlineField}>
                <Text style={styles.fieldLabel}>{t.strategy?.keyContacts ?? 'KEY CONTACTS'}</Text>
                <View style={styles.contactSearchRow}>
                  <Search size={14} color={theme.primaryDim} />
                  <TextInput
                    style={styles.contactSearchInput}
                    value={contactSearch}
                    onChangeText={setContactSearch}
                    placeholder={t.strategy?.searchContacts ?? 'Поиск...'}
                    placeholderTextColor={theme.primaryDim}
                  />
                </View>
                <ScrollView style={styles.inlineContactPicker} contentContainerStyle={styles.inlineContactPickerContent} nestedScrollEnabled>
                  {filteredDossiers.map(d => {
                    const isSelected = formContactIds.includes(d.contact.id);
                    return (
                      <TouchableOpacity
                        key={d.contact.id}
                        style={[
                          styles.inlineContactItem,
                          isSelected && styles.contactPickerItemActive,
                        ]}
                        onPress={() => toggleContact(d.contact.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.contactPickerText,
                            isSelected && styles.contactPickerTextActive,
                          ]}
                        >
                          {d.contact.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={[styles.formRow, { marginTop: 6 }]}>
              <TouchableOpacity style={[styles.inlineSaveBtn, { flex: 1 }]} onPress={closeGoalForm} activeOpacity={0.7}>
                <Text style={[styles.inlineSaveBtnText, { color: theme.primaryDim }]}>{t.contact.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.inlineSaveBtn, { flex: 1 }]} onPress={handleSaveGoal} activeOpacity={0.7}>
                <Text style={styles.inlineSaveBtnText}>{t.contact.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderDirectionSection = (dir: GoalDirection, index: number) => {
    const isExpanded = expandedDirectionIds.includes(dir.id);
    const dirGoals = goalsByDirection[dir.id] || [];

    return (
      <View key={dir.id} style={styles.directionSection}>
        <TouchableOpacity
          style={styles.directionHeader}
          onPress={() => toggleDirection(dir.id)}
          activeOpacity={0.7}
        >
          <View style={styles.directionHeaderLeft}>
            <FolderOpen size={18} color={theme.primary} />
            <Text style={styles.directionTitle}>{dir.name}</Text>
            <View style={styles.directionCount}>
              <Text style={styles.directionCountText}>{dirGoals.length}</Text>
            </View>
          </View>
          <View style={styles.directionHeaderRight}>
            <TouchableOpacity
              onPress={() => moveDirection(dir.id, 'up')}
              style={styles.reorderBtn}
              disabled={index === 0}
              activeOpacity={0.6}
            >
              <ArrowUp size={14} color={index === 0 ? theme.border : theme.primaryDim} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => moveDirection(dir.id, 'down')}
              style={styles.reorderBtn}
              disabled={index === sortedDirections.length - 1}
              activeOpacity={0.6}
            >
              <ArrowDown size={14} color={index === sortedDirections.length - 1 ? theme.border : theme.primaryDim} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openEditDirectionModal(dir)}
              style={styles.reorderBtn}
              activeOpacity={0.6}
            >
              <Edit3 size={14} color={theme.primaryDim} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteDirection(dir)}
              style={styles.reorderBtn}
              activeOpacity={0.6}
            >
              <Trash2 size={14} color={theme.danger} />
            </TouchableOpacity>
            {isExpanded ? (
              <ChevronUp size={18} color={theme.primaryDim} />
            ) : (
              <ChevronDown size={18} color={theme.primaryDim} />
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.directionContent}>
            {dirGoals.length === 0 ? (
              <Text style={styles.emptyDirText}>{t.strategy?.noGoals ?? 'No goals'}</Text>
            ) : (
              dirGoals.map(renderGoal)
            )}
            {creatingGoalForDirection === dir.id && !editingGoalId ? (
              renderInlineGoalCreateForm()
            ) : (
              <TouchableOpacity
                style={styles.addGoalInDir}
                onPress={() => openCreateGoalForm(dir.id)}
                activeOpacity={0.7}
              >
                <Plus size={16} color={theme.primary} />
                <Text style={styles.addGoalInDirText}>{t.strategy?.addGoal ?? 'ADD GOAL'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const uncategorizedGoals = goalsByDirection['__uncategorized'] || [];

  return (
    <View style={styles.background} testID="strategyTabRoot">
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Target size={28} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>{t.strategy?.title ?? 'GOAL'}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {sortedDirections.map((dir, index) => renderDirectionSection(dir, index))}

          {uncategorizedGoals.length > 0 && (
            <View style={styles.directionSection}>
              <View style={styles.directionHeader}>
                <View style={styles.directionHeaderLeft}>
                  <FolderOpen size={18} color={theme.primaryDim} />
                  <Text style={[styles.directionTitle, { color: theme.primaryDim }]}>
                    {t.strategy?.uncategorized ?? 'UNCATEGORIZED'}
                  </Text>
                  <View style={styles.directionCount}>
                    <Text style={styles.directionCountText}>{uncategorizedGoals.length}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.directionContent}>
                {uncategorizedGoals.map(renderGoal)}
              </View>
            </View>
          )}

          {creatingGoalForDirection === '__uncategorized' && !editingGoalId && (
            <View style={[styles.directionSection, { marginBottom: 16 }]}>
              <View style={styles.directionContent}>
                {renderInlineGoalCreateForm()}
              </View>
            </View>
          )}

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.bottomBtn}
              onPress={openCreateDirectionModal}
              activeOpacity={0.7}
            >
              <Plus size={18} color={theme.primary} />
              <Text style={styles.bottomBtnText}>
                {t.strategy?.addDirection ?? 'ADD DIRECTION'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomBtn}
              onPress={() => openCreateGoalForm()}
              activeOpacity={0.7}
            >
              <Plus size={18} color={theme.primary} />
              <Text style={styles.bottomBtnText}>
                {t.strategy?.addGoal ?? 'ADD GOAL'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>




        {/* Direction Modal */}
        <Modal visible={showDirectionModal} animationType="slide" onRequestClose={() => setShowDirectionModal(false)}>
          <View style={styles.modalContainer}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.modalContent} edges={['top']}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingDirection
                    ? (t.strategy?.editDirection ?? 'EDIT DIRECTION')
                    : (t.strategy?.addDirection ?? 'ADD DIRECTION')}
                </Text>
                <TouchableOpacity onPress={() => setShowDirectionModal(false)} activeOpacity={0.7}>
                  <X size={24} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.formContent}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t.strategy?.directionName ?? 'Direction name'}</Text>
                  <TextInput
                    style={styles.input}
                    value={directionName}
                    onChangeText={setDirectionName}
                    placeholder={t.strategy?.directionName ?? 'Direction name'}
                    placeholderTextColor={theme.primaryDim}
                    autoFocus
                  />
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={handleSaveDirection} activeOpacity={0.7}>
                  <Text style={styles.saveButtonText}>{t.contact.save}</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    background: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1 },
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
    list: { padding: 16, paddingBottom: 100 },
    directionSection: {
      marginBottom: 16,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
    },
    directionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    directionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    directionTitle: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
    },
    directionCount: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    directionCountText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.background,
      fontFamily: 'monospace' as const,
    },
    directionHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    reorderBtn: {
      padding: 6,
    },
    directionContent: {
      padding: 10,
    },
    emptyDirText: {
      fontSize: 12,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      textAlign: 'center',
      paddingVertical: 12,
    },
    addGoalInDir: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed' as const,
      marginTop: 4,
    },
    addGoalInDirText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    bottomActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    bottomBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 2,
      borderColor: theme.primary,
      paddingVertical: 14,
    },
    bottomBtnText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    goalCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card ?? theme.background,
      marginBottom: 8,
      overflow: 'hidden',
    },
    goalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 12,
      gap: 10,
    },
    goalHeaderLeft: { flex: 1, minWidth: 0 },
    goalTitle: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    goalDesc: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 4,
    },
    priorityContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      marginTop: 8,
      flexWrap: 'wrap' as const,
    },
    priorityDotsRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 3,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    priorityDotsInput: {
      paddingVertical: 8,
    },
    termPicker: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 4,
    },
    termPickerItem: {
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    termPickerItemActive: {
      borderColor: theme.primary,
      backgroundColor: theme.overlay,
    },
    termPickerText: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    termPickerTextActive: {
      color: theme.primary,
      fontWeight: '600' as const,
    },
    contactSearchRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 8,
      marginBottom: 4,
      gap: 6,
    },
    contactSearchInput: {
      flex: 1,
      paddingVertical: 6,
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    deadlineText: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    goalDetail: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: 12,
      gap: 10,
    },
    detailBlock: {
      backgroundColor: theme.card ?? theme.overlay,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    detailLabel: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    detailText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      lineHeight: 20,
    },
    nextStepBlock: {
      borderColor: theme.primary,
      borderWidth: 1,
    },
    nextStepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    contactBadges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    contactBadge: {
      borderWidth: 1,
      borderColor: theme.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
    },
    contactBadgeText: {
      fontSize: 11,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      fontWeight: '600' as const,
    },
    goalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    actionBtnDanger: { borderColor: theme.danger },
    actionBtnText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    modalContainer: { flex: 1, backgroundColor: theme.background },
    modalContent: { flex: 1 },
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
    formContent: { padding: 20, paddingBottom: 40 },
    field: { marginBottom: 16 },
    fieldLabel: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    input: {
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    formRow: { flexDirection: 'row', gap: 12 },
    directionPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    dirPickerItem: {
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 4,
    },
    dirPickerItemActive: {
      borderColor: theme.primary,
      backgroundColor: theme.overlay,
    },
    dirPickerText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    dirPickerTextActive: {
      color: theme.primary,
      fontWeight: '600' as const,
    },
    contactPicker: {
      borderWidth: 2,
      borderColor: theme.border,
      padding: 8,
      maxHeight: 200,
    },
    contactPickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 6,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    contactPickerItemActive: {
      borderColor: theme.primary,
      backgroundColor: theme.overlay,
    },
    contactPickerText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    contactPickerTextActive: { color: theme.primary, fontWeight: '600' as const },
    saveButton: {
      borderWidth: 2,
      borderColor: theme.primary,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
    },
    stepsBlock: {
      backgroundColor: theme.card ?? theme.overlay,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    stepsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    stepsHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    addStepHeaderBtn: {
      width: 28,
      height: 28,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noStepsText: {
      fontSize: 11,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      textAlign: 'center',
      paddingVertical: 8,
    },
    stepCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 10,
      marginBottom: 8,
      borderRadius: 6,
    },
    stepCardCompleted: {
      opacity: 0.6,
    },
    stepTypeBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    completedCheckbox: {
      width: 18,
      height: 18,
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completedLabel: {
      fontSize: 9,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 0.5,
    },
    stepCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    stepCardLeft: {
      flex: 1,
      minWidth: 0,
    },
    stepTypeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    stepTypeText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    stepContentText: {
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 18,
    },
    stepResultText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 6,
      fontStyle: 'italic' as const,
    },
    stepCardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginLeft: 6,
    },
    stepActionBtn: {
      padding: 4,
    },
    stepContactBadges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 6,
    },
    stepContactBadge: {
      borderWidth: 1,
      borderColor: theme.primaryDim,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 3,
    },
    stepContactBadgeText: {
      fontSize: 10,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
    },
    inlineStepForm: {
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 6,
      padding: 10,
      marginTop: 10,
      backgroundColor: theme.overlay,
    },
    inlineStepFormHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    inlineStepFormTitle: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
    },
    inlineField: {
      marginBottom: 10,
    },
    inlinePickerItem: {
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
    },
    inlineInput: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card ?? theme.background,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    inlineTextArea: {
      minHeight: 50,
      textAlignVertical: 'top' as const,
    },
    inlineContactPicker: {
      borderWidth: 1,
      borderColor: theme.border,
      padding: 6,
      maxHeight: 150,
    },
    inlineContactPickerContent: {
      flexGrow: 0,
    },
    inlineContactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      marginBottom: 2,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    inlineSaveBtn: {
      borderWidth: 1,
      borderColor: theme.primary,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 4,
      marginTop: 2,
    },
    inlineGoalForm: {
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 6,
      padding: 10,
      margin: 12,
      marginTop: 0,
      backgroundColor: theme.overlay,
    },
    inlineSaveBtnText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
    },
  });
