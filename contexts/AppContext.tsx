import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { trpc } from '@/lib/trpc';
import type { ContactDossier } from '@/types';
import { ThemeType, Theme, themes } from '@/constants/colors';
import { Language, translations, Translations } from '@/constants/locales';
import * as Localization from 'expo-localization';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const STORAGE_KEYS = {
  PHONE_NUMBER: 'user_phone',
  SESSION_TOKEN: 'user_session_token',
  THEME: 'app_theme',
  POWER_GROUPINGS: 'power_groupings',
  LANGUAGE: 'app_language',
  TUTORIAL_COMPLETED: 'tutorial_completed',
  APP_DATA_CACHE: 'app_data_cache_v1',

  LEGACY_DOSSIERS: 'contact_dossiers',
  LEGACY_SECTORS: 'user_sectors',
  LEGACY_POWER_GROUPINGS: 'power_groupings',
} as const;

const DEFAULT_SECTORS = ['work', 'business', 'politics', 'personal', 'other'];
const DEFAULT_POWER_GROUPINGS: string[] = [];

type AppDataCache = {
  dossiers: ContactDossier[];
  sectors: string[];
  powerGroupings: string[];
  updatedAt: number;
};

const parseDossiersWithDates = (raw: unknown): ContactDossier[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((d: any) => {
    const diary = Array.isArray(d?.diary) ? d.diary : [];
    return {
      ...d,
      addedDate: d?.addedDate ? new Date(d.addedDate) : new Date(),
      lastInteraction: d?.lastInteraction ? new Date(d.lastInteraction) : undefined,
      diary: diary.map((entry: any) => ({
        ...entry,
        date: entry?.date ? new Date(entry.date) : new Date(),
      })),
    } as ContactDossier;
  });
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();

  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  const [dossiers, setDossiers] = useState<ContactDossier[]>([]);
  const [sectors, setSectors] = useState<string[]>(DEFAULT_SECTORS);
  const [powerGroupings, setPowerGroupings] = useState<string[]>(DEFAULT_POWER_GROUPINGS);

  const [currentTheme, setCurrentTheme] = useState<ThemeType>('spy');
  const [theme, setTheme] = useState<Theme>(themes.spy);
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [t, setT] = useState<Translations>(translations.en);
  const [tutorialCompleted, setTutorialCompleted] = useState<boolean>(false);

  const phoneQuery = useQuery({
    queryKey: ['user_phone'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PHONE_NUMBER);
      return stored;
    },
  });

  const themeQuery = useQuery({
    queryKey: ['theme'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
      return (stored as ThemeType) || 'spy';
    },
  });

  const languageQuery = useQuery({
    queryKey: ['language'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (stored) {
        return stored as Language;
      }
      const systemLocale = Localization.getLocales()[0]?.languageCode || 'en';
      const detectedLanguage: Language = systemLocale.startsWith('ru') ? 'ru' : 'en';
      return detectedLanguage;
    },
  });

  const tutorialQuery = useQuery({
    queryKey: ['tutorialCompleted'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.TUTORIAL_COMPLETED);
      return stored === 'true';
    },
  });

  const cacheQuery = useQuery({
    queryKey: ['appDataCache'],
    queryFn: async (): Promise<AppDataCache | null> => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.APP_DATA_CACHE);
      if (!stored) return null;
      try {
        const parsed = JSON.parse(stored) as AppDataCache;
        return {
          dossiers: parseDossiersWithDates(parsed?.dossiers),
          sectors: Array.isArray(parsed?.sectors) ? parsed.sectors : DEFAULT_SECTORS,
          powerGroupings: Array.isArray(parsed?.powerGroupings)
            ? parsed.powerGroupings
            : DEFAULT_POWER_GROUPINGS,
          updatedAt: typeof parsed?.updatedAt === 'number' ? parsed.updatedAt : 0,
        };
      } catch (e) {
        console.log('[AppContext] failed to parse app data cache', e);
        return null;
      }
    },
  });

  const appDataQuery = trpc.appData.getMyData.useQuery(undefined, {
    enabled: !!phoneNumber,
    staleTime: 15_000,
  });

  const saveMyDataMutation = trpc.appData.saveMyData.useMutation();

  const { mutate: saveTheme } = useMutation({
    mutationFn: async (themeName: ThemeType) => {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, themeName);
      return themeName;
    },
  });

  const { mutate: saveLanguage } = useMutation({
    mutationFn: async (language: Language) => {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
      return language;
    },
  });

  const { mutate: saveTutorialCompleted } = useMutation({
    mutationFn: async (completed: boolean) => {
      await AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_COMPLETED, completed.toString());
      return completed;
    },
  });

  const persistAppDataCache = useCallback(async (next: AppDataCache) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.APP_DATA_CACHE, JSON.stringify(next));
      queryClient.setQueryData(['appDataCache'], next);
    } catch (e) {
      console.log('[AppContext] failed to persist cache', e);
    }
  }, [queryClient]);

  const applyAppData = useCallback((data: {
    dossiers: ContactDossier[];
    sectors: string[];
    powerGroupings: string[];
    updatedAt?: number;
  }) => {
    setDossiers(data.dossiers);
    setSectors(data.sectors);
    setPowerGroupings(data.powerGroupings);

    const updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : Date.now();
    persistAppDataCache({
      dossiers: data.dossiers,
      sectors: data.sectors,
      powerGroupings: data.powerGroupings,
      updatedAt,
    });
  }, [persistAppDataCache]);

  useEffect(() => {
    if (phoneQuery.data !== undefined) {
      setPhoneNumber(phoneQuery.data);
    }
  }, [phoneQuery.data]);

  useEffect(() => {
    if (themeQuery.data) {
      setCurrentTheme(themeQuery.data);
      setTheme(themes[themeQuery.data]);
    }
  }, [themeQuery.data]);

  useEffect(() => {
    if (languageQuery.data) {
      setCurrentLanguage(languageQuery.data);
      setT(translations[languageQuery.data]);
    }
  }, [languageQuery.data]);

  useEffect(() => {
    if (tutorialQuery.data !== undefined) {
      setTutorialCompleted(tutorialQuery.data);
    }
  }, [tutorialQuery.data]);

  useEffect(() => {
    if (cacheQuery.data) {
      console.log('[AppContext] hydrate from cache', {
        dossiers: cacheQuery.data.dossiers.length,
        sectors: cacheQuery.data.sectors.length,
        powerGroupings: cacheQuery.data.powerGroupings.length,
        updatedAt: cacheQuery.data.updatedAt,
      });
      setDossiers(cacheQuery.data.dossiers);
      setSectors(cacheQuery.data.sectors);
      setPowerGroupings(cacheQuery.data.powerGroupings);
    }
  }, [cacheQuery.data]);

  useEffect(() => {
    if (appDataQuery.data && (appDataQuery.data as any).ok === true) {
      const data = (appDataQuery.data as any).data;
      console.log('[AppContext] hydrate from server', {
        dossiers: Array.isArray(data?.dossiers) ? data.dossiers.length : -1,
        updatedAt: data?.updatedAt,
      });

      applyAppData({
        dossiers: parseDossiersWithDates(data?.dossiers),
        sectors: Array.isArray(data?.sectors) ? data.sectors : DEFAULT_SECTORS,
        powerGroupings: Array.isArray(data?.powerGroupings)
          ? data.powerGroupings
          : DEFAULT_POWER_GROUPINGS,
        updatedAt: typeof data?.updatedAt === 'number' ? data.updatedAt : Date.now(),
      });
    }
  }, [appDataQuery.data, applyAppData]);

  useEffect(() => {
    const migrateIfNeeded = async () => {
      if (!phoneNumber) return;
      if (cacheQuery.data) return;

      try {
        const [legacyDossiers, legacySectors, legacyGroups] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.LEGACY_DOSSIERS),
          AsyncStorage.getItem(STORAGE_KEYS.LEGACY_SECTORS),
          AsyncStorage.getItem(STORAGE_KEYS.LEGACY_POWER_GROUPINGS),
        ]);

        if (!legacyDossiers && !legacySectors && !legacyGroups) return;

        const dossiersParsed = legacyDossiers ? parseDossiersWithDates(JSON.parse(legacyDossiers)) : [];
        const sectorsParsed = legacySectors ? (JSON.parse(legacySectors) as unknown) : DEFAULT_SECTORS;
        const groupsParsed = legacyGroups ? (JSON.parse(legacyGroups) as unknown) : DEFAULT_POWER_GROUPINGS;

        const nextSectors = Array.isArray(sectorsParsed) ? (sectorsParsed as string[]) : DEFAULT_SECTORS;
        const nextGroups = Array.isArray(groupsParsed) ? (groupsParsed as string[]) : DEFAULT_POWER_GROUPINGS;

        console.log('[AppContext] migrating legacy local data to server', {
          dossiers: dossiersParsed.length,
          sectors: nextSectors.length,
          powerGroupings: nextGroups.length,
        });

        applyAppData({
          dossiers: dossiersParsed,
          sectors: nextSectors,
          powerGroupings: nextGroups,
          updatedAt: Date.now(),
        });

        await saveMyDataMutation.mutateAsync({
          dossiers: dossiersParsed,
          sectors: nextSectors,
          powerGroupings: nextGroups,
        });

        await AsyncStorage.multiRemove([
          STORAGE_KEYS.LEGACY_DOSSIERS,
          STORAGE_KEYS.LEGACY_SECTORS,
        ]);
      } catch (e) {
        console.log('[AppContext] legacy migration failed', e);
      }
    };

    migrateIfNeeded();
  }, [phoneNumber, cacheQuery.data, applyAppData, saveMyDataMutation]);

  const saveAppDataToServer = useCallback(
    async (next: { dossiers: ContactDossier[]; sectors: string[]; powerGroupings: string[] }) => {
      if (!phoneNumber) {
        console.log('[AppContext] saveAppDataToServer skipped: no phone');
        return;
      }

      applyAppData({ ...next, updatedAt: Date.now() });

      try {
        const res = await saveMyDataMutation.mutateAsync({
          dossiers: next.dossiers,
          sectors: next.sectors,
          powerGroupings: next.powerGroupings,
        });
        console.log('[AppContext] saveMyData result', res);
      } catch (e) {
        console.log('[AppContext] saveMyData failed', e);
      }
    },
    [applyAppData, phoneNumber, saveMyDataMutation],
  );

  const login = useCallback(async (phone: string) => {
    setPhoneNumber(phone);
    await AsyncStorage.setItem(STORAGE_KEYS.PHONE_NUMBER, phone);

    queryClient.invalidateQueries({ queryKey: ['user_phone'] }).catch((e) =>
      console.log('[AppContext] invalidate phone query failed', e),
    );
  }, [queryClient]);

  const loginWithToken = useCallback(async (phone: string, token: string) => {
    setPhoneNumber(phone);
    await AsyncStorage.setItem(STORAGE_KEYS.PHONE_NUMBER, phone);
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);

    queryClient.invalidateQueries({ queryKey: ['user_phone'] }).catch((e) =>
      console.log('[AppContext] invalidate phone query failed', e),
    );
  }, [queryClient]);

  const logout = useCallback(async () => {
    setPhoneNumber(null);
    setDossiers([]);
    setSectors(DEFAULT_SECTORS);
    setPowerGroupings(DEFAULT_POWER_GROUPINGS);
    setSelfContactEnsuredForPhone(null);

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PHONE_NUMBER,
      STORAGE_KEYS.SESSION_TOKEN,
      STORAGE_KEYS.APP_DATA_CACHE,
    ]);

    queryClient.removeQueries({ queryKey: ['appDataCache'] });
    queryClient.removeQueries({ queryKey: ['trpc.appData.getMyData'] });
  }, [queryClient]);

  const [selfContactEnsuredForPhone, setSelfContactEnsuredForPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!phoneNumber) {
      setSelfContactEnsuredForPhone(null);
      return;
    }

    if (selfContactEnsuredForPhone === phoneNumber) return;

    if (!appDataQuery.data || (appDataQuery.data as any).ok !== true) return;

    const data = (appDataQuery.data as any).data;
    const serverDossiers = parseDossiersWithDates(data?.dossiers);

    const hasSelf = serverDossiers.some((d) =>
      Array.isArray(d?.contact?.phoneNumbers)
        ? d.contact.phoneNumbers.includes(phoneNumber)
        : false,
    );

    if (hasSelf) {
      setSelfContactEnsuredForPhone(phoneNumber);
      return;
    }

    console.log('[AppContext] ensuring self contact on server', { phoneNumber });
    setSelfContactEnsuredForPhone(phoneNumber);

    const userContact: ContactDossier = {
      contact: {
        id: `user_${Date.now()}`,
        name: currentLanguage === 'ru' ? 'Пользователь' : 'User',
        phoneNumbers: [phoneNumber],
        emails: [],
      },
      sectors: [],
      functionalCircle: 'support',
      importance: 'high',
      relations: [],
      diary: [],
      addedDate: new Date(),
    };

    const updated = [...serverDossiers, userContact];
    saveAppDataToServer({
      dossiers: updated,
      sectors: Array.isArray(data?.sectors) ? data.sectors : DEFAULT_SECTORS,
      powerGroupings: Array.isArray(data?.powerGroupings)
        ? data.powerGroupings
        : DEFAULT_POWER_GROUPINGS,
    }).catch((e) => {
      console.log('[AppContext] ensure self contact failed', e);
      setSelfContactEnsuredForPhone(null);
    });
  }, [appDataQuery.data, currentLanguage, phoneNumber, saveAppDataToServer, selfContactEnsuredForPhone]);

  const addDossier = useCallback((dossier: ContactDossier) => {
    const updated = [...dossiers, dossier];
    saveAppDataToServer({ dossiers: updated, sectors, powerGroupings });
  }, [dossiers, saveAppDataToServer, sectors, powerGroupings]);

  const updateDossier = useCallback((id: string, updates: Partial<ContactDossier>) => {
    const updated = dossiers.map((d) => (d.contact.id === id ? { ...d, ...updates } : d));
    saveAppDataToServer({ dossiers: updated, sectors, powerGroupings });
  }, [dossiers, saveAppDataToServer, sectors, powerGroupings]);

  const deleteDossier = useCallback((id: string) => {
    const updated = dossiers.filter((d) => d.contact.id !== id);
    saveAppDataToServer({ dossiers: updated, sectors, powerGroupings });
  }, [dossiers, saveAppDataToServer, sectors, powerGroupings]);

  const addSector = useCallback((sector: string) => {
    const trimmed = sector.trim();
    if (!trimmed) return;
    if (sectors.includes(trimmed)) return;

    const updatedSectors = [...sectors, trimmed];
    saveAppDataToServer({ dossiers, sectors: updatedSectors, powerGroupings });
  }, [dossiers, saveAppDataToServer, sectors, powerGroupings]);

  const removeSector = useCallback((sector: string) => {
    const isUsedByContacts = dossiers.some((d) => 
      Array.isArray(d.sectors) && d.sectors.includes(sector)
    );

    if (isUsedByContacts) {
      return { error: true };
    }

    const updatedSectors = sectors.filter((s) => s !== sector);
    const updatedDossiers = dossiers.map((d) => ({
      ...d,
      sectors: Array.isArray(d.sectors) ? d.sectors.filter((s) => s !== sector) : [],
    }));

    saveAppDataToServer({ dossiers: updatedDossiers, sectors: updatedSectors, powerGroupings });
    return { error: false };
  }, [dossiers, saveAppDataToServer, sectors, powerGroupings]);

  const updateSector = useCallback((oldSector: string, newSector: string) => {
    const trimmed = newSector.trim();
    if (!trimmed) return;
    if (sectors.includes(trimmed)) return;

    const updatedSectors = sectors.map((s) => (s === oldSector ? trimmed : s));
    const updatedDossiers = dossiers.map((d) => ({
      ...d,
      sectors: Array.isArray(d.sectors)
        ? d.sectors.map((s) => (s === oldSector ? trimmed : s))
        : [],
    }));

    saveAppDataToServer({ dossiers: updatedDossiers, sectors: updatedSectors, powerGroupings });
  }, [dossiers, saveAppDataToServer, sectors, powerGroupings]);

  const addPowerGrouping = useCallback((groupName: string) => {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    if (powerGroupings.includes(trimmed)) return;

    const updated = [...powerGroupings, trimmed];
    saveAppDataToServer({ dossiers, sectors, powerGroupings: updated });
  }, [dossiers, saveAppDataToServer, sectors, powerGroupings]);

  const removePowerGrouping = useCallback((groupName: string) => {
    const updated = powerGroupings.filter((g) => g !== groupName);
    const updatedDossiers = dossiers.map((d) => ({
      ...d,
      powerGrouping: d.powerGrouping?.groupName === groupName ? undefined : d.powerGrouping,
    }));

    saveAppDataToServer({ dossiers: updatedDossiers, sectors, powerGroupings: updated });
  }, [dossiers, saveAppDataToServer, sectors, powerGroupings]);

  const updatePowerGrouping = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (powerGroupings.includes(trimmed)) return;

    const updated = powerGroupings.map((g) => (g === oldName ? trimmed : g));
    const updatedDossiers = dossiers.map((d) => ({
      ...d,
      powerGrouping:
        d.powerGrouping?.groupName === oldName
          ? { ...d.powerGrouping, groupName: trimmed }
          : d.powerGrouping,
    }));

    saveAppDataToServer({ dossiers: updatedDossiers, sectors, powerGroupings: updated });
  }, [dossiers, saveAppDataToServer, sectors, powerGroupings]);

  const switchTheme = useCallback((themeName: ThemeType) => {
    setCurrentTheme(themeName);
    setTheme(themes[themeName]);
    saveTheme(themeName);
  }, [saveTheme]);

  const switchLanguage = useCallback((language: Language) => {
    setCurrentLanguage(language);
    setT(translations[language]);
    saveLanguage(language);
  }, [saveLanguage]);

  const completeTutorial = useCallback(() => {
    setTutorialCompleted(true);
    saveTutorialCompleted(true);
  }, [saveTutorialCompleted]);

  const resetTutorial = useCallback(() => {
    setTutorialCompleted(false);
    saveTutorialCompleted(false);
  }, [saveTutorialCompleted]);

  const createBackup = useCallback(async () => {
    const backupData = {
      dossiers,
      sectors,
      powerGroupings,
      phoneNumber,
      theme: currentTheme,
      language: currentLanguage,
      tutorialCompleted,
      version: '1.1',
      exportDate: new Date().toISOString(),
    };

    if (Platform.OS === 'web') {
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `network-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      return true;
    }

    const jsonString = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    const file = new File(Paths.document, `network-backup-${dateStr}.json`);
    const ws = file.writableStream();
    const writer = ws.getWriter();
    await writer.write(new TextEncoder().encode(jsonString));
    await writer.close();

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(file.uri);
    }
    return true;
  }, [dossiers, sectors, powerGroupings, phoneNumber, currentTheme, currentLanguage, tutorialCompleted]);

  const restoreBackup = useCallback(async () => {
    try {
      const loadFromJson = async (jsonString: string) => {
        const backupData = JSON.parse(jsonString);

        const nextDossiers = backupData.dossiers
          ? parseDossiersWithDates(backupData.dossiers)
          : [];
        const nextSectors = Array.isArray(backupData.sectors)
          ? backupData.sectors
          : DEFAULT_SECTORS;
        const nextPowerGroupings = Array.isArray(backupData.powerGroupings)
          ? backupData.powerGroupings
          : DEFAULT_POWER_GROUPINGS;

        await saveAppDataToServer({
          dossiers: nextDossiers,
          sectors: nextSectors,
          powerGroupings: nextPowerGroupings,
        });

        if (backupData.theme && (backupData.theme === 'spy' || backupData.theme === 'business' || backupData.theme === 'genesis')) {
          const themeType = backupData.theme as ThemeType;
          setCurrentTheme(themeType);
          setTheme(themes[themeType]);
          saveTheme(themeType);
        }

        if (backupData.language && (backupData.language === 'ru' || backupData.language === 'en')) {
          const lang = backupData.language as Language;
          setCurrentLanguage(lang);
          setT(translations[lang]);
          saveLanguage(lang);
        }

        if (backupData.tutorialCompleted !== undefined) {
          setTutorialCompleted(!!backupData.tutorialCompleted);
          saveTutorialCompleted(!!backupData.tutorialCompleted);
        }
      };

      if (Platform.OS === 'web') {
        return new Promise<boolean>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/json';
          input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return resolve(false);

            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                const jsonString = String(event.target?.result ?? '');
                await loadFromJson(jsonString);
                resolve(true);
              } catch (error) {
                console.error('Failed to restore backup:', error);
                resolve(false);
              }
            };
            reader.readAsText(file);
          };
          input.click();
        });
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return false;
      }

      const fileUri = result.assets[0].uri;
      const file = new File(fileUri);
      const ab = await file.arrayBuffer();
      const jsonString = new TextDecoder().decode(ab);

      await loadFromJson(jsonString);
      return true;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      return false;
    }
  }, [saveAppDataToServer, saveTheme, saveLanguage, saveTutorialCompleted]);

  const isLoading =
    phoneQuery.isLoading ||
    cacheQuery.isLoading ||
    (phoneNumber ? appDataQuery.isLoading : false);

  const serverError = useMemo(() => {
    if (!appDataQuery.error) return null;
    return 'Не удалось загрузить данные с сервера. Используем кэш.';
  }, [appDataQuery.error]);

  return {
    phoneNumber,
    isAuthenticated: !!phoneNumber,
    isLoading,
    serverError,

    dossiers,
    sectors,
    powerGroupings,

    currentTheme,
    theme,
    switchTheme,

    currentLanguage,
    t,
    switchLanguage,

    tutorialCompleted,
    completeTutorial,
    resetTutorial,

    login,
    loginWithToken,
    logout,

    addDossier,
    updateDossier,
    deleteDossier,

    addSector,
    removeSector,
    updateSector,

    addPowerGrouping,
    removePowerGrouping,
    updatePowerGrouping,

    createBackup,
    restoreBackup,
  };
});

