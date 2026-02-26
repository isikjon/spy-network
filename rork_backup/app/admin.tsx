import { Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ArrowRight,
  BarChart3,
  Crown,
  KeyRound,
  Lock,
  Network,
  Search,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { useApp } from "@/contexts/AppContext";

const DossiersTabScreen = React.lazy(() => import("@/app/(tabs)/index"));
const NetworkTabScreen = React.lazy(() => import("@/app/(tabs)/network"));
const ProfileTabScreen = React.lazy(() => import("@/app/(tabs)/profile"));

const STORAGE_ADMIN_TOKEN_KEY = "admin_auth_token" as const;

type MainSectionKey = "analytics" | "admins";

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

export default function AdminScreen() {
  const { theme, phoneNumber, login, logout } = useApp();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [adminToken, setAdminToken] = useState<string>("");

  const [section, setSection] = useState<MainSectionKey>("analytics");
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

  const [newAdminUsername, setNewAdminUsername] = useState<string>("");
  const [newAdminPassword, setNewAdminPassword] = useState<string>("");
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>("analyst");

  const [pwdUsername, setPwdUsername] = useState<string>("");
  const [pwdNewPassword, setPwdNewPassword] = useState<string>("");

  const [roleUsername, setRoleUsername] = useState<string>("");
  const [roleRole, setRoleRole] = useState<AdminRole>("analyst");

  const statusQuery = trpc.adminAuth.status.useQuery();
  const meQuery = trpc.adminAuth.me.useQuery(undefined, {
    enabled: adminToken.length > 0,
    staleTime: 10_000,
  });

  const loginMutation = trpc.adminAuth.login.useMutation();

  const adminsListQuery = trpc.admin.adminList.useQuery(undefined, {
    enabled: adminToken.length > 0 && section === "admins",
  });

  const adminCreateMutation = trpc.admin.adminCreate.useMutation();
  const adminSetPasswordMutation = trpc.admin.adminSetPassword.useMutation();
  const adminSetRoleMutation = trpc.admin.adminSetRole.useMutation();
  const adminDeleteMutation = trpc.admin.adminDelete.useMutation();

  const analyticsUsersListQuery = trpc.admin.analyticsUsersList.useQuery(
    { query: usersQuery.trim() || undefined, limit: 200 },
    {
      enabled:
        adminToken.length > 0 &&
        section === "analytics" &&
        analyticsSection === "usersStats" &&
        analyticsTab === "users",
    },
  );

  const analyticsDossierQuery = trpc.admin.analyticsUserDossier.useQuery(
    { phoneNumber: selectedPhone },
    {
      enabled:
        adminToken.length > 0 &&
        section === "analytics" &&
        analyticsSection === "usersStats" &&
        analyticsTab === "dossier" &&
        selectedPhone.length > 0,
    },
  );

  const analyticsNetworkQuery = trpc.admin.analyticsUserNetworkMap.useQuery(
    { phoneNumber: selectedPhone },
    {
      enabled:
        adminToken.length > 0 &&
        section === "analytics" &&
        analyticsSection === "usersStats" &&
        analyticsTab === "network" &&
        selectedPhone.length > 0,
    },
  );

  const analyticsProfileQuery = trpc.admin.analyticsUserProfile.useQuery(
    { phoneNumber: selectedPhone },
    {
      enabled:
        adminToken.length > 0 &&
        section === "analytics" &&
        analyticsSection === "usersStats" &&
        analyticsTab === "profile" &&
        selectedPhone.length > 0,
    },
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_ADMIN_TOKEN_KEY)
      .then((t) => {
        if (t) setAdminToken(t);
      })
      .catch((e) => console.log("[admin] failed to load admin token", e));
  }, []);

  const forbidden =
    (adminsListQuery.data &&
      (adminsListQuery.data as any).ok === false &&
      (adminsListQuery.data as any).error === "FORBIDDEN") ||
    (meQuery.data &&
      (meQuery.data as any).ok === false &&
      (meQuery.data as any).error === "UNAUTHENTICATED");

  const meData = meQuery.data as MeOk | MeErr | undefined;
  const myRole: AdminRole | null = meData?.ok ? meData.user.role : null;
  const canAccessAnalytics = myRole === "admin" || myRole === "analyst";

  useEffect(() => {
    if (adminToken.length === 0) return;
    if (myRole === null) return;

    if (!canAccessAnalytics && section === "analytics") {
      setSection("admins");
    }
  }, [adminToken.length, canAccessAnalytics, myRole, section]);

  const handleReset = useCallback(() => {
    setAdminToken("");
    setUsername("");
    setPassword("");
    setSection("analytics");
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

    setNewAdminUsername("");
    setNewAdminPassword("");
    setNewAdminRole("analyst");
    setPwdUsername("");
    setPwdNewPassword("");
    setRoleUsername("");
    setRoleRole("analyst");

    AsyncStorage.removeItem(STORAGE_ADMIN_TOKEN_KEY).catch((e) =>
      console.log("[admin] failed to clear admin token", e),
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
      console.log("[admin] login failed", e);
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

  const handleAdminCreate = useCallback(async () => {
    try {
      const res = await adminCreateMutation.mutateAsync({
        username: newAdminUsername.trim(),
        password: newAdminPassword,
        role: newAdminRole,
      });

      if (!res.ok) {
        Alert.alert("Ошибка", String((res as any).error ?? "CREATE_FAILED"));
        return;
      }

      setNewAdminUsername("");
      setNewAdminPassword("");
      setNewAdminRole("analyst");
      await adminsListQuery.refetch();
    } catch (e) {
      console.log("[admin] create admin failed", e);
      Alert.alert("Ошибка", "Не удалось создать админа");
    }
  }, [
    adminCreateMutation,
    adminsListQuery,
    newAdminPassword,
    newAdminRole,
    newAdminUsername,
  ]);

  const handleAdminSetPassword = useCallback(async () => {
    try {
      const res = await adminSetPasswordMutation.mutateAsync({
        username: pwdUsername.trim(),
        newPassword: pwdNewPassword,
      });

      if (!res.ok) {
        Alert.alert("Ошибка", String((res as any).error ?? "SET_PASSWORD_FAILED"));
        return;
      }

      setPwdUsername("");
      setPwdNewPassword("");
      await adminsListQuery.refetch();
    } catch (e) {
      console.log("[admin] set password failed", e);
      Alert.alert("Ошибка", "Не удалось обновить пароль");
    }
  }, [adminSetPasswordMutation, adminsListQuery, pwdNewPassword, pwdUsername]);

  const handleAdminSetRole = useCallback(async () => {
    try {
      const res = await adminSetRoleMutation.mutateAsync({
        username: roleUsername.trim(),
        role: roleRole,
      });

      if (!res.ok) {
        Alert.alert("Ошибка", String((res as any).error ?? "SET_ROLE_FAILED"));
        return;
      }

      setRoleUsername("");
      setRoleRole("analyst");
      await adminsListQuery.refetch();
    } catch (e) {
      console.log("[admin] set role failed", e);
      Alert.alert("Ошибка", "Не удалось обновить роль");
    }
  }, [adminSetRoleMutation, adminsListQuery, roleRole, roleUsername]);

  const handleAdminDelete = useCallback(
    async (u: string) => {
      Alert.alert("Удалить админа?", u, [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await adminDeleteMutation.mutateAsync({ username: u });
              if (!res.ok) {
                Alert.alert("Ошибка", String((res as any).error ?? "DELETE_FAILED"));
                return;
              }
              await adminsListQuery.refetch();
            } catch (e) {
              console.log("[admin] delete admin failed", e);
              Alert.alert("Ошибка", "Не удалось удалить админа");
            }
          },
        },
      ]);
    },
    [adminDeleteMutation, adminsListQuery],
  );

  useEffect(() => {
    const shouldImpersonate =
      section === "analytics" &&
      analyticsSection === "usersStats" &&
      selectedPhone.trim().length > 0 &&
      (analyticsTab === "dossier" || analyticsTab === "network" || analyticsTab === "profile");

    const currentPhone = phoneNumber;

    if (shouldImpersonate) {
      if (prevImpersonationPhoneRef.current === undefined) {
        prevImpersonationPhoneRef.current = currentPhone;
      }

      if (currentPhone !== selectedPhone.trim()) {
        console.log("[admin] impersonating user phone", {
          from: currentPhone,
          to: selectedPhone.trim(),
        });
        login(selectedPhone.trim()).catch((e) =>
          console.log("[admin] impersonation login failed", e),
        );
      }
      return;
    }

    if (prevImpersonationPhoneRef.current !== undefined) {
      const prev = prevImpersonationPhoneRef.current;
      prevImpersonationPhoneRef.current = undefined;

      console.log("[admin] restoring phone after impersonation", { prev });

      if (typeof prev === "string" && prev.length > 0) {
        login(prev).catch((e) => console.log("[admin] restore login failed", e));
      } else {
        logout().catch((e) => console.log("[admin] restore logout failed", e));
      }
    }
  }, [analyticsSection, analyticsTab, login, logout, phoneNumber, section, selectedPhone]);

  const sixContactsQuery = trpc.admin.analyticsContactsSearch.useQuery(
    { phoneQuery: sixPhoneSearch.trim() || undefined, onlyPowerGroupings: false, limit: 200 },
    {
      enabled:
        adminToken.length > 0 &&
        section === "analytics" &&
        analyticsSection === "sixHandshakes",
      staleTime: 10_000,
    },
  );

  const sixHandshakesQuery = trpc.admin.analyticsSixHandshakes.useQuery(
    { from: sixFrom.trim(), to: sixTo.trim(), maxDepth: sixMaxDepth },
    {
      enabled:
        adminToken.length > 0 &&
        section === "analytics" &&
        analyticsSection === "sixHandshakes" &&
        sixFrom.trim().length > 0 &&
        sixTo.trim().length > 0,
    },
  );

  const powerContactsQuery = trpc.admin.analyticsContactsSearch.useQuery(
    { phoneQuery: powerPhoneSearch.trim() || undefined, onlyPowerGroupings: true, limit: 300 },
    {
      enabled:
        adminToken.length > 0 &&
        section === "analytics" &&
        analyticsSection === "powerGroupings",
      staleTime: 10_000,
    },
  );

  const powerRelatedQuery = trpc.admin.analyticsPowerGroupingsRelated.useQuery(
    { contactId: powerSelectedContactId },
    {
      enabled:
        adminToken.length > 0 &&
        section === "analytics" &&
        analyticsSection === "powerGroupings" &&
        powerSelectedContactId.length > 0,
      staleTime: 10_000,
    },
  );

  const powerGroupingsQuery = trpc.admin.analyticsPowerGroupings.useQuery(undefined, {
    enabled: adminToken.length > 0 && section === "analytics" && analyticsSection === "powerGroupings",
    staleTime: 30_000,
  });

  const anyLoading =
    loginMutation.isPending ||
    adminsListQuery.isFetching ||
    analyticsUsersListQuery.isFetching ||
    analyticsDossierQuery.isFetching ||
    analyticsNetworkQuery.isFetching ||
    analyticsProfileQuery.isFetching ||
    sixContactsQuery.isFetching ||
    sixHandshakesQuery.isFetching ||
    powerContactsQuery.isFetching ||
    powerRelatedQuery.isFetching ||
    powerGroupingsQuery.isFetching;

  return (
    <View style={styles.screen} testID="admin.screen">
      <Stack.Screen
        options={{
          title: "ADMIN PANEL",
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />

      <View style={styles.hero} testID="admin.hero">
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Shield size={18} color={theme.primary} />
            <Text style={styles.heroBadgeText}>SERVER CONTROL</Text>
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

        <Text style={styles.heroTitle}>АДМИН-ПАНЕЛЬ</Text>
        <Text style={styles.heroSubtitle}>
          УПРАВЛЕНИЕ АДМИНАМИ • АНАЛИТИКА ПОЛЬЗОВАТЕЛЕЙ
        </Text>

        <View style={styles.tokenRow}>
          <Lock size={18} color={theme.primaryDim} />
          <TextInput
            testID="admin.usernameInput"
            value={username}
            onChangeText={setUsername}
            placeholder="ADMIN USERNAME"
            placeholderTextColor={theme.primaryDim}
            style={styles.tokenInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.tokenRow}>
          <Lock size={18} color={theme.primaryDim} />
          <TextInput
            testID="admin.passwordInput"
            value={password}
            onChangeText={setPassword}
            placeholder="ADMIN PASSWORD"
            placeholderTextColor={theme.primaryDim}
            style={styles.tokenInput}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <TouchableOpacity
            testID="admin.login"
            onPress={handleAdminLogin}
            activeOpacity={0.75}
            style={styles.resetBtn}
            disabled={
              loginMutation.isPending || username.length === 0 || password.length === 0
            }
          >
            <Text style={styles.resetBtnText}>
              {loginMutation.isPending ? "..." : "LOGIN"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="admin.reset"
            onPress={handleReset}
            activeOpacity={0.75}
            style={styles.resetBtn}
          >
            <Text style={styles.resetBtnText}>RESET</Text>
          </TouchableOpacity>
        </View>

        {statusQuery.data && (statusQuery.data as any).enabled === false ? (
          <View style={styles.alertDanger} testID="admin.notConfigured">
            <Text style={styles.alertDangerTitle}>ADMIN AUTH НЕ НАСТРОЕНА</Text>
            <Text style={styles.alertDangerText}>
              Нужны env: RORK_ADMIN_AUTH_SECRET, RORK_ADMIN_DEFAULT_USERNAME,
              RORK_ADMIN_DEFAULT_PASSWORD
            </Text>
          </View>
        ) : null}

        {loginMutation.data && (loginMutation.data as any).ok === false ? (
          <View style={styles.alertDanger} testID="admin.loginError">
            <Text style={styles.alertDangerTitle}>ОШИБКА ВХОДА</Text>
            <Text style={styles.alertDangerText}>
              {String((loginMutation.data as any).error ?? "LOGIN_FAILED")}
            </Text>
          </View>
        ) : null}

        {adminToken.length > 0 && forbidden ? (
          <View style={styles.alertDanger} testID="admin.forbidden">
            <Text style={styles.alertDangerTitle}>ДОСТУП ЗАПРЕЩЕН</Text>
            <Text style={styles.alertDangerText}>
              Неверный логин/пароль или истекла сессия.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.nav} testID="admin.nav">
        {canAccessAnalytics ? (
          <NavButton
            active={section === "analytics"}
            icon={<BarChart3 size={18} color={theme.text} />}
            label="АНАЛИТИКА"
            onPress={() => setSection("analytics")}
            theme={theme}
            testID="admin.nav.analytics"
          />
        ) : (
          <View style={[navStyles.btn, { borderColor: theme.border, backgroundColor: theme.background }]} testID="admin.nav.analytics.hidden">
            <View style={navStyles.row}>
              <View style={navStyles.iconWrap}>
                <Lock size={18} color={theme.primaryDim} />
              </View>
              <Text style={[navStyles.label, { color: theme.textSecondary }]}>АНАЛИТИКА (НЕТ ДОСТУПА)</Text>
            </View>
          </View>
        )}
        <NavButton
          active={section === "admins"}
          icon={<UserCog size={18} color={theme.text} />}
          label="АДМИНЫ"
          onPress={() => setSection("admins")}
          theme={theme}
          testID="admin.nav.admins"
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        testID="admin.scroll"
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionHeaderText}>
              {section === "analytics" ? "АНАЛИТИКА" : "УПРАВЛЕНИЕ АДМИНАМИ"}
            </Text>
          </View>
          {anyLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <View style={styles.okDot} />
          )}
        </View>

        {section === "analytics" ? (
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
          />
        ) : null}

        {section === "admins" ? (
          <AdminsPanel
            theme={theme}
            data={adminsListQuery.data as any}
            isLoading={adminsListQuery.isFetching}
            newAdminUsername={newAdminUsername}
            setNewAdminUsername={setNewAdminUsername}
            newAdminPassword={newAdminPassword}
            setNewAdminPassword={setNewAdminPassword}
            newAdminRole={newAdminRole}
            setNewAdminRole={setNewAdminRole}
            onCreate={handleAdminCreate}
            pwdUsername={pwdUsername}
            setPwdUsername={setPwdUsername}
            pwdNewPassword={pwdNewPassword}
            setPwdNewPassword={setPwdNewPassword}
            onSetPassword={handleAdminSetPassword}
            roleUsername={roleUsername}
            setRoleUsername={setRoleUsername}
            roleRole={roleRole}
            setRoleRole={setRoleRole}
            onSetRole={handleAdminSetRole}
            onDelete={handleAdminDelete}
            busy={
              adminCreateMutation.isPending ||
              adminSetPasswordMutation.isPending ||
              adminSetRoleMutation.isPending ||
              adminDeleteMutation.isPending
            }
          />
        ) : null}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

function NavButton(props: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  theme: any;
  testID: string;
}) {
  const { active, icon, label, onPress, theme, testID } = props;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.78}
      style={[
        navStyles.btn,
        {
          backgroundColor: active ? theme.card : theme.background,
          borderColor: active ? theme.primary : theme.border,
        },
      ]}
    >
      <View style={navStyles.row}>
        <View style={navStyles.iconWrap}>{icon}</View>
        <Text
          style={[
            navStyles.label,
            { color: active ? theme.text : theme.textSecondary },
          ]}
        >
          {label}
        </Text>
      </View>
      <ArrowRight size={18} color={active ? theme.primary : theme.primaryDim} />
    </TouchableOpacity>
  );
}

