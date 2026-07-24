# 앱 개발자용 — 로컬 서버 연동 안내 (임시)

의사(웹) 서버를 아직 배포하지 않고, 개발 PC에서 켜둔 서버에 **같은 네트워크(Wi-Fi)** 에 있는 팀원이 직접 붙어서 앱을 개발할 때 쓰는 임시 안내입니다. 실제 배포(Render) 기준 정식 문서는 [app-integration.md](app-integration.md)이며, 아래는 그중 "지금 당장 로컬로 테스트하려면 뭘 써야 하는지"만 정리한 것입니다.

## 1. 지금 접속 주소

```
BASE = http://172.30.1.80:3001
```

- `172.30.1.80`은 서버를 켜둔 PC가 **지금 이 Wi-Fi에서 쓰고 있는 사설 IP**입니다. 같은 Wi-Fi/네트워크에 연결되어 있어야만 접속됩니다 (다른 네트워크·데이터망에서는 안 됨).
- 이 IP는 서버 PC가 Wi-Fi를 바꾸거나 재부팅하면 바뀔 수 있습니다. 접속이 안 되면 먼저 이 문서의 주소가 아직 맞는지 확인 요청하세요.
- 포트는 `3001`. 프로토콜은 `http`(로컬 임시라 https 아님)입니다.

접속 확인:
```
GET http://172.30.1.80:3001/healthz
→ { "status": "ok" }
```
이게 안 뜨면 서버가 꺼져 있거나, 네트워크가 다르거나, 방화벽에 막힌 겁니다 (5번 참고).

## 2. QR URL 형식 (로컬 임시)

```
http://172.30.1.80:3001/prescription/{qrId}
```

**주의**: 실제 배포되면 이 형식이 `https://yaksok-qr.onrender.com/prescription/{qrId}`로 바뀝니다. `qrId` 뒤 경로 구조(`/prescription/{qrId}`)는 동일하니, 그 부분만 맞춰서 파싱 로직을 짜면 배포 URL로 바뀌어도 코드 수정이 거의 없습니다.

지금 단계에서는 Android App Links / iOS Universal Links(QR 스캔 시 앱이 자동으로 뜨는 기능)는 **테스트할 수 없습니다** — 그건 실제 도메인 소유 검증(`assetlinks.json`/`apple-app-site-association`)이 필요해서 로컬 IP로는 안 됩니다. 지금은 QR을 스캔해서 나온 URL의 `{qrId}` 부분만 앱에서 파싱해서 쓰거나, `qrId` 값을 직접 코드/설정에 넣어 API 호출을 테스트하는 방식으로 진행하면 됩니다.

## 3. 앱이 실제로 호출할 API 2개

인증(API 키) 필요 없습니다 — 처방전 등록/폐기(의료진용)만 API 키가 필요하고, 앱이 쓰는 이 2개는 공개 API입니다.

### 3-1. 세션 발급

```
POST http://172.30.1.80:3001/api/prescription-qr/{qrId}/session
```
```json
{ "success": true, "data": { "access_token": "...", "expires_in": 10800 } }
```

### 3-2. 처방전 조회

```
GET http://172.30.1.80:3001/api/prescription-qr/{qrId}
Authorization: Bearer {access_token}
```
```json
{
  "success": true,
  "data": {
    "times": ["morning", "afternoon", "evening"],
    "start_date": "2026-07-24",
    "end_date": "2026-07-30",
    "medicines": [
      { "medicine_name": "감기약", "dose_amount": "1정", "caution": "음주를 피하세요" }
    ]
  }
}
```

전체 에러 코드 표, 토큰 취급 지침(3시간 만료, 재발급 방법), 중복 추가 정책은 [app-integration.md](app-integration.md) 2~6번 그대로 적용됩니다 — 도메인만 위 1번 주소로 바꿔서 보면 됩니다.

## 4. 테스트용 qrId 받는 법

처방전 등록은 의료진 화면(`/admin`)에서 제가 진행합니다. 테스트해볼 `qrId`가 필요하면 말씀해주세요 — 등록 후 나온 `qr_id`를 공유해드리겠습니다. (직접 등록하려면 API 키가 필요한데, 앱 개발에는 필요 없는 키라 공유하지 않습니다.)

## 5. 접속이 안 될 때 체크리스트

1. 서버 PC와 같은 Wi-Fi에 연결돼 있는지
2. 서버 PC에서 `npm run dev`(또는 `npm start`)가 실제로 켜져 있는지
3. 브라우저로 `http://172.30.1.80:3001/healthz` 먼저 직접 열어서 확인 (앱 코드 문제인지 네트워크 문제인지 구분됨)
4. 그래도 안 되면 서버 PC의 Windows 방화벽이 Node.js 인바운드 연결을 막고 있을 수 있음 — 서버 PC에서 "Windows Defender 방화벽" → "허용된 앱" 에서 Node.js가 개인 네트워크에서 허용되어 있는지 확인 필요 (제가 처리하겠습니다, 안 되면 알려주세요)
