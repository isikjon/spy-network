import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpcClient } from '@/lib/trpc';
import type {
  ForumCategory,
  ForumTopic,
  ForumMessage,
  ForumNotification,
  ForumNotificationSettings,
  ForumProfile,
  AccessLevel,
  BanRecord,
  BanType,
  ModeratorRecord,
} from '@/types';

const LOCAL_KEYS = {
  WELCOME_SEEN: 'forum_welcome_seen_v1',
  RULES_ACCEPTED: 'forum_rules_accepted_v1',
} as const;

export function getUserAccessLevel(subscriptionLevel: string): AccessLevel {
  switch (subscriptionLevel) {
    case 'working':
      return 2;
    case 'basic':
    default:
      return 1;
  }
}

export async function getEffectiveAccessLevel(identifier: string, subscriptionLevel: string): Promise<AccessLevel> {
  try {
    const level = await trpcClient.forum.getEffectiveAccessLevel.query({
      identifier,
      subscriptionLevel,
    });
    return level as AccessLevel;
  } catch (e) {
    console.log('[ForumService] getEffectiveAccessLevel error, fallback to local', e);
    return getUserAccessLevel(subscriptionLevel);
  }
}

export async function setAssignedAccessLevel(identifier: string, level: AccessLevel): Promise<void> {
  try {
    await trpcClient.forum.setAssignedAccessLevel.mutate({ identifier, level });
    console.log('[ForumService] setAssignedAccessLevel via server', identifier, level);
  } catch (e) {
    console.log('[ForumService] setAssignedAccessLevel error', e);
  }
}

export async function isModerator(identifier: string): Promise<boolean> {
  if (!identifier) return false;
  try {
    return await trpcClient.forum.isModerator.query({ identifier });
  } catch (e) {
    console.log('[ForumService] isModerator error', e);
    return false;
  }
}

export async function addModerator(phone: string, assignedBy: string): Promise<void> {
  try {
    await trpcClient.forum.addModerator.mutate({ phone, assignedBy });
    console.log('[ForumService] addModerator via server', phone);
  } catch (e) {
    console.log('[ForumService] addModerator error', e);
  }
}

export async function removeModerator(phone: string): Promise<void> {
  try {
    await trpcClient.forum.removeModerator.mutate({ phone });
    console.log('[ForumService] removeModerator via server', phone);
  } catch (e) {
    console.log('[ForumService] removeModerator error', e);
  }
}

export async function getBans(): Promise<BanRecord[]> {
  try {
    return await trpcClient.forum.getBans.query();
  } catch (e) {
    console.log('[ForumService] getBans error', e);
    return [];
  }
}

export async function banUser(
  phone: string,
  type: BanType,
  reason: string,
  bannedBy: string,
  durationDays: number | null,
): Promise<void> {
  try {
    await trpcClient.forum.banUser.mutate({ phone, type, reason, bannedBy, durationDays });
    console.log('[ForumService] banUser via server', phone, type);
  } catch (e) {
    console.log('[ForumService] banUser error', e);
  }
}

export async function unbanUser(phone: string, type: BanType): Promise<void> {
  try {
    await trpcClient.forum.unbanUser.mutate({ phone, type });
    console.log('[ForumService] unbanUser via server', phone, type);
  } catch (e) {
    console.log('[ForumService] unbanUser error', e);
  }
}

export async function getAllProfiles(): Promise<Record<string, ForumProfile>> {
  try {
    return await trpcClient.forum.getAllProfiles.query();
  } catch (e) {
    console.log('[ForumService] getAllProfiles error', e);
    return {};
  }
}

export async function getCategories(): Promise<ForumCategory[]> {
  try {
    return await trpcClient.forum.getCategories.query();
  } catch (e) {
    console.log('[ForumService] getCategories error', e);
    return [];
  }
}

export async function addCategory(cat: ForumCategory): Promise<ForumCategory[]> {
  try {
    await trpcClient.forum.addCategory.mutate({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      readLevel: cat.readLevel,
      createTopicLevel: cat.createTopicLevel,
      writeLevel: cat.writeLevel,
      order: cat.order,
    });
    return await getCategories();
  } catch (e) {
    console.log('[ForumService] addCategory error', e);
    return [];
  }
}

export async function updateCategory(id: string, updates: Partial<ForumCategory>): Promise<ForumCategory[]> {
  try {
    await trpcClient.forum.updateCategory.mutate({
      id,
      name: updates.name,
      description: updates.description,
      readLevel: updates.readLevel,
      createTopicLevel: updates.createTopicLevel,
      writeLevel: updates.writeLevel,
      order: updates.order,
    });
    return await getCategories();
  } catch (e) {
    console.log('[ForumService] updateCategory error', e);
    return [];
  }
}

