# YakSok 앱 연동 가이드

YakSok 앱 개발자를 위한 문서입니다. 이 문서만 보고 QR 스캔 → 복약 일정 등록까지 연동할 수 있어야 합니다.

> ## ⚠️ 경로 변경 안내 (필독)
> 이전에 공유된 초안에서는 QR 경로가 `/medicine/{qrId}` 였고 API도 "약 1개"를 반환했습니다.
> **현재는 QR 1개 = 처방전 1개** 구조로 바뀌었고, 아래처럼 전부 변경되었습니다.
>
> | 항목 | 이전 | 현재 |
> |---|---|---|
> | QR 랜딩 경로 | `/medicine/{qrId}` | `/prescription/{qrId}` |
> | 세션 발급 API | `/api/medicine-qr/{qrId}/session` | `/api/prescription-qr/{qrId}/session` |
> | 조회 API | `/api/medicine-qr/{qrId}` | `/api/prescription-qr/{qrId}` |
> | 조회 응답 구조 | 약 1개의 필드가 최상위에 바로 있음 | `medicines` 배열로 감싸짐 (아래 3번 참고) |
>
> 이미 이전 경로/응답 구조로 작업을 시작했다면 반드시 아래 내용으로 갱신해주세요.
>
> **도메인도 변경되었습니다**: `qr.yaksok.kr` → `yaksok-qr.onrender.com` (아래 전체가 새 도메인 기준으로 갱신됨).

---

## 1. 전체 플로우

```
1. 환자가 QR 스캔
2. 앱이 https://yaksok-qr.onrender.com/prescription/{qrId} 형태의 URL을 받음 (App Link / Universal Link로 앱이 직접 실행됨)
3. 앱이 qrId를 추출해 세션 발급 API 호출 → access_token 획득 (3시간 유효)
4. 앱이 access_token으로 조회 API 호출 → 처방전 전체(공통 일정 + 약 목록) 획득
5. 앱이 로컬 복약 일정에 처방전 내 약들을 등록
6. 이미 등록된 qrId면 재등록하지 않고 "이미 추가한 처방전입니다" 안내 (아래 6번 참고)
```

QR 자체는 만료되지 않습니다. 만료되는 건 access_token뿐이며, 필요할 때마다 세션 발급 API를 다시 호출해 재발급받으면 됩니다.

## 2. QR URL 형식

```
https://yaksok-qr.onrender.com/prescription/{qrId}
```

- `qrId`는 64자 hex 문자열이며 그 자체로 추측 불가능한 식별자입니다. URL에 별도 토큰 쿼리 파라미터는 없습니다.
- 앱이 설치되어 있지 않은 환경에서 이 URL을 브라우저로 열면 서버가 렌더링하는 안내 페이지(앱 설치 유도)가 뜹니다. 이 페이지에는 처방 내용이 절대 포함되지 않습니다.

## 3. API 상세

### 3-1. 세션 발급

```
POST /api/prescription-qr/{qrId}/session
```

**성공 (200)**
```json
{
  "success": true,
  "data": {
    "access_token": "e9987756bfd2962196772fa717f2f897ca3737c5e52bf9badf65cc541019654d",
    "expires_in": 10800
  }
}
```

`expires_in`은 초 단위이며 항상 `10800`(3시간)입니다.

| 상태 | code | 상황 |
|---|---|---|
| 404 | `QR_NOT_FOUND` | qrId가 존재하지 않음 |
| 410 | `QR_REVOKED` | 처방전이 폐기됨 |
| 429 | `TOO_MANY_REQUESTS` | 세션 발급 IP당 분당 10회 초과 |

### 3-2. 처방전 조회

```
GET /api/prescription-qr/{qrId}
Authorization: Bearer {access_token}
```

**성공 (200)**
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

**변경 전/후 응답 구조 비교**

| | 이전 (약 1개) | 현재 (처방전 1개) |
|---|---|---|
| 최상위 필드 | `medicine_name`, `dose_amount`, `times`, `start_date`, `end_date`, `caution` | `times`, `start_date`, `end_date`, `medicines[]` |
| 약 이름/용량/주의사항 | 최상위에 직접 존재 | `medicines[i].medicine_name` / `dose_amount` / `caution` |
| 복용 시간/기간 | 약마다 개별 | 처방전 전체 공통 (`times`, `start_date`, `end_date`) |

`times`는 `["morning", "afternoon", "evening", "bedtime"]` 중 1개 이상의 조합입니다. `caution`은 약마다 없을 수 있으며 이 경우 `null`이 옵니다.

