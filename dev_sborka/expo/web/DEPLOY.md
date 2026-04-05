# PRO Network - Инструкция по развёртыванию

## Структура файлов

```
web/
├── index.html          # Главная страница
├── privacy.html        # Политика конфиденциальности
├── support.html        # Центр поддержки
├── terms.html          # Условия использования
├── admin.html          # Вход администратора
├── styles.css          # Основные стили
├── pages.css           # Стили страниц
└── DEPLOY.md           # Этот файл
```

## Развёртывание

### Nginx

```nginx
server {
    listen 80;
    server_name pronetwork.app;
    root /var/www/pronetwork;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~* \.(css|js|png|jpg|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
cd web
docker build -t pronetwork-web .
docker run -d -p 80:80 pronetwork-web
```

### Vercel / Netlify

Укажите папку `web/` как директорию деплоя.

## Настройка

### Ссылки на магазины

В `index.html` замените:
- App Store: `https://apps.apple.com/app/id...`
- Google Play: `https://play.google.com/store/apps/details?id=...`

### Панель администратора

В `admin.html` настройте URL бэкенда в функции `getAdminUrl()`.

### Email адреса

Обновите контакты в файлах:
- privacy@pronetwork.app
- support@pronetwork.app
- legal@pronetwork.app

## Локальное тестирование

```bash
cd web && python -m http.server 8000
```

Откройте http://localhost:8000

## Требования App Store / Google Play

✅ Политика конфиденциальности (privacy.html)
✅ Условия использования (terms.html)  
✅ Поддержка пользователей (support.html)
