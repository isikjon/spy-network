import { initStore, storeSet } from "./backend/store";

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const testUsers = [
  {
    phone: "+79001112233",
    data: {
      phoneNumber: "+79001112233",
      dossiers: [{ contact: { id: "c1" }, relations: [1, 2] }, { contact: { id: "c2" }, relations: [1] }],
      sectors: ["Бизнес"],
      powerGroupings: ["Группа А"],
      updatedAt: now - 0.5 * DAY,
    },
    level: { level: 2, subscribedUntil: now + 5 * DAY, updatedAt: now - 2 * DAY },
    card: { paymentMethodId: "pm_111", cardType: "Visa", last4: "4242" },
  },
  {
    phone: "+79002223344",
    data: {
      phoneNumber: "+79002223344",
      dossiers: [{ contact: { id: "c3" }, relations: [1, 2, 3] }],
      sectors: ["Политика"],
      powerGroupings: [],
      updatedAt: now - 1 * DAY,
    },
    level: { level: 2, subscribedUntil: now + 2 * DAY, updatedAt: now - 3 * DAY },
    card: { paymentMethodId: "pm_222", cardType: "MasterCard", last4: "8888" },
  },
  {
    phone: "+79003334455",
    data: {
      phoneNumber: "+79003334455",
      dossiers: [{ contact: { id: "c4" }, relations: [] }, { contact: { id: "c5" }, relations: [1] }, { contact: { id: "c6" }, relations: [1, 2, 3, 4] }],
      sectors: [],
      powerGroupings: ["Группа Б"],
      updatedAt: now - 2 * DAY,
    },
    level: { level: 2, subscribedUntil: now - 1 * DAY, updatedAt: now - 8 * DAY },
    card: null,
  },
  {
    phone: "+79004445566",
    data: {
      phoneNumber: "+79004445566",
      dossiers: [],
      sectors: [],
      powerGroupings: [],
      updatedAt: now - 0.2 * DAY,
    },
    level: { level: 1, subscribedUntil: null, updatedAt: now - 1 * DAY },
    card: null,
  },
  {
    phone: "+79005556677",
    data: {
      phoneNumber: "+79005556677",
      dossiers: [{ contact: { id: "c7" }, relations: [1] }],
      sectors: ["Медиа"],
      powerGroupings: [],
      updatedAt: now - 3 * DAY,
    },
    level: { level: 1, subscribedUntil: null, updatedAt: now - 5 * DAY },
    card: null,
  },
  {
    phone: "+79006667788",
    data: {
      phoneNumber: "+79006667788",
      dossiers: [{ contact: { id: "c8" }, relations: [1, 2] }, { contact: { id: "c9" }, relations: [] }],
      sectors: ["Финансы"],
      powerGroupings: ["Группа В"],
      updatedAt: now - 4 * DAY,
    },
    level: { level: 2, subscribedUntil: now + 1 * DAY, updatedAt: now - 6 * DAY },
    card: { paymentMethodId: "pm_333", cardType: "Mir", last4: "1234" },
  },
  {
    phone: "+79007778899",
    data: {
      phoneNumber: "+79007778899",
      dossiers: [{ contact: { id: "c10" }, relations: [1] }],
      sectors: [],
      powerGroupings: [],
      updatedAt: now - 5 * DAY,
    },
    level: { level: 2, subscribedUntil: now - 3 * DAY, updatedAt: now - 10 * DAY },
    card: { paymentMethodId: "pm_444", cardType: "Visa", last4: "5678" },
  },
  {
    phone: "+79008889900",
    data: {
      phoneNumber: "+79008889900",
      dossiers: [{ contact: { id: "c11" }, relations: [1, 2, 3] }, { contact: { id: "c12" }, relations: [1] }, { contact: { id: "c13" }, relations: [] }, { contact: { id: "c14" }, relations: [1, 2] }],
      sectors: ["Технологии", "Бизнес"],
      powerGroupings: ["Группа А", "Группа Б"],
      updatedAt: now - 6 * DAY,
    },
    level: { level: 1, subscribedUntil: null, updatedAt: now - 6 * DAY },
    card: null,
  },
];

async function seed() {
  await initStore();
  for (const u of testUsers) {
    await storeSet(`user:${u.phone}:data`, u.data);
    await storeSet(`user:${u.phone}:level`, u.level);
    if (u.card) {
      await storeSet(`user:${u.phone}:payment_method`, u.card);
    }
  }
  console.log(`Seeded ${testUsers.length} test users`);
}

seed();
