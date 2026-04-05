import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ForumCategory,
  ForumTopic,
  ForumMessage,
  ForumNotification,
  ForumNotificationSettings,
  ForumProfile,
  AccessLevel,
} from '@/types';

const KEYS = {
  CATEGORIES: 'forum_categories_v2',
  TOPICS: 'forum_topics_v2',
  MESSAGES: 'forum_messages_v2',
  NOTIFICATIONS: 'forum_notifications_v1',
  NOTIFICATION_SETTINGS: 'forum_notification_settings_v1',
  SEEDED: 'forum_seeded_v2',
  WELCOME_SEEN: 'forum_welcome_seen_v1',
  RULES_ACCEPTED: 'forum_rules_accepted_v1',
  FORUM_PROFILE: 'forum_profile_v1',
  FORUM_PROFILES_ALL: 'forum_profiles_all_v1',
} as const;

const SEED_CATEGORIES: ForumCategory[] = [
  {
    id: 'cat_networking_theory',
    name: 'networking_theory',
    description: 'networking_theory_desc',
    readLevel: 1,
    createTopicLevel: 1,
    writeLevel: 1,
    order: 0,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'cat_practice_cases',
    name: 'practice_cases',
    description: 'practice_cases_desc',
    readLevel: 1,
    createTopicLevel: 1,
    writeLevel: 1,
    order: 1,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'cat_strategic_center',
    name: 'strategic_center',
    description: 'strategic_center_desc',
    readLevel: 2,
    createTopicLevel: 3,
    writeLevel: 3,
    order: 2,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'cat_analytical_node',
    name: 'analytical_node',
    description: 'analytical_node_desc',
    readLevel: 4,
    createTopicLevel: 4,
    writeLevel: 4,
    order: 3,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'cat_club_elite',
    name: 'club_elite',
    description: 'club_elite_desc',
    readLevel: 3,
    createTopicLevel: 4,
    writeLevel: 4,
    order: 4,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'cat_authors_column',
    name: 'authors_column',
    description: 'authors_column_desc',
    readLevel: 2,
    createTopicLevel: 5,
    writeLevel: 2,
    order: 5,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'cat_lab',
    name: 'lab_spynetwork',
    description: 'lab_spynetwork_desc',
    readLevel: 1,
    createTopicLevel: 1,
    writeLevel: 1,
    order: 6,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
];

interface SeedTopicDef {
  id: string;
  categoryId: string;
  title: string;
  messages: string[];
}

const SEED_TOPICS: SeedTopicDef[] = [
  // 1. ТЕОРИЯ НЕТВОРКИНГА
  {
    id: 'topic_nt_1',
    categoryId: 'cat_networking_theory',
    title: 'Первые шаги в стратегическом нетворкинге',
    messages: [
      'С чего вы начали работу над своей сетью? Какие первые шаги оказались самыми полезными?',
      'Как вы определили свои первые цели? Делитесь опытом.',
      'Что оказалось самым неожиданным в начале пути?',
    ],
  },
  {
    id: 'topic_nt_2',
    categoryId: 'cat_networking_theory',
    title: 'Как правильно вести дневник встреч',
    messages: [
      'Какие форматы записей вам удобнее: краткие заметки или подробные отчёты?',
      'Как часто вы пересматриваете записи и корректируете цели?',
      'Какие инсайты вы получили благодаря дневнику?',
    ],
  },
  {
    id: 'topic_nt_3',
    categoryId: 'cat_networking_theory',
    title: 'Типичные ошибки новичков',
    messages: [
      'Какие ошибки вы совершили в начале и как их исправили?',
      'Что бы вы посоветовали себе год назад?',
      'Какие ошибки чаще всего встречаются у ваших знакомых?',
    ],
  },
  // 2. ПРАКТИКА И КЕЙСЫ
  {
    id: 'topic_pc_1',
    categoryId: 'cat_practice_cases',
    title: 'Удачные примеры взаимодействий',
    messages: [
      'Расскажите о недавнем успешном контакте — что сработало?',
      'Какие фразы или подходы помогли вам установить доверие?',
      'Как вы поддержали связь после первой встречи?',
    ],
  },
  {
    id: 'topic_pc_2',
    categoryId: 'cat_practice_cases',
    title: 'Как находить точки пересечения с новыми людьми',
    messages: [
      'Какие вопросы вы задаёте, чтобы найти общие интересы?',
      'Как вы определяете, стоит ли развивать контакт?',
      'Какие методы помогают вам быстро установить раппорт?',
    ],
  },
  {
    id: 'topic_pc_3',
    categoryId: 'cat_practice_cases',
    title: 'Разбор сложных ситуаций',
    messages: [
      'Опишите ситуацию, где контакт развивался сложно — что помогло?',
      'Как вы выходили из неловких моментов?',
      'Какие уроки вынесли из неудачных попыток?',
    ],
  },
  // 3. Стратегический Центр
  {
    id: 'topic_sc_1',
    categoryId: 'cat_strategic_center',
    title: 'Как формулировать цели взаимодействия',
    messages: [
      'Какие цели вы ставите на квартал?',
      'Как вы связываете цели с конкретными контактами?',
      'Что помогает вам держать фокус?',
    ],
  },
  {
    id: 'topic_sc_2',
    categoryId: 'cat_strategic_center',
    title: 'Работа с ключевыми контактами',
    messages: [
      'Как вы определяете ключевые контакты?',
      'Какие методы используете для поддержания связи?',
      'Как вы оцениваете ценность контакта?',
    ],
  },
  {
    id: 'topic_sc_3',
    categoryId: 'cat_strategic_center',
    title: 'Стратегии развития сети',
    messages: [
      'Как вы планируете расширение сети?',
      'Какие подходы оказались самыми эффективными?',
      'Как вы корректируете стратегию по мере изменений?',
    ],
  },
  // 4. Аналитический Узел
  {
    id: 'topic_an_1',
    categoryId: 'cat_analytical_node',
    title: 'Как читать карту сети',
    messages: [
      'Какие элементы карты сети вы анализируете в первую очередь?',
      'Как вы определяете узлы влияния?',
      'Какие выводы вы сделали после анализа своей карты?',
    ],
  },
  {
    id: 'topic_an_2',
    categoryId: 'cat_analytical_node',
    title: 'Слабые места сети',
    messages: [
      'Где вы обнаружили пробелы в своей сети?',
      'Как вы планируете их закрывать?',
      'Какие связи оказались менее устойчивыми, чем казалось?',
    ],
  },
  {
    id: 'topic_an_3',
    categoryId: 'cat_analytical_node',
    title: 'Динамика развития сети',
    messages: [
      'Как изменилась ваша сеть за последние 6 месяцев?',
      'Какие новые связи оказались ключевыми?',
      'Как вы отслеживаете динамику?',
    ],
  },
  // 5. КЛУБ
  {
    id: 'topic_ce_1',
    categoryId: 'cat_club_elite',
    title: 'Поиск контактов по направлениям',
    messages: [
      'Знакомство, расскажите о себе',
      'Ищу контакт в....',
      'Сервис 6 рукопожатий',
    ],
  },
  {
    id: 'topic_ce_2',
    categoryId: 'cat_club_elite',
    title: 'Сложные кейсы участников',
    messages: [
      'Опишите сложный кейс — как вы его решали?',
      'Какие альтернативные стратегии вы рассматривали?',
      'Что оказалось ключевым фактором успеха?',
    ],
  },
  {
    id: 'topic_ce_3',
    categoryId: 'cat_club_elite',
    title: 'Долгосрочные стратегии развития сети',
    messages: [
      'Как вы планируете развитие сети на год вперёд?',
      'Какие цели ставите на 3–5 лет?',
      'Как вы оцениваете эффективность долгосрочных стратегий?',
    ],
  },
  // 6. Колонка Авторов
  {
    id: 'topic_ac_1',
    categoryId: 'cat_authors_column',
    title: 'Комментарии к методике',
    messages: [
      'Какие элементы методики вы считаете ключевыми?',
      'Как вы применяете принципы книги в реальной жизни?',
      'Какие вопросы вы хотели бы задать авторам?',
    ],
  },
  {
    id: 'topic_ac_2',
    categoryId: 'cat_authors_column',
    title: 'Разбор ситуаций от авторов',
    messages: [
      'Какие ситуации из вашей практики требуют комментария?',
      'Что бы вы хотели услышать от авторов?',
      'Какие темы стоит разобрать в следующем выпуске?',
    ],
  },
  {
    id: 'topic_ac_3',
    categoryId: 'cat_authors_column',
    title: 'Стратегическое видение',
    messages: [],
  },
  // 7. Лаборатория SpyNetwork
  {
    id: 'topic_lab_1',
    categoryId: 'cat_lab',
    title: 'Предложения по улучшению',
    messages: [
      'Какие функции вам не хватает?',
      'Что можно улучшить в интерфейсе?',
      'Какие идеи вы хотели бы видеть в будущем?',
    ],
  },
  {
    id: 'topic_lab_2',
    categoryId: 'cat_lab',
    title: 'Сообщения об ошибках',
    messages: [
      'Опишите проблему, с которой столкнулись.',
      'На каком устройстве возникла ошибка?',
      'Как можно воспроизвести проблему?',
    ],
  },
  {
    id: 'topic_lab_3',
    categoryId: 'cat_lab',
    title: 'Вопросы по использованию',
    messages: [
      'Какую функцию вы хотите освоить?',
      'Что вызывает затруднения?',
      'Какие инструкции стоит добавить в приложение?',
    ],
  },
];

const SEED_AUTHORS = [
  'Стратег',
  'Аналитик',
  'Модератор',
  'Навигатор',
  'Архитектор',
];

function pickAuthor(topicIdx: number, msgIdx: number): string {
  return SEED_AUTHORS[(topicIdx + msgIdx) % SEED_AUTHORS.length];
}

async function seedForum(): Promise<void> {
  const seeded = await AsyncStorage.getItem(KEYS.SEEDED);
  if (seeded === 'true') return;

  console.log('[ForumService] Seeding forum data...');

  await saveJSON(KEYS.CATEGORIES, SEED_CATEGORIES);

  const allTopics: ForumTopic[] = [];
  const allMessages: ForumMessage[] = [];

  const baseTime = new Date('2026-02-01T09:00:00.000Z').getTime();

  SEED_TOPICS.forEach((def, tIdx) => {
    const topicTime = baseTime + tIdx * 3600_000 * 24;
    const msgCount = def.messages.length;

    const lastMsgTime = msgCount > 0
      ? new Date(topicTime + (msgCount - 1) * 600_000).toISOString()
      : new Date(topicTime).toISOString();

    allTopics.push({
      id: def.id,
      categoryId: def.categoryId,
      title: def.title,
      authorPhone: 'system',
      authorName: pickAuthor(tIdx, 0),
      isPinned: false,
      isLocked: false,
      messageCount: msgCount,
      lastMessageAt: lastMsgTime,
      createdAt: new Date(topicTime).toISOString(),
    });

    def.messages.forEach((content, mIdx) => {
      allMessages.push({
        id: `msg_seed_${def.id}_${mIdx}`,
        topicId: def.id,
        authorPhone: 'system',
        authorName: pickAuthor(tIdx, mIdx),
        content,
        createdAt: new Date(topicTime + mIdx * 600_000).toISOString(),
      });
    });
  });

  await saveJSON(KEYS.TOPICS, allTopics);
  await saveJSON(KEYS.MESSAGES, allMessages);
  await AsyncStorage.setItem(KEYS.SEEDED, 'true');

  console.log('[ForumService] Forum seeded:', {
    categories: SEED_CATEGORIES.length,
    topics: allTopics.length,
    messages: allMessages.length,
  });
}

async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.log('[ForumService] loadJSON error', key, e);
    return fallback;
  }
}

