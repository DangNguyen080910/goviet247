FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY pnpm-lock.yaml* ./

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile || pnpm install

RUN apk add --no-cache openssl

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production

EXPOSE 5050

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]