export async function deleteCategory(id: string): Promise<ForumCategory[]> {
  try {
    await trpcClient.forum.deleteCategory.mutate({ id });
    return await getCategories();
  } catch (e) {
    console.log('[ForumService] deleteCategory error', e);
    return [];
  }
}

export async function getTopicsByCategory(categoryId: string): Promise<ForumTopic[]> {
  try {
    return await trpcClient.forum.getTopics.query({ categoryId });
  } catch (e) {
    console.log('[ForumService] getTopicsByCategory error', e);
    return [];
  }
}

export async function getTopic(id: string): Promise<ForumTopic | null> {
  try {
    return await trpcClient.forum.getTopic.query({ id });
  } catch (e) {
    console.log('[ForumService] getTopic error', e);
    return null;
  }
}

export async function addTopic(topic: ForumTopic, firstMessageContent?: string): Promise<void> {
  try {
    await trpcClient.forum.addTopic.mutate({
      id: topic.id,
      categoryId: topic.categoryId,
      title: topic.title,
      authorPhone: topic.authorPhone,
      authorUid: topic.authorUid,
      authorName: topic.authorName,
      firstMessageContent: firstMessageContent ?? '',
    });
    console.log('[ForumService] addTopic via server', topic.title);
  } catch (e) {
    console.log('[ForumService] addTopic error', e);
  }
}

export async function updateTopic(id: string, updates: Partial<ForumTopic>): Promise<void> {
  try {
    await trpcClient.forum.updateTopic.mutate({
      id,
      isPinned: updates.isPinned,
      isLocked: updates.isLocked,
    });
  } catch (e) {
    console.log('[ForumService] updateTopic error', e);
  }
}

export async function deleteTopicAndMessages(topicId: string): Promise<void> {
  try {
    await trpcClient.forum.deleteTopic.mutate({ id: topicId });
  } catch (e) {
    console.log('[ForumService] deleteTopicAndMessages error', e);
  }
}

export async function getMessagesByTopic(topicId: string): Promise<ForumMessage[]> {
  try {
    return await trpcClient.forum.getMessages.query({ topicId });
  } catch (e) {
    console.log('[ForumService] getMessagesByTopic error', e);
    return [];
  }
}

export async function addMessage(
  msg: ForumMessage,
  categoryId?: string,
  topicTitle?: string,
): Promise<void> {
  try {
    await trpcClient.forum.addMessage.mutate({
      id: msg.id,
      topicId: msg.topicId,
      authorPhone: msg.authorPhone,
      authorUid: msg.authorUid,
      authorName: msg.authorName,
      content: msg.content,
      replyToId: msg.replyToId,
      replyToAuthor: msg.replyToAuthor,
      replyToContent: msg.replyToContent,
      categoryId,
      topicTitle,
    });
  } catch (e) {
    console.log('[ForumService] addMessage error', e);
  }
}

export async function deleteMessage(msgId: string): Promise<void> {
  try {
    await trpcClient.forum.deleteMessage.mutate({ id: msgId });
  } catch (e) {
    console.log('[ForumService] deleteMessage error', e);
  }
}

export async function editMessage(msgId: string, content: string, authorPhone: string): Promise<{ ok: boolean }> {
  try {
    const result = await trpcClient.forum.editMessage.mutate({ id: msgId, content, authorPhone });
    console.log('[ForumService] editMessage', msgId, result);
    return { ok: result.ok };
  } catch (e) {
    console.log('[ForumService] editMessage error', e);
    return { ok: false };
  }
}

export async function searchTopics(query: string): Promise<ForumTopic[]> {
  try {
    return await trpcClient.forum.searchTopics.query({ query });
  } catch (e) {
    console.log('[ForumService] searchTopics error', e);
    return [];
  }
}

export async function getCategoryStats(): Promise<Record<string, { topicCount: number; messageCount: number; lastActivity: string }>> {
  try {
    return await trpcClient.forum.getCategoryStats.query();
  } catch (e) {
    console.log('[ForumService] getCategoryStats error', e);
    return {};
  }
}

export async function trackTopicView(topicId: string, uid: string): Promise<number> {
  try {
    const result = await trpcClient.forum.trackTopicView.mutate({ topicId, uid });
    return result.viewCount;
  } catch (e) {
    console.log('[ForumService] trackTopicView error', e);
    return 0;
  }
}

export async function getTopicViewCount(topicId: string): Promise<number> {
  try {
    return await trpcClient.forum.getTopicViewCount.query({ topicId });
  } catch (e) {
    console.log('[ForumService] getTopicViewCount error', e);
    return 0;
  }
}

export async function heartbeat(uid: string): Promise<number> {
  try {
    const result = await trpcClient.forum.heartbeat.mutate({ uid });
    return result.onlineCount;
  } catch (e) {
    console.log('[ForumService] heartbeat error', e);
    return 0;
  }
}