async function saveJSON(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.log('[ForumService] saveJSON error', key, e);
  }
}

export function getUserAccessLevel(subscriptionLevel: string): AccessLevel {
  switch (subscriptionLevel) {
    case 'working':
      return 2;
    case 'basic':
    default:
      return 1;
  }
}

export async function getCategories(): Promise<ForumCategory[]> {
  await seedForum();
  const cats = await loadJSON<ForumCategory[]>(KEYS.CATEGORIES, []);
  if (cats.length === 0) {
    await saveJSON(KEYS.CATEGORIES, SEED_CATEGORIES);
    return SEED_CATEGORIES;
  }
  return cats.sort((a, b) => a.order - b.order);
}

export async function saveCategories(cats: ForumCategory[]): Promise<void> {
  await saveJSON(KEYS.CATEGORIES, cats);
}

export async function addCategory(cat: ForumCategory): Promise<ForumCategory[]> {
  const cats = await getCategories();
  cats.push(cat);
  await saveJSON(KEYS.CATEGORIES, cats);
  return cats;
}

export async function updateCategory(id: string, updates: Partial<ForumCategory>): Promise<ForumCategory[]> {
  const cats = await getCategories();
  const updated = cats.map(c => (c.id === id ? { ...c, ...updates } : c));
  await saveJSON(KEYS.CATEGORIES, updated);
  return updated;
}

