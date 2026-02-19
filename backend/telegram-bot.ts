import * as fs from "fs";
import { storeGet, storeSet } from "./store";

const BOT_TOKEN = "8253107481:AAFk7Cw1nUeCHN2RhxghBhO9L_9LvBN3d5g";
const ACCESS_CODE = "SNB-4F8K-X2QZ-7WPM";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const SUBSCRIBERS_KEY = "system:telegram_backup_subscribers";
const POLL_INTERVAL_MS = 3000;

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

type Subscriber = {
  chatId: number;
  username: string;
  firstName: string;
  subscribedAt: number;
};

let pollOffset = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

async function tgApi(method: string, body?: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function getSubscribers(): Promise<Subscriber[]> {
  const subs = await storeGet<Subscriber[]>(SUBSCRIBERS_KEY);
  return Array.isArray(subs) ? subs : [];
}

async function saveSubscribers(subs: Subscriber[]): Promise<void> {
  await storeSet(SUBSCRIBERS_KEY, subs);
}

async function addSubscriber(chatId: number, username: string, firstName: string): Promise<boolean> {
  const subs = await getSubscribers();
  if (subs.some((s) => s.chatId === chatId)) return false;
  subs.push({ chatId, username, firstName, subscribedAt: Date.now() });
  await saveSubscribers(subs);
  return true;
}

async function removeSubscriber(chatId: number): Promise<boolean> {
  const subs = await getSubscribers();
  const filtered = subs.filter((s) => s.chatId !== chatId);
  if (filtered.length === subs.length) return false;
  await saveSubscribers(filtered);
  return true;
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  try {
    await tgApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
  } catch (e) {
    console.error("[telegram] sendMessage failed", chatId, e);
  }
}

async function handleMessage(msg: any): Promise<void> {
  const chatId = msg?.chat?.id;
  const text = (msg?.text || "").trim();
  const username = msg?.from?.username || "";
  const firstName = msg?.from?.first_name || "";

  if (!chatId || !text) return;

  if (text === "/start") {
    await sendMessage(
      chatId,
      "🔐 <b>Spy Network — Backup Bot</b>\n\n" +
        "Для получения автоматических бэкапов базы данных, отправьте код доступа.\n\n" +
        "Команды:\n" +
        "/status — статус подписки\n" +
        "/stop — отменить подписку",
    );
    return;
  }

  if (text === "/stop") {
    const removed = await removeSubscriber(chatId);
    if (removed) {
      await sendMessage(chatId, "❌ Подписка на бэкапы отменена.");
      console.log("[telegram] unsubscribed", chatId, username);
    } else {
      await sendMessage(chatId, "Вы не были подписаны.");
    }
    return;
  }

  if (text === "/status") {
    const subs = await getSubscribers();
    const isSub = subs.some((s) => s.chatId === chatId);
    if (isSub) {
      await sendMessage(chatId, "✅ Вы подписаны на бэкапы.\nОни приходят каждые 4 часа.");
    } else {
      await sendMessage(chatId, "❌ Вы не подписаны. Отправьте код доступа.");
    }
    return;
  }

  if (text === ACCESS_CODE) {
    const added = await addSubscriber(chatId, username, firstName);
    if (added) {
      await sendMessage(
        chatId,
        "✅ <b>Подписка активирована!</b>\n\n" +
          "Бэкапы базы данных будут приходить каждые 4 часа.\n" +
          "Формат: <code>ДД_Месяц_ГГГГ_ЧЧ-ММ.sqlite</code>\n\n" +
          "/stop — отменить подписку",
      );
      console.log("[telegram] new subscriber", chatId, username, firstName);
    } else {
      await sendMessage(chatId, "✅ Вы уже подписаны на бэкапы.");
    }
    return;
  }

  await sendMessage(chatId, "⛔ Неверный код доступа. Попробуйте ещё раз.");
}

async function pollUpdates(): Promise<void> {
  try {
    const data = await tgApi("getUpdates", {
      offset: pollOffset,
      timeout: 10,
      allowed_updates: ["message"],
    });

    if (data?.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        pollOffset = update.update_id + 1;
        if (update.message) {
          await handleMessage(update.message);
        }
      }
    }
  } catch (e) {
    console.error("[telegram] poll error", e);
  }

  pollTimer = setTimeout(pollUpdates, POLL_INTERVAL_MS);
}

export function startTelegramBot(): void {
  console.log("[telegram] bot started, access code:", ACCESS_CODE);
  pollUpdates();
}

export function stopTelegramBot(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

export function formatBackupName(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const month = MONTHS_RU[date.getMonth()];
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${d}_${month}_${y}_${h}-${min}.sqlite`;
}

export async function sendBackupToSubscribers(filePath: string): Promise<void> {
  const subs = await getSubscribers();
  if (subs.length === 0) {
    console.log("[telegram] no subscribers, skipping send");
    return;
  }

  if (!fs.existsSync(filePath)) {
    console.error("[telegram] backup file not found", filePath);
    return;
  }

  const fileName = formatBackupName(new Date());
  const stats = fs.statSync(filePath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`[telegram] sending backup to ${subs.length} subscribers: ${fileName} (${sizeMb}MB)`);

  const fileBuffer = fs.readFileSync(filePath);
  const caption = `📦 <b>Backup</b>\n📁 ${fileName}\n💾 ${sizeMb} MB\n🕐 ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

  for (const sub of subs) {
    try {
      const form = new FormData();
      form.append("chat_id", String(sub.chatId));
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
      form.append("document", new Blob([fileBuffer]), fileName);

      const res = await fetch(`${API}/sendDocument`, { method: "POST", body: form });
      const data = (await res.json()) as any;

      if (!data.ok) {
        console.error("[telegram] sendDocument failed for", sub.chatId, data.description);
        if (data.error_code === 403) {
          await removeSubscriber(sub.chatId);
          console.log("[telegram] removed blocked subscriber", sub.chatId);
        }
      }
    } catch (e) {
      console.error("[telegram] sendDocument error for", sub.chatId, e);
    }
  }
}
