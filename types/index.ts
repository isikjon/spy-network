export type Sector = string;

export type FunctionalCircle = 'support' | 'productivity' | 'development';

export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

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
}