export async function deleteCategory(id: string): Promise<ForumCategory[]> {
  const cats = await getCategories();
  const updated = cats.filter(c => c.id !== id);
  await saveJSON(KEYS.CATEGORIES, updated);
  const topics = await getTopicsByCategory(id);
  for (const t of topics) {
    await deleteTopicAndMessages(t.id);
  }
  return updated;
}

export async function getTopicsByCategory(categoryId: string): Promise<ForumTopic[]> {
  const all = await loadJSON<ForumTopic[]>(KEYS.TOPICS, []);
  return all
    .filter(t => t.categoryId === categoryId)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
}

export async function getTopic(id: string): Promise<ForumTopic | null> {
  const all = await loadJSON<ForumTopic[]>(KEYS.TOPICS, []);
  return all.find(t => t.id === id) ?? null;
}

export async function addTopic(topic: ForumTopic): Promise<void> {
  const all = await loadJSON<ForumTopic[]>(KEYS.TOPICS, []);
  all.push(topic);
  await saveJSON(KEYS.TOPICS, all);
}

export async function updateTopic(id: string, updates: Partial<ForumTopic>): Promise<void> {
  const all = await loadJSON<ForumTopic[]>(KEYS.TOPICS, []);
  const updated = all.map(t => (t.id === id ? { ...t, ...updates } : t));
  await saveJSON(KEYS.TOPICS, updated);
}

