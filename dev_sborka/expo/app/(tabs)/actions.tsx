import { useApp } from '@/contexts/AppContext';
import { ContactDossier } from '@/types';
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr: string): number {
  const today = new Date(todayStr());
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export default function ActionsScreen() {
  const { dossiers, goals, theme, t } = useApp();
  const router = useRouter();
  const styles = createStyles(theme);

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

  const goalActions = useMemo(() => {
    return goals
      .filter(g => g.nextStep)
      .map(g => ({
        id: g.id,
        title: g.title,
        nextStep: g.nextStep,
        deadline: g.deadline,
        progress: g.progress,
      }));
  }, [goals]);

  const hasAnyContent = overdue.length > 0 || upcoming.length > 0 || noDate.length > 0 || goalActions.length > 0;

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
                          {g.progress}% · {g.deadline}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.goalProgressMini}>
                      <View
                        style={[
                          styles.goalProgressFill,
                          {
                            width: `${g.progress}%` as any,
                            backgroundColor:
                              g.progress >= 75 ? theme.success : g.progress >= 40 ? theme.warning : theme.danger,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )}
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
    goalActionContent: { marginBottom: 8 },
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
    goalProgressMini: {
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    goalProgressFill: { height: '100%', borderRadius: 2 },
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
