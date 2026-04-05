import type { ContactDossier, StrategicGoal } from '@/types';

export interface PathNode {
  id: string;
  edge: { label: string; type: string } | null;
}

export interface UpgradeResult {
  up: number | null;
  down: number;
  trustRatio: number;
  recency: number;
  goalFactor: number;
  actionFactor: number;
  days: number;
  zScore: number;
}

export interface ConnectorScore {
  contactId: string;
  sci: number;
  degree: number;
  betweenness: number;
  role: string;
  roleIcon: string;
}

export interface MarkovForecast {
  states: number[];
  expectedLevel: number;
}

export interface MonthlyTransitions {
  pUp: number;
  pDown: number;
  pLost: number;
  pStay: number;
}

export interface PathHint {
  icon: string;
  text: string;
  color: string;
  bg: string;
}

const IMPORTANCE_TRUST: Record<string, number> = {
  critical: 90,
  high: 70,
  medium: 50,
  low: 25,
};

const IMPORTANCE_LEVEL: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
};

function getTrust(d: ContactDossier): number {
  return IMPORTANCE_TRUST[d.importance] ?? 50;
}

function getLevel(d: ContactDossier): number {
  return IMPORTANCE_LEVEL[d.importance] ?? 2;
}

function daysSince(dateStr?: string | Date): number {
  if (!dateStr) return 365;
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return 365;
  return Math.max(0, Math.ceil((Date.now() - d.getTime()) / 86400000));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type AdjMap = Record<string, { id: string; type: string; label: string }[]>;

export function buildAdjacencyMap(
  dossiers: ContactDossier[],
  goals: StrategicGoal[],
): AdjMap {
  const adj: AdjMap = { me: [] };

  dossiers.forEach((d) => {
    const cid = d.contact.id;
    if (!adj[cid]) adj[cid] = [];
    adj['me'].push({ id: cid, type: 'me', label: d.importance });
    adj[cid].push({ id: 'me', type: 'me', label: d.importance });
  });

  dossiers.forEach((d) => {
    (d.relations || []).forEach((rel) => {
      const fromId = d.contact.id;
      const toId = rel.contactId;
      if (!adj[fromId]) adj[fromId] = [];
      if (!adj[toId]) adj[toId] = [];
      adj[fromId].push({ id: toId, type: 'manual', label: rel.description || '' });
      adj[toId].push({ id: fromId, type: 'manual', label: rel.description || '' });
    });
  });

  goals.forEach((g) => {
    const cs = g.contactIds || [];
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        if (!adj[cs[i]]) adj[cs[i]] = [];
        if (!adj[cs[j]]) adj[cs[j]] = [];
        adj[cs[i]].push({ id: cs[j], type: 'goal', label: g.title });
        adj[cs[j]].push({ id: cs[i], type: 'goal', label: g.title });
      }
    }
  });

  return adj;
}

export function findPaths(
  fromId: string,
  toId: string,
  dossiers: ContactDossier[],
  goals: StrategicGoal[],
  maxPaths = 4,
): PathNode[][] {
  if (fromId === toId) return [];
  const adj = buildAdjacencyMap(dossiers, goals);
  const results: PathNode[][] = [];
  const queue: [string, PathNode[]][] = [[fromId, [{ id: fromId, edge: null }]]];
  const seen = new Set<string>();

  while (queue.length && results.length < maxPaths) {
    const [cur, path] = queue.shift()!;
    const key = path.map((p) => p.id).join('>');
    if (seen.has(key)) continue;
    seen.add(key);
    if (cur === toId && path.length > 1) {
      results.push(path);
      continue;
    }
    if (path.length >= 7) continue;
    for (const nb of adj[cur] || []) {
      if (!path.some((p) => p.id === nb.id)) {
        queue.push([nb.id, [...path, { id: nb.id, edge: { label: nb.label, type: nb.type } }]]);
      }
    }
  }
  return results;
}