| 상태 | code | 상황 |
|---|---|---|
| 401 | `INVALID_TOKEN` | 토큰 없음/형식 오류/DB에 없음 |
| 403 | `TOKEN_MISMATCH` | 토큰의 qrId와 URL의 qrId가 다름 |
| 404 | `QR_NOT_FOUND` | qrId가 존재하지 않음 |
| 410 | `TOKEN_EXPIRED` | 토큰 만료 |
| 410 | `QR_REVOKED` | 처방전 폐기됨 |
| 429 | `TOO_MANY_REQUESTS` | 조회 IP당 분당 60회 초과 |

## 4. 에러 코드 전체 표 및 앱 처리 가이드

| HTTP | code | 사용자 안내 문구 예시 | 앱 동작 |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | (앱에서는 발생하지 않음 — 등록 API 전용) | - |
| 401 | `INVALID_TOKEN` | "다시 시도해주세요" | 세션 재발급 API 호출 후 1회 재시도 |
| 403 | `TOKEN_MISMATCH` | "다시 시도해주세요" | 세션 재발급 후 재시도 (정상 흐름에서는 발생하지 않아야 함) |
| 404 | `QR_NOT_FOUND` | "존재하지 않는 QR입니다" | 재시도 금지, 스캔 실패로 안내 |
| 410 | `TOKEN_EXPIRED` | (사용자에게 노출 불필요) | 세션 재발급 후 자동 재시도 |
| 410 | `QR_REVOKED` | "폐기된 처방전입니다" | 재시도 금지 |
| 429 | `TOO_MANY_REQUESTS` | "잠시 후 다시 시도해주세요" | 잠시 대기 후 재시도 (지수 백오프 권장) |

모든 에러 응답 공통 형식:
```json
{ "success": false, "error": { "code": "TOKEN_EXPIRED", "message": "토큰이 만료되었습니다." } }
```
`message`는 참고용 한국어 문구이며, 사용자에게 보여줄 문구는 위 표 기준으로 앱에서 직접 관리하는 것을 권장합니다.

## 5. 토큰 취급 지침

- `access_token`은 발급 후 **3시간**만 유효합니다.
- 앱 로컬(디스크, 영구 저장소)에 저장하지 마세요. 메모리에만 유지하고, 필요할 때마다 세션 발급 API로 재발급받는 방식을 권장합니다.
- `401 INVALID_TOKEN` 또는 `410 TOKEN_EXPIRED`를 받으면 세션 발급 API를 다시 호출해 새 토큰을 받은 뒤 원래 요청을 1회 재시도하세요.

## 6. 중복 추가 정책

서버는 같은 qrId에 대한 재조회를 막지 않습니다(멱등). 중복 방지는 **앱 책임**입니다.

- 앱이 로컬에 "이미 등록 완료된 qrId 목록"을 보관하세요.
- 스캔한 qrId가 이미 목록에 있으면 조회 API를 다시 호출하지 말고 "이미 추가한 처방전입니다"를 바로 안내하세요.
- 새 qrId면 정상 플로우(세션 발급 → 조회 → 로컬 등록 → 목록에 추가)를 진행하세요.

## 7. App Links / Universal Links 설정을 위해 서버 팀에 전달할 값

서버는 `https://yaksok-qr.onrender.com/.well-known/assetlinks.json`, `.../apple-app-site-association`을 정적으로 서빙할 준비가 되어 있지만, 아래 값은 플레이스홀더 상태입니다. 앱 팀에서 값을 전달해주셔야 실제 배포가 가능합니다.

- **Android**: 패키지명(`applicationId`), 릴리스 키스토어의 SHA-256 서명 지문
- **iOS**: Apple Developer Team ID, Bundle ID

두 파일 모두 `paths`에 `/prescription/*` 하나만 등록되어 있으니, 다른 경로도 앱에서 열어야 한다면 별도로 알려주세요.

## 8. 콜드 스타트 대응 (중요)

서버가 Render 무료 티어에 배포되어 있습니다. **15분간 요청이 없으면 서비스가 중지되고, 다음 요청이 왔을 때 다시 뜨는 데 50초 이상 걸릴 수 있습니다.** 세션 발급/조회 API가 평소보다 오래 걸린다고 해서 실패로 간주하지 마세요.

- **API 호출 타임아웃을 최소 60초로 설정하세요.** 기본값(보통 10~30초)으로 두면 콜드 스타트 중 정상 요청이 타임아웃으로 실패합니다.
- `GET /healthz`로 미리 깨워둘 수 있습니다 (인증 불필요, DB 연결까지 확인 후 `{"status":"ok"}` 반환). 시연/테스트 직전에 한 번 호출해두는 것을 권장합니다.
