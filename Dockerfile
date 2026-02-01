FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npx tsc \
  --skipLibCheck \
  --outDir dist \
  --module commonjs \
  --moduleResolution node \
  --target ES2020 \
  --lib ES2020,DOM \
  backend/server.ts

RUN mkdir -p /app/data
VOLUME /app/data
EXPOSE 3000
CMD ["node", "dist/backend/server.js"]
