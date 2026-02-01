# Запуск бэкенда на сервере

## Хранение данных

Данные хранятся в файле `/app/data/store.json` внутри контейнера. Чтобы они **не удалялись** при перезапуске контейнера, при запуске нужно примонтировать том:

```bash
docker run -d -p 3000:3000 \
  -v spy-data:/app/data \
  --name backend --restart unless-stopped \
  spy-network-backend
```

Так папка `/app/data` будет храниться в Docker-томе `spy-data` и сохранится между перезапусками.

## Вход в веб-админку

Чтобы войти в админку по адресу **https://ваш-домен/admin**, на сервере нужно задать переменные окружения для создания первого админа:

- `RORK_ADMIN_AUTH_SECRET` — секрет для хеширования паролей (любая длинная строка).
- `RORK_ADMIN_DEFAULT_USERNAME` — логин первого админа (например `admin`).
- `RORK_ADMIN_DEFAULT_PASSWORD` — пароль первого админа.

Пример запуска с переменными:

```bash
docker run -d -p 3000:3000 \
  -v spy-data:/app/data \
  -e RORK_ADMIN_AUTH_SECRET="ваш-секрет-минимум-16-символов" \
  -e RORK_ADMIN_DEFAULT_USERNAME="admin" \
  -e RORK_ADMIN_DEFAULT_PASSWORD="ваш-пароль" \
  --name backend --restart unless-stopped \
  spy-network-backend
```

После этого откройте в браузере **https://ваш-домен/admin**, введите логин и пароль.