export function edgeStrength(
  aId: string,
  bId: string,
  dossiers: ContactDossier[],
): number {
  if (aId === 'me' || bId === 'me') {
    const cId = aId === 'me' ? bId : aId;
    const d = dossiers.find((x) => x.contact.id === cId);
    if (!d) return 0.1;
    const trust = getTrust(d);
    const level = getLevel(d);
    return Math.min(trust / 100 * 0.65 + level / 5 * 0.35, 1);
  }
  const a = dossiers.find((x) => x.contact.id === aId);
  const b = dossiers.find((x) => x.contact.id === bId);
  if (!a || !b) return 0.2;
  const avgTrust = (getTrust(a) + getTrust(b)) / 200;
  const lvBonus = Math.min(getLevel(a), getLevel(b)) / 5 * 0.25;
  const hasManual = a.relations.some((r) => r.contactId === bId) ||
    b.relations.some((r) => r.contactId === aId);
  return Math.min(avgTrust + lvBonus + (hasManual ? 0.15 : 0), 1);
}

export function pathScore(path: PathNode[], dossiers: ContactDossier[]): number {
  if (!path || path.length < 2) return 0;
  let prod = 1;
  for (let i = 0; i < path.length - 1; i++) {
    prod *= edgeStrength(path[i].id, path[i + 1].id, dossiers);
  }
  return Math.min(prod / Math.sqrt(path.length - 1), 1);
}

export function calcUpgrade(
  d: ContactDossier,
  goals: StrategicGoal[],
  overrideLevel?: number,
): UpgradeResult {
  const level = overrideLevel ?? getLevel(d);
  const trust = getTrust(d);

  if (level >= 5) {
    return {
      up: null,
      down: calcDowngradeRisk(d, level),
      trustRatio: 100,
      recency: 0,
      goalFactor: 0,
      actionFactor: 0,
      days: daysSince(d.lastInteraction),
      zScore: 0,
    };
  }

  const nextThresh = [0, 25, 45, 62, 78, 92][Math.min(level + 1, 5)];
  const trustRatio = Math.min(trust / nextThresh, 1.5);
  const days = daysSince(d.lastInteraction);
  const recency = Math.exp(-days / 90);
  const goalCount = goals.filter((g) => (g.contactIds || []).includes(d.contact.id)).length;
  const goalF = Math.min(goalCount / 2, 1);
  const today = todayStr();
  const actionF = d.nextAction && d.nextActionDate && d.nextActionDate >= today ? 1 : 0;
  const z = 0.40 * Math.min(trustRatio, 1) + 0.30 * recency + 0.20 * goalF + 0.10 * actionF;
  const p = 1 / (1 + Math.exp(-8 * (z - 0.5)));

  return {
    up: Math.round(p * 100),
    down: calcDowngradeRisk(d, level),
    trustRatio: Math.round(trustRatio * 100),
    recency: Math.round(recency * 100),
    goalFactor: Math.round(goalF * 100),
    actionFactor: actionF,
    days,
    zScore: Math.round(z * 100),
  };
}

function calcDowngradeRisk(d: ContactDossier, level?: number): number {
  const l = level ?? getLevel(d);
  const days = daysSince(d.lastInteraction);
  const decayRate = Math.max(120 - l * 15, 30);
  return Math.round((1 - Math.exp(-days / decayRate)) * 100 * 0.7);
}

export function nodeDegree(
  contactId: string,
  dossiers: ContactDossier[],
  goals: StrategicGoal[],
): number {
  let deg = 0;
  const d = dossiers.find((x) => x.contact.id === contactId);
  if (d) deg += d.relations.length;
  goals.forEach((g) => {
    if ((g.contactIds || []).includes(contactId)) deg++;
  });
  return deg;
}

export function calcCentrality(
  dossiers: ContactDossier[],
  goals: StrategicGoal[],
): Record<string, number> {
  const scores: Record<string, number> = {};
  dossiers.forEach((d) => (scores[d.contact.id] = 0));
  const ids = dossiers.map((d) => d.contact.id);
  const maxPairs = Math.min(ids.length * (ids.length - 1) / 2, 200);
  let count = 0;
  for (let i = 0; i < ids.length && count < maxPairs; i++) {
    for (let j = i + 1; j < ids.length && count < maxPairs; j++) {
      const paths = findPaths(ids[i], ids[j], dossiers, goals, 1);
      if (paths[0]) {
        paths[0].slice(1, -1).forEach((n) => {
          if (scores[n.id] !== undefined) scores[n.id]++;
        });
      }
      count++;
    }
  }
  return scores;
}

