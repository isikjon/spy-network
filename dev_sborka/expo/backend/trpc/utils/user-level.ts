import { storeGet, storeSet } from "../../store";
import { chargeRenewal } from "../routes/payment";

export type UserLevel = 1 | 2;

export type UserLevelData = {
  level: UserLevel;
  subscribedUntil: number | null;
  updatedAt: number;
};

const MAX_CONTACTS_LEVEL_1 = 20;

function levelKey(uid: string): string {
  return `user:${uid}:level`;
}

export async function getUserLevel(uid: string): Promise<UserLevelData> {
  const stored = await storeGet<UserLevelData>(levelKey(uid));

  if (!stored) {
    return {
      level: 1,
      subscribedUntil: null,
      updatedAt: Date.now(),
    };
  }

  if (stored.level === 2 && stored.subscribedUntil && Date.now() > stored.subscribedUntil) {
    console.log("[user-level] subscription expired, attempting auto-renewal", { uid });
    const renewed = await chargeRenewal(uid);
    if (renewed) {
      const tempUntil = Date.now() + 60 * 60 * 1000;
      const tempData: UserLevelData = { level: 2, subscribedUntil: tempUntil, updatedAt: Date.now() };
      await storeSet(levelKey(uid), tempData);
      console.log("[user-level] auto-renewal initiated, temp access granted", { uid });
      return tempData;
    }
    const downgraded: UserLevelData = { level: 1, subscribedUntil: null, updatedAt: Date.now() };
    await storeSet(levelKey(uid), downgraded);
    console.log("[user-level] auto-renewal failed, downgraded to level 1", { uid });
    return downgraded;
  }

  return stored;
}

export async function setUserLevel(
  uid: string,
  level: UserLevel,
  subscribedUntil?: number,
): Promise<UserLevelData> {
  const data: UserLevelData = {
    level,
    subscribedUntil: level === 2 ? (subscribedUntil ?? Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
    updatedAt: Date.now(),
  };
  await storeSet(levelKey(uid), data);
  console.log("[user-level] set", { uid, level, subscribedUntil: data.subscribedUntil });
  return data;
}

export async function checkContactLimit(
  uid: string,
  currentCount: number,
): Promise<{
  allowed: boolean;
  currentCount: number;
  maxCount: number | null;
  level: UserLevel;
}> {
  const levelData = await getUserLevel(uid);

  if (levelData.level >= 2) {
    return {
      allowed: true,
      currentCount,
      maxCount: null,
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
