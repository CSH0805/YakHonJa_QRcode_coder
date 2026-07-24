# API curl 테스트 예시

`BASE`는 로컬 실행 시 `http://localhost:3000` (또는 실행 시 설정한 `PORT`), 배포 후에는 `https://yaksok-qr.onrender.com` 로 바꿔서 사용하세요.

등록/폐기(`POST`, `DELETE /api/prescriptions*`)는 발급자 전용 API라 `X-API-Key` 헤더가 필요합니다. 세션 발급/조회(`/api/prescription-qr/*`)는 앱이 호출하는 공개 엔드포인트라 키가 필요 없습니다.

```bash
BASE=http://localhost:3000
ADMIN_API_KEY=.env의_ADMIN_API_KEY_값
```

## 1. 처방전 등록 (약 여러 개 + 공통 일정)

```bash
curl -sS -X POST "$BASE/api/prescriptions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -d '{
    "times": ["morning", "afternoon", "evening"],
    "start_date": "2026-07-24",
    "end_date": "2026-07-30",
    "medicines": [
      { "medicine_name": "감기약", "dose_amount": "1정", "caution": "음주를 피하세요" },
      { "medicine_name": "멀미약", "dose_amount": "1정", "caution": "" },
      { "medicine_name": "가래약", "dose_amount": "1포", "caution": "" },
      { "medicine_name": "두통약", "dose_amount": "1정", "caution": "공복에 복용하지 마세요" }
    ]
  }'
```

응답의 `data.qr_id` 값을 아래 예시들에 `QR_ID`로 사용합니다.

```bash
QR_ID=응답에서_받은_qr_id
```

## 2. 세션 발급 (앱이 호출하는 1단계, 인증 불필요)

```bash
curl -sS -X POST "$BASE/api/prescription-qr/$QR_ID/session"
```

```bash
TOKEN=응답에서_받은_access_token
```

## 3. 처방 전체 조회 (앱이 호출하는 2단계, 인증 불필요)

```bash
curl -sS "$BASE/api/prescription-qr/$QR_ID" \
  -H "Authorization: Bearer $TOKEN"
```

응답 예시:

```json
{
  "success": true,
  "data": {
    "times": ["morning", "afternoon", "evening"],
    "start_date": "2026-07-24",
    "end_date": "2026-07-30",
    "medicines": [
      { "medicine_name": "감기약", "dose_amount": "1정", "caution": "음주를 피하세요" },
      { "medicine_name": "멀미약", "dose_amount": "1정", "caution": null },
      { "medicine_name": "가래약", "dose_amount": "1포", "caution": null },
      { "medicine_name": "두통약", "dose_amount": "1정", "caution": "공복에 복용하지 마세요" }
    ]
  }
}
```

## 4. QR 폐기 (발급자 전용, X-API-Key 필요)

```bash
curl -sS -X DELETE "$BASE/api/prescriptions/$QR_ID" \
  -H "X-API-Key: $ADMIN_API_KEY"
```

## 5. 발급자 API 인증 확인

```bash
# 키 없이 등록 -> 401 UNAUTHORIZED
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/prescriptions" \
  -H "Content-Type: application/json" \
  -d '{"times":["morning"],"start_date":"2026-07-24","end_date":"2026-07-30","medicines":[{"medicine_name":"x","dose_amount":"1정"}]}'

# 틀린 키로 등록 -> 401 UNAUTHORIZED
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/prescriptions" \
  -H "Content-Type: application/json" -H "X-API-Key: wrong-key" \
  -d '{"times":["morning"],"start_date":"2026-07-24","end_date":"2026-07-30","medicines":[{"medicine_name":"x","dose_amount":"1정"}]}'

# 키 없이 폐기 -> 401 UNAUTHORIZED
curl -sS -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE/api/prescriptions/$QR_ID"
```

## 에러 케이스 확인

```bash
# 존재하지 않는 QR로 세션 발급 -> 404 QR_NOT_FOUND
curl -sS -X POST "$BASE/api/prescription-qr/0000000000000000000000000000000000000000000000000000000000000000/session"

# 토큰 없이 조회 -> 401 INVALID_TOKEN
curl -sS "$BASE/api/prescription-qr/$QR_ID"

# 잘못된 토큰으로 조회 -> 401 INVALID_TOKEN
curl -sS "$BASE/api/prescription-qr/$QR_ID" -H "Authorization: Bearer invalid-token"

# 폐기 후 세션 발급 -> 410 QR_REVOKED
curl -sS -X DELETE "$BASE/api/prescriptions/$QR_ID" -H "X-API-Key: $ADMIN_API_KEY"
curl -sS -X POST "$BASE/api/prescription-qr/$QR_ID/session"

# 필수 필드 누락 등록 -> 400 VALIDATION_ERROR
curl -sS -X POST "$BASE/api/prescriptions" \
  -H "Content-Type: application/json" -H "X-API-Key: $ADMIN_API_KEY" \
  -d '{"times": ["morning"], "start_date": "2026-07-24", "end_date": "2026-07-30"}'
```

## 헬스체크 (콜드 스타트 깨우기)

```bash
curl -sS "$BASE/healthz"
```

`{"status":"ok"}` (200)이면 정상. Render 무료 티어에서 서비스가 잠들어 있었다면 응답까지 50초 이상 걸릴 수 있습니다.

## .well-known 앱 연동 파일 Content-Type 확인

```bash
curl -I "$BASE/.well-known/apple-app-site-association"
curl -I "$BASE/.well-known/assetlinks.json"
```

두 응답 모두 `Content-Type: application/json`이어야 하고, `Cache-Control: no-store`가 **없어야** 합니다.

## 웹 화면 확인

```bash
# 서비스 소개 페이지
open "$BASE/"

# 처방전 등록 페이지 (의료진용, API 키 입력 필요)
open "$BASE/admin"

# QR 랜딩 페이지 (브라우저에서 직접 열었을 때)
open "$BASE/prescription/$QR_ID"
```
