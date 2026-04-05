import { useApp } from '@/contexts/AppContext';
import {
  Brain,
  Search,
  TrendingUp,
  Globe,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Info,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  findPaths,
  pathScore,
  getPathHints,
  calcUpgrade,
  getConnectorScores,
  predictStates,
  expectedLevel,
  monthsToLevel,
  steadyState,
  getMonthlyTransitions,
  getNetworkForecast,
  getLevel,
  STATE_LABELS,
  STATE_COLORS,
  LEVEL_LABELS,
  type PathNode,
  type UpgradeResult,
  type PathHint,
} from '@/utils/analysisEngine';
import type { ContactDossier } from '@/types';

type AnalysisTab = 'path' | 'potential' | 'connectors' | 'markov';

export default function AnalysisScreen() {
  const { dossiers, goals, theme, t } = useApp();
  const [activeTab, setActiveTab] = useState<AnalysisTab>('path');

  const styles = createStyles(theme);

  const tabs: { key: AnalysisTab; icon: React.ReactNode; label: string }[] = [
    { key: 'path', icon: <Search size={16} color={activeTab === 'path' ? theme.primary : theme.textSecondary} />, label: '🔍 Путь' },
    { key: 'potential', icon: <TrendingUp size={16} color={activeTab === 'potential' ? theme.primary : theme.textSecondary} />, label: '📈 Потенциал' },
    { key: 'connectors', icon: <Globe size={16} color={activeTab === 'connectors' ? theme.primary : theme.textSecondary} />, label: '🌐 Коннекторы' },
    { key: 'markov', icon: <Sparkles size={16} color={activeTab === 'markov' ? theme.primary : theme.textSecondary} />, label: '🔮 Марков' },
  ];

  return (
    <View style={styles.background} testID="analysisTabRoot">
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Brain size={24} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>{t.analysis?.title ?? 'ANALYSIS'}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'path' && <PathTab dossiers={dossiers} goals={goals} theme={theme} styles={styles} />}
          {activeTab === 'potential' && <PotentialTab dossiers={dossiers} goals={goals} theme={theme} styles={styles} />}
          {activeTab === 'connectors' && <ConnectorsTab dossiers={dossiers} goals={goals} theme={theme} styles={styles} />}
          {activeTab === 'markov' && <MarkovTab dossiers={dossiers} goals={goals} theme={theme} styles={styles} />}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PathTab({ dossiers, goals, theme, styles }: {
  dossiers: ContactDossier[];
  goals: any[];
  theme: any;
  styles: any;
}) {
  const [fromId, setFromId] = useState<string>('me');
  const [toId, setToId] = useState<string>('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [pathResult, setPathResult] = useState<PathNode[][] | null>(null);
  const [selectedPathIdx, setSelectedPathIdx] = useState(0);

  const searchPath = useCallback(() => {
    if (!toId) return;
    const paths = findPaths(fromId, toId, dossiers, goals, 4);
    paths.sort((a, b) => pathScore(b, dossiers) - pathScore(a, dossiers));
    setPathResult(paths);
    setSelectedPathIdx(0);
  }, [fromId, toId, dossiers, goals]);

  const currentPath = pathResult && pathResult.length > 0 ? pathResult[selectedPathIdx] : null;
  const score = currentPath ? Math.round(pathScore(currentPath, dossiers) * 100) : 0;
  const hints = currentPath ? getPathHints(currentPath, toId, dossiers, goals) : [];

  const getNodeName = useCallback((id: string) => {
    if (id === 'me') return 'Я';
    const d = dossiers.find((x) => x.contact.id === id);
    return d ? d.contact.name : '?';
  }, [dossiers]);

  return (
    <View>
      <View style={styles.formulaCard}>
        <Text style={styles.formulaText}>
          BFS по графу связей. Сила ребра = 0.65·доверие + 0.35·уровень
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>ОТКУДА</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => { setShowFromPicker(!showFromPicker); setShowToPicker(false); }}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerText}>
            {fromId === 'me' ? 'Я (центр сети)' : getNodeName(fromId)}
          </Text>
          <ChevronRight size={16} color={theme.primaryDim} />
        </TouchableOpacity>
        {showFromPicker && (
          <ContactPickerList
            dossiers={dossiers}
            selectedId={fromId}
            showMe
            onSelect={(id) => { setFromId(id); setShowFromPicker(false); setPathResult(null); }}
            theme={theme}
            styles={styles}
          />
        )}

        <Text style={styles.fieldLabel}>КУДА</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => { setShowToPicker(!showToPicker); setShowFromPicker(false); }}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerText}>
            {toId ? getNodeName(toId) : '— Выберите контакт —'}
          </Text>
          <ChevronRight size={16} color={theme.primaryDim} />
        </TouchableOpacity>
        {showToPicker && (
          <ContactPickerList
            dossiers={dossiers}
            selectedId={toId}
            onSelect={(id) => { setToId(id); setShowToPicker(false); setPathResult(null); }}
            theme={theme}
            styles={styles}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.actionButton, !toId && styles.actionButtonDisabled]}
        onPress={searchPath}
        activeOpacity={0.7}
        disabled={!toId}
      >
        <Text style={styles.actionButtonText}>НАЙТИ ПУТЬ →</Text>
      </TouchableOpacity>

      {pathResult !== null && pathResult.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🚫</Text>
          <Text style={styles.emptyText}>Путь не найден. Контакты не связаны.</Text>
        </View>
      )}

      {pathResult && pathResult.length > 1 && (
        <View style={styles.altPathsRow}>
          {pathResult.map((_, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.altPathBtn, selectedPathIdx === i && styles.altPathBtnActive]}
              onPress={() => setSelectedPathIdx(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.altPathBtnText, selectedPathIdx === i && styles.altPathBtnTextActive]}>
                Путь {i + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {currentPath && (
        <View style={styles.resultCard}>
          <View style={styles.pathScoreRow}>
            <View style={[styles.scoreBadge, { backgroundColor: score >= 60 ? '#059669' : score >= 30 ? '#d97706' : '#dc2626' }]}>
              <Text style={styles.scoreBadgeText}>{score}%</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pathScoreLabel}>Вероятность успеха</Text>
              <Text style={styles.pathSteps}>{currentPath.length - 1} шаг(ов)</Text>
            </View>
          </View>

          <View style={styles.pathChain}>
            {currentPath.map((node, i) => (
              <View key={i} style={styles.pathChainItem}>
                <View style={[styles.pathNode, node.id === 'me' && styles.pathNodeMe]}>
                  <Text style={styles.pathNodeText}>
                    {getNodeName(node.id).split(' ').map((w) => w[0] || '').join('').slice(0, 2)}
                  </Text>
                </View>
                <Text style={styles.pathNodeName} numberOfLines={1}>
                  {getNodeName(node.id).split(' ')[0]}
                </Text>
                {node.edge && (
                  <Text style={styles.pathEdgeLabel} numberOfLines={1}>{node.edge.label}</Text>
                )}
                {i < currentPath.length - 1 && (
                  <ArrowRight size={14} color={theme.primaryDim} style={{ marginTop: -20 }} />
                )}
              </View>
            ))}
          </View>

          {hints.map((hint, i) => (
            <HintBox key={i} hint={hint} theme={theme} styles={styles} />
          ))}
        </View>
      )}
    </View>
  );
}

function PotentialTab({ dossiers, goals, theme, styles }: {
  dossiers: ContactDossier[];
  goals: any[];
  theme: any;
  styles: any;
}) {
  const sorted = useMemo(() => {
    return [...dossiers]
      .map((d) => ({ d, u: calcUpgrade(d, goals) }))
      .sort((a, b) => (b.u.up ?? -1) - (a.u.up ?? -1));
  }, [dossiers, goals]);

  if (!dossiers.length) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>📈</Text>
        <Text style={styles.emptyText}>Нет контактов для анализа</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.formulaCard}>
        <Text style={styles.formulaText}>
          P = σ(8·(z−0.5)), z = 0.4·доверие + 0.3·рецентность + 0.2·цели + 0.1·действие
        </Text>
      </View>

      {sorted.map(({ d, u }) => (
        <PotentialCard key={d.contact.id} dossier={d} upgrade={u} goals={goals} theme={theme} styles={styles} />
      ))}
    </View>
  );
}

