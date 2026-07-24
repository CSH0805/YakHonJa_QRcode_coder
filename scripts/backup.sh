#!/usr/bin/env bash
# yaksok(RDS) DB mysqldump 백업 스크립트
#
# RDS 자동 백업(스냅샷)이 기본 활성화되어 있다면 그것이 1차 복구 수단이며,
# 이 스크립트는 특정 시점 SQL 덤프를 별도로 뽑아두기 위한 보조 수단입니다.
#
# 사용법: ./backup.sh
# 필요 환경변수 (없으면 .env에서 읽음): DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT, DB_SSL
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

DB_HOST="${DB_HOST:?DB_HOST가 설정되지 않았습니다 (RDS 엔드포인트)}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-yaksok}"
DB_SSL="${DB_SSL:-true}"
: "${DB_USER:?DB_USER가 설정되지 않았습니다}"
: "${DB_PASSWORD:?DB_PASSWORD가 설정되지 않았습니다}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/yaksok-qr}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
CA_BUNDLE="$PROJECT_DIR/certs/ap-northeast-2-bundle.pem"

mkdir -p "$BACKUP_DIR"

# 비밀번호를 명령줄 인자나 환경변수가 아니라 --defaults-extra-file로 전달한다
# (ps 등으로 프로세스 목록을 볼 수 있는 다른 사용자에게 노출되지 않도록).
# SSL 옵션(ssl-ca/ssl-mode)은 일부 클라이언트 빌드에서 옵션 파일로 읽으면 오작동해서
# 명령줄 인자로 따로 전달한다 - 이 값들은 비밀이 아니므로 노출 문제가 없다.
DEFAULTS_FILE="$(mktemp)"
trap 'rm -f "$DEFAULTS_FILE"' EXIT

{
  echo "[client]"
  echo "user=$DB_USER"
  echo "password=$DB_PASSWORD"
  echo "host=$DB_HOST"
  echo "port=$DB_PORT"
} > "$DEFAULTS_FILE"
chmod 600 "$DEFAULTS_FILE"

SSL_ARGS=()
if [ "$DB_SSL" != "false" ]; then
  if [ ! -f "$CA_BUNDLE" ]; then
    echo "DB_SSL=true인데 CA 번들이 없습니다: $CA_BUNDLE" >&2
    exit 1
  fi
  SSL_ARGS=(--ssl-ca="$CA_BUNDLE" --ssl-mode=VERIFY_IDENTITY)
fi

# --set-gtid-purged=OFF, --no-tablespaces: RDS의 애플리케이션 전용 계정은 RELOAD/PROCESS
# 같은 관리자 권한이 없다(정상 - 최소 권한 원칙). 기본 --single-transaction은 GTID/테이블스페이스
# 일관성을 위해 짧게라도 전역 FLUSH TABLES WITH READ LOCK을 시도하는데, RDS는 마스터 계정조차
# 이를 허용하지 않는다. 두 옵션으로 그 시도 자체를 건너뛰고 InnoDB 트랜잭션 스냅샷만으로 백업한다.
mysqldump \
  --defaults-extra-file="$DEFAULTS_FILE" \
  "${SSL_ARGS[@]}" \
  --single-transaction \
  --set-gtid-purged=OFF \
  --no-tablespaces \
  --routines \
  --triggers \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "백업 완료: $BACKUP_FILE"

# 보존 기간이 지난 백업 삭제
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "오래된 백업 정리 완료 (${RETENTION_DAYS}일 이상 경과분 삭제)"
