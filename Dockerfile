FROM node:20-alpine

WORKDIR /app

# Зависимости
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# 1a) Публичная веб-сборка → dist/ (без служебного меню)
# 1b) Staff-сборка → dist-staff/ (секретный URL, пункты админ/аналитика в профиле)
ARG EXPO_PUBLIC_API=https://spynetwork.ru
ARG STAFF_WEB_SLUG=lkdj7djdjhg
RUN EXPO_PUBLIC_RORK_API_BASE_URL=${EXPO_PUBLIC_API} \
    EXPO_PUBLIC_ENABLE_STAFF_MENU=false \
    EXPO_PUBLIC_WEB_BASE_PATH=/app \
    npx expo export --platform web --output-dir dist
RUN EXPO_PUBLIC_RORK_API_BASE_URL=${EXPO_PUBLIC_API} \
    EXPO_PUBLIC_ENABLE_STAFF_MENU=true \
    EXPO_PUBLIC_WEB_BASE_PATH=/${STAFF_WEB_SLUG} \
    npx expo export --platform web --output-dir dist-staff

# 2) Компилируем TypeScript бэкенда
RUN npx tsc \
  --skipLibCheck \
  --outDir server-dist \
  --module commonjs \
  --moduleResolution node \
  --target ES2020 \
  --lib ES2020,DOM \
  backend/server.ts

RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000
CMD ["node", "server-dist/backend/server.js"]
