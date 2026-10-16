# Image de développement local uniquement (better-sqlite3 nécessite une compilation native)
FROM node:22-alpine

RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

# npm install : le volume node_modules persiste entre les rebuilds, il faut donc resynchroniser les dépendances au démarrage
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run db:migrate && npm run dev -- --hostname 0.0.0.0"]
