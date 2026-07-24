# YakSok QR 웹/서버

의사가 웹에서 처방전(약 여러 개 + 공통 복용 일정)을 입력해 QR을 발급하고, YakSok 앱이 QR을 스캔해 2단계 인증(세션 발급 → 토큰 조회)으로 처방 정보를 가져가는 웹/서버입니다. 이 저장소는 **웹 + 서버만** 담당하며, 앱은 별도 저장소에서 구현됩니다.

## 기술 스택
- Node.js + Express
- MySQL 8.x (서버에 직접 설치, `mysql2/promise` 커넥션 풀)
- QR 생성: `qrcode`
- 만료 토큰 정리: `node-cron`
- 프론트: 정적 HTML + fetch (등록 폼), 서버 렌더 HTML (QR 랜딩 페이지)

## 데이터 모델

**QR 1개 = 처방전 1개.** 한 처방전 안에 약이 여러 개 들어갈 수 있습니다. 복용 시간(아침/점심/저녁/취침 전)과 복용 기간(시작일~종료일)은 처방전 전체가 공통으로 가지며, 약 이름/1회 복용량/주의사항은 약마다 따로 입력합니다.

- `prescriptions` : QR 1건당 1행. `qr_id`(PK), `times`, `start_date`, `end_date`, `revoked_at`
- `prescription_items` : 처방전에 속한 약 목록. `qr_id`(FK), `medicine_name`, `dose_amount`, `caution`, `sort_order`
- `access_tokens` : 앱 세션 토큰. `qr_id`(FK)

앱 개발자용 연동 문서는 [docs/app-integration.md](docs/app-integration.md) 참고 (경로/응답 구조 변경 이력 포함).

## 타임존

서버/DB는 **UTC 기준**으로 동작합니다. `access_tokens.expires_at`은 MySQL `NOW()`에 의존하지 않고 Node에서 `Date.now() + 3시간`으로 계산해 바인딩하며(`src/services/tokenService.js`), DB 커넥션 풀도 `timezone: 'Z'`로 고정되어 있어(`src/config/db.js`) DB 서버의 로컬 타임존 설정과 무관하게 항상 정확한 만료 시각이 유지됩니다. 화면/문서에 표시할 때만 필요하면 KST 등으로 변환하세요.

---

## 1. MySQL 설치 및 초기 설정

### 1-1. 설치 (Ubuntu/Debian 기준)

```bash
sudo apt update
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo mysql_secure_installation
```

`mysql_secure_installation` 진행 시 root 비밀번호 설정, 익명 사용자 제거, 원격 root 로그인 비활성화, 테스트 DB 제거를 모두 예(Y)로 진행하세요.

### 1-2. 외부 접속 차단

`/etc/mysql/mysql.conf.d/mysqld.cnf` (또는 배포판에 따라 `/etc/mysql/my.cnf`)에서:

```ini
[mysqld]
bind-address = 127.0.0.1
```

방화벽에서도 3306 포트를 외부에 열지 않습니다.

```bash
sudo ufw deny 3306
sudo systemctl restart mysql
```

### 1-3. DB / 테이블 / 애플리케이션 계정 생성

`schema.sql`은 DB, 테이블, 인덱스, 그리고 앱 전용 계정(`yaksok_app`)까지 한 번에 생성합니다. **root는 이 스크립트를 실행할 때만 사용**하고, 애플리케이션은 절대 root로 접속하지 않습니다.

```bash
mysql -u root -p < schema.sql
```

> `schema.sql`에는 `yaksok_app` 계정 비밀번호가 예시값(`change_me_strong_password`)으로 들어 있습니다. 실행 전에 강력한 값으로 바꾸고, 바꾼 값을 `.env`의 `DB_PASSWORD`에도 동일하게 넣어주세요.
>
> ```sql
> ALTER USER 'yaksok_app'@'localhost' IDENTIFIED BY '실제_비밀번호';
> ```

생성된 계정 확인:

```bash
mysql -u yaksok_app -p -h 127.0.0.1 yaksok_qr -e "SHOW TABLES;"
```

---

## 2. 로컬 실행

```bash
npm install
cp .env.example .env
# .env를 열어 DB_PASSWORD 등을 schema.sql에서 설정한 값과 맞춰주세요.
# ADMIN_API_KEY도 반드시 채워야 서버가 부팅됩니다 (비어 있으면 즉시 에러 종료).
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run dev
```

기본적으로 `http://localhost:3000` 에서 실행됩니다.

- `GET /` : 서비스 소개 페이지
- `GET /admin` : 처방전 등록 페이지 (의료진 전용, API 키 입력 필요 — 아래 6번 참고)
- `GET /prescription/:qrId` : QR 랜딩 페이지

API 테스트는 [docs/curl-examples.md](docs/curl-examples.md) 참고.

---

## 3. 서버 배포

### 3-1. 코드 배포 + 프로세스 관리 (PM2)

```bash
npm install --production
npm install -g pm2

cp .env.example .env   # 서버용 값으로 채우기 (BASE_URL=https://qr.yaksok.kr 등)

pm2 start src/server.js --name yaksok-qr
pm2 save
pm2 startup   # 안내되는 명령을 그대로 실행하면 재부팅 시 자동 시작
```

배포 갱신 시:

```bash
git pull
npm install --production
pm2 restart yaksok-qr
```

### 3-2. Nginx + Let's Encrypt

[nginx.conf.example](nginx.conf.example) 참고. 요약:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp nginx.conf.example /etc/nginx/sites-available/qr.yaksok.kr
sudo ln -s /etc/nginx/sites-available/qr.yaksok.kr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d qr.yaksok.kr
```

도메인 `qr.yaksok.kr`은 Android App Links / iOS Universal Links 검증 때문에 고정값입니다. 변경하면 앱 연동이 깨집니다.

### 3-3. 앱 연동 파일 채우기

`public/.well-known/assetlinks.json`, `public/.well-known/apple-app-site-association`은 플레이스홀더 상태입니다. 앱 팀에게서 아래 값을 받아 채워주세요.

- Android: 패키지명, 서명 인증서 SHA-256 지문
- iOS: Team ID + Bundle ID (`TEAMID.com.example.bundleid` 형식)

두 파일 모두 `src/app.js`에서 확장자 유무와 무관하게 `Content-Type: application/json`으로 명시 응답하며, `Cache-Control: no-store` 미들웨어보다 앞에 위치해 캐싱이 허용됩니다. 배포 후 확인:

```bash
curl -I https://qr.yaksok.kr/.well-known/apple-app-site-association
curl -I https://qr.yaksok.kr/.well-known/assetlinks.json
```

`nginx.conf.example`에는 Let's Encrypt ACME 챌린지(`/.well-known/acme-challenge/`)가 이 두 파일의 location과 절대 겹치지 않도록 `^~`/`=` 우선순위를 명시해뒀습니다.

### 3-4. 백업

```bash
sudo mkdir -p /var/backups/yaksok-qr
chmod +x scripts/backup.sh
crontab -e
# 매일 새벽 3시 백업
# 0 3 * * * /path/to/project/scripts/backup.sh >> /var/log/yaksok-backup.log 2>&1
```

---

## 4. 발급자 API 인증

`POST /api/prescriptions`, `DELETE /api/prescriptions/:qrId`는 의료진(발급자) 전용이라 `X-API-Key` 헤더가 필요합니다. 값은 `.env`의 `ADMIN_API_KEY`와 `crypto.timingSafeEqual`로 비교됩니다(`src/middleware/adminAuth.js`). 헤더가 없거나 값이 다르면 `401 UNAUTHORIZED`입니다.

앱이 호출하는 `POST /api/prescription-qr/:qrId/session`, `GET /api/prescription-qr/:qrId`와 랜딩 페이지 `GET /prescription/:qrId`는 이 인증이 없는 공개 엔드포인트입니다(qrId + 세션 토큰으로 별도 보호됨).

웹 등록 폼(`/admin`)은 접속 시 키 입력 화면을 먼저 보여주고, 입력한 키를 `sessionStorage`에만 저장해 등록 요청 헤더로 사용합니다. 키가 틀리면 서버가 401을 반환하고 화면이 다시 키 입력으로 돌아갑니다. **키를 프론트 JS 코드에 하드코딩하지 않습니다.**

## 5. API 명세 요약

모든 응답은 `Cache-Control: no-store` (단, `.well-known` 앱 연동 파일 2종은 예외 — 3-3번 참고). 에러는 공통으로 `{ "success": false, "error": { "code", "message" } }` 형식.

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/prescriptions` | `X-API-Key` | 처방전 등록(약 여러 개 + 공통 일정) + QR 발급 (201) |
| DELETE | `/api/prescriptions/:qrId` | `X-API-Key` | QR 폐기 (소프트 삭제, 토큰 전체 삭제) (200) |
| POST | `/api/prescription-qr/:qrId/session` | 없음 | 앱 1단계: 3시간 액세스 토큰 발급 (200) |
| GET | `/api/prescription-qr/:qrId` | `Authorization: Bearer` | 앱 2단계: 처방 전체 조회 (200) |