function PotentialCard({ dossier, upgrade, styles, theme: _theme }: {
  dossier: ContactDossier;
  upgrade: UpgradeResult;
  goals: any[];
  theme: any;
  styles: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const level = getLevel(dossier);
  const levelLabel = LEVEL_LABELS[dossier.importance] ?? 'Контакт';
  const upColor = (upgrade.up ?? 0) >= 65 ? '#059669' : (upgrade.up ?? 0) >= 40 ? '#d97706' : '#dc2626';
  const downColor = upgrade.down >= 50 ? '#dc2626' : upgrade.down >= 30 ? '#d97706' : '#64748b';
  const initials = dossier.contact.name.split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

  const factors = [
    { label: 'Доверие', val: upgrade.trustRatio, color: '#4f46e5' },
    { label: 'Рецентность', val: upgrade.recency, color: '#06b6d4', hint: upgrade.days < 365 ? `${upgrade.days}д` : '—' },
    { label: 'Цели', val: upgrade.goalFactor, color: '#7c3aed' },
    { label: 'Шаг', val: upgrade.actionFactor * 100, color: '#059669', hint: upgrade.actionFactor ? '✓' : '✗' },
  ];

  const tips = useMemo(() => {
    const t: string[] = [];
    if (upgrade.trustRatio < 50) t.push('🤝 Проведите личную встречу — доверие ниже 50%');
    if (upgrade.recency < 30) t.push('📅 Не было контакта ' + upgrade.days + ' дн. — свяжитесь сегодня');
    if (upgrade.goalFactor < 40) t.push('🎯 Добавьте в стратегическую цель — усилит связь');
    if (!upgrade.actionFactor) t.push('⚡ Задайте следующий шаг и дату');
    if (upgrade.down >= 40) t.push('⚠️ Высокий риск деградации — приоритизируйте');
    if (!t.length) t.push('✅ Отличная динамика! Поддерживайте ритм');
    return t.slice(0, 3);
  }, [upgrade]);

  return (
    <TouchableOpacity style={styles.card} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
      <View style={styles.contactRow}>
        <View style={[styles.avatar, { borderColor: upColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactName}>{dossier.contact.name}</Text>
          <Text style={styles.contactSub}>{levelLabel} · ур.{level}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' as const }}>
          {upgrade.up !== null ? (
            <View style={[styles.upgradeBadge, { backgroundColor: upColor + '22', borderColor: upColor }]}>
              <Text style={[styles.upgradeBadgeText, { color: upColor }]}>↑ {upgrade.up}%</Text>
            </View>
          ) : (
            <Text style={[styles.allyLabel, { color: '#059669' }]}>★ Союзник</Text>
          )}
        </View>
      </View>

      {upgrade.up !== null && (
        <View style={styles.progressBar}>
          <View style={[
            styles.progressFill,
            {
              width: `${upgrade.up}%` as any,
              backgroundColor: upColor,
            },
          ]} />
        </View>
      )}

      {expanded && (
        <View style={styles.expandedSection}>
          <Text style={styles.sectionTitle}>ФАКТОРЫ АПГРЕЙДА</Text>
          <View style={styles.factorsRow}>
            {factors.map((f) => (
              <View key={f.label} style={styles.factorCol}>
                <View style={styles.factorBarBg}>
                  <View style={[styles.factorBarFill, { height: `${Math.max(f.val, 3)}%` as any, backgroundColor: f.val >= 70 ? '#059669' : f.val >= 40 ? f.color : f.val >= 15 ? '#d97706' : '#64748b' }]} />
                </View>
                <Text style={styles.factorValue}>{Math.round(f.val)}%</Text>
                <Text style={styles.factorLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>💡 ЧТО ДЕЛАТЬ</Text>
          {tips.map((tip, i) => (
            <Text key={i} style={styles.tipText}>{tip}</Text>
          ))}

          <View style={styles.riskRow}>
            <Text style={[styles.riskLabel, { color: downColor }]}>
              Риск снижения: {upgrade.down}%
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ConnectorsTab({ dossiers, goals, theme, styles }: {
  dossiers: ContactDossier[];
  goals: any[];
  theme: any;
  styles: any;
}) {
  const scores = useMemo(() => getConnectorScores(dossiers, goals), [dossiers, goals]);

  if (!dossiers.length) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>🌐</Text>
        <Text style={styles.emptyText}>Нет контактов для анализа</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.formulaCard}>
        <Text style={styles.formulaText}>
          SCI = 0.35·доверие + 0.30·уровень + 0.20·степень + 0.15·посредничество
        </Text>
      </View>

      {scores.map((sc, i) => {
        const d = dossiers.find((x) => x.contact.id === sc.contactId);
        if (!d) return null;
        const initials = d.contact.name.split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
        const sciColor = sc.sci >= 60 ? '#059669' : sc.sci >= 40 ? '#d97706' : '#64748b';

        return (
          <View key={sc.contactId} style={styles.card}>
            <View style={styles.contactRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{i + 1}</Text>
              </View>
              <View style={[styles.avatar, { borderColor: sciColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRoleRow}>
                  <Text style={styles.contactName}>{d.contact.name}</Text>
                  <Text style={styles.roleTag}>{sc.roleIcon} {sc.role}</Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.statText}>Связей: {sc.degree}</Text>
                  <Text style={styles.statText}>Посредник: {sc.betweenness}</Text>
                </View>
              </View>
              <View style={[styles.sciBadge, { borderColor: sciColor }]}>
                <Text style={[styles.sciValue, { color: sciColor }]}>{sc.sci}</Text>
                <Text style={styles.sciLabel}>SCI</Text>
              </View>
            </View>
            {sc.betweenness >= 2 && (
              <View style={styles.hintRow}>
                <Info size={14} color={theme.primary} />
                <Text style={styles.hintText}>
                  Ключевой коннектор — через {d.contact.name.split(' ')[0]} проходит {sc.betweenness} кратчайших путей
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function MarkovTab({ dossiers, goals, theme, styles }: {
  dossiers: ContactDossier[];
  goals: any[];
  theme: any;
  styles: any;
}) {
  const [selectedId, setSelectedId] = useState<string>(dossiers[0]?.contact.id ?? '');
  const [showPicker, setShowPicker] = useState(false);

  const selected = dossiers.find((d) => d.contact.id === selectedId);

  const detail = useMemo(() => {
    if (!selected) return null;
    const p3 = predictStates(selected, goals, 3);
    const p6 = predictStates(selected, goals, 6);
    const p12 = predictStates(selected, goals, 12);
    const p24 = predictStates(selected, goals, 24);
    const ss = steadyState(selected, goals);
    const trans = getMonthlyTransitions(selected, goals);
    const mtl5 = getLevel(selected) < 5 ? monthsToLevel(selected, goals, 5) : null;
    const p12l5 = Math.round(p12[5] * 100);
    const el12 = expectedLevel(p12);
    const el24 = expectedLevel(p24);

    let insightIcon = '📊';
    let insightText = '';
    if (getLevel(selected) >= 4 && trans.pUp >= 0.08) {
      insightIcon = '🚀';
      insightText = `Высокий темп: ${p12l5}% шанс «Союзника» за ~${mtl5 || '12+'}м. Инвестируйте сейчас.`;
    } else if (getLevel(selected) === 5) {
      insightIcon = '★';
      insightText = `Союзник. Удержание 12м: ${Math.round(p12[5] * 100)}%, 24м: ${Math.round(p24[5] * 100)}%.`;
    } else if (trans.pDown > trans.pUp * 1.5) {
      insightIcon = '⚠️';
      insightText = `Риск деградации: ${Math.round(trans.pDown * 100)}% vs ${Math.round(trans.pUp * 100)}%/мес. Свяжитесь в 2 недели.`;
    } else {
      insightText = `Ожидаемый уровень: 12м → ${el12}${mtl5 ? ' · до Союзника ~' + mtl5 + 'м' : ''}, 24м → ${el24}.`;
    }

    return { p3, p6, p12, p24, ss, trans, mtl5, p12l5, insightIcon, insightText };
  }, [selected, goals]);

  const forecast = useMemo(() => getNetworkForecast(dossiers, goals).slice(0, 10), [dossiers, goals]);

  if (!dossiers.length) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>🔮</Text>
        <Text style={styles.emptyText}>Нет контактов для анализа</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.formulaCard}>
        <Text style={styles.formulaText}>
          Цепи Маркова: 6 состояний (0=потерян, 1–5=уровни). Pn·v0 = прогноз на N мес.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>КОНТАКТ ДЛЯ АНАЛИЗА</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowPicker(!showPicker)}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerText}>
            {selected ? selected.contact.name : '— Выберите —'}
          </Text>
          <ChevronRight size={16} color={theme.primaryDim} />
        </TouchableOpacity>
        {showPicker && (
          <ContactPickerList
            dossiers={dossiers}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setShowPicker(false); }}
            theme={theme}
            styles={styles}
          />
        )}
      </View>

      {selected && detail && (
        <View style={styles.card}>
          <View style={styles.contactRow}>
            <View style={[styles.avatar, { borderColor: theme.primary }]}>
              <Text style={styles.avatarText}>
                {selected.contact.name.split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>{selected.contact.name}</Text>
              <Text style={styles.contactSub}>
                {LEVEL_LABELS[selected.importance] ?? 'Контакт'} · ур.{getLevel(selected)}
              </Text>
            </View>
            {getLevel(selected) < 5 ? (
              <View style={{ alignItems: 'flex-end' as const }}>
                <Text style={styles.markovTarget}>до Союзника</Text>
                <Text style={styles.markovMonths}>{detail.mtl5 ? detail.mtl5 + 'м' : '—'}</Text>
                <Text style={styles.markovProb}>P={detail.p12l5}%</Text>
              </View>
            ) : (
              <Text style={[styles.allyLabel, { color: '#059669' }]}>★ Союзник</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>ЕЖЕМЕСЯЧНЫЕ ВЕРОЯТНОСТИ</Text>
          <View style={styles.transGrid}>
            <TransItem label="↑ Апгрейд" value={Math.round(detail.trans.pUp * 100)} color="#059669" theme={theme} styles={styles} />
            <TransItem label="↓ Даунгрейд" value={Math.round(detail.trans.pDown * 100)} color="#dc2626" theme={theme} styles={styles} />
            <TransItem label="☠ Потеря" value={Math.round(detail.trans.pLost * 100)} color="#7f1d1d" theme={theme} styles={styles} />
            <TransItem label="→ Без изм." value={Math.round(detail.trans.pStay * 100)} color="#64748b" theme={theme} styles={styles} />
          </View>

          <Text style={styles.sectionTitle}>ПРОГНОЗ СОСТОЯНИЙ</Text>
          <StateChart label="3 мес." states={detail.p3} currentLevel={getLevel(selected)} theme={theme} styles={styles} />
          <StateChart label="6 мес." states={detail.p6} currentLevel={getLevel(selected)} theme={theme} styles={styles} />
          <StateChart label="12 мес." states={detail.p12} currentLevel={getLevel(selected)} theme={theme} styles={styles} />
          <StateChart label="24 мес." states={detail.p24} currentLevel={getLevel(selected)} theme={theme} styles={styles} />

          <View style={styles.insightBox}>
            <Text style={styles.insightIcon}>{detail.insightIcon}</Text>
            <Text style={styles.insightText}>{detail.insightText}</Text>
          </View>

          <Text style={styles.sectionTitle}>♾️ РАВНОВЕСИЕ (24 МЕС.)</Text>
          <View style={styles.equilibriumRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <View key={s} style={styles.eqCol}>
                <Text style={[styles.eqValue, { color: STATE_COLORS[s] }]}>
                  {Math.round(detail.ss[s] * 100)}%
                </Text>
                <Text style={styles.eqLabel}>{STATE_LABELS[s]}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.eqLevel}>
            Равновесный уровень: {expectedLevel(detail.ss)}
          </Text>
        </View>
      )}

      <Text style={styles.sectionHeader}>🌐 ПРОГНОЗ СЕТИ НА 12 МЕСЯЦЕВ</Text>
      {forecast.map((f) => {
        const initials = f.contact.contact.name.split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
        const dColor = f.delta > 0.15 ? '#059669' : f.delta < -0.2 ? '#dc2626' : '#64748b';
        const levelLabel = LEVEL_LABELS[f.contact.importance] ?? 'Контакт';
        return (
          <View key={f.contact.contact.id} style={styles.forecastRow}>
            <View style={[styles.avatarSmall, { borderColor: dColor }]}>
              <Text style={styles.avatarSmallText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.forecastName}>{f.contact.contact.name}</Text>
              <Text style={styles.forecastSub}>{levelLabel} → ожид. {f.expectedLvl.toFixed(1)}</Text>
            </View>
            <Text style={[styles.forecastDelta, { color: dColor }]}>
              {f.delta > 0 ? '+' : ''}{f.delta.toFixed(2)}
            </Text>
            {f.pLost > 15 && (
              <Text style={styles.forecastLost}>{f.pLost}%☠</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function ContactPickerList({ dossiers, selectedId, showMe, onSelect, theme, styles }: {
  dossiers: ContactDossier[];
  selectedId: string;
  showMe?: boolean;
  onSelect: (id: string) => void;
  theme: any;
  styles: any;
}) {
  const [search, setSearch] = useState('');
  const filtered = dossiers.filter((d) =>
    d.contact.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View style={styles.contactList}>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Поиск..."
        placeholderTextColor={theme.primaryDim}
      />
      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
        {showMe && (
          <TouchableOpacity
            style={[styles.contactOption, selectedId === 'me' && styles.contactOptionActive]}
            onPress={() => onSelect('me')}
            activeOpacity={0.7}
          >
            <Text style={[styles.contactOptionText, selectedId === 'me' && styles.contactOptionTextActive]}>
              Я (центр сети)
            </Text>
          </TouchableOpacity>
        )}
        {filtered.map((d) => (
          <TouchableOpacity
            key={d.contact.id}
            style={[styles.contactOption, selectedId === d.contact.id && styles.contactOptionActive]}
            onPress={() => onSelect(d.contact.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.contactOptionText, selectedId === d.contact.id && styles.contactOptionTextActive]}>
              {d.contact.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function HintBox({ hint, styles }: { hint: PathHint; theme: any; styles: any }) {
  return (
    <View style={[styles.hintBox, { borderLeftColor: hint.color }]}>
      <Text style={styles.hintBoxIcon}>{hint.icon}</Text>
      <Text style={styles.hintBoxText}>{hint.text}</Text>
    </View>
  );
}

function TransItem({ label, value, color, styles }: {
  label: string; value: number; color: string; theme: any; styles: any;
}) {
  return (
    <View style={styles.transItem}>
      <Text style={[styles.transValue, { color }]}>{value}%</Text>
      <Text style={styles.transLabel}>{label}</Text>
    </View>
  );
}

function StateChart({ label, states, currentLevel, styles }: {
  label: string; states: number[]; currentLevel: number; theme: any; styles: any;
}) {
  const maxP = Math.max(...states.map((s) => s || 0), 0.01);
  return (
    <View style={styles.stateChartBlock}>
      <Text style={styles.stateChartLabel}>{label}</Text>
      <View style={styles.stateChartBars}>
        {[0, 1, 2, 3, 4, 5].map((s) => {
          const pct = Math.round((states[s] || 0) * 100);
          const h = Math.max(pct > 0 ? 4 : 1, Math.round((states[s] || 0) / maxP * 48));
          const isCur = s === currentLevel;
          return (
            <View key={s} style={styles.stateBarCol}>
              {pct > 0 && <Text style={styles.stateBarPct}>{pct}%</Text>}
              <View style={[
                styles.stateBar,
                {
                  height: h,
                  backgroundColor: STATE_COLORS[s],
                  opacity: pct > 0 ? 1 : 0.15,
                },
                isCur && { borderWidth: 1, borderColor: STATE_COLORS[s] },
              ]} />
              <Text style={styles.stateBarLabel}>{STATE_LABELS[s]}</Text>
            </View>
          );
        })}
      </View>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 3,
    },
    tabBar: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      flexGrow: 0,
      flexShrink: 0,
      zIndex: 10,
    },
    tabBarContent: {
      paddingHorizontal: 8,
      gap: 4,
      paddingVertical: 8,
    },
    tabButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    tabButtonActive: {
      backgroundColor: theme.primary + '18',
      borderColor: theme.primary,
    },
    tabButtonText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    tabButtonTextActive: {
      color: theme.primary,
    },
    content: { padding: 14, paddingBottom: 40 },
    formulaCard: {
      borderWidth: 1,
      borderColor: theme.primary + '44',
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      backgroundColor: theme.overlay,
    },
    formulaText: {
      fontSize: 11,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      lineHeight: 16,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    },
    fieldLabel: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      marginBottom: 12,
    },
    pickerText: {
      fontSize: 14,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    contactList: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden' as const,
    },
    searchInput: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: theme.text,
      fontFamily: 'monospace' as const,
      backgroundColor: theme.overlay,
    },
    contactOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    contactOptionActive: { backgroundColor: theme.overlay },
    contactOptionText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    contactOptionTextActive: { color: theme.primary, fontWeight: '600' as const },
    actionButton: {
      borderWidth: 2,
      borderColor: theme.primary,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      marginBottom: 14,
    },
    actionButtonDisabled: { opacity: 0.4 },
    actionButtonText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyIcon: { fontSize: 36, marginBottom: 10 },
    emptyText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      textAlign: 'center' as const,
    },
    resultCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    },
    pathScoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    scoreBadge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreBadgeText: {
      fontSize: 16,
      fontWeight: '800' as const,
      color: '#FFFFFF',
      fontFamily: 'monospace' as const,
    },
    pathScoreLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    pathSteps: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },
    pathChain: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 14,
      paddingVertical: 8,
    },
    pathChainItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    pathNode: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.overlay,
    },
    pathNodeMe: {
      backgroundColor: theme.primary + '33',
    },
    pathNodeText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    pathNodeName: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      maxWidth: 50,
      position: 'absolute' as const,
      bottom: -14,
      left: -4,
    },
    pathEdgeLabel: {
      fontSize: 8,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      maxWidth: 60,
    },
    altPathsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    altPathBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    altPathBtnActive: {
      backgroundColor: theme.primary + '18',
      borderColor: theme.primary,
    },
    altPathBtnText: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    altPathBtnTextActive: { color: theme.primary },
    hintBox: {
      borderLeftWidth: 3,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 6,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      backgroundColor: theme.overlay,
    },
    hintBoxIcon: { fontSize: 16, marginTop: 1 },
    hintBoxText: {
      flex: 1,
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 18,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.overlay,
    },
    avatarText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    contactName: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    contactSub: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 1,
    },
    upgradeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 1,
    },
    upgradeBadgeText: {
      fontSize: 12,
      fontWeight: '700' as const,
      fontFamily: 'monospace' as const,
    },
    allyLabel: {
      fontSize: 13,
      fontWeight: '700' as const,
      fontFamily: 'monospace' as const,
    },
    progressBar: {
      height: 6,
      backgroundColor: theme.overlay,
      borderRadius: 3,
      marginTop: 10,
      overflow: 'hidden' as const,
    },
    progressFill: {
      height: '100%' as const,
      borderRadius: 3,
    },
    expandedSection: {
      marginTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      letterSpacing: 1.5,
      marginBottom: 10,
      marginTop: 4,
    },
    factorsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 14,
    },
    factorCol: {
      alignItems: 'center',
      width: 60,
    },
    factorBarBg: {
      width: 24,
      height: 54,
      backgroundColor: theme.overlay,
      borderRadius: 4,
      overflow: 'hidden' as const,
      justifyContent: 'flex-end',
      marginBottom: 4,
    },
    factorBarFill: {
      width: '100%' as const,
      borderRadius: 4,
    },
    factorValue: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    factorLabel: {
      fontSize: 8,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
      textAlign: 'center' as const,
    },
    tipText: {
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 18,
      marginBottom: 4,
    },
    riskRow: {
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    riskLabel: {
      fontSize: 11,
      fontWeight: '600' as const,
      fontFamily: 'monospace' as const,
    },
    rankBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.overlay,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    nameRoleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    roleTag: {
      fontSize: 10,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 2,
    },
    statText: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    sciBadge: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignItems: 'center',
    },
    sciValue: {
      fontSize: 16,
      fontWeight: '800' as const,
      fontFamily: 'monospace' as const,
    },
    sciLabel: {
      fontSize: 8,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    hintRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      alignItems: 'flex-start',
    },
    hintText: {
      flex: 1,
      fontSize: 11,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      lineHeight: 16,
    },
    markovTarget: {
      fontSize: 9,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    markovMonths: {
      fontSize: 18,
      fontWeight: '800' as const,
      color: theme.primary,
      fontFamily: 'monospace' as const,
    },
    markovProb: {
      fontSize: 10,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
    },
    transGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    transItem: {
      flex: 1,
      minWidth: '40%' as any,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: theme.overlay,
    },
    transValue: {
      fontSize: 16,
      fontWeight: '700' as const,
      fontFamily: 'monospace' as const,
    },
    transLabel: {
      fontSize: 9,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },
    stateChartBlock: {
      marginBottom: 12,
    },
    stateChartLabel: {
      fontSize: 10,
      fontWeight: '600' as const,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginBottom: 6,
    },
    stateChartBars: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 70,
      paddingBottom: 16,
    },
    stateBarCol: {
      flex: 1,
      alignItems: 'center',
    },
    stateBarPct: {
      fontSize: 8,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      marginBottom: 2,
    },
    stateBar: {
      width: 16,
      borderRadius: 3,
      minHeight: 2,
    },
    stateBarLabel: {
      fontSize: 7,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 3,
      textAlign: 'center' as const,
    },
    insightBox: {
      flexDirection: 'row',
      gap: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: theme.overlay,
      borderWidth: 1,
      borderColor: theme.primary + '44',
      marginVertical: 10,
    },
    insightIcon: { fontSize: 18 },
    insightText: {
      flex: 1,
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
      lineHeight: 18,
    },
    equilibriumRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    eqCol: {
      alignItems: 'center',
      flex: 1,
    },
    eqValue: {
      fontSize: 14,
      fontWeight: '700' as const,
      fontFamily: 'monospace' as const,
    },
    eqLabel: {
      fontSize: 8,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      marginTop: 2,
    },
    eqLevel: {
      fontSize: 11,
      color: theme.primaryDim,
      fontFamily: 'monospace' as const,
      textAlign: 'center' as const,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
      marginTop: 16,
      marginBottom: 10,
    },
    forecastRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      backgroundColor: theme.card,
      marginBottom: 6,
    },
    avatarSmall: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.overlay,
    },
    avatarSmallText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    forecastName: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
    },
    forecastSub: {
      fontSize: 10,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
    },
    forecastDelta: {
      fontSize: 13,
      fontWeight: '700' as const,
      fontFamily: 'monospace' as const,
    },
    forecastLost: {
      fontSize: 10,
      color: '#dc2626',
      fontWeight: '600' as const,
      fontFamily: 'monospace' as const,
    },
  });
