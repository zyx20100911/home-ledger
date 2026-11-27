#!/bin/sh
set -e

echo "[home-ledger-api] Applying Prisma migrations..."
pnpm --filter @home-ledger/api exec prisma migrate deploy

echo "[home-ledger-api] Ensuring system default categories..."
pnpm --filter @home-ledger/api prisma:seed

echo "[home-ledger-api] Starting NestJS server..."
exec node /app/apps/api/dist/main.js