export async function getOnlineCount(): Promise<number> {
  try {
    return await trpcClient.forum.getOnlineCount.query();
  } catch (e) {
    console.log('[ForumService] getOnlineCount error', e);
    return 0;
  }
}

export async function toggleMessageLike(msgId: string, userIdentifier: string): Promise<void> {
  try {
    await trpcClient.forum.toggleLike.mutate({ msgId, userIdentifier });
  } catch (e) {
    console.log('[ForumService] toggleMessageLike error', e);
  }
}

export async function toggleMessageDislike(msgId: string, userIdentifier: string): Promise<void> {
  try {
    await trpcClient.forum.toggleDislike.mutate({ msgId, userIdentifier });
  } catch (e) {
    console.log('[ForumService] toggleMessageDislike error', e);
  }
}

export async function getNotifications(_uid: string): Promise<ForumNotification[]> {
  try {
    return await trpcClient.forum.getNotifications.query();
  } catch (e) {
    console.log('[ForumService] getNotifications error', e);
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await trpcClient.forum.markNotificationRead.mutate({ id });
  } catch (e) {
    console.log('[ForumService] markNotificationRead error', e);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await trpcClient.forum.markAllNotificationsRead.mutate();
  } catch (e) {
    console.log('[ForumService] markAllNotificationsRead error', e);
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    return await trpcClient.forum.getUnreadCount.query();
  } catch (e) {
    console.log('[ForumService] getUnreadCount error', e);
    return 0;
  }
}

export async function getNotificationSettings(uid: string): Promise<ForumNotificationSettings> {
  try {
    return await trpcClient.forum.getNotificationSettings.query({ uid });
  } catch (e) {
    console.log('[ForumService] getNotificationSettings error', e);
    return {
      enabled: true,
      subscribedCategoryIds: [],
      subscribedTopicIds: [],
      muteAll: false,
    };
  }
}

export async function saveNotificationSettings(
  uid: string,
  settings: ForumNotificationSettings,
): Promise<void> {
  try {
    await trpcClient.forum.saveNotificationSettings.mutate({
      uid,
      ...settings,
    });
  } catch (e) {
    console.log('[ForumService] saveNotificationSettings error', e);
  }
}

export async function hasSeenWelcome(): Promise<boolean> {
  const val = await AsyncStorage.getItem(LOCAL_KEYS.WELCOME_SEEN);
  return val === 'true';
}

export async function markWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEYS.WELCOME_SEEN, 'true');
}

export async function hasAcceptedRules(): Promise<boolean> {
  const val = await AsyncStorage.getItem(LOCAL_KEYS.RULES_ACCEPTED);
  return val === 'true';
}

export async function markRulesAccepted(): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEYS.RULES_ACCEPTED, 'true');
}

export async function getForumProfile(identifier: string): Promise<ForumProfile | null> {
  try {
    return await trpcClient.forum.getForumProfile.query({ identifier });
  } catch (e) {
    console.log('[ForumService] getForumProfile error', e);
    return null;
  }
}

export async function getForumProfileByUid(uid: string): Promise<ForumProfile | null> {
  if (!uid) return null;
  return getForumProfile(uid);
}

export async function saveForumProfile(identifier: string, profile: ForumProfile): Promise<void> {
  try {
    await trpcClient.forum.saveForumProfile.mutate({ identifier, profile });
    console.log('[ForumService] saveForumProfile via server', identifier, profile.fullName);
  } catch (e) {
    console.log('[ForumService] saveForumProfile error', e);
  }
}

export async function hasForumProfile(identifier: string): Promise<boolean> {
  const profile = await getForumProfile(identifier);
  return profile !== null;
}

export async function getForumProfileByPhone(phone: string): Promise<ForumProfile | null> {
  return getForumProfile(phone);
}

export async function getForumProfileByAuthorPhone(authorPhone: string): Promise<ForumProfile | null> {
  if (!authorPhone || authorPhone === 'system') return null;
  try {
    return await trpcClient.forum.getForumProfileByAuthorPhone.query({ authorPhone });
  } catch (e) {
    console.log('[ForumService] getForumProfileByAuthorPhone error', e);
    return null;
  }
}

export async function getForumProfileByAuthorUid(authorUid: string): Promise<ForumProfile | null> {
  if (!authorUid || authorUid === 'system') return null;
  return getForumProfile(authorUid);
}

export function getForumNickname(profile: ForumProfile, identifier: string): string {
  const last3 = identifier.replace(/\D/g, '').slice(-3);
  return `${profile.fullName} ${last3}`;
}

export async function createNotificationForNewMessage(
  _msg: ForumMessage,
  _topic: ForumTopic,
  _categoryId: string,
): Promise<void> {
  // Notifications are now created server-side in addMessage
  // This function is kept for backward compatibility but is a no-op
}
