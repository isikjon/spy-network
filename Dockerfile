FROM node:20-alpine

WORKDIR /app

# Зависимости
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# 1) Собираем Expo web → dist/
RUN EXPO_PUBLIC_RORK_API_BASE_URL=https://spynetwork.ru \
    npx expo export --platform web --output-dir dist

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
