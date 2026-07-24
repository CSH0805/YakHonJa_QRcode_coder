-- YakSok QR - DB 초기 설정 스크립트
-- root(관리자) 계정으로 1회 실행합니다: mysql -u root -p < schema.sql
-- 실행 후 애플리케이션은 아래에서 생성되는 yaksok_app 계정만 사용합니다 (root 사용 금지).
--
-- 데이터 모델: QR 1개 = 처방전 1개(prescription). 한 처방전 안에 약이 여러 개(prescription_items)
-- 들어갈 수 있고, 복용 시간/기간은 처방전 전체가 공통으로 가집니다. 약 이름/용량/주의사항은 약마다 다릅니다.

CREATE DATABASE IF NOT EXISTS yaksok_qr
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE yaksok_qr;

CREATE TABLE IF NOT EXISTS prescriptions (
  qr_id      CHAR(64) NOT NULL PRIMARY KEY,
  times      JSON     NOT NULL,
  start_date DATE     NOT NULL,
  end_date   DATE     NOT NULL,
  revoked_at DATETIME NULL,
  -- DEFAULT를 두지 않는다: created_at은 항상 애플리케이션(Node)이 UTC로 계산해 명시적으로 넣는다.
  -- MySQL 세션 타임존이 SYSTEM(KST 등)이면 DEFAULT CURRENT_TIMESTAMP는 UTC가 아닌 값을 넣어
  -- 다른 UTC 기준 컬럼과 어긋나게 된다.
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

-- 애플리케이션 전용 계정 생성 (root 대신 이 계정을 .env에 사용).
-- 아래 비밀번호는 예시입니다. 반드시 실제 배포 전에 강력한 값으로 교체하고
-- 교체한 값을 .env의 DB_PASSWORD에도 동일하게 반영하세요.
CREATE USER IF NOT EXISTS 'yaksok_app'@'localhost' IDENTIFIED BY 'change_me_strong_password';

GRANT SELECT, INSERT, UPDATE, DELETE ON yaksok_qr.* TO 'yaksok_app'@'localhost';

FLUSH PRIVILEGES;
