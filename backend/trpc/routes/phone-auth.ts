import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "../create-context";
import { plusofonCallToAuth } from "../utils/plusofon";
import { createUserSession, deleteUserSession } from "../utils/user-session";
import { storeGet, storeSet, storeDelete } from "../../store";

/**
 * Обратный Flash Call — полный флоу:
 *
 * 1. Пользователь вводит номер → app вызывает requestCall
 * 2. Бэкенд отправляет POST call-to-auth в Plusofon
 * 3. Plusofon шлёт ПЕРВЫЙ вебхук → мы получаем номер для звонка (displayPhone)
 * 4. App поллит checkStatus → видит displayPhone → показывает пользователю
 * 5. Пользователь звонит на номер
 * 6. Plusofon шлёт ВТОРОЙ вебхук → подтверждение звонка → verified = true
 * 7. App поллит checkStatus → видит verified → получает токен сессии
 */

/**
 * Pending-авторизация.
 * Ключ: auth:pending:<phone>
 */
type PendingAuth = {
  userPhone: string;
  /** Номер для звонка — приходит через вебхук от Plusofon */
  displayPhone: string | null;
  /** Ключ проверки — приходит через вебхук от Plusofon */
  key: string | null;
  /** Звонок подтверждён — приходит через второй вебхук */
  verified: boolean;
  createdAt: number;
  expiresAt: number;
};

const PENDING_TTL_MS = 5 * 60 * 1000; // 5 минут

/**
 * Тестовый номер для модерации сторов.
 * Авторизация проходит автоматически без звонка.
 */
const TEST_PHONE = "71111111111"; // +7 111 111 11-11

function pendingKey(phone: string): string {
  return `auth:pending:${phone}`;
}

/**
 * Нормализация номера: убираем +, пробелы, скобки, дефисы.
 * Результат: 79XXXXXXXXX
 */
function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }
  if (digits.length === 10) {
    digits = "7" + digits;
  }
  return digits;
}

/**
 * Получить webhook URL.
 */
function getWebhookUrl(): string {
  const envUrl = process.env.WEBHOOK_BASE_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, "")}/auth/webhook/plusofon`;
  return "https://spynetwork.ru/auth/webhook/plusofon";
}

export const phoneAuthRouter = createTRPCRouter({
  /**
   * Шаг 1: Запросить обратный Flash Call.
   * Plusofon примет запрос. Номер для звонка придёт через вебхук.
   */
  requestCall: publicProcedure
    .input(z.object({ phone: z.string().min(10) }))
    .mutation(async ({ input }) => {
      const phone = normalizePhone(input.phone);

      if (phone.length < 11) {
        return { ok: false as const, error: "INVALID_PHONE" as const };
      }

      // Тестовый номер — мгновенная авторизация без Plusofon
      if (phone === TEST_PHONE) {
        console.log("[phone-auth] TEST PHONE — auto-verifying");
        const pending: PendingAuth = {
          userPhone: phone,
          displayPhone: "8-111-111-11-11",
          key: "test-key",
          verified: true, // сразу verified
          createdAt: Date.now(),
          expiresAt: Date.now() + PENDING_TTL_MS,
        };
        await storeSet(pendingKey(phone), pending);

        // Генерируем демо-данные если их ещё нет
        await ensureTestData(phone);

        return {
          ok: true as const,
          status: "requested" as const,
          phone,
          displayPhone: "8-111-111-11-11",
        };
      }

      // Антиспам: не чаще раза в 60 сек
      const existing = await storeGet<PendingAuth>(pendingKey(phone));
      if (existing && Date.now() < existing.expiresAt) {
        const secondsAgo = Math.floor((Date.now() - existing.createdAt) / 1000);
        if (secondsAgo < 60) {
          return {
            ok: true as const,
            status: "already_requested" as const,
            phone,
            retryAfter: 60 - secondsAgo,
            displayPhone: existing.displayPhone,
          };
        }
      }

      // Вызываем Plusofon
      const webhookUrl = getWebhookUrl();
      console.log("[phone-auth] requesting call-to-auth", { phone, webhookUrl });
      const result = await plusofonCallToAuth(phone, webhookUrl);

      if (!result.ok) {
        const errMsg = (result as { ok: false; error: string }).error;
        console.error("[phone-auth] plusofon callToAuth failed", errMsg);
        return { ok: false as const, error: "SEND_FAILED" as const, detail: errMsg };
      }

      // Номер для звонка пришёл сразу в ответе API!
      const displayPhone = (result as { ok: true; displayPhone: string }).displayPhone;
      const key = (result as { ok: true; key: string }).key;

      // Форматируем номер: 79675180075 → 8-967-518-00-75
      let formattedPhone = displayPhone;
      const digits = displayPhone.replace(/[^0-9]/g, "");
      if (digits.length === 11) {
        formattedPhone = `8-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
      }

      const pending: PendingAuth = {
        userPhone: phone,
        displayPhone: formattedPhone,
        key,
        verified: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + PENDING_TTL_MS,
      };
      await storeSet(pendingKey(phone), pending);

      return {
        ok: true as const,
        status: "requested" as const,
        phone,
        displayPhone: formattedPhone,
      };
    }),

  /**
   * Шаг 2: Проверить статус авторизации.
   * App поллит каждые 2-3 секунды.
   *
   * Возможные статусы:
   * - waiting_call: номер получен, ждём звонок от пользователя
   * - verified: звонок подтверждён, вот токен
   * - expired / not_found: ошибка
   */
  checkStatus: publicProcedure
    .input(z.object({ phone: z.string().min(10) }))
    .query(async ({ input }) => {
      const phone = normalizePhone(input.phone);
      const pending = await storeGet<PendingAuth>(pendingKey(phone));

      if (!pending) {
        return { ok: false as const, error: "NOT_FOUND" as const };
      }

      if (Date.now() > pending.expiresAt) {
        await storeDelete(pendingKey(phone));
        return { ok: false as const, error: "EXPIRED" as const };
      }

      // Номер есть, но звонок ещё не подтверждён
      if (!pending.verified) {
        return {
          ok: false as const,
          error: "WAITING_CALL" as const,
          displayPhone: pending.displayPhone,
        };
      }

      // Верифицирован! Создаём сессию и демо-данные если нужно.
      await storeDelete(pendingKey(phone));
      const session = await createUserSession(phone);
      await ensureTestData(phone);

      return {
        ok: true as const,
        token: session.token,
        phone: session.phone,
        expiresAt: session.expiresAt,
      };
    }),

  /**
   * Получить текущую сессию.
   */
  me: publicProcedure.query(async ({ ctx }) => {
    const phone = ctx.userPhone;
    if (!phone) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }
    return { ok: true as const, phone };
  }),

  /**
   * Выйти (удалить сессию).
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get("x-user-auth");
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token) {
        await deleteUserSession(token);
      }
    }
    return { ok: true as const };
  }),
});

/**
 * Генерация демо-данных для нового пользователя.
 * Вызывается для всех новых пользователей при первой авторизации.
 */
