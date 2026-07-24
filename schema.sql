-- YakSok QR - DB 초기 설정 스크립트
-- AWS RDS의 마스터(admin) 계정으로 1회 실행합니다. 예:
--   mysql -h <RDS 엔드포인트> -u admin -p --ssl-ca=certs/ap-northeast-2-bundle.pem --ssl-mode=VERIFY_IDENTITY < schema.sql
-- 실행 후 애플리케이션은 아래에서 생성되는 yaksok_app 계정만 사용합니다 (admin/root 계정 사용 금지).

CREATE DATABASE IF NOT EXISTS yaksok
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE yaksok;

CREATE TABLE IF NOT EXISTS prescriptions (
  qr_id      CHAR(64) NOT NULL PRIMARY KEY,
  times      JSON     NOT NULL,
  start_date DATE     NOT NULL,
  end_date   DATE     NOT NULL,
  revoked_at DATETIME NULL,
  -- DEFAULT를 두지 않는다: created_at은 항상 애플리케이션(Node)이 UTC로 계산해 명시적으로 넣는다.
  -- DB 서버 세션 타임존이 무엇이든(RDS 기본은 UTC이지만) DEFAULT CURRENT_TIMESTAMP에 의존하면
  -- 다른 UTC 기준 컬럼과 어긋날 수 있다.
  created_at DATETIME NOT NULL,
  INDEX idx_prescriptions_revoked_at (revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prescription_items (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  qr_id         CHAR(64)     NOT NULL,
  medicine_name VARCHAR(200) NOT NULL,
  dose_amount   VARCHAR(50)  NOT NULL,
  caution       TEXT         NULL,
  sort_order    INT          NOT NULL DEFAULT 0,
  INDEX idx_prescription_items_qr_id (qr_id),
  CONSTRAINT fk_prescription_items_qr_id
    FOREIGN KEY (qr_id) REFERENCES prescriptions(qr_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS access_tokens (
  token_hash CHAR(64)  NOT NULL PRIMARY KEY,
  qr_id      CHAR(64)  NOT NULL,
  expires_at DATETIME  NOT NULL,
  -- DEFAULT를 두지 않는다: created_at도 애플리케이션이 UTC로 계산해 명시적으로 넣는다 (위와 동일한 이유).
  created_at DATETIME  NOT NULL,
  INDEX idx_access_tokens_expires_at (expires_at),
  INDEX idx_access_tokens_qr_id (qr_id),
  CONSTRAINT fk_access_tokens_qr_id
    FOREIGN KEY (qr_id) REFERENCES prescriptions(qr_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 애플리케이션 전용 계정 생성 (admin/root 대신 이 계정을 .env에 사용).
-- 호스트를 '%'로 두는 이유: RDS는 앱 서버가 네트워크 너머 원격에서 접속하므로
-- 로컬 MySQL에서 쓰던 'localhost' 스코프는 RDS 자신의 루프백만 의미해 앱이 접속할 수 없다.
-- 대신 보안 그룹으로 접근 가능한 소스를 제한하고, SSL + 비밀번호로 보호한다.
-- 아래 비밀번호는 예시입니다. 반드시 실제 배포 전에 강력한 값으로 교체하고
-- 교체한 값을 .env의 DB_PASSWORD에도 동일하게 반영하세요.
CREATE USER IF NOT EXISTS 'yaksok_app'@'%' IDENTIFIED BY 'change_me_strong_password';

-- yaksok DB에는 이 QR 서비스와 무관한 다른 팀(앱 백엔드로 추정: doctor_notes, medicine_schedules,
-- medicine_searches, symptoms, users 등)의 테이블이 이미 존재한다. GRANT ... ON yaksok.*로
-- DB 전체에 권한을 주면 그 테이블들까지 이 서비스 계정이 읽고 쓸 수 있게 되므로,
-- 반드시 이 서비스가 실제로 쓰는 테이블 3개에만 권한을 명시적으로 좁혀서 부여한다.
GRANT SELECT, INSERT, UPDATE, DELETE ON yaksok.prescriptions TO 'yaksok_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON yaksok.prescription_items TO 'yaksok_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON yaksok.access_tokens TO 'yaksok_app'@'%';

FLUSH PRIVILEGES;
