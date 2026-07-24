# YakSok QR 웹/서버

의사가 웹에서 처방전(약 여러 개 + 공통 복용 일정)을 입력해 QR을 발급하고, YakSok 앱이 QR을 스캔해 2단계 인증(세션 발급 → 토큰 조회)으로 처방 정보를 가져가는 웹/서버입니다. 이 저장소는 **웹 + 서버만** 담당하며, 앱은 별도 저장소에서 구현됩니다.

## 기술 스택
- Node.js + Express
- MySQL 8.x — **AWS RDS for MySQL** (`mysql2/promise` 커넥션 풀, SSL 필수)
- QR 생성: `qrcode`
- 만료 토큰 정리: `node-cron`
- 프론트: 정적 HTML + fetch (등록 폼), 서버 렌더 HTML (QR 랜딩 페이지)

> ⚠️ **보안 그룹 TODO**: 현재 RDS 인스턴스의 보안 그룹이 `0.0.0.0/0`(전체 인터넷)에 3306 포트를 열어두고 있습니다. 이 문서의 설정(SSL 필수, 최소 권한 계정)은 전송 구간과 계정 권한을 보호할 뿐 "누구나 3306으로 접속을 시도할 수 있다"는 점 자체는 막지 못합니다. **운영/시연 전에 반드시** 보안 그룹 인바운드 규칙을 EC2(앱 서버) 보안 그룹 또는 특정 IP 대역으로 제한하세요.

## 데이터 모델

**QR 1개 = 처방전 1개.** 한 처방전 안에 약이 여러 개 들어갈 수 있습니다. 복용 시간(아침/점심/저녁/취침 전)과 복용 기간(시작일~종료일)은 처방전 전체가 공통으로 가지며, 약 이름/1회 복용량/주의사항은 약마다 따로 입력합니다.

- `prescriptions` : QR 1건당 1행. `qr_id`(PK), `times`, `start_date`, `end_date`, `revoked_at`
- `prescription_items` : 처방전에 속한 약 목록. `qr_id`(FK), `medicine_name`, `dose_amount`, `caution`, `sort_order`
- `access_tokens` : 앱 세션 토큰. `qr_id`(FK)

앱 개발자용 연동 문서는 [docs/app-integration.md](docs/app-integration.md) 참고 (경로/응답 구조 변경 이력 포함).

## 타임존

서버/DB는 **UTC 기준**으로 동작합니다. `access_tokens.expires_at`은 MySQL `NOW()`에 의존하지 않고 Node에서 `Date.now() + 3시간`으로 계산해 바인딩하며(`src/services/tokenService.js`), DB 커넥션 풀도 `timezone: 'Z'`로 고정되어 있어(`src/config/db.js`) DB 서버의 로컬 타임존 설정과 무관하게 항상 정확한 만료 시각이 유지됩니다. 화면/문서에 표시할 때만 필요하면 KST 등으로 변환하세요.

---

## 1. AWS RDS(MySQL) 연결 및 초기 설정

### 1-1. RDS 인스턴스 준비

RDS 콘솔에서 MySQL 8.x 인스턴스를 생성(또는 이미 생성된 인스턴스 사용)합니다. 퍼블릭 액세스가 필요하면(EC2 없이 로컬에서 직접 접속하는 경우) 인스턴스 생성 시 "퍼블릭 액세스 가능"을 예로 설정하세요. 엔드포인트/포트는 RDS 콘솔 > 데이터베이스 > 연결 & 보안 탭에서 확인합니다.

### 1-2. RDS CA 번들 다운로드 (SSL 필수)

이 프로젝트는 RDS 접속 시 서버 인증서를 실제로 검증합니다(`rejectUnauthorized: false` 사용 안 함). 리전에 맞는 CA 번들을 받아 `certs/`에 둡니다.

```bash
mkdir -p certs
curl -o certs/ap-northeast-2-bundle.pem \
  https://truststore.pki.rds.amazonaws.com/ap-northeast-2/ap-northeast-2-bundle.pem
```

