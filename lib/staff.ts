import Constants from "expo-constants";

/** Вторая веб-сборка (секретный URL) с пунктами админки и аналитики в профиле */
export function isStaffWebBuild(): boolean {
  const v = Constants.expoConfig?.extra?.enableStaffMenu;
  return v === true || v === "true";
}
