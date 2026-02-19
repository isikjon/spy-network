FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

COPY backend/ ./backend/
COPY web/ ./web/

RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000

CMD ["bun", "run", "backend/server.ts"]
