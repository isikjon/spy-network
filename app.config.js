/* eslint-disable @typescript-eslint/no-require-imports */
const appJson = require("./app.json");

/**
 * EXPO_PUBLIC_WEB_BASE_PATH: базовый путь веба (/app публично, /lkdj7djdjhg для staff)
 * EXPO_PUBLIC_ENABLE_STAFF_MENU: true только во второй сборке dist-staff
 */
module.exports = () => {
  const webBasePath = process.env.EXPO_PUBLIC_WEB_BASE_PATH || "/app";
  const enableStaffMenu = process.env.EXPO_PUBLIC_ENABLE_STAFF_MENU === "true";
  const apiUrl =
    process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
    appJson.expo.extra?.EXPO_PUBLIC_RORK_API_BASE_URL ||
    "https://spynetwork.ru";

  return {
    expo: {
      ...appJson.expo,
      experiments: {
        ...appJson.expo.experiments,
        baseUrl: webBasePath,
      },
      extra: {
        ...appJson.expo.extra,
        EXPO_PUBLIC_RORK_API_BASE_URL: apiUrl,
        enableStaffMenu,
        webBasePath,
      },
    },
  };
};
