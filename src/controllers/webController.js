const prescriptionService = require('../services/prescriptionService');

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function page({ title, heading, body, status }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} - YakSok</title>
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <main class="landing">
    <div class="brand">YakSok</div>
    <h1>${escapeHtml(heading)}</h1>
    ${body}
  </main>
</body>
</html>`;
}

async function landing(req, res, next) {
  try {
    const { qrId } = req.params;

    if (!/^[0-9a-f]{64}$/.test(qrId)) {
      return res.status(404).send(page({
        title: '존재하지 않는 QR',
        heading: '존재하지 않는 QR입니다',
        body: '<p>QR 코드를 다시 확인해주세요.</p>',
      }));
    }

    const status = await prescriptionService.getStatus(qrId);

    if (!status) {
      return res.status(404).send(page({
        title: '존재하지 않는 QR',
        heading: '존재하지 않는 QR입니다',
        body: '<p>QR 코드를 다시 확인해주세요.</p>',
      }));
    }

    if (status.revoked) {
      return res.status(410).send(page({
        title: '폐기된 QR',
        heading: '폐기된 QR입니다',
        body: '<p>담당 의료진에게 새로운 QR 발급을 요청해주세요.</p>',
      }));
    }

    return res.status(200).send(page({
      title: '처방전 QR',
      heading: 'YakSok 앱으로 스캔해주세요',
      body: `
        <p>이 QR은 YakSok 앱에서 스캔하면 처방전에 담긴 모든 약이 복약 일정에 자동으로 등록됩니다.</p>
        <p>처방 정보는 보안을 위해 앱에서 인증 후에만 확인할 수 있습니다.</p>
        <div class="store-links">
          <a href="#" class="store-link">App Store에서 받기</a>
          <a href="#" class="store-link">Google Play에서 받기</a>
        </div>
      `,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = { landing };