다른 리전을 쓴다면 `ap-northeast-2` 부분을 해당 리전 코드로 바꾸세요 (전체 목록: [AWS RDS SSL 문서](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)).

### 1-3. DB / 테이블 / 애플리케이션 계정 생성

`schema.sql`은 DB, 테이블, 인덱스, 그리고 앱 전용 계정(`yaksok_app`)까지 한 번에 생성합니다. **RDS 마스터(admin) 계정은 이 스크립트를 실행할 때만 사용**하고, 애플리케이션은 절대 admin으로 접속하지 않습니다.

```bash
mysql -h <RDS 엔드포인트> -u admin -p \
  --ssl-ca=certs/ap-northeast-2-bundle.pem --ssl-mode=VERIFY_IDENTITY \
  < schema.sql
```

> `schema.sql`에는 `yaksok_app` 계정 비밀번호가 예시값(`change_me_strong_password`)으로 들어 있습니다. 실행 전(또는 실행 직후)에 강력한 값으로 바꾸고, 바꾼 값을 `.env`의 `DB_PASSWORD`에도 동일하게 넣어주세요.
>
> ```sql
> ALTER USER 'yaksok_app'@'%' IDENTIFIED BY '실제_비밀번호';
> FLUSH PRIVILEGES;
> ```
>
> 이미 같은 RDS 인스턴스에 다른 팀(예: 앱 백엔드)의 테이블이 있을 수 있습니다. `schema.sql`의 `GRANT`는 의도적으로 `yaksok.*` 전체가 아니라 이 서비스가 쓰는 테이블 3개(`prescriptions`, `prescription_items`, `access_tokens`)에만 좁혀서 권한을 줍니다 — 다른 팀 테이블에 실수로 접근하지 않도록 하기 위함이니 이 스코프를 넓히지 마세요.

생성된 계정 확인:

```bash
mysql -h <RDS 엔드포인트> -u yaksok_app -p \
  --ssl-ca=certs/ap-northeast-2-bundle.pem --ssl-mode=VERIFY_IDENTITY \
  yaksok -e "SHOW TABLES;"
```

### 1-4. SSL 연결 확인

```bash
mysql -h <RDS 엔드포인트> -u yaksok_app -p \
  --ssl-ca=certs/ap-northeast-2-bundle.pem --ssl-mode=VERIFY_IDENTITY \
  -e "SHOW STATUS LIKE 'Ssl_cipher';"
```

`Ssl_cipher` 값이 비어 있지 않아야(예: `TLS_AES_256_GCM_SHA384`) 실제로 암호화된 연결입니다.

---

## 2. 로컬 실행

```bash
npm install
cp .env.example .env
# .env를 열어 DB_HOST/DB_USER/DB_PASSWORD를 RDS 접속정보와 schema.sql에서 만든 계정으로 맞춰주세요.
# DB_SSL은 기본 true이며, certs/ap-northeast-2-bundle.pem이 있어야 부팅됩니다 (1-2번 참고).
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

### 3-1. Render (현재 배포 방식)

**현재 운영 중인 배포**: https://yaksok-qr.onrender.com (Live, RDS 연결 확인됨)

Render는 리버스 프록시 뒤에서 앱을 실행하고 `PORT` 환경변수를 직접 주입합니다. 이미 반영되어 있습니다 (`src/app.js`의 `app.set('trust proxy', 1)`, `src/server.js`의 `app.listen(env.port, '0.0.0.0', ...)`).

Render 대시보드 설정:
- **Build Command**: `npm install`
- **Start Command**: `npm start` (또는 `node src/server.js`)
- **Environment**: `.env.example`의 키를 전부 등록 (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`, `BASE_URL=https://yaksok-qr.onrender.com`, `ADMIN_API_KEY`, `NODE_ENV=production`). `PORT`는 Render가 자동 주입하므로 직접 설정하지 않습니다.
- **Health Check Path**: `/healthz` (아래 5-1번 참고) — Settings → Health Check Path에 등록하세요.
- `certs/ap-northeast-2-bundle.pem`은 저장소에 포함되어 있어 별도 업로드 없이 빌드됩니다.