`POST /api/prescriptions` 요청 본문:

```json
{
  "times": ["morning", "evening"],
  "start_date": "2026-07-24",
  "end_date": "2026-07-30",
  "medicines": [
    { "medicine_name": "감기약", "dose_amount": "1정", "caution": "음주를 피하세요" },
    { "medicine_name": "두통약", "dose_amount": "1정", "caution": "" }
  ]
}
```

에러 코드:

| 코드 | 상태 | 발생 상황 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 등록 시 필수 필드 누락/형식 오류 |
| `UNAUTHORIZED` | 401 | `X-API-Key` 없음/불일치 (발급자 API 전용) |
| `INVALID_TOKEN` | 401 | 토큰 없음/형식 오류/DB에 없음 |
| `TOKEN_MISMATCH` | 403 | 토큰의 qr_id와 URL의 qrId 불일치 |
| `QR_NOT_FOUND` | 404 | qrId 없음 |
| `TOKEN_EXPIRED` | 410 | 토큰 만료 |
| `QR_REVOKED` | 410 | QR 폐기됨 |
| `TOO_MANY_REQUESTS` | 429 | rate limit 초과 (등록 IP당 분당 20회, 세션 발급 IP당 분당 10회, 조회 IP당 분당 60회) |

전체 요청/응답 예시는 [docs/curl-examples.md](docs/curl-examples.md) 참고.

---

## 6. 보안 요약

- `qrId`, `access_token`은 `crypto.randomBytes(32).toString('hex')`로 생성 (`Math.random()` 미사용)
- 토큰은 SHA-256 해시로만 DB 저장, 원문 미저장
- 처방전 등록/폐기 API는 `X-API-Key` + `crypto.timingSafeEqual`로 보호 (`ADMIN_API_KEY` 미설정 시 서버 부팅 자체가 실패)
- 등록 API도 rate limit 적용 (IP당 분당 20회)
- QR 랜딩 페이지(`/prescription/:qrId`)는 인증 없이 처방 내용을 절대 노출하지 않음 (존재/폐기 여부만 확인)
- 모든 SQL은 `mysql2` placeholder 바인딩 사용 (문자열 연결 금지)
- 에러 응답에 스택 트레이스/SQL 등 내부 정보 미노출
- 토큰 만료는 DB 서버 타임존과 무관하게 Node가 계산 (위 "타임존" 섹션 참고), `node-cron`으로 1시간마다 만료 토큰 삭제
- MySQL은 `127.0.0.1`에만 바인딩, 3306 포트 방화벽 차단, 애플리케이션 전용 계정만 사용 (root 미사용)
