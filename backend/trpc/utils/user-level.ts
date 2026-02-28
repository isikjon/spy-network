/**
 * Система уровней пользователей (ДОПУСК).
 *
 * Уровень 1 (бесплатный): реклама + макс 20 контактов
 * Уровень 2 (подписка 99 руб./неделя): без рекламы, безлимит контактов
 *
 * Ключ хранения: user:<phone>:level
 */

import { storeGet, storeSet } from "../../store";
import { chargeRenewal } from "../routes/payment";

export type UserLevel = 1 | 2;

export type UserLevelData = {
  level: UserLevel;
  /** Для уровня 2: дата окончания подписки */
  subscribedUntil: number | null;
  /** Когда уровень был установлен */
  updatedAt: number;
};

const MAX_CONTACTS_LEVEL_1 = 20;

function levelKey(phone: string): string {
  return `user:${phone}:level`;
}

/**
 * Получить уровень пользователя. По умолчанию — уровень 1.
 */
export async function getUserLevel(phone: string): Promise<UserLevelData> {
  const stored = await storeGet<UserLevelData>(levelKey(phone));

  if (!stored) {
    return {
      level: 1,
      subscribedUntil: null,
      updatedAt: Date.now(),
    };
  }

  // Проверяем: если подписка истекла — пробуем автопродление, иначе понижаем уровень
  if (stored.level === 2 && stored.subscribedUntil && Date.now() > stored.subscribedUntil) {
    console.log("[user-level] subscription expired, attempting auto-renewal", { phone });
    const renewed = await chargeRenewal(phone);
    if (renewed) {
      // Даём временный доступ на 1 час пока ЮКасса обрабатывает платёж
      const tempUntil = Date.now() + 60 * 60 * 1000;
      const tempData: UserLevelData = { level: 2, subscribedUntil: tempUntil, updatedAt: Date.now() };
      await storeSet(levelKey(phone), tempData);
      console.log("[user-level] auto-renewal initiated, temp access granted", { phone });
      return tempData;
    }
    const downgraded: UserLevelData = { level: 1, subscribedUntil: null, updatedAt: Date.now() };
    await storeSet(levelKey(phone), downgraded);
    console.log("[user-level] auto-renewal failed, downgraded to level 1", { phone });
    return downgraded;
  }

  return stored;
}

/**
 * Установить уровень пользователя.
 * Для уровня 2: subscribedUntil — timestamp окончания подписки.
 */
export async function setUserLevel(
  phone: string,
  level: UserLevel,
  subscribedUntil?: number,
): Promise<UserLevelData> {
  const data: UserLevelData = {
    level,
    subscribedUntil: level === 2 ? (subscribedUntil ?? Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
    updatedAt: Date.now(),
  };
  await storeSet(levelKey(phone), data);
  console.log("[user-level] set", { phone, level, subscribedUntil: data.subscribedUntil });
  return data;
}

/**
 * Проверить, может ли пользователь добавить ещё контакт.
 * Возвращает { allowed, currentCount, maxCount, level }.
 */
export async function checkContactLimit(
  phone: string,
  currentCount: number,
): Promise<{
  allowed: boolean;
  currentCount: number;
  maxCount: number | null;
  level: UserLevel;
}> {
  const levelData = await getUserLevel(phone);

  if (levelData.level >= 2) {
    return {
      allowed: true,
      currentCount,
      maxCount: null, // безлимит
      level: levelData.level,
    };
  }

  return {
    allowed: currentCount < MAX_CONTACTS_LEVEL_1,
    currentCount,
    maxCount: MAX_CONTACTS_LEVEL_1,
    level: levelData.level,
  };
}

export { MAX_CONTACTS_LEVEL_1 };
