import { Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BarChart3,
  Crown,
  Lock,
  Network,
  Search,
  Shield,
  Users,
} from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { useApp } from "@/contexts/AppContext";
import { isAdminPhone } from "@/constants/adminAccess";

import DossiersTabScreen from "@/app/(tabs)/index";
import NetworkTabScreen from "@/app/(tabs)/network";
import ProfileTabScreen from "@/app/(tabs)/profile";
import type { Language } from "@/constants/locales";

const STORAGE_ADMIN_TOKEN_KEY = "admin_auth_token" as const;

type MeOk = { ok: true; user: { username: string; role: AdminRole } };
type MeErr = { ok: false; error: "UNAUTHENTICATED" };

type AnalyticsSectionKey = "usersStats" | "sixHandshakes" | "powerGroupings";
type AnalyticsTabKey = "users" | "dossier" | "network" | "profile";

type AnalyticsContactLite = {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
  ownerPhoneNumber: string;
  groupName: string | null;
  suzerainId: string | null;
  vassalIds: string[];
};

type AnalyticsPowerEdge = {
  suzerainId: string;
  vassalId: string;
  groupName: string;
};

type SixPickMode = "from" | "to";
type AdminRole = "admin" | "manager" | "analyst";

type AnalyticsCopy = {
  title: string;
  serverControl: string;
  login: string;
  reset: string;
  adminUsername: string;
  adminPassword: string;
  analytics: string;
  loginError: string;
  accessDenied: string;
  invalidCredentials: string;
  authNotConfigured: string;
  requiredEnv: string;
  usersStats: string;
  sixHandshakes: string;
  powerGroupings: string;
  sectionsCount: string;
  tabsCount: string;
  usersList: string;
  dossier: string;
  networkMap: string;
  profile: string;
  selectedUser: string;
  searchByPhone: string;
  phone: string;
  dossiers: string;
  updated: string;
  shortestPath: string;
  contactSelection: string;
  selectingFrom: string;
  selectingTo: string;
  contact: string;
  result: string;
  shortestChain: string;
  pathNotFound: string;
  depth: string;
  parameters: string;
  suzerainToVassal: string;
  topGroups: string;
  contactsCount: string;
  contactsInPowerGroupings: string;
  selectedPowerLinks: string;
  relatedContacts: string;
  selected: string;
  role: string;
  selectedItem: string;
  suzerain: string;
  vassal: string;
  relationshipTree: string;
  tree: string;
  pickContactLeft: string;
  noTreeRoots: string;
  loading: string;
  noData: string;
  error: string;
  accessDeniedPhone: string;
};

const ANALYTICS_COPY: Record<Language, AnalyticsCopy> = {
  ru: {
    title: "АНАЛИТИКА",
    serverControl: "SERVER CONTROL",
    login: "LOGIN",
    reset: "RESET",
    adminUsername: "ADMIN USERNAME",
    adminPassword: "ADMIN PASSWORD",
    analytics: "АНАЛИТИКА",
    loginError: "ОШИБКА ВХОДА",
    accessDenied: "ДОСТУП ЗАПРЕЩЕН",
    invalidCredentials: "Неверный логин/пароль или истекла сессия.",
    authNotConfigured: "ADMIN AUTH НЕ НАСТРОЕНА",
    requiredEnv: "Нужны env: RORK_ADMIN_AUTH_SECRET, RORK_ADMIN_DEFAULT_USERNAME, RORK_ADMIN_DEFAULT_PASSWORD",
    usersStats: "Статистика пользователей",
    sixHandshakes: "6 рукопожатий",
    powerGroupings: "Властные группировки",
    sectionsCount: "3 раздела",
    tabsCount: "4 вкладки",
    usersList: "Список пользователей",
    dossier: "Досье",
    networkMap: "Карта сети",
    profile: "Профиль",
    selectedUser: "Выбранный пользователь:",
    searchByPhone: "Поиск по телефону",
    phone: "ТЕЛЕФОН",
    dossiers: "ДОСЬЕ",
    updated: "ОБНОВЛ.",
    shortestPath: "кратчайший путь",
    contactSelection: "Выбор контактов",
    selectingFrom: "Выбираем: FROM",
    selectingTo: "Выбираем: TO",
    contact: "КОНТАКТ",
    result: "Результат",
    shortestChain: "Кратчайшая цепочка",
    pathNotFound: "Путь не найден.",
    depth: "Глубина",
    parameters: "Параметры",
    suzerainToVassal: "сюзерен → вассал",
    topGroups: "Топ групп",
    contactsCount: "КОНТАКТОВ",
    contactsInPowerGroupings: "Контакты во властных группировках",
    selectedPowerLinks: "Властные связи выбранного",
    relatedContacts: "Связанные контакты",
    selected: "Выбранный",
    role: "РОЛЬ",
    selectedItem: "Выбран",
    suzerain: "Сюзерен",
    vassal: "Вассал",
    relationshipTree: "Карта связей (дерево)",
    tree: "Дерево",
    pickContactLeft: "Выберите контакт слева.",
    noTreeRoots: "Нет корней дерева (возможно цикл).",
    loading: "Загрузка...",
    noData: "Нет данных. Проверьте доступ и выбранного пользователя.",
    error: "Ошибка",
    accessDeniedPhone: "Доступ запрещён для вашего номера телефона.",
  },
  en: {
    title: "ANALYTICS",
    serverControl: "SERVER CONTROL",
    login: "LOGIN",
    reset: "RESET",
    adminUsername: "ADMIN USERNAME",
    adminPassword: "ADMIN PASSWORD",
    analytics: "ANALYTICS",
    loginError: "LOGIN ERROR",
    accessDenied: "ACCESS DENIED",
    invalidCredentials: "Invalid username/password or session expired.",
    authNotConfigured: "ADMIN AUTH IS NOT CONFIGURED",
    requiredEnv: "Required env vars: RORK_ADMIN_AUTH_SECRET, RORK_ADMIN_DEFAULT_USERNAME, RORK_ADMIN_DEFAULT_PASSWORD",
    usersStats: "User stats",
    sixHandshakes: "6 handshakes",
    powerGroupings: "Power groupings",
    sectionsCount: "3 sections",
    tabsCount: "4 tabs",
    usersList: "Users list",
    dossier: "Dossier",
    networkMap: "Network map",
    profile: "Profile",
    selectedUser: "Selected user:",
    searchByPhone: "Search by phone",
    phone: "PHONE",
    dossiers: "DOSSIERS",
    updated: "UPDATED",
    shortestPath: "shortest path",
    contactSelection: "Contact selection",
    selectingFrom: "Picking: FROM",
    selectingTo: "Picking: TO",
    contact: "CONTACT",
    result: "Result",
    shortestChain: "Shortest chain",
    pathNotFound: "Path not found.",
    depth: "Depth",
    parameters: "Parameters",
    suzerainToVassal: "suzerain → vassal",
    topGroups: "Top groups",
    contactsCount: "CONTACTS",
    contactsInPowerGroupings: "Contacts in power groupings",
    selectedPowerLinks: "Selected power links",
    relatedContacts: "Related contacts",
    selected: "Selected",
    role: "ROLE",
    selectedItem: "Selected",
    suzerain: "Suzerain",
    vassal: "Vassal",
    relationshipTree: "Relationship map (tree)",
    tree: "Tree",
    pickContactLeft: "Pick a contact on the left.",
    noTreeRoots: "No tree roots found (possible cycle).",
    loading: "Loading...",
    noData: "No data. Check access rights and selected user.",
    error: "Error",
    accessDeniedPhone: "Access denied for your phone number.",
  },
};

