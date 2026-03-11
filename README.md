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

## Plusofon Flash Call — токен

**Ошибка «Недостаточно прав»** означает, что в `PLUSOFON_FC_TOKEN` указан токен личного кабинета, а нужен **access_token** аккаунта Flash Call.

1. Войти в [личный кабинет Plusofon](https://cabinet.plusofon.ru)
2. Раздел **Flash Call** → список аккаунтов
3. Взять `access_token` нужного аккаунта (или создать новый)
4. Либо через API: `GET https://restapi.plusofon.ru/api/v1/flash-call` с токеном ЛК → в ответе `data[].access_token`

`PLUSOFON_FC_TOKEN` = этот `access_token`, **не** токен личного кабинета.

## Сборка APK

```bash
eas build --platform android --profile preview
```
