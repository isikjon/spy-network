import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';
import { Plus, Search, Shield, FileText, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import * as Contacts from 'expo-contacts';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  StatusBar,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContactDossier } from '@/types';

export default function DossiersScreen() {
  const { dossiers, addDossier, theme, t, phoneNumber, currentLanguage } = useApp();

  const levelQuery = trpc.appData.getMyLevel.useQuery(undefined, {
    enabled: !!phoneNumber,
    staleTime: 30_000,
  });
  const userLevel = levelQuery.data?.ok ? levelQuery.data.level : 1;
  const maxContacts = levelQuery.data?.ok ? levelQuery.data.maxContacts : 20;
  const isAtLimit = maxContacts !== null && dossiers.length >= maxContacts;
  const [search, setSearch] = useState('');
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<Contacts.Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  const styles = createStyles(theme);

  const filteredDossiers = dossiers.filter((d) => {
    if (!search) return true;
    
    const searchLower = search.toLowerCase();
    
    return (
      d.contact.name.toLowerCase().includes(searchLower) ||
      d.contact.phoneNumbers.some(p => p.toLowerCase().includes(searchLower)) ||
      d.contact.emails.some(e => e.toLowerCase().includes(searchLower)) ||
      (d.contact.company && d.contact.company.toLowerCase().includes(searchLower)) ||
      (d.contact.position && d.contact.position.toLowerCase().includes(searchLower)) ||
      (d.contact.notes && d.contact.notes.toLowerCase().includes(searchLower)) ||
      d.sectors.some(s => s.toLowerCase().includes(searchLower)) ||
      d.functionalCircle.toLowerCase().includes(searchLower) ||
      d.importance.toLowerCase().includes(searchLower) ||
      d.diary.some(entry => entry.content.toLowerCase().includes(searchLower))
    );
  });

  const loadContacts = async () => {
    if (!checkLimitAndWarn()) return;

    if (Platform.OS === 'web') {
      Alert.alert(t.dossiers.notAvailable, t.dossiers.contactAccessWeb);
      return;
    }

    setIsLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Image, Contacts.Fields.Company, Contacts.Fields.JobTitle],
        });
        setPhoneContacts(data);
        setShowContactsModal(true);
      } else {
        Alert.alert(t.dossiers.permissionDenied, t.dossiers.contactPermissionRequired);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
      Alert.alert(t.dossiers.error, t.dossiers.failedLoadContacts);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const checkLimitAndWarn = (): boolean => {
    if (isAtLimit) {
      Alert.alert(
        currentLanguage === 'ru' ? 'ЛИМИТ КОНТАКТОВ' : 'CONTACT LIMIT',
        currentLanguage === 'ru'
          ? `Достигнут лимит ${maxContacts} контактов. Получите ДОПУСК уровня 2 в профиле для снятия ограничения.`
          : `Reached the limit of ${maxContacts} contacts. Get Level 2 ACCESS in profile to remove the limit.`,
        [{ text: 'OK', style: 'default' }]
      );
      return false;
    }
    return true;
  };

  const handleSelectPhoneContact = (contact: Contacts.Contact) => {
    if (!checkLimitAndWarn()) return;

    const newDossier: ContactDossier = {
      contact: {
        id: `contact_${Date.now()}`,
        name: contact.name || t.dossiers.unknown,
        phoneNumbers: contact.phoneNumbers?.map(p => p.number || '') || [],
        emails: contact.emails?.map(e => e.email || '') || [],
        company: contact.company,
        position: contact.jobTitle,
        photo: contact.image?.uri,
      },
      sectors: [],
      functionalCircle: 'productivity',
      importance: 'medium',
      relations: [],
      diary: [
        {
          id: `diary_${Date.now()}`,
          date: new Date(),
          type: 'auto',
          content: t.dossiers.contactImported,
        },
      ],
      addedDate: new Date(),
    };
    addDossier(newDossier);
    setShowContactsModal(false);
    setContactSearch('');
    router.push({ pathname: '/dossier/[id]', params: { id: newDossier.contact.id, edit: 'true' } });
  };

  const handleAddMockContact = () => {
    if (!checkLimitAndWarn()) return;

    const mockContact: ContactDossier = {
      contact: {
        id: `contact_${Date.now()}`,
        name: `Agent ${Math.floor(Math.random() * 1000)}`,
        phoneNumbers: ['+7 999 123 45 67'],
        emails: ['agent@classified.net'],
        company: 'Classified Corp',
        position: 'Senior Operative',
      },
      sectors: ['business'],
      functionalCircle: 'productivity',
      importance: 'high',
      relations: [],
      diary: [
        {
          id: `diary_${Date.now()}`,
          date: new Date(),
          type: 'auto',
          content: t.dossiers.contactAddedToNetwork,
        },
      ],
      addedDate: new Date(),
      lastInteraction: new Date(),
    };
    addDossier(mockContact);
    router.push({ pathname: '/dossier/[id]', params: { id: mockContact.contact.id, edit: 'true' } });
  };

  const getImportanceColor = (importance: string) => {
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
  };

  const renderDossier = ({ item }: { item: ContactDossier }) => (
    <TouchableOpacity
      style={styles.dossierCard}
      onPress={() => router.push({ pathname: '/dossier/[id]', params: { id: item.contact.id } })}
      activeOpacity={0.7}
    >
      <View style={styles.dossierHeader}>
        <View style={styles.dossierIcon}>
          <FileText size={20} color={theme.primary} />
        </View>
        <View style={styles.dossierInfo}>
          <Text style={styles.dossierName}>{item.contact.name}</Text>
          {item.powerGrouping?.groupName && (
            <Text style={styles.powerGroupingName}>{item.powerGrouping.groupName.toUpperCase()}</Text>
          )}
          <Text style={styles.dossierMeta}>
            {item.contact.position || t.dossiers.unknownPosition}
          </Text>
        </View>
        <View
          style={[
            styles.importanceBadge,
            { borderColor: getImportanceColor(item.importance) },
          ]}
        >
          <Text
            style={[
              styles.importanceText,
              { color: getImportanceColor(item.importance) },
            ]}
          >
            {item.importance.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.dossierFooter}>
        {item.contact.goal && (
          <Text style={styles.dossierGoal}>{item.contact.goal}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.background}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Shield size={28} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>{t.dossiers.title}</Text>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={theme.primaryDim} />
          <TextInput
            style={styles.searchInput}
            placeholder={t.dossiers.searchPlaceholder}
            placeholderTextColor={theme.primaryDim}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {dossiers.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={64} color={theme.primaryDim} strokeWidth={1} />
            <Text style={styles.emptyTitle}>{t.dossiers.noDossiers}</Text>
            <Text style={styles.emptyText}>
              {t.dossiers.beginBuilding}
            </Text>
            <View style={styles.emptyActions}>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddMockContact}
                  activeOpacity={0.7}
                >
                  <Plus size={20} color={theme.primary} />
                  <Text style={styles.addButtonText}>{t.dossiers.createContact}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.addButton}
                onPress={loadContacts}
                activeOpacity={0.7}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Users size={20} color={theme.primary} />
                )}
                <Text style={styles.addButtonText}>{t.dossiers.importFromPhone}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <FlatList
              data={filteredDossiers}
              renderItem={renderDossier}
              keyExtractor={(item) => item.contact.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
            <View style={styles.fabContainer}>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={[styles.fab, { bottom: 90 }]}
                  onPress={handleAddMockContact}
                  activeOpacity={0.8}
                >
                  <Plus size={28} color={theme.primary} strokeWidth={2} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.fab}
                onPress={loadContacts}
                activeOpacity={0.8}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Users size={24} color={theme.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <Modal
          visible={showContactsModal}
          animationType="slide"
          onRequestClose={() => setShowContactsModal(false)}
        >
          <View style={styles.modalContainer}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.modalContent} edges={['top']}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Users size={24} color={theme.primary} />
                  <Text style={styles.modalTitle}>{t.dossiers.addressBook}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowContactsModal(false)}
                  activeOpacity={0.7}
                >
                  <X size={24} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Search size={18} color={theme.primaryDim} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t.dossiers.searchContacts}
                  placeholderTextColor={theme.primaryDim}
                  value={contactSearch}
                  onChangeText={setContactSearch}
                />
              </View>

              <FlatList
                data={phoneContacts.filter(c => 
                  !contactSearch || 
                  (c.name && c.name.toLowerCase().includes(contactSearch.toLowerCase())) ||
                  (c.phoneNumbers && c.phoneNumbers.some(p => p.number?.includes(contactSearch))) ||
                  (c.emails && c.emails.some(e => e.email?.toLowerCase().includes(contactSearch.toLowerCase())))
                )}
                keyExtractor={(item, index) => `contact_${index}_${item.name || 'unknown'}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => handleSelectPhoneContact(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contactIcon}>
                      <Users size={20} color={theme.primary} />
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{item.name || t.dossiers.unknown}</Text>
                      {item.phoneNumbers && item.phoneNumbers.length > 0 && (
                        <Text style={styles.contactDetail}>{item.phoneNumbers[0].number}</Text>
                      )}
                      {item.company && (
                        <Text style={styles.contactDetail}>{item.company}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.contactsList}
                showsVerticalScrollIndicator={false}
              />
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
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
    fontSize: 24,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  dossierCard: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 16,
    marginBottom: 12,
  },
  dossierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dossierIcon: {
    marginRight: 12,
  },
  dossierInfo: {
    flex: 1,
  },
  dossierName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  dossierMeta: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  powerGroupingName: {
    fontSize: 12,
    color: '#8B0000',
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  importanceBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: '700' as const,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  dossierFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  dossierTag: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  dossierGoal: {
    fontSize: 12,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 32,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.background,
    borderWidth: 2,
    borderColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 20,
  },
  emptyActions: {
    gap: 16,
    marginTop: 32,
    width: '100%',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalContent: {
    flex: 1,
  },
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
  contactsList: {
    padding: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 16,
    marginBottom: 12,
  },
  contactIcon: {
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
});