배포 갱신은 `git push`로 연결된 브랜치에 반영하면 Render가 자동으로 재빌드/재배포합니다.

### 3-2. EC2 등 직접 서버에 배포하는 경우 (대안)

> Render를 쓰면 이 섹션은 필요 없습니다. EC2 등 직접 관리하는 서버에 배포할 때만 참고하세요.

```bash
npm install --production
npm install -g pm2

cp .env.example .env   # 서버용 값으로 채우기

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

Nginx + Let's Encrypt는 [nginx.conf.example](nginx.conf.example) 참고 (역시 Render 배포 시에는 불필요 — 파일 상단 안내 참고). 요약:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp nginx.conf.example /etc/nginx/sites-available/your-domain
sudo ln -s /etc/nginx/sites-available/your-domain /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain
```

### 3-3. 앱 연동 파일 채우기

**Android(`assetlinks.json`)는 디버그 키스토어 지문으로 채워진 상태**입니다 (`package_name: com.yaksok.yaksok`). `sha256_cert_fingerprints`는 배열이며, **릴리스 키스토어 지문을 받으면 기존 디버그 지문을 지우지 말고 배열에 추가**하세요 (JSON은 주석을 못 넣으니 이 규칙을 여기 README에 남겨둡니다). 디버그/릴리스 지문이 배열에 같이 있어도 문제없습니다 — Android는 서명이 일치하는 항목이 하나라도 있으면 검증을 통과시킵니다.

```json
"sha256_cert_fingerprints": [
  "C5:E2:40:45:8C:1C:93:B9:77:78:26:2F:80:32:89:D6:1E:4B:17:19:D3:E6:03:A0:89:79:11:A0:B5:CA:10:F2",
  "여기에 릴리스 지문 추가"
]
```

**iOS(`apple-app-site-association`)는 아직 플레이스홀더**입니다 (Team ID / Bundle ID 미수령). 앱 팀에게서 받아 채워주세요.

- Android: 릴리스 키스토어 SHA-256 서명 지문 (받는 대로 위 배열에 추가)
- iOS: Team ID + Bundle ID (`TEAMID.com.example.bundleid` 형식)

두 파일 모두 `src/app.js`에서 확장자 유무와 무관하게 `Content-Type: application/json`으로 명시 응답하며, `Cache-Control: no-store` 미들웨어보다 앞에 위치해 캐싱이 허용됩니다. 배포 후 확인:

```bash
curl -I https://yaksok-qr.onrender.com/.well-known/apple-app-site-association
curl -I https://yaksok-qr.onrender.com/.well-known/assetlinks.json
```

(EC2 등 직접 배포 시에는) `nginx.conf.example`에 Let's Encrypt ACME 챌린지(`/.well-known/acme-challenge/`)가 이 두 파일의 location과 절대 겹치지 않도록 `^~`/`=` 우선순위를 명시해뒀습니다.

### 3-4. 콜드 스타트 대응 (Render 무료 티어)

Render 무료 티어는 15분간 요청이 없으면 서비스가 중지되고, 다음 요청이 왔을 때 다시 뜨는 데 50초 이상 걸릴 수 있습니다. **시연 전에는 `curl https://yaksok-qr.onrender.com/healthz`를 한 번 호출해 서비스를 미리 깨워두세요.** 앱 연동 시 고려사항은 [docs/app-integration.md](docs/app-integration.md)의 안내를 따르세요 (API 타임아웃을 60초 이상으로 설정 권장).

### 3-5. 백업

**RDS 자동 백업(스냅샷)이 있다면 그것이 1차 복구 수단**이며, `scripts/backup.sh`는 특정 시점 SQL 덤프를 별도로 뽑아두기 위한 보조 수단입니다. RDS 콘솔 > 유지 관리 및 백업에서 자동 백업 활성화 여부와 보존 기간을 확인하세요.

