import { Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Crown,
  KeyRound,
  Lock,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { useApp } from "@/contexts/AppContext";
import { isAdminPhone } from "@/constants/adminAccess";
import type { Language } from "@/constants/locales";

const STORAGE_ADMIN_TOKEN_KEY = "admin_auth_token" as const;

type AdminRole = "admin" | "manager" | "analyst";

type AdminCopy = {
  title: string;
  subtitle: string;
  serverControl: string;
  login: string;
  reset: string;
  adminUsername: string;
  adminPassword: string;
  adminsManagement: string;
  authNotConfigured: string;
  requiredEnv: string;
  loginError: string;
  accessDenied: string;
  invalidCredentials: string;
  createAdmin: string;
  create: string;
  changePassword: string;
  updatePassword: string;
  roles: string;
  saveRole: string;
  loading: string;
  error: string;
  deleteAdminTitle: string;
  cancel: string;
  delete: string;
  failedCreateAdmin: string;
  failedUpdatePassword: string;
  failedUpdateRole: string;
  failedDeleteAdmin: string;
  accessDeniedPhone: string;
};

const ADMIN_COPY: Record<Language, AdminCopy> = {
  ru: {
    title: "АДМИН-ПАНЕЛЬ",
    subtitle: "УПРАВЛЕНИЕ АДМИНАМИ",
    serverControl: "SERVER CONTROL",
    login: "LOGIN",
    reset: "RESET",
    adminUsername: "ADMIN USERNAME",
    adminPassword: "ADMIN PASSWORD",
    adminsManagement: "УПРАВЛЕНИЕ АДМИНАМИ",
    authNotConfigured: "ADMIN AUTH НЕ НАСТРОЕНА",
    requiredEnv: "Нужны env: RORK_ADMIN_AUTH_SECRET, RORK_ADMIN_DEFAULT_USERNAME, RORK_ADMIN_DEFAULT_PASSWORD",
    loginError: "ОШИБКА ВХОДА",
    accessDenied: "ДОСТУП ЗАПРЕЩЕН",
    invalidCredentials: "Неверный логин/пароль или истекла сессия.",
    createAdmin: "Создать админа",
    create: "Создать",
    changePassword: "Смена пароля",
    updatePassword: "Обновить пароль",
    roles: "Роли",
    saveRole: "Сохранить роль",
    loading: "Загрузка...",
    error: "Ошибка",
    deleteAdminTitle: "Удалить админа?",
    cancel: "Отмена",
    delete: "Удалить",
    failedCreateAdmin: "Не удалось создать админа",
    failedUpdatePassword: "Не удалось обновить пароль",
    failedUpdateRole: "Не удалось обновить роль",
    failedDeleteAdmin: "Не удалось удалить админа",
    accessDeniedPhone: "Доступ запрещён для вашего номера телефона.",
  },
  en: {
    title: "ADMIN PANEL",
    subtitle: "ADMIN MANAGEMENT",
    serverControl: "SERVER CONTROL",
    login: "LOGIN",
    reset: "RESET",
    adminUsername: "ADMIN USERNAME",
    adminPassword: "ADMIN PASSWORD",
    adminsManagement: "ADMIN MANAGEMENT",
    authNotConfigured: "ADMIN AUTH IS NOT CONFIGURED",
    requiredEnv: "Required env vars: RORK_ADMIN_AUTH_SECRET, RORK_ADMIN_DEFAULT_USERNAME, RORK_ADMIN_DEFAULT_PASSWORD",
    loginError: "LOGIN ERROR",
    accessDenied: "ACCESS DENIED",
    invalidCredentials: "Invalid username/password or session expired.",
    createAdmin: "Create admin",
    create: "Create",
    changePassword: "Change password",
    updatePassword: "Update password",
    roles: "Roles",
    saveRole: "Save role",
    loading: "Loading...",
    error: "Error",
    deleteAdminTitle: "Delete admin?",
    cancel: "Cancel",
    delete: "Delete",
    failedCreateAdmin: "Failed to create admin",
    failedUpdatePassword: "Failed to update password",
    failedUpdateRole: "Failed to update role",
    failedDeleteAdmin: "Failed to delete admin",
    accessDeniedPhone: "Access denied for your phone number.",
  },
};

export default function AdminScreen() {
  const { theme, phoneNumber, currentLanguage } = useApp();
  const copy = ADMIN_COPY[currentLanguage];
  const styles = useMemo(() => createStyles(theme), [theme]);

  const hasAccess = isAdminPhone(phoneNumber);

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [adminToken, setAdminToken] = useState<string>("");

  const [newAdminUsername, setNewAdminUsername] = useState<string>("");
  const [newAdminPassword, setNewAdminPassword] = useState<string>("");
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>("analyst");

  const [pwdUsername, setPwdUsername] = useState<string>("");
  const [pwdNewPassword, setPwdNewPassword] = useState<string>("");

  const [roleUsername, setRoleUsername] = useState<string>("");
  const [roleRole, setRoleRole] = useState<AdminRole>("analyst");

  const statusQuery = trpc.adminAuth.status.useQuery(undefined, { enabled: hasAccess });
  const meQuery = trpc.adminAuth.me.useQuery(undefined, {
    enabled: hasAccess && adminToken.length > 0,
    staleTime: 10_000,
  });

  const loginMutation = trpc.adminAuth.login.useMutation();

  const adminsListQuery = trpc.admin.adminList.useQuery(undefined, {
    enabled: hasAccess && adminToken.length > 0,
  });

  const adminCreateMutation = trpc.admin.adminCreate.useMutation();
  const adminSetPasswordMutation = trpc.admin.adminSetPassword.useMutation();
  const adminSetRoleMutation = trpc.admin.adminSetRole.useMutation();
  const adminDeleteMutation = trpc.admin.adminDelete.useMutation();

  useEffect(() => {
    if (!hasAccess) return;
    AsyncStorage.getItem(STORAGE_ADMIN_TOKEN_KEY)
      .then((t) => {
        if (t) setAdminToken(t);
      })
      .catch((e) => console.log("[admin] failed to load admin token", e));
  }, [hasAccess]);

  const forbidden =
    (adminsListQuery.data &&
      (adminsListQuery.data as any).ok === false &&
      (adminsListQuery.data as any).error === "FORBIDDEN") ||
    (meQuery.data &&
      (meQuery.data as any).ok === false &&
      (meQuery.data as any).error === "UNAUTHENTICATED");

  const handleReset = useCallback(() => {
    setAdminToken("");
    setUsername("");
    setPassword("");
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

  const handleAdminCreate = useCallback(async () => {
    try {
      const res = await adminCreateMutation.mutateAsync({
        username: newAdminUsername.trim(),
        password: newAdminPassword,
        role: newAdminRole,
      });
      if (!res.ok) {
        Alert.alert(copy.error, String((res as any).error ?? "CREATE_FAILED"));
        return;
      }
      setNewAdminUsername("");
      setNewAdminPassword("");
      setNewAdminRole("analyst");
      await adminsListQuery.refetch();
    } catch (e) {
      console.log("[admin] create admin failed", e);
      Alert.alert(copy.error, copy.failedCreateAdmin);
    }
  }, [adminCreateMutation, adminsListQuery, copy, newAdminPassword, newAdminRole, newAdminUsername]);

  const handleAdminSetPassword = useCallback(async () => {
    try {
      const res = await adminSetPasswordMutation.mutateAsync({
        username: pwdUsername.trim(),
        newPassword: pwdNewPassword,
      });
      if (!res.ok) {
        Alert.alert(copy.error, String((res as any).error ?? "SET_PASSWORD_FAILED"));
        return;
      }
      setPwdUsername("");
      setPwdNewPassword("");
      await adminsListQuery.refetch();
    } catch (e) {
      console.log("[admin] set password failed", e);
      Alert.alert(copy.error, copy.failedUpdatePassword);
    }
  }, [adminSetPasswordMutation, adminsListQuery, copy, pwdNewPassword, pwdUsername]);

  const handleAdminSetRole = useCallback(async () => {
    try {
      const res = await adminSetRoleMutation.mutateAsync({
        username: roleUsername.trim(),
        role: roleRole,
      });
      if (!res.ok) {
        Alert.alert(copy.error, String((res as any).error ?? "SET_ROLE_FAILED"));
        return;
      }
      setRoleUsername("");
      setRoleRole("analyst");
      await adminsListQuery.refetch();
    } catch (e) {
      console.log("[admin] set role failed", e);
      Alert.alert(copy.error, copy.failedUpdateRole);
    }
  }, [adminSetRoleMutation, adminsListQuery, copy, roleRole, roleUsername]);

  const handleAdminDelete = useCallback(
    async (u: string) => {
      Alert.alert(copy.deleteAdminTitle, u, [
        { text: copy.cancel, style: "cancel" },
        {
          text: copy.delete,
          style: "destructive",
          onPress: async () => {
            try {
              const res = await adminDeleteMutation.mutateAsync({ username: u });
              if (!res.ok) {
                Alert.alert(copy.error, String((res as any).error ?? "DELETE_FAILED"));
                return;
              }
              await adminsListQuery.refetch();
            } catch (e) {
              console.log("[admin] delete admin failed", e);
              Alert.alert(copy.error, copy.failedDeleteAdmin);
            }
          },
        },
      ]);
    },
    [adminDeleteMutation, adminsListQuery, copy],
  );

  const anyLoading =
    loginMutation.isPending ||
    adminsListQuery.isFetching ||
    adminCreateMutation.isPending ||
    adminSetPasswordMutation.isPending ||
    adminSetRoleMutation.isPending ||
    adminDeleteMutation.isPending;

  if (!hasAccess) {
    return (
      <View style={styles.screen} testID="admin.denied">
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
    <View style={styles.screen} testID="admin.screen">
      <Stack.Screen
        options={{
          title: copy.title,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />

      <View style={styles.hero} testID="admin.hero">
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
        <Text style={styles.heroSubtitle}>{copy.subtitle}</Text>

        <View style={styles.tokenRow}>
          <Lock size={18} color={theme.primaryDim} />
          <TextInput
            testID="admin.usernameInput"
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
            testID="admin.passwordInput"
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
            testID="admin.login"
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
            testID="admin.reset"
            onPress={handleReset}
            activeOpacity={0.75}
            style={styles.resetBtn}
          >
            <Text style={styles.resetBtnText}>{copy.reset}</Text>
          </TouchableOpacity>
        </View>

        {statusQuery.data && (statusQuery.data as any).enabled === false ? (
          <View style={styles.alertDanger} testID="admin.notConfigured">
            <Text style={styles.alertDangerTitle}>{copy.authNotConfigured}</Text>
            <Text style={styles.alertDangerText}>{copy.requiredEnv}</Text>
          </View>
        ) : null}

        {loginMutation.data && (loginMutation.data as any).ok === false ? (
          <View style={styles.alertDanger} testID="admin.loginError">
            <Text style={styles.alertDangerTitle}>{copy.loginError}</Text>
            <Text style={styles.alertDangerText}>
              {String((loginMutation.data as any).error ?? "LOGIN_FAILED")}
            </Text>
          </View>
        ) : null}

        {adminToken.length > 0 && forbidden ? (
          <View style={styles.alertDanger} testID="admin.forbidden">
            <Text style={styles.alertDangerTitle}>{copy.accessDenied}</Text>
            <Text style={styles.alertDangerText}>{copy.invalidCredentials}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        testID="admin.scroll"
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionHeaderText}>{copy.adminsManagement}</Text>
          </View>
          {anyLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <View style={styles.okDot} />
          )}
        </View>

        {adminToken.length > 0 ? (
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
            copy={copy}
          />
        ) : null}

        <View style={styles.footerSpacer} />
      </ScrollView>
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
  copy: AdminCopy;
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
    copy,
  } = props;

  const styles = useMemo(() => panelStyles(theme), [theme]);

  return (
    <View style={styles.card} testID="admin.admins.card">
      <View style={styles.titleRow}>
        <Text style={styles.title}>{copy.adminsManagement}</Text>
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
          <Text style={styles.subCardTitle}>{copy.createAdmin}</Text>
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
          <RolePill theme={theme} label="analyst" active={newAdminRole === "analyst"} onPress={() => setNewAdminRole("analyst")} testID="admin.admins.create.role.analyst" />
          <RolePill theme={theme} label="manager" active={newAdminRole === "manager"} onPress={() => setNewAdminRole("manager")} testID="admin.admins.create.role.manager" />
          <RolePill theme={theme} label="admin" active={newAdminRole === "admin"} onPress={() => setNewAdminRole("admin")} testID="admin.admins.create.role.admin" />
        </View>

        <TouchableOpacity
          testID="admin.admins.create.submit"
          onPress={onCreate}
          activeOpacity={0.78}
          style={[styles.primaryBtn, { opacity: busy ? 0.6 : 1 }]}
          disabled={busy || newAdminUsername.trim().length < 3 || newAdminPassword.length < 6}
        >
          <Text style={styles.primaryBtnText}>{copy.create}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subCard} testID="admin.admins.password">
        <View style={styles.subCardTitleRow}>
          <KeyRound size={18} color={theme.primary} />
          <Text style={styles.subCardTitle}>{copy.changePassword}</Text>
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
          <Text style={styles.primaryBtnText}>{copy.updatePassword}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subCard} testID="admin.admins.role">
        <View style={styles.subCardTitleRow}>
          <Crown size={18} color={theme.primary} />
          <Text style={styles.subCardTitle}>{copy.roles}</Text>
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
          <RolePill theme={theme} label="analyst" active={roleRole === "analyst"} onPress={() => setRoleRole("analyst")} testID="admin.admins.role.role.analyst" />
          <RolePill theme={theme} label="manager" active={roleRole === "manager"} onPress={() => setRoleRole("manager")} testID="admin.admins.role.role.manager" />
          <RolePill theme={theme} label="admin" active={roleRole === "admin"} onPress={() => setRoleRole("admin")} testID="admin.admins.role.role.admin" />
        </View>

        <TouchableOpacity
          testID="admin.admins.role.submit"
          onPress={onSetRole}
          activeOpacity={0.78}
          style={[styles.primaryBtn, { opacity: busy ? 0.6 : 1 }]}
          disabled={busy || roleUsername.trim().length < 1}
        >
          <Text style={styles.primaryBtnText}>{copy.saveRole}</Text>
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
              <Text style={styles.tableCellPrimary} numberOfLines={1}>{u}</Text>
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
    resultBox: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 14,
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