const navStyles = StyleSheet.create({
  btn: {
    flex: 1,
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  label: {
    flex: 1,
    fontSize: 12,
    letterSpacing: 0.8,
    fontWeight: "900" as const,
  },
});

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
  } = props;

  const styles = useMemo(() => panelStyles(theme), [theme]);

  return (
    <View style={styles.card} testID="admin.analytics.card">
      <View style={styles.titleRow}>
        <Text style={styles.title}>АНАЛИТИКА</Text>
        <View style={styles.chip}>
          <BarChart3 size={14} color={theme.primary} />
          <Text style={styles.chipText}>3 раздела</Text>
        </View>
      </View>

      <View style={styles.tabsRow} testID="admin.analytics.sections">
        <TabButton
          theme={theme}
          active={analyticsSection === "usersStats"}
          label="Статистика Пользователей"
          icon={<Users size={16} color={theme.text} />}
          onPress={() => setAnalyticsSection("usersStats")}
          testID="admin.analytics.section.usersStats"
        />
        <TabButton
          theme={theme}
          active={analyticsSection === "sixHandshakes"}
          label="6 рукопожатий"
          icon={<Network size={16} color={theme.text} />}
          onPress={() => setAnalyticsSection("sixHandshakes")}
          testID="admin.analytics.section.sixHandshakes"
        />
        <TabButton
          theme={theme}
          active={analyticsSection === "powerGroupings"}
          label="Властные группировки"
          icon={<Crown size={16} color={theme.text} />}
          onPress={() => setAnalyticsSection("powerGroupings")}
          testID="admin.analytics.section.powerGroupings"
        />
      </View>

      {analyticsSection === "usersStats" ? (
        <View style={{ gap: 12 }} testID="admin.analytics.usersStats">
          <View style={styles.titleRow}>
            <Text style={styles.title}>Статистика Пользователей</Text>
            <View style={styles.chip}>
              <Users size={14} color={theme.primary} />
              <Text style={styles.chipText}>4 вкладки</Text>
            </View>
          </View>

          <View style={styles.tabsRow} testID="admin.analytics.tabs">
        <TabButton
          theme={theme}
          active={analyticsTab === "users"}
          label="Список Пользователей"
          icon={<Search size={16} color={theme.text} />}
          onPress={() => setAnalyticsTab("users")}
          testID="admin.analytics.tab.users"
        />
        <TabButton
          theme={theme}
          active={analyticsTab === "dossier"}
          label="Досье"
          icon={<Users size={16} color={theme.text} />}
          onPress={() => setAnalyticsTab("dossier")}
          testID="admin.analytics.tab.dossier"
          disabled={selectedPhone.length === 0}
        />
        <TabButton
          theme={theme}
          active={analyticsTab === "network"}
          label="Карта сети"
          icon={<Network size={16} color={theme.text} />}
          onPress={() => setAnalyticsTab("network")}
          testID="admin.analytics.tab.network"
          disabled={selectedPhone.length === 0}
        />
        <TabButton
          theme={theme}
          active={analyticsTab === "profile"}
          label="Профиль"
          icon={<Crown size={16} color={theme.text} />}
          onPress={() => setAnalyticsTab("profile")}
          testID="admin.analytics.tab.profile"
          disabled={selectedPhone.length === 0}
        />
      </View>

          <View style={styles.selectedRow} testID="admin.analytics.selectedRow">
        <Text style={styles.muted}>Выбранный пользователь:</Text>
        <Text style={styles.selectedPhone} numberOfLines={1}>
          {selectedPhone.length > 0 ? selectedPhone : "—"}
        </Text>
      </View>

          {analyticsTab === "users" ? (
        <View style={{ gap: 12 }} testID="admin.analytics.usersTab">
          <View style={styles.searchRow}>
            <Search size={18} color={theme.primaryDim} />
            <TextInput
              testID="admin.analytics.users.search"
              value={usersQuery}
              onChangeText={setUsersQuery}
              placeholder="Поиск по телефону (часть номера)"
              placeholderTextColor={theme.primaryDim}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.table} testID="admin.analytics.users.table">
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>ТЕЛЕФОН</Text>
              <Text style={styles.tableHeaderCell}>ДОСЬЕ</Text>
              <Text style={styles.tableHeaderCell}>ОБНОВЛ.</Text>
            </View>

            {renderAdminResultInline({ data: usersListData, isLoading, theme }) ??
              ((usersListData?.users ?? []) as any[]).slice(0, 60).map((u) => {
                const phone = String(u.phoneNumber ?? "");
                const updated =
                  typeof u.updatedAt === "number" && u.updatedAt > 0
                    ? new Date(u.updatedAt).toLocaleString()
                    : "-";

                return (
                  <TouchableOpacity
                    key={phone}
                    testID={`admin.analytics.users.row.${phone}`}
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

          {analyticsTab === "dossier" ? null : null}

          {analyticsTab === "network" ? null : null}

          {analyticsTab === "profile" ? null : null}

          {analyticsTab === "dossier" || analyticsTab === "network" || analyticsTab === "profile" ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 18,
                overflow: "hidden",
                backgroundColor: theme.background,
              }}
              testID="admin.analytics.mirror.container"
            >
              {analyticsTab === "dossier" ? (
                <View testID="admin.analytics.mirror.dossier">
                  <React.Suspense fallback={<ActivityIndicator color={theme.primary} />}>
                    <DossiersTabScreen />
                  </React.Suspense>
                </View>
              ) : null}
              {analyticsTab === "network" ? (
                <View testID="admin.analytics.mirror.network">
                  <React.Suspense fallback={<ActivityIndicator color={theme.primary} />}>
                    <NetworkTabScreen />
                  </React.Suspense>
                </View>
              ) : null}
              {analyticsTab === "profile" ? (
                <View testID="admin.analytics.mirror.profile">
                  <React.Suspense fallback={<ActivityIndicator color={theme.primary} />}>
                    <ProfileTabScreen />
                  </React.Suspense>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {analyticsSection === "sixHandshakes" ? (
        <View style={{ gap: 12 }} testID="admin.analytics.sixHandshakes">
          <View style={styles.titleRow}>
            <Text style={styles.title}>6 рукопожатий</Text>
            <View style={styles.chip}>
              <Network size={14} color={theme.primary} />
              <Text style={styles.chipText}>кратчайший путь</Text>
            </View>
          </View>

          <View style={styles.threeColGrid} testID="admin.analytics.six.grid">
            <View style={styles.colCard} testID="admin.analytics.six.left">
              <Text style={styles.colTitle}>Выбор контактов</Text>

              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  testID="admin.analytics.six.pickMode.from"
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
                  <Text style={styles.pickModeLabel}>Выбираем: FROM</Text>
                  <Text style={styles.pickModeValue} numberOfLines={1}>
                    {sixFrom.length > 0 ? sixFrom : "—"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="admin.analytics.six.pickMode.to"
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
                  <Text style={styles.pickModeLabel}>Выбираем: TO</Text>
                  <Text style={styles.pickModeValue} numberOfLines={1}>
                    {sixTo.length > 0 ? sixTo : "—"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.searchRow, { marginTop: 12 }]}>
                <Search size={18} color={theme.primaryDim} />
                <TextInput
                  testID="admin.analytics.six.search"
                  value={sixPhoneSearch}
                  onChangeText={setSixPhoneSearch}
                  placeholder="Поиск по телефону"
                  placeholderTextColor={theme.primaryDim}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={[styles.searchRow, { marginTop: 10 }]}>
                <Text style={styles.muted}>MAX</Text>
                <TextInput
                  testID="admin.analytics.six.maxDepth"
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

              <View style={[styles.table, { marginTop: 12 }]} testID="admin.analytics.six.contactsTable">
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>КОНТАКТ</Text>
                  <Text style={styles.tableHeaderCell}>ТЕЛЕФОН</Text>
                </View>

                {renderAdminResultInline({ data: sixContactsData, isLoading: sixContactsLoading, theme }) ??
                  (((sixContactsData?.contacts ?? []) as AnalyticsContactLite[]) || [])
                    .slice(0, 80)
                    .map((c) => {
                      const mainPhone = c.phoneNumbers?.[0] ?? "";
                      const activeId = sixPickMode === "from" ? sixFrom : sixTo;
                      const isActive = activeId === c.id;

                      return (
                        <TouchableOpacity
                          key={c.id}
                          testID={`admin.analytics.six.contact.${c.id}`}
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

            <View style={styles.colCard} testID="admin.analytics.six.right">
              <Text style={styles.colTitle}>Результат</Text>

              {renderAdminResultCard({
                theme,
                title: "Кратчайшая цепочка",
                data: sixHandshakesData,
                isLoading: sixHandshakesLoading,
                renderOk: (d) => {
                  const pathContacts = Array.isArray(d?.pathContacts)
                    ? (d.pathContacts as any[])
                    : null;
                  const path = Array.isArray(d?.path) ? (d.path as unknown[]) : null;

                  if (!path || path.length === 0) {
                    return <Text style={styles.muted}>Путь не найден.</Text>;
                  }

                  const rows = pathContacts && pathContacts.length === path.length ? pathContacts : path;

                  return (
                    <View style={{ gap: 10 }}>
                      <Text style={styles.muted}>Глубина: {String(d?.depth ?? "-")}</Text>
                      <View style={styles.kvBox}>
                        {rows.map((item, idx) => {
                          if (typeof item === "string") {
                            return (
                              <KVRow
                                key={`${String(item)}-${idx}`}
                                theme={theme}
                                k={String(idx + 1)}
                                v={String(item)}
                              />
                            );
                          }

                          const id = String((item as any)?.id ?? "");
                          const name = String((item as any)?.name ?? "");
                          const phone = Array.isArray((item as any)?.phoneNumbers)
                            ? String((item as any)?.phoneNumbers?.[0] ?? "")
                            : "";

                          return (
                            <KVRow
                              key={`${id}-${idx}`}
                              theme={theme}
                              k={String(idx + 1)}
                              v={`${name || id}${phone ? ` • ${phone}` : ""}`}
                            />
                          );
                        })}
                      </View>
                    </View>
                  );
                },
              })}
            </View>

            <View style={styles.colCard} testID="admin.analytics.six.meta">
              <Text style={styles.colTitle}>Параметры</Text>
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
        <View style={{ gap: 12 }} testID="admin.analytics.powerGroupings">
          <View style={styles.titleRow}>
            <Text style={styles.title}>Властные группировки</Text>
            <View style={styles.chip}>
              <Crown size={14} color={theme.primary} />
              <Text style={styles.chipText}>сюзерен → вассал</Text>
            </View>
          </View>

          {renderAdminResultCard({
            theme,
            title: "Топ групп",
            data: powerGroupingsData,
            isLoading: powerGroupingsLoading,
            renderOk: (d) => {
              const groups = (d?.groups ?? []) as any[];
              return (
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderCell}>ГРУППА</Text>
                    <Text style={styles.tableHeaderCell}>КОНТАКТОВ</Text>
                  </View>

                  {groups.slice(0, 10).map((g) => {
                    const name = String(g.groupName ?? "");
                    const count = String(g.dossiersCount ?? 0);
                    return (
                      <View key={name} style={styles.tableRow} testID={`admin.analytics.power.top.${name}`}>
                        <Text style={styles.tableCellPrimary} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={styles.tableCell}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            },
          })}

          <View style={styles.threeColGrid} testID="admin.analytics.power.grid">
            <View style={styles.colCard} testID="admin.analytics.power.left">
              <Text style={styles.colTitle}>Контакты во властных группировках</Text>

              <View style={styles.searchRow}>
                <Search size={18} color={theme.primaryDim} />
                <TextInput
                  testID="admin.analytics.power.search"
                  value={powerPhoneSearch}
                  onChangeText={setPowerPhoneSearch}
                  placeholder="Поиск по телефону"
                  placeholderTextColor={theme.primaryDim}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={[styles.table, { marginTop: 12 }]} testID="admin.analytics.power.contactsTable">
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>КОНТАКТ</Text>
                  <Text style={styles.tableHeaderCell}>ГРУППА</Text>
                </View>

                {renderAdminResultInline({
                  data: powerContactsData,
                  isLoading: powerContactsLoading,
                  theme,
                }) ??
                  (((powerContactsData?.contacts ?? []) as AnalyticsContactLite[]) || [])
                    .slice(0, 120)
                    .map((c) => {
                      const isActive = powerSelectedContactId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          testID={`admin.analytics.power.contact.${c.id}`}
                          activeOpacity={0.78}
                          onPress={() => setPowerSelectedContactId(c.id)}
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
                            {c.groupName || "—"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
              </View>
            </View>

            <View style={styles.colCard} testID="admin.analytics.power.middle">
              <Text style={styles.colTitle}>Властные связи выбранного</Text>

              {renderAdminResultCard({
                theme,
                title: "Связанные контакты",
                data: powerRelatedData,
                isLoading: powerRelatedLoading,
                renderOk: (d) => {
                  const selected = d?.selected as AnalyticsContactLite | undefined;
                  const related = (d?.relatedContacts ?? []) as AnalyticsContactLite[];
                  const edges = (d?.edges ?? []) as AnalyticsPowerEdge[];

                  const label = selected
                    ? `${selected.name || selected.id} • ${selected.groupName || ""}`
                    : "—";

                  return (
                    <View style={{ gap: 10 }}>
                      <Text style={styles.muted}>Выбранный: {label}</Text>

                      <View style={styles.table}>
                        <View style={styles.tableHeader}>
                          <Text style={styles.tableHeaderCell}>КОНТАКТ</Text>
                          <Text style={styles.tableHeaderCell}>РОЛЬ</Text>
                        </View>

                        {related.slice(0, 120).map((c) => {
                          const isSelected = c.id === selected?.id;
                          const hasSuz = edges.some((e) => e.vassalId === c.id);
                          const hasVas = edges.some((e) => e.suzerainId === c.id);
                          const role = isSelected
                            ? "Выбран"
                            : hasSuz && hasVas
                              ? "Сюзерен/Вассал"
                              : hasVas
                                ? "Сюзерен"
                                : hasSuz
                                  ? "Вассал"
                                  : "—";

                          return (
                            <View
                              key={c.id}
                              style={[
                                styles.tableRow,
                                {
                                  backgroundColor: isSelected ? theme.background : theme.card,
                                },
                              ]}
                              testID={`admin.analytics.power.related.${c.id}`}
                            >
                              <Text style={styles.tableCellPrimary} numberOfLines={1}>
                                {c.name || c.id}
                              </Text>
                              <Text style={styles.tableCell} numberOfLines={1}>
                                {role}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                },
              })}
            </View>

            <View style={styles.colCard} testID="admin.analytics.power.right">
              <Text style={styles.colTitle}>Карта связей (дерево)</Text>

              {renderAdminResultCard({
                theme,
                title: "Дерево",
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
                    return <Text style={styles.muted}>Выберите контакт слева.</Text>;
                  }

                  return (
                    <View style={styles.kvBox} testID="admin.analytics.power.tree">
                      {roots.length > 0 ? (
                        roots.map((r) => renderNode(r, 0, new Set<string>()))
                      ) : (
                        <Text style={styles.muted}>Нет корней дерева (возможно цикл).</Text>
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

function AdminsPanel(props: {
  theme: any;
  data: any;
  isLoading: boolean;
  newAdminUsername: string;
  setNewAdminUsername: (v: string) => void;
  newAdminPassword: string;
  setNewAdminPassword: (v: string) => void;
  newAdminRole: AdminRole;
  setNewAdminRole: (v: AdminRole) => void;
  onCreate: () => void;
  pwdUsername: string;
  setPwdUsername: (v: string) => void;
  pwdNewPassword: string;
  setPwdNewPassword: (v: string) => void;
  onSetPassword: () => void;
  roleUsername: string;
  setRoleUsername: (v: string) => void;
  roleRole: AdminRole;
  setRoleRole: (v: AdminRole) => void;
  onSetRole: () => void;
  onDelete: (u: string) => void;
  busy: boolean;
}) {
  const {
    theme,
    data,
    isLoading,
    newAdminUsername,
    setNewAdminUsername,
    newAdminPassword,
    setNewAdminPassword,
    newAdminRole,
    setNewAdminRole,
    onCreate,
    pwdUsername,
    setPwdUsername,
    pwdNewPassword,
    setPwdNewPassword,
    onSetPassword,
    roleUsername,
    setRoleUsername,
    roleRole,
    setRoleRole,
    onSetRole,
    onDelete,
    busy,
  } = props;

  const styles = useMemo(() => panelStyles(theme), [theme]);

  return (
    <View style={styles.card} testID="admin.admins.card">
      <View style={styles.titleRow}>
        <Text style={styles.title}>Управление админами</Text>
        <View style={styles.chip}>
          <UserCog size={14} color={theme.primary} />
          <Text style={styles.chipText}>RBAC</Text>
        </View>
      </View>

      {renderAdminResultInline({ data, isLoading, theme }) ? (
        <View style={styles.resultBox} testID="admin.admins.inlineError">
          {renderAdminResultInline({ data, isLoading, theme })}
        </View>
      ) : null}

      <View style={styles.subCard} testID="admin.admins.create">
        <View style={styles.subCardTitleRow}>
          <UserPlus size={18} color={theme.primary} />
          <Text style={styles.subCardTitle}>Создать админа</Text>
        </View>

        <TextInput
          testID="admin.admins.create.username"
          value={newAdminUsername}
          onChangeText={setNewAdminUsername}
          placeholder="username"
          placeholderTextColor={theme.primaryDim}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          testID="admin.admins.create.password"
          value={newAdminPassword}
          onChangeText={setNewAdminPassword}
          placeholder="password"
          placeholderTextColor={theme.primaryDim}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <View style={styles.roleRow}>
          <RolePill
            theme={theme}
            label="analyst"
            active={newAdminRole === "analyst"}
            onPress={() => setNewAdminRole("analyst")}
            testID="admin.admins.create.role.analyst"
          />
          <RolePill
            theme={theme}
            label="manager"
            active={newAdminRole === "manager"}
            onPress={() => setNewAdminRole("manager")}
            testID="admin.admins.create.role.manager"
          />
          <RolePill
            theme={theme}
            label="admin"
            active={newAdminRole === "admin"}
            onPress={() => setNewAdminRole("admin")}
            testID="admin.admins.create.role.admin"
          />
        </View>

        <TouchableOpacity
          testID="admin.admins.create.submit"
          onPress={onCreate}
          activeOpacity={0.78}
          style={[styles.primaryBtn, { opacity: busy ? 0.6 : 1 }]}
          disabled={
            busy || newAdminUsername.trim().length < 3 || newAdminPassword.length < 6
          }
        >
          <Text style={styles.primaryBtnText}>Создать</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subCard} testID="admin.admins.password">
        <View style={styles.subCardTitleRow}>
          <KeyRound size={18} color={theme.primary} />
          <Text style={styles.subCardTitle}>Смена пароля</Text>
        </View>

        <TextInput
          testID="admin.admins.password.username"
          value={pwdUsername}
          onChangeText={setPwdUsername}
          placeholder="username"
          placeholderTextColor={theme.primaryDim}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          testID="admin.admins.password.newPassword"
          value={pwdNewPassword}
          onChangeText={setPwdNewPassword}
          placeholder="new password"
          placeholderTextColor={theme.primaryDim}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <TouchableOpacity
          testID="admin.admins.password.submit"
          onPress={onSetPassword}
          activeOpacity={0.78}
          style={[styles.primaryBtn, { opacity: busy ? 0.6 : 1 }]}
          disabled={busy || pwdUsername.trim().length < 1 || pwdNewPassword.length < 6}
        >
          <Text style={styles.primaryBtnText}>Обновить пароль</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subCard} testID="admin.admins.role">
        <View style={styles.subCardTitleRow}>
          <Crown size={18} color={theme.primary} />
          <Text style={styles.subCardTitle}>Роли</Text>
        </View>

        <TextInput
          testID="admin.admins.role.username"
          value={roleUsername}
          onChangeText={setRoleUsername}
          placeholder="username"
          placeholderTextColor={theme.primaryDim}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.roleRow}>
          <RolePill
            theme={theme}
            label="analyst"
            active={roleRole === "analyst"}
            onPress={() => setRoleRole("analyst")}
            testID="admin.admins.role.role.analyst"
          />
          <RolePill
            theme={theme}
            label="manager"
            active={roleRole === "manager"}
            onPress={() => setRoleRole("manager")}
            testID="admin.admins.role.role.manager"
          />
          <RolePill
            theme={theme}
            label="admin"
            active={roleRole === "admin"}
            onPress={() => setRoleRole("admin")}
            testID="admin.admins.role.role.admin"
          />
        </View>

        <TouchableOpacity
          testID="admin.admins.role.submit"
          onPress={onSetRole}
          activeOpacity={0.78}
          style={[styles.primaryBtn, { opacity: busy ? 0.6 : 1 }]}
          disabled={busy || roleUsername.trim().length < 1}
        >
          <Text style={styles.primaryBtnText}>Сохранить роль</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.table} testID="admin.admins.table">
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderCell}>USERNAME</Text>
          <Text style={styles.tableHeaderCell}>ROLE</Text>
          <Text style={styles.tableHeaderCell}>ACTION</Text>
        </View>

        {((data?.admins ?? []) as any[]).slice(0, 80).map((a) => {
          const u = String(a.username ?? "");
          const r = String(a.role ?? "-");
          return (
            <View key={u} style={styles.tableRow} testID={`admin.admins.row.${u}`}>
              <Text style={styles.tableCellPrimary} numberOfLines={1}>
                {u}
              </Text>
              <Text style={styles.tableCell}>{r}</Text>
              <TouchableOpacity
                testID={`admin.admins.delete.${u}`}
                onPress={() => onDelete(u)}
                activeOpacity={0.78}
                style={styles.iconBtn}
              >
                <Trash2 size={16} color={theme.danger} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
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
        tabStyles.btn,
        {
          opacity: disabled ? 0.45 : 1,
          borderColor: active ? theme.primary : theme.border,
          backgroundColor: active ? theme.card : theme.background,
        },
      ]}
    >
      <View style={tabStyles.btnTopRow}>
        <View style={tabStyles.btnIcon}>{icon}</View>
        <Text
          style={[
            tabStyles.btnText,
            { color: active ? theme.text : theme.textSecondary },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const tabStyles = StyleSheet.create({
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

function RolePill(props: {
  theme: any;
  label: AdminRole;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { theme, label, active, onPress, testID } = props;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.78}
      style={[
        pillStyles.pill,
        {
          borderColor: active ? theme.primary : theme.border,
          backgroundColor: active ? theme.card : theme.background,
        },
      ]}
    >
      <Text style={[pillStyles.pillText, { color: active ? theme.text : theme.textSecondary }]}> 
        {label.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "900" as const,
    letterSpacing: 1,
  },
});

function renderAdminResultInline(args: {
  data: any;
  isLoading: boolean;
  theme: any;
}): React.ReactNode | null {
  const { data, isLoading, theme } = args;

  if (isLoading) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: theme.textSecondary, fontWeight: "800" as const }}>
          Загрузка...
        </Text>
      </View>
    );
  }

  if (!data) return null;

  if (data.ok === false) {
    return <Text style={{ color: theme.danger }}>Ошибка: {String(data.error)}</Text>;
  }

  return null;
}

function renderAdminResultCard(args: {
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
      <View style={styles.resultBox} testID="admin.result.loading">
        <ActivityIndicator color={theme.primary} />
        <Text style={styles.muted}>Загрузка...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.resultBox} testID="admin.result.empty">
        <Text style={styles.muted}>Нет данных. Проверьте доступ и выбранного пользователя.</Text>
      </View>
    );
  }

  if (data.ok === false) {
    return (
      <View style={styles.resultBox} testID="admin.result.error">
        <Text style={styles.title}>{title}</Text>
        <Text style={{ color: theme.danger, fontWeight: "900" as const }}>
          Ошибка: {String(data.error)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.resultBox} testID="admin.result.ok">
      <Text style={styles.title}>{title}</Text>
      {renderOk(data)}
    </View>
  );
}

function KVRow(props: { theme: any; k: string; v: string }) {
  const { theme, k, v } = props;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Text
        style={{
          width: 100,
          color: theme.textSecondary,
          fontWeight: "900" as const,
          letterSpacing: 0.6,
          fontSize: 11,
        }}
      >
        {k}
      </Text>
      <Text style={{ flex: 1, color: theme.text, fontWeight: "800" as const }}>
        {v}
      </Text>
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
    metricsRow: {
      flexDirection: "row",
      gap: 10,
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
    subCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    subCardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    subCardTitle: {
      color: theme.text,
      fontWeight: "900" as const,
      letterSpacing: 0.6,
      fontSize: 13,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: theme.text,
      fontWeight: "800" as const,
    },
    roleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    primaryBtn: {
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: {
      color: theme.background,
      fontWeight: "900" as const,
      letterSpacing: 1,
    },
    iconBtn: {
      width: 40,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      borderRadius: 12,
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
    heroSubtitle: {
      color: theme.primaryDim,
      fontSize: 11,
      fontWeight: "900" as const,
      letterSpacing: 1.2,
      marginTop: 6,
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
    nav: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
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
  });