```bash
sudo mkdir -p /var/backups/yaksok-qr
chmod +x scripts/backup.sh
crontab -e
# 매일 새벽 3시 백업
# 0 3 * * * /path/to/project/scripts/backup.sh >> /var/log/yaksok-backup.log 2>&1
```

비밀번호는 `--defaults-extra-file`(0600 권한의 임시 파일, 실행 후 자동 삭제)로 `mysqldump`에 전달되어 `ps`로 노출되지 않습니다. `yaksok_app` 계정은 RDS가 요구하는 `RELOAD`/`PROCESS` 같은 관리자 권한이 없으므로(의도적으로 최소 권한만 부여) `--set-gtid-purged=OFF --no-tablespaces` 옵션으로 `mysqldump`가 그런 권한을 요구하는 경로를 타지 않게 했습니다.

---

## 4. 발급자 API 인증

`POST /api/prescriptions`, `DELETE /api/prescriptions/:qrId`는 의료진(발급자) 전용이라 `X-API-Key` 헤더가 필요합니다. 값은 `.env`의 `ADMIN_API_KEY`와 `crypto.timingSafeEqual`로 비교됩니다(`src/middleware/adminAuth.js`). 헤더가 없거나 값이 다르면 `401 UNAUTHORIZED`입니다.

앱이 호출하는 `POST /api/prescription-qr/:qrId/session`, `GET /api/prescription-qr/:qrId`와 랜딩 페이지 `GET /prescription/:qrId`는 이 인증이 없는 공개 엔드포인트입니다(qrId + 세션 토큰으로 별도 보호됨).

웹 등록 폼(`/admin`)은 접속 시 키 입력 화면을 먼저 보여주고, 입력한 키를 `sessionStorage`에만 저장해 등록 요청 헤더로 사용합니다. 키가 틀리면 서버가 401을 반환하고 화면이 다시 키 입력으로 돌아갑니다. **키를 프론트 JS 코드에 하드코딩하지 않습니다.**

## 5. API 명세 요약

### 5-1. 헬스체크

```
GET /healthz
```

DB에 `SELECT 1`을 실제로 실행해서 연결까지 확인합니다. 인증 불필요, rate limit 미적용.

| 상태 | 응답 |
|---|---|
| 200 | `{ "status": "ok" }` |
| 503 | `{ "status": "error" }` (DB 연결 실패) |

Render의 헬스체크뿐 아니라, 콜드 스타트 후 서비스를 깨우는 용도로도 씁니다 (3-4번 참고).

### 5-2. 처방전 API

모든 응답은 `Cache-Control: no-store` (단, `.well-known` 앱 연동 파일 2종과 `/healthz`는 예외 — 각각 3-3번, 위 5-1번 참고). 에러는 공통으로 `{ "success": false, "error": { "code", "message" } }` 형식.

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
- 토큰 만료는 DB 서버 타임존과 무관하게 Node가 계산 (위 "타임존" 섹션 참고), `node-cron`으로 1시간마다 만료 토큰 삭제. 단, Render 무료 티어에서 서비스가 콜드 스타트로 중지된 동안에는 이 cron도 돌지 않습니다 — 만료 판정 자체는 조회 시점에 코드에서 항상 수행되므로 보안 문제는 없고, 만료된 레코드가 삭제되지 않고 일시적으로 더 쌓이는 정도의 영향입니다.
- DB는 RDS 접속 시 SSL 필수(`rejectUnauthorized: false` 사용 안 함, CA 번들로 서버 인증서 실제 검증), 애플리케이션 전용 계정(`yaksok_app`)만 사용하며 이 서비스가 쓰는 테이블 3개로만 권한을 좁힘 (admin/root 미사용)
- **TODO(운영 전 필수)**: RDS 보안 그룹이 현재 `0.0.0.0/0`으로 열려 있음 — 위 "기술 스택" 섹션의 경고 참고, EC2/특정 IP로 제한할 것
