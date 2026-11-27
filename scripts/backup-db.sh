#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-30}"
CONTAINER_NAME="${CONTAINER_NAME:-home-ledger-prod-postgres}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"

read_env_value() {
  local key="$1"
  local default_val="$2"
  if [[ ! -f "$ENV_FILE" ]]; then
    printf '%s' "$default_val"
    return
  fi
  local line
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    printf '%s' "$default_val"
    return
  fi
  local val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"
  printf '%s' "${val:-$default_val}"
}

PG_USER="$(read_env_value "POSTGRES_USER" "home_ledger")"
PG_DB="$(read_env_value "POSTGRES_DB" "home_ledger")"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TARGET_FILE="$BACKUP_DIR/home-ledger-$TIMESTAMP.sql.gz"
TMP_FILE="$TARGET_FILE.tmp"

echo "[backup] Exporting database '$PG_DB' from container '$CONTAINER_NAME'..."
docker exec "$CONTAINER_NAME" pg_dump -U "$PG_USER" -d "$PG_DB" --clean --if-exists --no-owner | gzip -9 > "$TMP_FILE"

if [[ ! -s "$TMP_FILE" ]]; then
  rm -f "$TMP_FILE"
  echo "[backup] Error: backup file is empty." >&2
  exit 1
fi

mv "$TMP_FILE" "$TARGET_FILE"
echo "[backup] Success: $TARGET_FILE"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'home-ledger-*.sql.gz' -mtime +"$RETAIN_DAYS" -print -delete
