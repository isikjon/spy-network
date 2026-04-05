export type Sector = string;

export type FunctionalCircle = 'support' | 'productivity' | 'development';

export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

export type RelationshipLevel = 'acquaintance' | 'contact' | 'useful_connection' | 'trusted_person' | 'ally';

export interface ContactInfo {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
  company?: string;
  position?: string;
  goal?: string;
  notes?: string;
  photo?: string;
}

export interface ContactRelation {
  contactId: string;
  strength: number;
  description?: string;
}

export interface PowerGrouping {
  groupName: string;
  suzerainId?: string;
  vassalIds: string[];
}

export interface DiaryEntry {
  id: string;
  date: Date;
  type: 'auto' | 'manual';
  content: string;
  attachments?: string[];
}

export interface ContactAssessment {
  resourcePotential: number;
  mutualInterests: number;
  openness: number;
  influence: number;
  longTermPotential: number;
  impressions: string;
  valueIndex: number;
  date: string;
}

export interface ContactDossier {
  contact: ContactInfo;
  sectors: Sector[];
  functionalCircle: FunctionalCircle;
  importance: ImportanceLevel;
  relations: ContactRelation[];
  diary: DiaryEntry[];
  addedDate: Date;
  lastInteraction?: Date;
  powerGrouping?: PowerGrouping;
  nextAction?: string;
  nextActionDate?: string;
  assessment?: ContactAssessment;
  trustLevel?: number;
  noDirectConnection?: boolean;
  relationshipLevel?: RelationshipLevel;
}

export type GoalStepType = 'meeting' | 'call' | 'write' | 'event';

export interface GoalStep {
  id: string;
  type: GoalStepType;
  content: string;
  result: string;
  contactIds: string[];
  order: number;
  completed?: boolean;
}

export interface StrategicGoal {
  id: string;
  title: string;
  description: string;
  deadline: string;
  progress: number;
  contactIds: string[];
  nextStep: string;
  notes: string;
  createdAt: string;
  directionId?: string;
  steps?: GoalStep[];
}

export interface GoalDirection {
  id: string;
  name: string;
  order: number;
}

export type AccessLevel = 1 | 2 | 3 | 4 | 5;

export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  readLevel: AccessLevel;
  createTopicLevel: AccessLevel;
  writeLevel: AccessLevel;
  order: number;
  createdAt: string;
}

export interface ForumTopic {
  id: string;
  categoryId: string;
  title: string;
  authorPhone: string;
  authorName: string;
  isPinned: boolean;
  isLocked: boolean;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface ForumMessage {
  id: string;
  topicId: string;
  authorPhone: string;
  authorName: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  replyToId?: string;
  replyToAuthor?: string;
  replyToContent?: string;
  likes?: string[];
  dislikes?: string[];
}

export interface ForumNotificationSettings {
  enabled: boolean;
  subscribedCategoryIds: string[];
  subscribedTopicIds: string[];
  muteAll: boolean;
}

export interface ForumNotification {
  id: string;
  topicId: string;
  topicTitle: string;
  categoryId: string;
  messageId: string;
  authorName: string;
  preview: string;
  isRead: boolean;
  createdAt: string;
}

export interface ForumProfile {
  fullName: string;
  networkingGoals: string;
  competencies: string;
  canBeUseful: string;
  lookingFor: string;
  phone: string;
  createdAt: string;
  photoBase64?: string;
  accessLevel?: AccessLevel;
}