export function socialCapital(
  d: ContactDossier,
  centrality: Record<string, number>,
  dossiers: ContactDossier[],
  goals: StrategicGoal[],
): number {
  const trust = getTrust(d);
  const level = getLevel(d);
  const degree = nodeDegree(d.contact.id, dossiers, goals);
  const bc = centrality[d.contact.id] || 0;
  const maxBC = Math.max(...Object.values(centrality), 1);
  return Math.round(
    (trust / 100) * 35 +
    (level / 5) * 30 +
    (degree / Math.max(dossiers.length - 1, 1)) * 20 +
    (bc / maxBC) * 15,
  );
}

export function getConnectorScores(
  dossiers: ContactDossier[],
  goals: StrategicGoal[],
): ConnectorScore[] {
  const centrality = calcCentrality(dossiers, goals);
  return dossiers.map((d) => {
    const bc = centrality[d.contact.id] || 0;
    const degree = nodeDegree(d.contact.id, dossiers, goals);
    const sci = socialCapital(d, centrality, dossiers, goals);
    let role: string;
    let roleIcon: string;
    if (bc >= 3) { role = 'Мост'; roleIcon = '🌉'; }
    else if (bc >= 1) { role = 'Коннектор'; roleIcon = '🔗'; }
    else if (degree >= 3) { role = 'Узловой'; roleIcon = '🌟'; }
    else { role = 'Рядовой'; roleIcon = '👤'; }
    return { contactId: d.contact.id, sci, degree, betweenness: bc, role, roleIcon };
  }).sort((a, b) => b.sci - a.sci);
}

export function getMonthlyTransitions(
  d: ContactDossier,
  goals: StrategicGoal[],
  overrideLevel?: number,
): MonthlyTransitions {
  const level = overrideLevel ?? getLevel(d);
  const u = calcUpgrade(d, goals, level);
  const pUpAnnual = (u.up !== null ? u.up / 100 : 0) * 0.45;
  const pUp = level < 5 ? Math.min(1 - Math.pow(Math.max(1 - pUpAnnual, 0.001), 1 / 12), 0.08) : 0;
  const pDownAnnual = u.down / 100 * 0.30;
  const pDown = level > 1 ? Math.min(1 - Math.pow(Math.max(1 - pDownAnnual, 0.001), 1 / 12), 0.06) : 0;
  const pLost = level === 1 ? 0.012 : level === 2 ? 0.004 : 0.001;
  const pStay = Math.max(1 - pUp - pDown - pLost, 0.5);
  const total = pUp + pDown + pLost + pStay;
  return {
    pUp: pUp / total,
    pDown: pDown / total,
    pLost: pLost / total,
    pStay: pStay / total,
  };
}

export function predictStates(
  d: ContactDossier,
  goals: StrategicGoal[],
  months: number,
): number[] {
  let v = Array(6).fill(0) as number[];
  v[Math.max(1, Math.min(5, getLevel(d)))] = 1;
  for (let m = 0; m < months; m++) {
    const nv = Array(6).fill(0) as number[];
    nv[0] += v[0];
    for (let s = 1; s <= 5; s++) {
      if (v[s] < 0.00001) continue;
      const { pUp, pDown, pLost, pStay } = getMonthlyTransitions(d, goals, s);
      nv[s] += v[s] * pStay;
      if (s < 5) nv[s + 1] += v[s] * pUp;
      else nv[5] += v[s] * pUp;
      if (s > 1) nv[s - 1] += v[s] * pDown;
      else nv[1] += v[s] * pDown;
      nv[0] += v[s] * pLost;
    }
    v = nv;
  }
  return v;
}

export function expectedLevel(v: number[]): string {
  return v.slice(1).reduce((s, p, i) => s + p * (i + 1), 0).toFixed(1);
}

export function monthsToLevel(
  d: ContactDossier,
  goals: StrategicGoal[],
  targetLevel: number,
): number | null {
  if (getLevel(d) === targetLevel) return 0;
  if (targetLevel < getLevel(d)) return null;
  for (let m = 1; m <= 36; m++) {
    if (predictStates(d, goals, m)[targetLevel] >= 0.35) return m;
  }
  return null;
}