export async function deleteTopicAndMessages(topicId: string): Promise<void> {
  const allTopics = await loadJSON<ForumTopic[]>(KEYS.TOPICS, []);
  await saveJSON(KEYS.TOPICS, allTopics.filter(t => t.id !== topicId));

  const allMsgs = await loadJSON<ForumMessage[]>(KEYS.MESSAGES, []);
  await saveJSON(KEYS.MESSAGES, allMsgs.filter(m => m.topicId !== topicId));
}

export async function getMessagesByTopic(topicId: string): Promise<ForumMessage[]> {
  const all = await loadJSON<ForumMessage[]>(KEYS.MESSAGES, []);
  return all
    .filter(m => m.topicId === topicId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function addMessage(msg: ForumMessage): Promise<void> {
  const all = await loadJSON<ForumMessage[]>(KEYS.MESSAGES, []);
  all.push(msg);
  await saveJSON(KEYS.MESSAGES, all);

  const allTopics = await loadJSON<ForumTopic[]>(KEYS.TOPICS, []);
  const updatedTopics = allTopics.map(t =>
    t.id === msg.topicId
      ? { ...t, messageCount: t.messageCount + 1, lastMessageAt: msg.createdAt }
      : t,
  );
  await saveJSON(KEYS.TOPICS, updatedTopics);
}

export async function deleteMessage(msgId: string): Promise<void> {
  const all = await loadJSON<ForumMessage[]>(KEYS.MESSAGES, []);
  await saveJSON(KEYS.MESSAGES, all.filter(m => m.id !== msgId));
}

export async function toggleMessageLike(msgId: string, phone: string): Promise<ForumMessage[]> {
  const all = await loadJSON<ForumMessage[]>(KEYS.MESSAGES, []);
  const updated = all.map(m => {
    if (m.id !== msgId) return m;
    const likes = m.likes ?? [];
    const dislikes = (m.dislikes ?? []).filter(p => p !== phone);
    const hasLiked = likes.includes(phone);
    return {
      ...m,
      likes: hasLiked ? likes.filter(p => p !== phone) : [...likes, phone],
      dislikes,
    };
  });
  await saveJSON(KEYS.MESSAGES, updated);
  return updated;
}

export async function toggleMessageDislike(msgId: string, phone: string): Promise<ForumMessage[]> {
  const all = await loadJSON<ForumMessage[]>(KEYS.MESSAGES, []);
  const updated = all.map(m => {
    if (m.id !== msgId) return m;
    const dislikes = m.dislikes ?? [];
    const likes = (m.likes ?? []).filter(p => p !== phone);
    const hasDisliked = dislikes.includes(phone);
    return {
      ...m,
      dislikes: hasDisliked ? dislikes.filter(p => p !== phone) : [...dislikes, phone],
      likes,
    };
  });
  await saveJSON(KEYS.MESSAGES, updated);
  return updated;
}

export async function getNotifications(_phone: string): Promise<ForumNotification[]> {
  const all = await loadJSON<ForumNotification[]>(KEYS.NOTIFICATIONS, []);
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function addNotification(n: ForumNotification): Promise<void> {
  const all = await loadJSON<ForumNotification[]>(KEYS.NOTIFICATIONS, []);
  all.push(n);
  if (all.length > 200) all.splice(0, all.length - 200);
  await saveJSON(KEYS.NOTIFICATIONS, all);
}

export async function markNotificationRead(id: string): Promise<void> {
  const all = await loadJSON<ForumNotification[]>(KEYS.NOTIFICATIONS, []);
  const updated = all.map(n => (n.id === id ? { ...n, isRead: true } : n));
  await saveJSON(KEYS.NOTIFICATIONS, updated);
}

export async function markAllNotificationsRead(): Promise<void> {
  const all = await loadJSON<ForumNotification[]>(KEYS.NOTIFICATIONS, []);
  const updated = all.map(n => ({ ...n, isRead: true }));
  await saveJSON(KEYS.NOTIFICATIONS, updated);
}

export async function getUnreadCount(): Promise<number> {
  const all = await loadJSON<ForumNotification[]>(KEYS.NOTIFICATIONS, []);
  return all.filter(n => !n.isRead).length;
}

export async function getNotificationSettings(phone: string): Promise<ForumNotificationSettings> {
  const key = `${KEYS.NOTIFICATION_SETTINGS}_${phone}`;
  return loadJSON<ForumNotificationSettings>(key, {
    enabled: true,
    subscribedCategoryIds: [],
    subscribedTopicIds: [],
    muteAll: false,
  });
}

export async function saveNotificationSettings(
  phone: string,
  settings: ForumNotificationSettings,
): Promise<void> {
  const key = `${KEYS.NOTIFICATION_SETTINGS}_${phone}`;
  await saveJSON(key, settings);
}

export async function hasSeenWelcome(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.WELCOME_SEEN);
  return val === 'true';
}

export async function markWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(KEYS.WELCOME_SEEN, 'true');
}

export async function hasAcceptedRules(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.RULES_ACCEPTED);
  return val === 'true';
}

