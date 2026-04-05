# Spy Network

Профессиональное приложение для управления сетью контактов.

## Технологии

- **React Native / Expo** — кросс-платформенное мобильное приложение (iOS, Android, Web)
- **Expo Router** — файловая маршрутизация
- **Hono / Bun** — бэкенд сервер
- **tRPC** — типобезопасное API
- **YooKassa** — онлайн-оплата подписки
- **Plusofon Flash Call** — авторизация по звонку

## Запуск

```bash
# Установить зависимости
npm install

# Запустить веб
npm run start-web

# Запустить бэкенд
bun run backend/server.ts
```

## Деплой (Docker)

```bash
docker build -t spy-network .

docker run -d \
  --name spy-network \
  --restart unless-stopped \
  -p 3000:3000 \
  -v spy-data:/app/data \
  -e YOOKASSA_SHOP_ID=... \
  -e YOOKASSA_SECRET_KEY=... \
  -e PLUSOFON_FC_TOKEN=... \
  -e APP_BASE_URL=https://spynetwork.ru \
  spy-network
```

## Сборка APK

```bash
eas build --platform android --profile preview
```