export default function AdminAnalyticsScreen() {
  const { theme, phoneNumber, login, logout, currentLanguage } = useApp();
  const copy = ANALYTICS_COPY[currentLanguage];
  const styles = useMemo(() => createStyles(theme), [theme]);

  const hasAccess = isAdminPhone(phoneNumber);

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [adminToken, setAdminToken] = useState<string>("");

  const [analyticsSection, setAnalyticsSection] = useState<AnalyticsSectionKey>("usersStats");
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTabKey>("users");

  const [usersQuery, setUsersQuery] = useState<string>("");
  const [selectedPhone, setSelectedPhone] = useState<string>("");

  const [sixFrom, setSixFrom] = useState<string>("");
  const [sixTo, setSixTo] = useState<string>("");
  const [sixMaxDepth, setSixMaxDepth] = useState<number>(6);
  const [sixPickMode, setSixPickMode] = useState<SixPickMode>("from");
  const [sixPhoneSearch, setSixPhoneSearch] = useState<string>("");

  const [powerPhoneSearch, setPowerPhoneSearch] = useState<string>("");
  const [powerSelectedContactId, setPowerSelectedContactId] = useState<string>("");

  const prevImpersonationPhoneRef = useRef<string | null | undefined>(undefined);

  const isFullScreen = adminToken.length > 0;

  const statusQuery = trpc.adminAuth.status.useQuery(undefined, { enabled: hasAccess });
  const meQuery = trpc.adminAuth.me.useQuery(undefined, {
    enabled: hasAccess && adminToken.length > 0,
    staleTime: 10_000,
  });

  const loginMutation = trpc.adminAuth.login.useMutation();

  const analyticsUsersListQuery = trpc.admin.analyticsUsersList.useQuery(
    { query: usersQuery.trim() || undefined, limit: 200 },
    {
      enabled:
        hasAccess &&
        adminToken.length > 0 &&
        analyticsSection === "usersStats" &&
        analyticsTab === "users",
    },
  );

  const analyticsDossierQuery = trpc.admin.analyticsUserDossier.useQuery(
    { phoneNumber: selectedPhone },
    {
      enabled:
        hasAccess &&
        adminToken.length > 0 &&
        analyticsSection === "usersStats" &&
        analyticsTab === "dossier" &&
        selectedPhone.length > 0,
    },
  );

  const analyticsNetworkQuery = trpc.admin.analyticsUserNetworkMap.useQuery(
    { phoneNumber: selectedPhone },
    {
      enabled:
        hasAccess &&
        adminToken.length > 0 &&
        analyticsSection === "usersStats" &&
        analyticsTab === "network" &&
        selectedPhone.length > 0,
    },
  );

  const analyticsProfileQuery = trpc.admin.analyticsUserProfile.useQuery(
    { phoneNumber: selectedPhone },
    {
      enabled:
        hasAccess &&
        adminToken.length > 0 &&
        analyticsSection === "usersStats" &&
        analyticsTab === "profile" &&
        selectedPhone.length > 0,
    },
  );

  const sixContactsQuery = trpc.admin.analyticsContactsSearch.useQuery(
    { phoneQuery: sixPhoneSearch.trim() || undefined, onlyPowerGroupings: false, limit: 200 },
    {
      enabled:
        hasAccess &&
        adminToken.length > 0 &&
        analyticsSection === "sixHandshakes",
      staleTime: 10_000,
    },
  );

  const sixHandshakesQuery = trpc.admin.analyticsSixHandshakes.useQuery(
    { from: sixFrom.trim(), to: sixTo.trim(), maxDepth: sixMaxDepth },
    {
      enabled:
        hasAccess &&
        adminToken.length > 0 &&
        analyticsSection === "sixHandshakes" &&
        sixFrom.trim().length > 0 &&
        sixTo.trim().length > 0,
    },
  );

  const powerContactsQuery = trpc.admin.analyticsContactsSearch.useQuery(
    { phoneQuery: powerPhoneSearch.trim() || undefined, onlyPowerGroupings: true, limit: 300 },
    {
      enabled:
        hasAccess &&
        adminToken.length > 0 &&
        analyticsSection === "powerGroupings",
      staleTime: 10_000,
    },
  );

  const powerRelatedQuery = trpc.admin.analyticsPowerGroupingsRelated.useQuery(
    { contactId: powerSelectedContactId },
    {
      enabled:
        hasAccess &&
        adminToken.length > 0 &&
        analyticsSection === "powerGroupings" &&
        powerSelectedContactId.length > 0,
      staleTime: 10_000,
    },
  );

  const powerGroupingsQuery = trpc.admin.analyticsPowerGroupings.useQuery(undefined, {
    enabled: hasAccess && adminToken.length > 0 && analyticsSection === "powerGroupings",
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!hasAccess) return;
    AsyncStorage.getItem(STORAGE_ADMIN_TOKEN_KEY)
      .then((t) => {
        if (t) setAdminToken(t);
      })
      .catch((e) => console.log("[admin-analytics] failed to load admin token", e));
  }, [hasAccess]);

  const meData = meQuery.data as MeOk | MeErr | undefined;
  const myRole: AdminRole | null = meData?.ok ? meData.user.role : null;
  const canAccessAnalytics = myRole === "admin" || myRole === "analyst";

  const forbidden =
    (meQuery.data &&
      (meQuery.data as any).ok === false &&
      (meQuery.data as any).error === "UNAUTHENTICATED");

  const handleReset = useCallback(() => {
    setAdminToken("");
    setUsername("");
    setPassword("");
    setAnalyticsSection("usersStats");
    setAnalyticsTab("users");
    setUsersQuery("");
    setSelectedPhone("");
    setSixFrom("");
    setSixTo("");
    setSixMaxDepth(6);
    setSixPickMode("from");
    setSixPhoneSearch("");
    setPowerPhoneSearch("");
    setPowerSelectedContactId("");
    AsyncStorage.removeItem(STORAGE_ADMIN_TOKEN_KEY).catch((e) =>
      console.log("[admin-analytics] failed to clear admin token", e),
    );
  }, []);

  const handleAdminLogin = useCallback(async () => {
    try {
      const res = await loginMutation.mutateAsync({ username, password });
      if (res.ok) {
        setAdminToken(res.token);
        await AsyncStorage.setItem(STORAGE_ADMIN_TOKEN_KEY, res.token);
      }
    } catch (e) {
      console.log("[admin-analytics] login failed", e);
    }
  }, [loginMutation, password, username]);

  const ensureSelectedPhone = useCallback(
    (phone: string) => {
      const next = phone.trim();
      setSelectedPhone(next);
      if (next.length === 0) return;
      if (analyticsSection !== "usersStats") return;
      if (analyticsTab !== "users") return;
      setAnalyticsTab("dossier");
    },
    [analyticsSection, analyticsTab],
  );

  useEffect(() => {
    const shouldImpersonate =
      analyticsSection === "usersStats" &&
      selectedPhone.trim().length > 0 &&
      (analyticsTab === "dossier" || analyticsTab === "network" || analyticsTab === "profile");

    const currentPhone = phoneNumber;

    if (shouldImpersonate) {
      if (prevImpersonationPhoneRef.current === undefined) {
        prevImpersonationPhoneRef.current = currentPhone;
      }
      if (currentPhone !== selectedPhone.trim()) {
        console.log("[admin-analytics] impersonating user phone", {
          from: currentPhone,
          to: selectedPhone.trim(),
        });
        login(selectedPhone.trim()).catch((e) =>
          console.log("[admin-analytics] impersonation login failed", e),
        );
      }
      return;
    }

    if (prevImpersonationPhoneRef.current !== undefined) {
      const prev = prevImpersonationPhoneRef.current;
      prevImpersonationPhoneRef.current = undefined;
      console.log("[admin-analytics] restoring phone after impersonation", { prev });
      if (typeof prev === "string" && prev.length > 0) {
        login(prev).catch((e) => console.log("[admin-analytics] restore login failed", e));
      } else {
        logout().catch((e) => console.log("[admin-analytics] restore logout failed", e));
      }
    }
  }, [analyticsSection, analyticsTab, login, logout, phoneNumber, selectedPhone]);

  const anyLoading =
    loginMutation.isPending ||
    analyticsUsersListQuery.isFetching ||
    analyticsDossierQuery.isFetching ||
    analyticsNetworkQuery.isFetching ||
    analyticsProfileQuery.isFetching ||
    sixContactsQuery.isFetching ||
    sixHandshakesQuery.isFetching ||
    powerContactsQuery.isFetching ||
    powerRelatedQuery.isFetching ||
    powerGroupingsQuery.isFetching;

  if (!hasAccess) {
    return (
      <View style={styles.screen} testID="admin-analytics.denied">
        <Stack.Screen
          options={{
            title: copy.title,
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.deniedContainer}>
          <Lock size={48} color={theme.danger} />
          <Text style={styles.deniedTitle}>{copy.accessDenied}</Text>
          <Text style={styles.deniedText}>{copy.accessDeniedPhone}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="admin-analytics.screen">
      <Stack.Screen
        options={{
          title: copy.title,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />

      {!isFullScreen ? (
        <View style={styles.hero} testID="admin-analytics.hero">
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Shield size={18} color={theme.primary} />
              <Text style={styles.heroBadgeText}>{copy.serverControl}</Text>
            </View>
            <View style={styles.heroPills}>
              <View style={[styles.pill, { borderColor: theme.border }]}>
                <Text style={styles.pillText}>WEB: {Platform.OS}</Text>
              </View>
              <View style={[styles.pill, { borderColor: theme.border }]}>
                <Text style={styles.pillText}>API: /api/trpc</Text>
              </View>
            </View>
          </View>

          <Text style={styles.heroTitle}>{copy.title}</Text>

          <View style={styles.tokenRow}>
            <Lock size={18} color={theme.primaryDim} />
            <TextInput
              testID="admin-analytics.usernameInput"
              value={username}
              onChangeText={setUsername}
              placeholder={copy.adminUsername}
              placeholderTextColor={theme.primaryDim}
              style={styles.tokenInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.tokenRow}>
            <Lock size={18} color={theme.primaryDim} />
            <TextInput
              testID="admin-analytics.passwordInput"
              value={password}
              onChangeText={setPassword}
              placeholder={copy.adminPassword}
              placeholderTextColor={theme.primaryDim}
              style={styles.tokenInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <TouchableOpacity
              testID="admin-analytics.login"
              onPress={handleAdminLogin}
              activeOpacity={0.75}
              style={styles.resetBtn}
              disabled={loginMutation.isPending || username.length === 0 || password.length === 0}
            >
              <Text style={styles.resetBtnText}>
                {loginMutation.isPending ? "..." : copy.login}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="admin-analytics.reset"
              onPress={handleReset}
              activeOpacity={0.75}
              style={styles.resetBtn}
            >
              <Text style={styles.resetBtnText}>{copy.reset}</Text>
            </TouchableOpacity>
          </View>

          {statusQuery.data && (statusQuery.data as any).enabled === false ? (
            <View style={styles.alertDanger} testID="admin-analytics.notConfigured">
              <Text style={styles.alertDangerTitle}>{copy.authNotConfigured}</Text>
              <Text style={styles.alertDangerText}>{copy.requiredEnv}</Text>
            </View>
          ) : null}

          {loginMutation.data && (loginMutation.data as any).ok === false ? (
            <View style={styles.alertDanger} testID="admin-analytics.loginError">
              <Text style={styles.alertDangerTitle}>{copy.loginError}</Text>
              <Text style={styles.alertDangerText}>
                {String((loginMutation.data as any).error ?? "LOGIN_FAILED")}
              </Text>
            </View>
          ) : null}

          {adminToken.length > 0 && forbidden ? (
            <View style={styles.alertDanger} testID="admin-analytics.forbidden">
              <Text style={styles.alertDangerTitle}>{copy.accessDenied}</Text>
              <Text style={styles.alertDangerText}>{copy.invalidCredentials}</Text>
            </View>
          ) : null}

          {adminToken.length > 0 && !canAccessAnalytics && myRole !== null ? (
            <View style={styles.alertDanger}>
              <Text style={styles.alertDangerTitle}>{copy.accessDenied}</Text>
              <Text style={styles.alertDangerText}>
                {currentLanguage === "ru"
                  ? "Ваша роль не имеет доступа к аналитике."
                  : "Your role does not have analytics access."}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        style={styles.content}
        contentContainerStyle={isFullScreen ? styles.contentInnerFull : styles.contentInner}
        testID="admin-analytics.scroll"
      >
        {!isFullScreen ? (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionHeaderText}>{copy.analytics}</Text>
            </View>
            {anyLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <View style={styles.okDot} />
            )}
          </View>
        ) : null}

        {adminToken.length > 0 && canAccessAnalytics ? (
          <AnalyticsPanel
            theme={theme}
            analyticsSection={analyticsSection}
            setAnalyticsSection={(v) => {
              setAnalyticsSection(v);
              if (v !== "usersStats") {
                setAnalyticsTab("users");
                setSelectedPhone("");
              }
            }}
            analyticsTab={analyticsTab}
            setAnalyticsTab={setAnalyticsTab}
            usersQuery={usersQuery}
            setUsersQuery={setUsersQuery}
            selectedPhone={selectedPhone}
            onSelectFromList={ensureSelectedPhone}
            usersListData={analyticsUsersListQuery.data as any}
            sixFrom={sixFrom}
            setSixFrom={setSixFrom}
            sixTo={sixTo}
            setSixTo={setSixTo}
            sixMaxDepth={sixMaxDepth}
            setSixMaxDepth={setSixMaxDepth}
            sixPickMode={sixPickMode}
            setSixPickMode={setSixPickMode}
            sixPhoneSearch={sixPhoneSearch}
            setSixPhoneSearch={setSixPhoneSearch}
            sixContactsData={sixContactsQuery.data as any}
            sixContactsLoading={sixContactsQuery.isFetching}
            sixHandshakesData={sixHandshakesQuery.data as any}
            sixHandshakesLoading={sixHandshakesQuery.isFetching}
            powerPhoneSearch={powerPhoneSearch}
            setPowerPhoneSearch={setPowerPhoneSearch}
            powerSelectedContactId={powerSelectedContactId}
            setPowerSelectedContactId={setPowerSelectedContactId}
            powerContactsData={powerContactsQuery.data as any}
            powerContactsLoading={powerContactsQuery.isFetching}
            powerRelatedData={powerRelatedQuery.data as any}
            powerRelatedLoading={powerRelatedQuery.isFetching}
            powerGroupingsData={powerGroupingsQuery.data as any}
            powerGroupingsLoading={powerGroupingsQuery.isFetching}
            isLoading={
              analyticsUsersListQuery.isFetching ||
              analyticsDossierQuery.isFetching ||
              analyticsNetworkQuery.isFetching ||
              analyticsProfileQuery.isFetching ||
              sixContactsQuery.isFetching ||
              sixHandshakesQuery.isFetching ||
              powerContactsQuery.isFetching ||
              powerRelatedQuery.isFetching ||
              powerGroupingsQuery.isFetching
            }
            copy={copy}
          />
        ) : null}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

function AnalyticsPanel(props: {
  theme: any;
  analyticsSection: AnalyticsSectionKey;
  setAnalyticsSection: (v: AnalyticsSectionKey) => void;
  analyticsTab: AnalyticsTabKey;
  setAnalyticsTab: (v: AnalyticsTabKey) => void;
  usersQuery: string;
  setUsersQuery: (v: string) => void;
  selectedPhone: string;
  onSelectFromList: (phone: string) => void;
  usersListData: any;
  sixFrom: string;
  setSixFrom: (v: string) => void;
  sixTo: string;
  setSixTo: (v: string) => void;
  sixMaxDepth: number;
  setSixMaxDepth: (v: number) => void;
  sixPickMode: SixPickMode;
  setSixPickMode: (v: SixPickMode) => void;
  sixPhoneSearch: string;
  setSixPhoneSearch: (v: string) => void;
  sixContactsData: any;
  sixContactsLoading: boolean;
  sixHandshakesData: any;
  sixHandshakesLoading: boolean;
  powerPhoneSearch: string;
  setPowerPhoneSearch: (v: string) => void;
  powerSelectedContactId: string;
  setPowerSelectedContactId: (v: string) => void;
  powerContactsData: any;
  powerContactsLoading: boolean;
  powerRelatedData: any;
  powerRelatedLoading: boolean;
  powerGroupingsData: any;
  powerGroupingsLoading: boolean;
  isLoading: boolean;
  copy: AnalyticsCopy;
}) {
  const {
    theme,
    analyticsSection,
    setAnalyticsSection,
    analyticsTab,
    setAnalyticsTab,
    usersQuery,
    setUsersQuery,
    selectedPhone,
    onSelectFromList,
    usersListData,
    sixFrom,
    setSixFrom,
    sixTo,
    setSixTo,
    sixMaxDepth,
    setSixMaxDepth,
    sixPickMode,
    setSixPickMode,
    sixPhoneSearch,
    setSixPhoneSearch,
    sixContactsData,
    sixContactsLoading,
    sixHandshakesData,
    sixHandshakesLoading,
    powerPhoneSearch,
    setPowerPhoneSearch,
    powerSelectedContactId,
    setPowerSelectedContactId,
    powerContactsData,
    powerContactsLoading,
    powerRelatedData,
    powerRelatedLoading,
    powerGroupingsData,
    powerGroupingsLoading,
    isLoading,
    copy,
  } = props;

  const styles = useMemo(() => panelStyles(theme), [theme]);

  return (
    <View style={styles.card} testID="admin-analytics.card">
      <View style={styles.titleRow}>
        <Text style={styles.title}>{copy.analytics}</Text>
        <View style={styles.chip}>
          <BarChart3 size={14} color={theme.primary} />
          <Text style={styles.chipText}>{copy.sectionsCount}</Text>
        </View>
      </View>

      <View style={styles.tabsRow} testID="admin-analytics.sections">
        <TabButton
          theme={theme}
          active={analyticsSection === "usersStats"}
          label={copy.usersStats}
          icon={<Users size={16} color={theme.text} />}
          onPress={() => setAnalyticsSection("usersStats")}
          testID="admin-analytics.section.usersStats"
        />
        <TabButton
          theme={theme}
          active={analyticsSection === "sixHandshakes"}
          label={copy.sixHandshakes}
          icon={<Network size={16} color={theme.text} />}
          onPress={() => setAnalyticsSection("sixHandshakes")}
          testID="admin-analytics.section.sixHandshakes"
        />
        <TabButton
          theme={theme}
          active={analyticsSection === "powerGroupings"}
          label={copy.powerGroupings}
          icon={<Crown size={16} color={theme.text} />}
          onPress={() => setAnalyticsSection("powerGroupings")}
          testID="admin-analytics.section.powerGroupings"
        />
      </View>

      {analyticsSection === "usersStats" ? (
        <View style={{ gap: 12 }} testID="admin-analytics.usersStats">
          <View style={styles.titleRow}>
            <Text style={styles.title}>{copy.usersStats}</Text>
            <View style={styles.chip}>
              <Users size={14} color={theme.primary} />
              <Text style={styles.chipText}>{copy.tabsCount}</Text>
            </View>
          </View>

          <View style={styles.tabsRow} testID="admin-analytics.tabs">
            <TabButton
              theme={theme}
              active={analyticsTab === "users"}
              label={copy.usersList}
              icon={<Search size={16} color={theme.text} />}
              onPress={() => setAnalyticsTab("users")}
              testID="admin-analytics.tab.users"
            />
            <TabButton
              theme={theme}
              active={analyticsTab === "dossier"}
              label={copy.dossier}
              icon={<Users size={16} color={theme.text} />}
              onPress={() => setAnalyticsTab("dossier")}
              testID="admin-analytics.tab.dossier"
              disabled={selectedPhone.length === 0}
            />
            <TabButton
              theme={theme}
              active={analyticsTab === "network"}
              label={copy.networkMap}
              icon={<Network size={16} color={theme.text} />}
              onPress={() => setAnalyticsTab("network")}
              testID="admin-analytics.tab.network"
              disabled={selectedPhone.length === 0}
            />
            <TabButton
              theme={theme}
              active={analyticsTab === "profile"}
              label={copy.profile}
              icon={<Crown size={16} color={theme.text} />}
              onPress={() => setAnalyticsTab("profile")}
              testID="admin-analytics.tab.profile"
              disabled={selectedPhone.length === 0}
            />
          </View>

          <View style={styles.selectedRow} testID="admin-analytics.selectedRow">
            <Text style={styles.muted}>{copy.selectedUser}</Text>
            <Text style={styles.selectedPhone} numberOfLines={1}>
              {selectedPhone.length > 0 ? selectedPhone : "—"}
            </Text>
          </View>

          {analyticsTab === "users" ? (
            <View style={{ gap: 12 }} testID="admin-analytics.usersTab">
              <View style={styles.searchRow}>
                <Search size={18} color={theme.primaryDim} />
                <TextInput
                  testID="admin-analytics.users.search"
                  value={usersQuery}
                  onChangeText={setUsersQuery}
                  placeholder={copy.searchByPhone}
                  placeholderTextColor={theme.primaryDim}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.table} testID="admin-analytics.users.table">
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>{copy.phone}</Text>
                  <Text style={styles.tableHeaderCell}>{copy.dossiers}</Text>
                  <Text style={styles.tableHeaderCell}>{copy.updated}</Text>
                </View>

                {renderInline({ data: usersListData, isLoading, theme }) ??
                  ((usersListData?.users ?? []) as any[]).slice(0, 60).map((u) => {
                    const phone = String(u.phoneNumber ?? "");
                    const updated =
                      typeof u.updatedAt === "number" && u.updatedAt > 0
                        ? new Date(u.updatedAt).toLocaleString()
                        : "-";
                    return (
                      <TouchableOpacity
                        key={phone}
                        testID={`admin-analytics.users.row.${phone}`}
                        activeOpacity={0.78}
                        onPress={() => onSelectFromList(phone)}
                        style={styles.tableRowBtn}
                      >
                        <Text style={styles.tableCellPrimary}>{phone}</Text>
                        <Text style={styles.tableCell}>{String(u.dossiersCount ?? 0)}</Text>
                        <Text style={styles.tableCell}>{updated}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>
          ) : null}

          {analyticsTab === "dossier" || analyticsTab === "network" || analyticsTab === "profile" ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 18,
                overflow: "hidden",
                backgroundColor: theme.background,
              }}
              testID="admin-analytics.mirror.container"
            >
              {analyticsTab === "dossier" ? (
                <View testID="admin-analytics.mirror.dossier">
                  <DossiersTabScreen />
                </View>
              ) : null}
              {analyticsTab === "network" ? (
                <View testID="admin-analytics.mirror.network">
                  <NetworkTabScreen />
                </View>
              ) : null}
              {analyticsTab === "profile" ? (
                <View testID="admin-analytics.mirror.profile">
                  <ProfileTabScreen />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {analyticsSection === "sixHandshakes" ? (
        <View style={{ gap: 12 }} testID="admin-analytics.sixHandshakes">
          <View style={styles.titleRow}>
            <Text style={styles.title}>{copy.sixHandshakes}</Text>
            <View style={styles.chip}>
              <Network size={14} color={theme.primary} />
              <Text style={styles.chipText}>{copy.shortestPath}</Text>
            </View>
          </View>

          <View style={styles.threeColGrid} testID="admin-analytics.six.grid">
            <View style={styles.colCard} testID="admin-analytics.six.left">
              <Text style={styles.colTitle}>{copy.contactSelection}</Text>
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  testID="admin-analytics.six.pickMode.from"
                  onPress={() => setSixPickMode("from")}
                  activeOpacity={0.78}
                  style={[
                    styles.pickModeBtn,
                    {
                      borderColor: sixPickMode === "from" ? theme.primary : theme.border,
                      backgroundColor: sixPickMode === "from" ? theme.card : theme.background,
                    },
                  ]}
                >
                  <Text style={styles.pickModeLabel}>{copy.selectingFrom}</Text>
                  <Text style={styles.pickModeValue} numberOfLines={1}>
                    {sixFrom.length > 0 ? sixFrom : "—"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="admin-analytics.six.pickMode.to"
                  onPress={() => setSixPickMode("to")}
                  activeOpacity={0.78}
                  style={[
                    styles.pickModeBtn,
                    {
                      borderColor: sixPickMode === "to" ? theme.primary : theme.border,
                      backgroundColor: sixPickMode === "to" ? theme.card : theme.background,
                    },
                  ]}
                >
                  <Text style={styles.pickModeLabel}>{copy.selectingTo}</Text>
                  <Text style={styles.pickModeValue} numberOfLines={1}>
                    {sixTo.length > 0 ? sixTo : "—"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.searchRow, { marginTop: 12 }]}>
                <Search size={18} color={theme.primaryDim} />
                <TextInput
                  testID="admin-analytics.six.search"
                  value={sixPhoneSearch}
                  onChangeText={setSixPhoneSearch}
                  placeholder={copy.searchByPhone}
                  placeholderTextColor={theme.primaryDim}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={[styles.searchRow, { marginTop: 10 }]}>
                <Text style={styles.muted}>MAX</Text>
                <TextInput
                  testID="admin-analytics.six.maxDepth"
                  value={String(sixMaxDepth)}
                  onChangeText={(v) => {
                    const n = Number(v);
                    if (Number.isFinite(n)) {
                      setSixMaxDepth(Math.max(1, Math.min(6, Math.floor(n))));
                    }
                  }}
                  placeholder="6"
                  placeholderTextColor={theme.primaryDim}
                  style={[styles.searchInput, { fontWeight: "900" as const }]}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.table, { marginTop: 12 }]} testID="admin-analytics.six.contactsTable">
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>КОНТАКТ</Text>
                  <Text style={styles.tableHeaderCell}>ТЕЛЕФОН</Text>
                </View>

                {renderInline({ data: sixContactsData, isLoading: sixContactsLoading, theme }) ??
                  (((sixContactsData?.contacts ?? []) as AnalyticsContactLite[]) || [])
                    .slice(0, 80)
                    .map((c) => {
                      const mainPhone = c.phoneNumbers?.[0] ?? "";
                      const activeId = sixPickMode === "from" ? sixFrom : sixTo;
                      const isActive = activeId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          testID={`admin-analytics.six.contact.${c.id}`}
                          activeOpacity={0.78}
                          onPress={() => {
                            if (sixPickMode === "from") setSixFrom(c.id);
                            else setSixTo(c.id);
                          }}
                          style={[
                            styles.tableRowBtn,
                            {
                              borderLeftWidth: 3,
                              borderLeftColor: isActive ? theme.primary : "transparent",
                            },
                          ]}
                        >
                          <Text style={styles.tableCellPrimary} numberOfLines={1}>
                            {c.name || c.id}
                          </Text>
                          <Text style={styles.tableCell} numberOfLines={1}>
                            {mainPhone || "—"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
              </View>
            </View>

            <View style={styles.colCard} testID="admin-analytics.six.right">
              <Text style={styles.colTitle}>{copy.result}</Text>
              {renderResultCard({
                theme,
                title: copy.shortestChain,
                data: sixHandshakesData,
                isLoading: sixHandshakesLoading,
                renderOk: (d) => {
                  const pathContacts = Array.isArray(d?.pathContacts) ? (d.pathContacts as any[]) : null;
                  const path = Array.isArray(d?.path) ? (d.path as unknown[]) : null;
                  if (!path || path.length === 0) {
                    return <Text style={styles.muted}>{copy.pathNotFound}</Text>;
                  }
                  const rows = pathContacts && pathContacts.length === path.length ? pathContacts : path;
                  return (
                    <View style={{ gap: 10 }}>
                      <Text style={styles.muted}>{copy.depth}: {String(d?.depth ?? "-")}</Text>
                      <View style={styles.kvBox}>
                        {rows.map((item, idx) => {
                          if (typeof item === "string") {
                            return <KVRow key={`${String(item)}-${idx}`} theme={theme} k={String(idx + 1)} v={String(item)} />;
                          }
                          const id = String((item as any)?.id ?? "");
                          const name = String((item as any)?.name ?? "");
                          const phone = Array.isArray((item as any)?.phoneNumbers)
                            ? String((item as any)?.phoneNumbers?.[0] ?? "")
                            : "";
                          return <KVRow key={`${id}-${idx}`} theme={theme} k={String(idx + 1)} v={`${name || id}${phone ? ` • ${phone}` : ""}`} />;
                        })}
                      </View>
                    </View>
                  );
                },
              })}
            </View>

            <View style={styles.colCard} testID="admin-analytics.six.meta">
              <Text style={styles.colTitle}>{copy.parameters}</Text>
              <View style={styles.kvBox}>
                <KVRow theme={theme} k="FROM" v={sixFrom || "—"} />
                <KVRow theme={theme} k="TO" v={sixTo || "—"} />
                <KVRow theme={theme} k="MAX" v={String(sixMaxDepth)} />
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {analyticsSection === "powerGroupings" ? (
        <View style={{ gap: 12 }} testID="admin-analytics.powerGroupings">
          <View style={styles.titleRow}>
            <Text style={styles.title}>{copy.powerGroupings}</Text>
            <View style={styles.chip}>
              <Crown size={14} color={theme.primary} />
              <Text style={styles.chipText}>{copy.suzerainToVassal}</Text>
            </View>
          </View>

          {renderResultCard({
            theme,
            title: copy.topGroups,
            data: powerGroupingsData,
            isLoading: powerGroupingsLoading,
            renderOk: (d) => {
              const groups = (d?.groups ?? []) as any[];
              return (
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderCell}>ГРУППА</Text>
                    <Text style={styles.tableHeaderCell}>{copy.contactsCount}</Text>
                  </View>
                  {groups.slice(0, 10).map((g) => {
                    const name = String(g.groupName ?? "");
                    const count = String(g.dossiersCount ?? 0);
                    return (
                      <View key={name} style={styles.tableRow} testID={`admin-analytics.power.top.${name}`}>
                        <Text style={styles.tableCellPrimary} numberOfLines={1}>{name}</Text>
                        <Text style={styles.tableCell}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            },
          })}

          <View style={styles.threeColGrid} testID="admin-analytics.power.grid">
            <View style={styles.colCard} testID="admin-analytics.power.left">
              <Text style={styles.colTitle}>{copy.contactsInPowerGroupings}</Text>
              <View style={styles.searchRow}>
                <Search size={18} color={theme.primaryDim} />
                <TextInput
                  testID="admin-analytics.power.search"
                  value={powerPhoneSearch}
                  onChangeText={setPowerPhoneSearch}
                  placeholder={copy.searchByPhone}
                  placeholderTextColor={theme.primaryDim}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={[styles.table, { marginTop: 12 }]} testID="admin-analytics.power.contactsTable">
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>{copy.contact}</Text>
                  <Text style={styles.tableHeaderCell}>ГРУППА</Text>
                </View>
                {renderInline({ data: powerContactsData, isLoading: powerContactsLoading, theme }) ??
                  (((powerContactsData?.contacts ?? []) as AnalyticsContactLite[]) || [])
                    .slice(0, 120)
                    .map((c) => {
                      const isActive = powerSelectedContactId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          testID={`admin-analytics.power.contact.${c.id}`}
                          activeOpacity={0.78}
                          onPress={() => setPowerSelectedContactId(c.id)}
                          style={[
                            styles.tableRowBtn,
                            { borderLeftWidth: 3, borderLeftColor: isActive ? theme.primary : "transparent" },
                          ]}
                        >
                          <Text style={styles.tableCellPrimary} numberOfLines={1}>{c.name || c.id}</Text>
                          <Text style={styles.tableCell} numberOfLines={1}>{c.groupName || "—"}</Text>
                        </TouchableOpacity>
                      );
                    })}
              </View>
            </View>

            <View style={styles.colCard} testID="admin-analytics.power.middle">
              <Text style={styles.colTitle}>{copy.selectedPowerLinks}</Text>
              {renderResultCard({
                theme,
                title: copy.relatedContacts,
                data: powerRelatedData,
                isLoading: powerRelatedLoading,
                renderOk: (d) => {
                  const selected = d?.selected as AnalyticsContactLite | undefined;
                  const related = (d?.relatedContacts ?? []) as AnalyticsContactLite[];
                  const edges = (d?.edges ?? []) as AnalyticsPowerEdge[];
                  const label = selected ? `${selected.name || selected.id} • ${selected.groupName || ""}` : "—";
                  return (
                    <View style={{ gap: 10 }}>
                      <Text style={styles.muted}>{copy.selected}: {label}</Text>
                      <View style={styles.table}>
                        <View style={styles.tableHeader}>
                          <Text style={styles.tableHeaderCell}>{copy.contact}</Text>
                          <Text style={styles.tableHeaderCell}>{copy.role}</Text>
                        </View>
                        {related.slice(0, 120).map((c) => {
                          const isSelected = c.id === selected?.id;
                          const hasSuz = edges.some((e) => e.vassalId === c.id);
                          const hasVas = edges.some((e) => e.suzerainId === c.id);
                          const role = isSelected
                            ? copy.selectedItem
                            : hasSuz && hasVas
                              ? `${copy.suzerain}/${copy.vassal}`
                              : hasVas
                                ? copy.suzerain
                                : hasSuz
                                  ? copy.vassal
                                  : "—";
                          return (
                            <View
                              key={c.id}
                              style={[styles.tableRow, { backgroundColor: isSelected ? theme.background : theme.card }]}
                              testID={`admin-analytics.power.related.${c.id}`}
                            >
                              <Text style={styles.tableCellPrimary} numberOfLines={1}>{c.name || c.id}</Text>
                              <Text style={styles.tableCell} numberOfLines={1}>{role}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                },
              })}
            </View>

            <View style={styles.colCard} testID="admin-analytics.power.right">
              <Text style={styles.colTitle}>{copy.relationshipTree}</Text>
              {renderResultCard({
                theme,
                title: copy.tree,
                data: powerRelatedData,
                isLoading: powerRelatedLoading,
                renderOk: (d) => {
                  const related = (d?.relatedContacts ?? []) as AnalyticsContactLite[];
                  const edges = (d?.edges ?? []) as AnalyticsPowerEdge[];
                  const byId = new Map<string, AnalyticsContactLite>();
                  for (const c of related) byId.set(c.id, c);
                  const children = new Map<string, string[]>();
                  const incoming = new Map<string, number>();
                  for (const e of edges) {
                    if (!byId.has(e.suzerainId) || !byId.has(e.vassalId)) continue;
                    if (!children.has(e.suzerainId)) children.set(e.suzerainId, []);
                    children.get(e.suzerainId)?.push(e.vassalId);
                    incoming.set(e.vassalId, (incoming.get(e.vassalId) ?? 0) + 1);
                    if (!incoming.has(e.suzerainId)) incoming.set(e.suzerainId, incoming.get(e.suzerainId) ?? 0);
                  }
                  const roots = related
                    .map((c) => c.id)
                    .filter((id) => (incoming.get(id) ?? 0) === 0)
                    .slice(0, 20);

                  const renderNode = (id: string, depth: number, seen: Set<string>): React.ReactNode => {
                    if (seen.has(id)) return null;
                    const nextSeen = new Set(seen);
                    nextSeen.add(id);
                    const c = byId.get(id);
                    const name = c?.name || id;
                    const phone = c?.phoneNumbers?.[0] ?? "";
                    const pad = Math.min(8 + depth * 14, 80);
                    const kids = (children.get(id) ?? []).slice(0, 60);
                    return (
                      <View key={`${id}-${depth}`} style={{ gap: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: pad }}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 99,
                              backgroundColor: depth === 0 ? theme.primary : theme.primaryDim,
                              opacity: depth === 0 ? 1 : 0.9,
                            }}
                          />
                          <Text style={{ color: theme.text, fontWeight: depth === 0 ? ("900" as const) : ("800" as const), flex: 1 }} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text style={{ color: theme.textSecondary, width: 120, textAlign: "right" as const }} numberOfLines={1}>
                            {phone || ""}
                          </Text>
                        </View>
                        {kids.map((kid) => renderNode(kid, depth + 1, nextSeen))}
                      </View>
                    );
                  };

                  if (related.length === 0) {
                    return <Text style={styles.muted}>{copy.pickContactLeft}</Text>;
                  }
                  return (
                    <View style={styles.kvBox} testID="admin-analytics.power.tree">
                      {roots.length > 0 ? (
                        roots.map((r) => renderNode(r, 0, new Set<string>()))
                      ) : (
                        <Text style={styles.muted}>{copy.noTreeRoots}</Text>
                      )}
                    </View>
                  );
                },
              })}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TabButton(props: {
  theme: any;
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
}) {
  const { theme, active, label, icon, onPress, testID, disabled } = props;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.78}
      disabled={disabled}
      style={[
        tabBtnStyles.btn,
        {
          opacity: disabled ? 0.45 : 1,
          borderColor: active ? theme.primary : theme.border,
          backgroundColor: active ? theme.card : theme.background,
        },
      ]}
    >
      <View style={tabBtnStyles.btnTopRow}>
        <View style={tabBtnStyles.btnIcon}>{icon}</View>
        <Text
          style={[tabBtnStyles.btnText, { color: active ? theme.text : theme.textSecondary }]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const tabBtnStyles = StyleSheet.create({
  btn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  btnTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "900" as const,
    letterSpacing: 0.2,
    lineHeight: 14,
  },
});

function KVRow(props: { theme: any; k: string; v: string }) {
  const { theme, k, v } = props;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Text style={{ width: 100, color: theme.textSecondary, fontWeight: "900" as const, letterSpacing: 0.6, fontSize: 11 }}>
        {k}
      </Text>
      <Text style={{ flex: 1, color: theme.text, fontWeight: "800" as const }}>{v}</Text>
    </View>
  );
}

function renderInline(args: { data: any; isLoading: boolean; theme: any }): React.ReactNode | null {
  const { data, isLoading, theme } = args;
  if (isLoading) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: theme.textSecondary, fontWeight: "800" as const }}>Загрузка...</Text>
      </View>
    );
  }
  if (!data) return null;
  if (data.ok === false) {
    return <Text style={{ color: theme.danger }}>Ошибка: {String(data.error)}</Text>;
  }
  return null;
}

function renderResultCard(args: {
  theme: any;
  title: string;
  data: any;
  isLoading: boolean;
  renderOk: (data: any) => React.ReactNode;
}): React.ReactNode {
  const { theme, title, data, isLoading, renderOk } = args;
  const styles = panelStyles(theme);
  if (isLoading && !data) {
    return (
      <View style={styles.resultBox}>
        <ActivityIndicator color={theme.primary} />
        <Text style={styles.muted}>Загрузка...</Text>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.resultBox}>
        <Text style={styles.muted}>Нет данных.</Text>
      </View>
    );
  }
  if (data.ok === false) {
    return (
      <View style={styles.resultBox}>
        <Text style={styles.title}>{title}</Text>
        <Text style={{ color: theme.danger, fontWeight: "900" as const }}>Ошибка: {String(data.error)}</Text>
      </View>
    );
  }
  return (
    <View style={styles.resultBox}>
      <Text style={styles.title}>{title}</Text>
      {renderOk(data)}
    </View>
  );
}

const panelStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      backgroundColor: theme.card,
      padding: 16,
      gap: 12,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    title: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900" as const,
      letterSpacing: 0.8,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    chipText: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "900" as const,
      letterSpacing: 1.2,
    },
    muted: {
      color: theme.textSecondary,
      lineHeight: 18,
    },
    tabsRow: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },
    selectedRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    selectedPhone: {
      flex: 1,
      textAlign: "right" as const,
      color: theme.text,
      fontWeight: "900" as const,
      letterSpacing: 0.4,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontWeight: "800" as const,
      letterSpacing: 0.2,
      paddingVertical: 8,
    },
    table: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      overflow: "hidden",
    },
    tableHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tableHeaderCell: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "900" as const,
      letterSpacing: 1.3,
    },
    tableRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
      gap: 10,
    },
    tableRowBtn: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
      gap: 10,
    },
    tableCellPrimary: {
      color: theme.text,
      flex: 1,
      marginRight: 10,
      fontWeight: "900" as const,
    },
    tableCell: {
      color: theme.textSecondary,
      width: 110,
      textAlign: "right" as const,
    },
    threeColGrid: {
      flexDirection: Platform.OS === "web" ? ("row" as const) : ("column" as const),
      gap: 12,
      alignItems: "stretch",
    },
    colCard: {
      flex: 1,
      minWidth: Platform.OS === "web" ? 320 : undefined,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      borderRadius: 16,
      padding: 14,
    },
    colTitle: {
      color: theme.text,
      fontWeight: "900" as const,
      letterSpacing: 0.6,
      fontSize: 13,
      marginBottom: 10,
    },
    pickModeBtn: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 6,
    },
    pickModeLabel: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "900" as const,
      letterSpacing: 1.2,
    },
    pickModeValue: {
      color: theme.text,
      fontWeight: "900" as const,
      letterSpacing: 0.2,
    },
    resultBox: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 14,
      backgroundColor: theme.background,
      gap: 10,
    },
    kvBox: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 12,
      backgroundColor: theme.background,
      gap: 10,
    },
  });

const createStyles = (theme: any) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    hero: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      gap: 12,
    },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    heroBadgeText: {
      color: theme.text,
      fontSize: 10,
      fontWeight: "900" as const,
      letterSpacing: 1.4,
    },
    heroPills: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: theme.background,
    },
    pillText: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "900" as const,
      letterSpacing: 0.8,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 26,
      fontWeight: "900" as const,
      letterSpacing: 1.8,
      marginTop: 4,
    },
    tokenRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 16,
    },
    tokenInput: {
      flex: 1,
      color: theme.text,
      fontWeight: "900" as const,
      letterSpacing: 0.9,
      paddingVertical: 8,
    },
    resetBtn: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    resetBtnText: {
      color: theme.textSecondary,
      fontWeight: "900" as const,
      letterSpacing: 1,
      fontSize: 10,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 28,
      gap: 12,
    },
    contentInnerFull: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 0,
      gap: 0,
      flexGrow: 1,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    sectionHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    sectionHeaderText: {
      color: theme.text,
      fontWeight: "900" as const,
      letterSpacing: 1.4,
      fontSize: 12,
    },
    okDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.success,
    },
    alertDanger: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.danger,
      borderRadius: 16,
      padding: 12,
      backgroundColor: theme.background,
    },
    alertDangerTitle: {
      color: theme.danger,
      fontWeight: "900" as const,
      letterSpacing: 1.2,
    },
    alertDangerText: {
      marginTop: 6,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    footerSpacer: {
      height: 24,
    },
    deniedContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 32,
    },
    deniedTitle: {
      color: theme.danger,
      fontSize: 20,
      fontWeight: "900" as const,
      letterSpacing: 1.5,
    },
    deniedText: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: "center" as const,
      lineHeight: 20,
    },
  });