export async function markRulesAccepted(): Promise<void> {
  await AsyncStorage.setItem(KEYS.RULES_ACCEPTED, 'true');
}

export async function getForumProfile(phone: string): Promise<ForumProfile | null> {
  const key = `${KEYS.FORUM_PROFILE}_${phone}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as ForumProfile;
  } catch (e) {
    console.log('[ForumService] getForumProfile error', e);
    return null;
  }
}

export async function saveForumProfile(phone: string, profile: ForumProfile): Promise<void> {
  const key = `${KEYS.FORUM_PROFILE}_${phone}`;
  await saveJSON(key, profile);
  const allProfiles = await loadJSON<Record<string, ForumProfile>>(KEYS.FORUM_PROFILES_ALL, {});
  allProfiles[phone] = profile;
  await saveJSON(KEYS.FORUM_PROFILES_ALL, allProfiles);
  console.log('[ForumService] saveForumProfile', phone, profile.fullName);
}

export async function hasForumProfile(phone: string): Promise<boolean> {
  const profile = await getForumProfile(phone);
  return profile !== null;
}

export async function getForumProfileByPhone(phone: string): Promise<ForumProfile | null> {
  return getForumProfile(phone);
}

export async function getForumProfileByAuthorPhone(authorPhone: string): Promise<ForumProfile | null> {
  if (!authorPhone || authorPhone === 'system') return null;
  return getForumProfile(authorPhone);
}

export function getForumNickname(profile: ForumProfile, phone: string): string {
  const last3 = phone.replace(/\D/g, '').slice(-3);
  return `${profile.fullName} ${last3}`;
}

export async function createNotificationForNewMessage(
  msg: ForumMessage,
  topic: ForumTopic,
  categoryId: string,
): Promise<void> {
  const notification: ForumNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    topicId: topic.id,
    topicTitle: topic.title,
    categoryId,
    messageId: msg.id,
    authorName: msg.authorName,
    preview: msg.content.slice(0, 100),
    isRead: false,
    createdAt: msg.createdAt,
  };
  await addNotification(notification);
}