export function steadyState(d: ContactDossier, goals: StrategicGoal[]): number[] {
  return predictStates(d, goals, 24);
}

export function getNetworkForecast(
  dossiers: ContactDossier[],
  goals: StrategicGoal[],
): {
  contact: ContactDossier;
  expectedLvl: number;
  delta: number;
  pLost: number;
}[] {
  return dossiers.map((d) => {
    const p12 = predictStates(d, goals, 12);
    const el = parseFloat(expectedLevel(p12));
    return {
      contact: d,
      expectedLvl: el,
      delta: el - getLevel(d),
      pLost: Math.round(p12[0] * 100),
    };
  }).sort((a, b) => b.delta - a.delta);
}

export function getPathHints(
  path: PathNode[],
  targetId: string,
  dossiers: ContactDossier[],
  goals: StrategicGoal[],
): PathHint[] {
  const target = dossiers.find((d) => d.contact.id === targetId);
  const hints: PathHint[] = [];
  if (!target) return hints;

  const L = path.length;

  if (L === 2) {
    hints.push({
      icon: '✅',
      text: `Прямой выход на ${target.contact.name} — действуйте сейчас`,
      color: '#059669',
      bg: '#022c22',
    });
    const upd = calcUpgrade(target, goals);
    if (upd.up !== null && upd.up > 60) {
      hints.push({
        icon: '📈',
        text: `Высокая вероятность повышения: ${upd.up}%`,
        color: '#3730a3',
        bg: '#1e1b4b',
      });
    }
  } else {
    const bridge = dossiers.find((d) => d.contact.id === path[1].id);
    if (bridge) {
      const es = Math.round(edgeStrength(path[0].id, bridge.contact.id, dossiers) * 100);
      const firstName = bridge.contact.name.split(' ')[0];
      const targetFirst = target.contact.name.split(' ')[0];
      hints.push({
        icon: '🤝',
        text: `Попросите ${firstName} представить вас ${targetFirst}. Сила связи: ${es}%`,
        color: '#1e3a5f',
        bg: '#0f172a',
      });
      const bridgeTrust = getTrust(bridge);
      if (bridgeTrust < 65) {
        hints.push({
          icon: '⚠️',
          text: `Доверие к ${firstName} — ${bridgeTrust}%. Поднимите до 65%+ для снижения риска`,
          color: '#92400e',
          bg: '#1c0a00',
        });
      } else {
        hints.push({
          icon: '💡',
          text: `Доверие к ${firstName} достаточно (${bridgeTrust}%). Хорошее время для просьбы`,
          color: '#065f46',
          bg: '#022c22',
        });
      }
    }
    if (L > 3) {
      const chain = path.slice(1, -1).map((p) => {
        if (p.id === 'me') return 'Я';
        const c = dossiers.find((x) => x.contact.id === p.id);
        return c ? c.contact.name.split(' ')[0] : '?';
      }).join(' → ');
      hints.push({
        icon: '🔗',
        text: `Цепочка: ${chain}. Каждое звено ослабляет рекомендацию`,
        color: '#4a1d96',
        bg: '#1e1b4b',
      });
    }
  }

  const sharedGoals = goals.filter(
    (g) => (g.contactIds || []).includes(targetId),
  );
  if (sharedGoals.length) {
    hints.push({
      icon: '🎯',
      text: `Связаны общей целью «${sharedGoals[0].title}» — используйте как повод`,
      color: '#1e3a5f',
      bg: '#0f172a',
    });
  } else {
    hints.push({
      icon: '💭',
      text: `Добавьте ${target.contact.name.split(' ')[0]} в стратегическую цель для контекста сближения`,
      color: '#334155',
      bg: '#0f172a',
    });
  }

  return hints;
}

export const STATE_LABELS = ['Потеря', 'Знаком.', 'Контакт', 'Полезн.', 'Довер.', 'Союзник'];
export const STATE_COLORS = ['#dc2626', '#64748b', '#2563eb', '#7c3aed', '#d97706', '#059669'];
export const LEVEL_LABELS: Record<string, string> = {
  low: 'Знакомый',
  medium: 'Контакт',
  high: 'Полезная связь',
  critical: 'Доверенное лицо',
};

export { getLevel, getTrust, daysSince };