async function ensureTestData(phone: string) {
  const dataKey = `user:${phone}:data`;
  const existing = await storeGet(dataKey);
  if (existing) return; // данные уже есть

  console.log("[phone-auth] generating demo data for new user", phone);

  const now = Date.now();
  const day = 86400000;

  const demoData = {
    phoneNumber: phone,
    dossiers: [
      {
        contact: {
          id: "demo-1",
          name: "Иванов Алексей Петрович",
          phoneNumbers: ["+7 900 123-45-67"],
          emails: ["ivanov@company.ru"],
          company: "ООО «Альфа Групп»",
          position: "Генеральный директор",
          goal: "Стратегическое партнёрство",
          notes: "Ключевой контакт для выхода на рынок B2B. Предпочитает личные встречи.",
        },
        sectors: ["business"],
        functionalCircle: "productivity" as const,
        importance: "critical" as const,
        relations: [
          { contactId: "demo-2", strength: 85 },
          { contactId: "demo-3", strength: 60 },
          { contactId: "demo-4", strength: 50 },
          { contactId: "demo-5", strength: 40 },
        ],
        diary: [
          { id: "d1", date: new Date(now - 3 * day), type: "manual" as const, content: "Встреча в офисе. Обсудили условия контракта на Q2." },
          { id: "d2", date: new Date(now - 10 * day), type: "manual" as const, content: "Звонок. Договорились о встрече на следующей неделе." },
          { id: "d1a", date: new Date(now - 2 * day), type: "manual" as const, content: "1. Что сделать для развития отношений?\nПлан:\nРезультат:\n\n2. Как узнать о человеке больше\nПлан:\nРезультат:\n\n3. Что я могу дать?\nПлан:\nРезультат:\n\n4. Что попросить?\nПлан:\nРезультат:\n\n5. Как обеспечить следующую встречу?\nПлан:\nРезультат:" },
        ],
        addedDate: new Date(now - 30 * day),
        lastInteraction: new Date(now - 2 * day),
        powerGrouping: { groupName: "Альфа Групп", vassalIds: ["demo-2", "demo-3", "demo-4"] },
      },
      {
        contact: {
          id: "demo-2",
          name: "Петрова Мария Сергеевна",
          phoneNumbers: ["+7 916 234-56-78"],
          emails: ["petrova@alphagroup.ru"],
          company: "ООО «Альфа Групп»",
          position: "Финансовый директор",
          goal: "Согласование бюджета проекта",
          notes: "Отвечает за финансовые решения. Аналитический склад ума.",
        },
        sectors: ["business"],
        functionalCircle: "development" as const,
        importance: "high" as const,
        relations: [{ contactId: "demo-1", strength: 85 }],
        diary: [
          { id: "d3", date: new Date(now - 5 * day), type: "manual" as const, content: "Отправлены финансовые документы на согласование." },
          { id: "d3a", date: new Date(now - 4 * day), type: "manual" as const, content: "1. Что сделать для развития отношений?\nПлан:\nРезультат:\n\n2. Как узнать о человеке больше\nПлан:\nРезультат:\n\n3. Что я могу дать?\nПлан:\nРезультат:\n\n4. Что попросить?\nПлан:\nРезультат:\n\n5. Как обеспечить следующую встречу?\nПлан:\nРезультат:" },
        ],
        addedDate: new Date(now - 25 * day),
        lastInteraction: new Date(now - 4 * day),
        powerGrouping: { groupName: "Альфа Групп", suzerainId: "demo-1", vassalIds: [] },
      },
      {
        contact: {
          id: "demo-3",
          name: "Сидоров Дмитрий Олегович",
          phoneNumbers: ["+7 925 345-67-89"],
          emails: ["sidorov@techstart.io"],
          company: "TechStart",
          position: "CTO",
          goal: "Техническая интеграция",
          notes: "Отвечает за техническую часть. Быстро принимает решения.",
        },
        sectors: ["business", "other"],
        functionalCircle: "development" as const,
        importance: "high" as const,
        relations: [
          { contactId: "demo-1", strength: 60 },
          { contactId: "demo-6", strength: 75 },
        ],
        diary: [
          { id: "d4", date: new Date(now - 7 * day), type: "manual" as const, content: "Созвон по API интеграции. Получили документацию." },
        ],
        addedDate: new Date(now - 20 * day),
        lastInteraction: new Date(now - 7 * day),
        powerGrouping: { groupName: "Альфа Групп", suzerainId: "demo-1", vassalIds: [] },
      },
      {
        contact: {
          id: "demo-4",
          name: "Козлова Анна Владимировна",
          phoneNumbers: ["+7 903 456-78-90"],
          emails: ["kozlova@media.ru"],
          company: "MediaPro",
          position: "Руководитель PR-отдела",
          goal: "Медийное сопровождение",
          notes: "Контакт для PR-кампаний. Широкая сеть в медиа-индустрии.",
        },
        sectors: ["personal", "other"],
        functionalCircle: "support" as const,
        importance: "medium" as const,
        relations: [{ contactId: "demo-1", strength: 50 }],
        diary: [
          { id: "d5", date: new Date(now - 14 * day), type: "manual" as const, content: "Обсудили медиаплан на весну." },
        ],
        addedDate: new Date(now - 15 * day),
        lastInteraction: new Date(now - 14 * day),
        powerGrouping: { groupName: "Альфа Групп", suzerainId: "demo-1", vassalIds: [] },
      },
      {
        contact: {
          id: "demo-5",
          name: "Николаев Игорь Анатольевич",
          phoneNumbers: ["+7 977 567-89-01"],
          emails: ["nikolaev@lawfirm.ru"],
          company: "Юридическая фирма «Право»",
          position: "Старший партнёр",
          goal: "Юридическое сопровождение",
          notes: "Опытный юрист. Помогает с договорами и сделками.",
        },
        sectors: ["business"],
        functionalCircle: "support" as const,
        importance: "medium" as const,
        relations: [{ contactId: "demo-1", strength: 40 }],
        diary: [],
        addedDate: new Date(now - 10 * day),
      },
      {
        contact: {
          id: "demo-6",
          name: "Кашин Дмитрий Владимирович",
          phoneNumbers: ["+7 999 123-45-67"],
          emails: ["kashin@classified.net"],
          company: "Classified Corp",
          position: "Senior Operative",
          goal: "Выход на первого лица",
          notes: "Связующее звено между командами. Хорошо ориентируется в структурах.",
        },
        sectors: ["politics"],
        functionalCircle: "development" as const,
        importance: "medium" as const,
        relations: [{ contactId: "demo-3", strength: 75 }],
        diary: [
          { id: "d6", date: new Date(now - 8 * day), type: "manual" as const, content: "Первый контакт. Договорились о повторной встрече через неделю." },
        ],
        addedDate: new Date(now - 8 * day),
        lastInteraction: new Date(now - 8 * day),
      },
      {
        contact: {
          id: "demo-7",
          name: "Смирнов Олег Анатольевич",
          phoneNumbers: ["+7 915 321-00-44"],
          emails: ["smirnov@corp.ru"],
          company: "Classified Corp",
          position: "Senior",
          goal: "Стратегическая поддержка",
          notes: "Опытный переговорщик. Ценный контакт в сложных ситуациях.",
        },
        sectors: ["other"],
        functionalCircle: "development" as const,
        importance: "critical" as const,
        relations: [{ contactId: "demo-1", strength: 70 }],
        diary: [
          { id: "d7", date: new Date(now - 6 * day), type: "manual" as const, content: "Встреча в нейтральном месте. Обсудили стратегию на квартал." },
        ],
        addedDate: new Date(now - 12 * day),
        lastInteraction: new Date(now - 6 * day),
      },
      {
        contact: {
          id: "demo-8",
          name: "Терентьев Павел Игоревич",
          phoneNumbers: ["+7 965 444-33-22"],
          emails: ["terentiev@invest.ru"],
          company: "InvestGroup",
          position: "Директор по инвестициям",
          goal: "Привлечение финансирования",
          notes: "Принимает решения о вложениях. Ценит конкретику и цифры.",
        },
        sectors: ["business"],
        functionalCircle: "productivity" as const,
        importance: "high" as const,
        relations: [
          { contactId: "demo-1", strength: 55 },
          { contactId: "demo-2", strength: 45 },
        ],
        diary: [
          { id: "d8", date: new Date(now - 9 * day), type: "manual" as const, content: "Презентация проекта. Получили положительный отклик." },
        ],
        addedDate: new Date(now - 18 * day),
        lastInteraction: new Date(now - 9 * day),
      },
    ],
    sectors: ["work", "business", "politics", "personal", "other"],
    powerGroupings: ["Альфа Групп"],
    updatedAt: now,
  };

  await storeSet(dataKey, demoData);
  console.log("[phone-auth] demo data created: 8 contacts for", phone);
}

