# Crown & Glow — backend production image
# Multi-stage build: install once with dev deps to compile, then ship only
# production node_modules + compiled JS in the final image.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
# node:20-alpine ships no OpenSSL by default — Prisma's engine binaries are
# dynamically linked against it, and `prisma generate`'s OS/libc detection
# silently guesses wrong without it, so install it before touching Prisma.
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma's generated client is imported by the TS source, so it must exist
# before `tsc` runs. DATABASE_URL isn't needed for generate — only for
# actually connecting — so a placeholder is fine at build time.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
# Same reason as the builder stage — this is the image that actually runs
# `prisma migrate deploy` at container start, so it's the stage that matters
# most: without OpenSSL here the schema engine binary fails to start and
# `migrate deploy` crash-loops with a "could not parse schema engine
# response" error instead of a clear "OpenSSL missing" one.
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# The production node_modules above doesn't include the Prisma CLI or a
# generated client — regenerate the client against the real DATABASE_URL
# that's actually present at container start, right before migrating.
RUN npx prisma generate

EXPOSE 5000

# Applies any pending migrations, then starts the server. Running migrations
# on every boot is the simplest safe default for a single-instance deploy;
# move this to a separate release/migrate step before scaling to more than
# one backend replica, so two replicas don't race to apply the same migration.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
