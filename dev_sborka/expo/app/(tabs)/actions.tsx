import { useApp } from '@/contexts/AppContext';
import { ContactDossier, GoalStepType, StrategicGoal } from '@/types';
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
  Heart,
  Target,
  Cake,
  X,
  Footprints,
  Phone,
  MessageSquare,
  Users,
  Check,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function termToDays(term: string): number {
  switch (term) {
    case 'day': return 1;
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
    case 'year': return 365;
    default: {
      const today = new Date(todayStr());
      const target = new Date(term);
      const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
      return isNaN(diff) ? 365 : diff;
    }
  }
}

function getTermLabel(term: string): string {
  const map: Record<string, string> = {
    day: '\u0414\u0435\u043d\u044c',
    week: '\u041d\u0435\u0434\u0435\u043b\u044f',
    month: '\u041c\u0435\u0441\u044f\u0446',
    quarter: '\u041a\u0432\u0430\u0440\u0442\u0430\u043b',
    year: '\u0413\u043e\u0434',
  };
  return map[term] ?? term;
}

export default function ActionsScreen() {
  const { dossiers, goals, updateGoal, theme, t } = useApp();
  const router = useRouter();
  const styles = createStyles(theme);

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [highlightStepId, setHighlightStepId] = useState<string | null>(null);

  const selectedGoal = useMemo(() => {
    if (!selectedGoalId) return null;
    return goals.find(g => g.id === selectedGoalId) ?? null;
  }, [selectedGoalId, goals]);

  const openGoalModal = useCallback((goalId: string, stepId: string) => {
    setSelectedGoalId(goalId);
    setHighlightStepId(stepId);
  }, []);

  const closeGoalModal = useCallback(() => {
    setSelectedGoalId(null);
    setHighlightStepId(null);
  }, []);

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
  }, [goals, updateGoal]);

  const getStepTypeIcon = useCallback((type: GoalStepType) => {
    switch (type) {
      case 'meeting': return Calendar;
      case 'call': return Phone;
      case 'write': return MessageSquare;
      case 'event': return Users;
    }
  }, []);

  const getStepTypeLabel = useCallback((type: GoalStepType) => {
    const map: Record<GoalStepType, string> = {
      meeting: t.strategy?.stepTypeMeeting ?? 'Встреча',
      call: t.strategy?.stepTypeCall ?? 'Звонок',
      write: t.strategy?.stepTypeWrite ?? 'Написать',
      event: t.strategy?.stepTypeEvent ?? 'Событие',
    };
    return map[type];
  }, [t]);

  const today = todayStr();

  const dossiersWithActions = useMemo(() => {
    return dossiers.filter(d => d.nextAction);
  }, [dossiers]);

  const overdue = useMemo(() => {
    return dossiersWithActions
      .filter(d => d.nextActionDate && d.nextActionDate < today)
      .sort((a, b) => (a.nextActionDate ?? '').localeCompare(b.nextActionDate ?? ''));
  }, [dossiersWithActions, today]);

  const upcoming = useMemo(() => {
    return dossiersWithActions
      .filter(d => d.nextActionDate && d.nextActionDate >= today)
      .sort((a, b) => (a.nextActionDate ?? '').localeCompare(b.nextActionDate ?? ''));
  }, [dossiersWithActions, today]);

  const noDate = useMemo(() => {
    return dossiersWithActions.filter(d => !d.nextActionDate);
  }, [dossiersWithActions]);

  const birthdayToday = useMemo(() => {
    const now = new Date();
    const todayDD = String(now.getDate()).padStart(2, '0');
    const todayMM = String(now.getMonth() + 1).padStart(2, '0');
    const todayDDMM = `${todayDD}.${todayMM}`;

    const importanceOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

    return dossiers
      .filter(d => {
        const bday = d.contact.birthday;
        if (!bday) return false;
        const parts = bday.split('.');
        if (parts.length < 2) return false;
        const dd = parts[0];
        const mm = parts[1];
        return `${dd}.${mm}` === todayDDMM;
      })
      .sort((a, b) => (importanceOrder[b.importance] ?? 0) - (importanceOrder[a.importance] ?? 0));
  }, [dossiers]);

  const importanceWeightMap: Record<string, number> = useMemo(() => ({
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }), []);

  const prioritySteps = useMemo(() => {
    const items: {
      goalId: string;
      goalTitle: string;
      stepId: string;
      stepContent: string;
      contactName: string | null;
      contactId: string | null;
      score: number;
      priority: number;
      deadline: string;
    }[] = [];

    for (const goal of goals) {
      const sortedSteps = [...(goal.steps || [])].sort((a, b) => a.order - b.order);
      const firstIncomplete = sortedSteps.find(s => !s.completed);
      if (!firstIncomplete) continue;

      const stepContact = firstIncomplete.contactIds.length > 0
        ? dossiers.find(d => firstIncomplete.contactIds.includes(d.contact.id))
        : null;

      const contactImportanceScore = stepContact
        ? (importanceWeightMap[stepContact.importance] ?? 2)
        : 1;

      const daysToDeadline = goal.deadline ? termToDays(goal.deadline) : 365;
      const urgencyScore = daysToDeadline <= 0 ? 10 : daysToDeadline <= 7 ? 8 : daysToDeadline <= 30 ? 5 : daysToDeadline <= 90 ? 3 : 1;

      const score = (goal.priority * 3) + (contactImportanceScore * 2) + (urgencyScore * 2);

      items.push({
        goalId: goal.id,
        goalTitle: goal.title,
        stepId: firstIncomplete.id,
        stepContent: firstIncomplete.content,
        contactName: stepContact?.contact.name ?? null,
        contactId: stepContact?.contact.id ?? null,
        score,
        priority: goal.priority,
        deadline: goal.deadline,
      });
    }

    return items.sort((a, b) => b.score - a.score);
  }, [goals, dossiers, importanceWeightMap]);

  const goalActions = useMemo(() => {
    return goals
      .filter(g => g.nextStep)
      .map(g => ({
        id: g.id,
        title: g.title,
        nextStep: g.nextStep,
        deadline: g.deadline,
        priority: g.priority,
      }));
  }, [goals]);

  const maintenanceContacts = useMemo(() => {
    const importanceWeights: Record<string, number> = {
      critical: 14,
      high: 21,
      medium: 45,
      low: 90,
    };

    return dossiers
      .filter(d => !d.noDirectConnection)
      .map(d => {
        let recommendedDays = importanceWeights[d.importance] ?? 45;
        if (d.assessment) {
          const vi = d.assessment.valueIndex;
          if (vi >= 75) recommendedDays = Math.min(recommendedDays, 14);
          else if (vi >= 50) recommendedDays = Math.min(recommendedDays, 28);
          else if (vi >= 30) recommendedDays = Math.max(recommendedDays, 45);
        }
        const lastDate = d.lastInteraction
          ? new Date(d.lastInteraction)
          : d.diary && d.diary.length > 0
            ? new Date(Math.max(...d.diary.map(e => new Date(e.date).getTime())))
            : null;
        if (!lastDate) {
          return { dossier: d, daysLeft: -recommendedDays };
        }
        const now = new Date();
        const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysLeft = recommendedDays - daysSinceLast;
        return { dossier: d, daysLeft };
      })
      .filter(item => item.daysLeft <= 3)
      .sort((a, b) => b.daysLeft - a.daysLeft);
  }, [dossiers]);

  const hasAnyContent = overdue.length > 0 || upcoming.length > 0 || noDate.length > 0 || goalActions.length > 0 || maintenanceContacts.length > 0 || prioritySteps.length > 0 || birthdayToday.length > 0;

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'critical': return theme.danger;
      case 'high': return theme.warning;
      case 'medium': return theme.primary;
      default: return theme.primaryDim;
    }
  };

  const renderDossierRow = (d: ContactDossier, isOverdue: boolean) => {
    const days = d.nextActionDate ? daysUntil(d.nextActionDate) : null;
    const importanceColor = getImportanceColor(d.importance);

    return (
      <TouchableOpacity
        key={d.contact.id}
        style={[styles.actionRow, isOverdue && styles.actionRowOverdue]}
        onPress={() => router.push(`/dossier/${d.contact.id}` as any)}
        activeOpacity={0.7}
        testID={`action-row-${d.contact.id}`}
      >
        <View style={[styles.avatar, { borderColor: importanceColor }]}>
          <Text style={[styles.avatarText, { color: importanceColor }]}>
            {d.contact.name
              .split(' ')
              .map(w => w[0] || '')
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.actionRowContent}>
          <Text style={styles.actionRowName}>{d.contact.name}</Text>
          <Text style={styles.actionRowAction}>
            {d.nextAction || (t.actions?.maintainContact ?? 'Maintain contact')}
          </Text>
          {d.contact.position ? (
            <Text style={styles.actionRowMeta}>
              {d.contact.position}
              {d.nextActionDate ? ` · ${d.nextActionDate}` : ''}
            </Text>
          ) : null}
        </View>
        {days !== null && (
          <View
            style={[
              styles.daysBadge,
              days <= 0
                ? styles.daysBadgeOverdue
                : days <= 3
                  ? styles.daysBadgeUrgent
                  : styles.daysBadgeNormal,
            ]}
          >
            <Text
              style={[
                styles.daysBadgeText,
                days <= 0
                  ? styles.daysBadgeTextOverdue
                  : days <= 3
                    ? styles.daysBadgeTextUrgent
                    : styles.daysBadgeTextNormal,
              ]}
            >
              {days <= 0
                ? (t.actions?.overdueLabel ?? 'Overdue')
                : `${days}${t.actions?.daysLeft ?? 'd'}`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.background} testID="actionsTabRoot">
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Calendar size={28} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>{t.actions?.title ?? 'ACTIONS'}</Text>
        </View>

        {!hasAnyContent ? (
          <View style={styles.emptyState}>
            <Calendar size={64} color={theme.primaryDim} strokeWidth={1} />
            <Text style={styles.emptyTitle}>{t.actions?.noActions ?? 'NO ACTIONS'}</Text>
            <Text style={styles.emptyText}>
              {t.actions?.noActionsDesc ?? 'Add actions to contacts in their dossiers'}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subtitle}>{t.actions?.subtitle ?? 'AGENT AGENDA'}</Text>

            {overdue.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <AlertTriangle size={14} color={theme.danger} />
                  <Text style={[styles.sectionTitle, { color: theme.danger }]}>
                    {t.actions?.overdue ?? 'OVERDUE'} ({overdue.length})
                  </Text>
                </View>
                {overdue.map(d => renderDossierRow(d, true))}
              </>
            )}

            {upcoming.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <CheckCircle size={14} color={theme.success} />
                  <Text style={[styles.sectionTitle, { color: theme.success }]}>
                    {t.actions?.upcoming ?? 'UPCOMING'} ({upcoming.length})
                  </Text>
                </View>
                {upcoming.map(d => renderDossierRow(d, false))}
              </>
            )}

            {noDate.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Clock size={14} color={theme.warning} />
                  <Text style={[styles.sectionTitle, { color: theme.warning }]}>
                    {t.actions?.noDate ?? 'NO DATE'} ({noDate.length})
                  </Text>
                </View>
                {noDate.map(d => renderDossierRow(d, false))}
              </>
            )}

            {birthdayToday.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                  <Cake size={14} color={'#e11d48'} />
                  <Text style={[styles.sectionTitle, { color: '#e11d48' }]}>
                    {(t.actions as any)?.birthdayToday ?? 'BIRTHDAY TODAY'} ({birthdayToday.length})
                  </Text>
                </View>
                {birthdayToday.map(d => {
                  const importanceColor = getImportanceColor(d.importance);
                  return (
                    <TouchableOpacity
                      key={`bday_${d.contact.id}`}
                      style={styles.birthdayRow}
                      onPress={() => router.push({ pathname: `/dossier/${d.contact.id}` as any, params: { section: 'diary' } })}
                      activeOpacity={0.7}
                      testID={`birthday-row-${d.contact.id}`}
                    >
                      <View style={[styles.avatar, { borderColor: '#e11d48' }]}>
                        <Text style={[styles.avatarText, { color: '#e11d48' }]}>
                          {d.contact.name
                            .split(' ')
                            .map(w => w[0] || '')
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.actionRowContent}>
                        <Text style={styles.actionRowName}>{d.contact.name}</Text>
                        {d.contact.position ? (
                          <Text style={styles.actionRowMeta}>{d.contact.position}</Text>
                        ) : null}
                        {d.contact.birthday ? (
                          <Text style={[styles.actionRowAction, { color: '#e11d48' }]}>{d.contact.birthday}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.daysBadge, { backgroundColor: '#e11d4822', borderColor: '#e11d48' }]}>
                        <Cake size={12} color={'#e11d48'} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {prioritySteps.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                  <Target size={14} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.primary }]}>
                    {t.actions?.prioritySteps ?? 'PRIORITY STEPS'} ({prioritySteps.length})
                  </Text>
                </View>
                {prioritySteps.map(item => {
                  const deadlineDays = item.deadline ? termToDays(item.deadline) : null;
                  return (
                    <TouchableOpacity
                      key={`${item.goalId}_${item.stepId}`}
                      style={styles.priorityStepRow}
                      onPress={() => openGoalModal(item.goalId, item.stepId)}
                      activeOpacity={0.7}
                      testID={`priority-step-${item.goalId}`}
                    >
                      <View style={styles.priorityStepContent}>
                        <Text style={styles.priorityStepGoal}>{item.goalTitle}</Text>
                        <Text style={styles.priorityStepName}>{item.stepContent}</Text>
                        {item.contactName ? (
                          <Text style={styles.priorityStepContact}>{item.contactName}</Text>
                        ) : null}
                      </View>
                      <View style={styles.priorityStepRight}>
                        <View style={styles.priorityDotsRow}>
                          {Array.from({ length: 10 }, (_, i) => {
                            const color = item.priority >= 8 ? theme.danger : item.priority >= 5 ? theme.warning : (theme.success ?? theme.primaryDim);
                            return (
                              <View
                                key={i}
                                style={[
                                  styles.priorityDot,
                                  i < item.priority
                                    ? { backgroundColor: color }
                                    : { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
                                ]}
                              />
                            );
                          })}
                        </View>
                        {item.deadline ? (
                          <Text style={styles.priorityStepDeadline}>
                            {getTermLabel(item.deadline)}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {maintenanceContacts.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                  <Heart size={14} color={theme.warning} />
                  <Text style={[styles.sectionTitle, { color: theme.warning }]}>
                    {t.actions?.maintainSection ?? 'MAINTAIN CONNECTIONS'} ({maintenanceContacts.length})
                  </Text>
                </View>
                {maintenanceContacts.map(({ dossier: d, daysLeft }) => {
                  const importanceColor = getImportanceColor(d.importance);
                  return (
                    <TouchableOpacity
                      key={d.contact.id}
                      style={[styles.actionRow, daysLeft <= 0 && styles.actionRowOverdue]}
                      onPress={() => router.push({ pathname: `/dossier/${d.contact.id}` as any, params: { section: 'maintenance' } })}
                      activeOpacity={0.7}
                      testID={`maintain-row-${d.contact.id}`}
                    >
                      <View style={[styles.avatar, { borderColor: importanceColor }]}>
                        <Text style={[styles.avatarText, { color: importanceColor }]}>
                          {d.contact.name
                            .split(' ')
                            .map(w => w[0] || '')
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.actionRowContent}>
                        <Text style={styles.actionRowName}>{d.contact.name}</Text>
                        {d.contact.position ? (
                          <Text style={styles.actionRowMeta}>{d.contact.position}</Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.daysBadge,
                          daysLeft <= 0 ? styles.daysBadgeOverdue : styles.daysBadgeUrgent,
                        ]}
                      >
                        <Text
                          style={[
                            styles.daysBadgeText,
                            daysLeft <= 0 ? styles.daysBadgeTextOverdue : styles.daysBadgeTextUrgent,
                          ]}
                        >
                          {daysLeft <= 0
                            ? `${Math.abs(daysLeft)}${t.actions?.maintainDaysOverdue ?? 'd overdue'}`
                            : daysLeft === 0
                              ? (t.actions?.maintainToday ?? 'Today')
                              : `${daysLeft}${t.actions?.daysLeft ?? 'd'}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {goalActions.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                  <ChevronRight size={14} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.primary }]}>
                    {t.strategy?.nextStep ?? 'GOAL NEXT STEPS'} ({goalActions.length})
                  </Text>
                </View>
                {goalActions.map(g => (
                  <View key={g.id} style={styles.goalActionRow}>
                    <View style={styles.goalActionContent}>
                      <Text style={styles.goalActionTitle}>{g.title}</Text>
                      <Text style={styles.goalActionStep}>{g.nextStep}</Text>
                      {g.deadline ? (
                        <Text style={styles.goalActionMeta}>
                          {g.priority}/10 · {getTermLabel(g.deadline)}
                        </Text>
                      ) : (
                        <Text style={styles.goalActionMeta}>
                          {g.priority}/10
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )}

        <Modal
          visible={!!selectedGoal}
          animationType="slide"
          transparent
          onRequestClose={closeGoalModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Target size={18} color={theme.primary} />
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selectedGoal?.title}
                </Text>
                <TouchableOpacity onPress={closeGoalModal} activeOpacity={0.7} style={styles.modalCloseBtn}>
                  <X size={18} color={theme.primaryDim} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {selectedGoal?.description ? (
                  <View style={styles.modalBlock}>
                    <Text style={styles.modalLabel}>{t.strategy?.description ?? 'ОПИСАНИЕ'}</Text>
                    <Text style={styles.modalText}>{selectedGoal.description}</Text>
                  </View>
                ) : null}

                <View style={styles.modalBlock}>
                  <View style={styles.modalMetaRow}>
                    <View style={styles.modalPriorityRow}>
                      {Array.from({ length: 10 }, (_, i) => {
                        const p = selectedGoal?.priority ?? 5;
                        const color = p >= 8 ? theme.danger : p >= 5 ? theme.warning : (theme.success ?? theme.primaryDim);
                        return (
                          <View
                            key={i}
                            style={[
                              styles.modalPriorityDot,
                              i < p
                                ? { backgroundColor: color }
                                : { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
                            ]}
                          />
                        );
                      })}
                    </View>
                    {selectedGoal?.deadline ? (
                      <Text style={styles.modalDeadline}>
                        {t.strategy?.deadline ?? 'СРОК'}: {getTermLabel(selectedGoal.deadline)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {(() => {
                  const linkedContacts = dossiers.filter(d => selectedGoal?.contactIds.includes(d.contact.id));
                  if (linkedContacts.length === 0) return null;
                  return (
                    <View style={styles.modalBlock}>
                      <Text style={styles.modalLabel}>{t.strategy?.keyContacts ?? 'КЛЮЧЕВЫЕ КОНТАКТЫ'}</Text>
                      <View style={styles.modalContactBadges}>
                        {linkedContacts.map(d => (
                          <View key={d.contact.id} style={styles.modalContactBadge}>
                            <Text style={styles.modalContactBadgeText}>{d.contact.name}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}

                <View style={styles.modalStepsBlock}>
                  <View style={styles.modalStepsHeader}>
                    <Footprints size={14} color={theme.primary} />
                    <Text style={[styles.modalLabel, { color: theme.primary, marginBottom: 0 }]}>
                      {t.strategy?.steps ?? 'ШАГИ'}
                    </Text>
                  </View>
                  {(() => {
                    const sortedSteps = [...(selectedGoal?.steps || [])].sort((a, b) => a.order - b.order);
                    if (sortedSteps.length === 0) {
                      return <Text style={styles.modalNoSteps}>{t.strategy?.noSteps ?? 'Нет шагов'}</Text>;
                    }
                    return sortedSteps.map((step) => {
                      const StepIcon = getStepTypeIcon(step.type);
                      const sContacts = dossiers.filter(d => step.contactIds.includes(d.contact.id));
                      const isHighlighted = step.id === highlightStepId;
                      return (
                        <View
                          key={step.id}
                          style={[
                            styles.modalStepCard,
                            step.completed && styles.modalStepCardCompleted,
                            isHighlighted && styles.modalStepCardHighlighted,
                          ]}
                        >
                          <View style={styles.modalStepHeader}>
                            <View style={styles.modalStepTypeBadge}>
                              <StepIcon size={12} color={step.completed ? theme.primaryDim : theme.primary} />
                              <Text style={[styles.modalStepTypeText, step.completed && { color: theme.primaryDim }]}>
                                {getStepTypeLabel(step.type)}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.modalCheckbox,
                                step.completed && { backgroundColor: theme.success ?? '#059669', borderColor: theme.success ?? '#059669' },
                              ]}
                              onPress={() => handleToggleStepCompleted(selectedGoal!.id, step.id)}
                              activeOpacity={0.7}
                            >
                              {step.completed && <Check size={12} color="#fff" />}
                            </TouchableOpacity>
                          </View>
                          <Text
                            style={[
                              styles.modalStepContent,
                              step.completed && { textDecorationLine: 'line-through' as const, color: theme.primaryDim },
                            ]}
                          >
                            {step.content}
                          </Text>
                          {step.result ? (
                            <Text style={[styles.modalStepResult, step.completed && { color: theme.primaryDim }]}>
                              {step.result}
                            </Text>
                          ) : null}
                          {sContacts.length > 0 && (
                            <View style={styles.modalStepContactBadges}>
                              {sContacts.map(d => (
                                <View key={d.contact.id} style={styles.modalStepContactBadge}>
                                  <Text style={styles.modalStepContactText}>{d.contact.name}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    });
                  })()}
                </View>

                <TouchableOpacity
                  style={styles.modalGoToBtn}
                  onPress={() => {
                    closeGoalModal();
                    router.push({ pathname: '/strategy' as any, params: { goalId: selectedGoal?.id } });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalGoToBtnText}>{t.strategy?.openFull ?? 'Открыть в Цели'}</Text>
                  <ChevronRight size={14} color={theme.primary} />
                </TouchableOpacity>
              </ScrollView>
            </View>
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
    content: { padding: 16, paddingBottom: 40 },
    subtitle: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
      marginBottom: 14,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700' as const,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 12,
      marginBottom: 8,
      gap: 10,
    },
    actionRowOverdue: { borderColor: theme.danger + '55' },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    avatarText: {
      fontSize: 12,
      fontWeight: '700' as const,
      fontFamily: 'monospace' as const,
    },
    actionRowContent: { flex: 1, minWidth: 0 },
    actionRowName: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    actionRowAction: {
      fontSize: 12,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },
    actionRowMeta: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },
    daysBadge: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      flexShrink: 0,
    },
    daysBadgeOverdue: {
      backgroundColor: theme.danger + '22',
      borderColor: theme.danger,
    },
    daysBadgeUrgent: {
      backgroundColor: theme.warning + '22',
      borderColor: theme.warning,
    },
    daysBadgeNormal: {
      backgroundColor: theme.overlay,
      borderColor: theme.border,
    },
    daysBadgeText: {
      fontSize: 11,
      fontWeight: '700' as const,
      fontFamily: 'monospace' as const,
    },
    daysBadgeTextOverdue: { color: theme.danger },
    daysBadgeTextUrgent: { color: theme.warning },
    daysBadgeTextNormal: { color: theme.textSecondary },
    goalActionRow: {
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 12,
      marginBottom: 8,
    },
    goalActionContent: { marginBottom: 4 },
    goalActionTitle: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    goalActionStep: {
      fontSize: 12,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      marginTop: 4,
      fontWeight: '600' as const,
    },
    goalActionMeta: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },
    priorityStepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 12,
      marginBottom: 8,
      gap: 10,
    },
    priorityStepContent: { flex: 1, minWidth: 0 },
    priorityStepGoal: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    priorityStepName: {
      fontSize: 12,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
      fontWeight: '600' as const,
    },
    priorityStepContact: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },
    priorityStepRight: {
      alignItems: 'flex-end',
      gap: 4,
      flexShrink: 0,
    },
    priorityDotsRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 2,
    },
    priorityDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    priorityStepDeadline: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: 16,
    },
    modalContainer: {
      backgroundColor: theme.background,
      borderWidth: 2,
      borderColor: theme.border,
      maxHeight: '85%' as const,
      overflow: 'hidden' as const,
    },
    modalHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      padding: 16,
      gap: 10,
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalBody: {
      padding: 16,
    },
    modalBlock: {
      marginBottom: 14,
    },
    modalLabel: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
      marginBottom: 6,
    },
    modalText: {
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 18,
    },
    modalMetaRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      flexWrap: 'wrap' as const,
    },
    modalPriorityRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 3,
    },
    modalPriorityDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    modalDeadline: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    modalContactBadges: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 6,
    },
    modalContactBadge: {
      backgroundColor: theme.overlay,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    modalContactBadgeText: {
      fontSize: 11,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    modalStepsBlock: {
      marginBottom: 14,
    },
    modalStepsHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      marginBottom: 10,
    },
    modalNoSteps: {
      fontSize: 12,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
    },
    modalStepCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      padding: 10,
      marginBottom: 8,
    },
    modalStepCardCompleted: {
      opacity: 0.6,
    },
    modalStepCardHighlighted: {
      borderColor: theme.primary,
      borderWidth: 2,
      backgroundColor: theme.primary + '08',
    },
    modalStepHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 6,
    },
    modalStepTypeBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
    },
    modalStepTypeText: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
    },
    modalCheckbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    modalStepContent: {
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 18,
    },
    modalStepResult: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 4,
    },
    modalStepContactBadges: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 4,
      marginTop: 6,
    },
    modalStepContactBadge: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    modalStepContactText: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    modalGoToBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 6,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.primary + '44',
      marginBottom: 20,
    },
    modalGoToBtnText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
    },
    birthdayRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: 2,
      borderColor: '#e11d4855',
      backgroundColor: theme.overlay,
      padding: 12,
      marginBottom: 8,
      gap: 10,
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
  });