/**
 * Обработка вебхуков от Plusofon.
 *
 * ПЕРВЫЙ вебхук: Plusofon присылает номер для звонка.
 *   body: { phone: "8XXXXXXXXXX", key: "abc123" }
 *   — phone это номер для звонка (служебный), НЕ номер пользователя
 *
 * ВТОРОЙ вебхук: подтверждение, что пользователь позвонил.
 *   body: { ... подтверждение ... }
 *
 * Проблема: в первом вебхуке phone — это служебный номер,
 * а нам нужно сопоставить с номером пользователя.
 * Решение: ищем среди всех pending авторизаций.
 */
export async function handlePlusofonWebhook(body: Record<string, unknown>): Promise<boolean> {
  console.log("[phone-auth] WEBHOOK received:", JSON.stringify(body, null, 2));

  const webhookPhone = String(body.phone || "").replace(/[^0-9]/g, "");
  const key = String(body.key || "");
  const status = body.status || body.result || body.event;

  console.log("[phone-auth] webhook parsed:", { webhookPhone, key, status, bodyKeys: Object.keys(body) });

  // Перебираем все pending авторизации и ищем совпадение
  const { storeGetAll } = await import("../../store");
  const allKeys = await storeGetAll<PendingAuth>("auth:pending:");

  for (const [storeKey, pending] of Object.entries(allKeys)) {
    if (Date.now() > pending.expiresAt) {
      continue;
    }

    // ПЕРВЫЙ вебхук: номер для звонка ещё не получен
    if (!pending.displayPhone && webhookPhone && key) {
      // Plusofon присылает номер для звонка — сохраняем
      pending.displayPhone = webhookPhone.length >= 7 ? webhookPhone : null;
      pending.key = key;

      // Форматируем номер для отображения
      if (pending.displayPhone) {
        // Если 11 цифр начинается с 8 — форматируем как 8-XXX-XXX-XX-XX
        if (pending.displayPhone.length === 11 && pending.displayPhone.startsWith("8")) {
          const d = pending.displayPhone;
          pending.displayPhone = `8-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
        }
      }

      await storeSet(storeKey, pending);
      console.log("[phone-auth] webhook: stored displayPhone for", pending.userPhone, "→", pending.displayPhone);
      return true;
    }

    // ВТОРОЙ вебхук: подтверждение звонка (номер уже есть, ещё не verified)
    if (pending.displayPhone && !pending.verified) {
      // Проверяем — это подтверждение звонка (может содержать статус, или key совпадает)
      const isConfirmation =
        status === "success" ||
        status === "confirmed" ||
        status === "completed" ||
        (key && pending.key && key === pending.key) ||
        // Если phone в вебхуке совпадает с номером пользователя — это подтверждение
        (webhookPhone === pending.userPhone);

      if (isConfirmation) {
        pending.verified = true;
        await storeSet(storeKey, pending);
        console.log("[phone-auth] webhook: VERIFIED", pending.userPhone);
        return true;
      }
    }
  }

  console.warn("[phone-auth] webhook: no matching pending auth found");
  return false;
}
