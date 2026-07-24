#!/usr/bin/env bash
# yaksok_qr DB mysqldump 백업 스크립트
# RDS 등 관리형 DB의 자동 백업이 없으므로 cron으로 주기 실행합니다.
#
# 사용법: ./backup.sh
# 필요 환경변수 (없으면 .env에서 읽음): DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT
#
# crontab 등록 예시 (매일 새벽 3시 실행):
#   0 3 * * * /path/to/scripts/backup.sh >> /var/log/yaksok-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-yaksok_qr}"
: "${DB_USER:?DB_USER가 설정되지 않았습니다}"
: "${DB_PASSWORD:?DB_PASSWORD가 설정되지 않았습니다}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/yaksok-qr}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/yaksok_qr_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

MYSQL_PWD="$DB_PASSWORD" mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "백업 완료: $BACKUP_FILE"

# 보존 기간이 지난 백업 삭제
find "$BACKUP_DIR" -name 'yaksok_qr_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "오래된 백업 정리 완료 (${RETENTION_DAYS}일 이상 경과분 삭제)"
