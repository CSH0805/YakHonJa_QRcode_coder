const AppError = require('../utils/AppError');
const prescriptionService = require('../services/prescriptionService');
const tokenService = require('../services/tokenService');

function extractBearerToken(req) {
  const header = req.get('authorization') || req.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;
  return token;
}

async function issueSession(req, res, next) {
  try {
    const { qrId } = req.params;
    const status = await prescriptionService.getStatus(qrId);

    if (!status) {
      throw new AppError(404, 'QR_NOT_FOUND', '존재하지 않는 QR입니다.');
    }
    if (status.revoked) {
      throw new AppError(410, 'QR_REVOKED', '폐기된 QR입니다.');
    }

    const { token, expiresIn } = await tokenService.createSession(qrId);

    res.status(200).json({
      success: true,
      data: { access_token: token, expires_in: expiresIn },
    });
  } catch (err) {
    next(err);
  }
}

async function getPrescription(req, res, next) {
  try {
    const { qrId } = req.params;
    const token = extractBearerToken(req);

    if (!token) {
      throw new AppError(401, 'INVALID_TOKEN', '인증 토큰이 필요합니다.');
    }

    const tokenRow = await tokenService.findByToken(token);
    if (!tokenRow) {
      throw new AppError(401, 'INVALID_TOKEN', '유효하지 않은 토큰입니다.');
    }

    if (tokenRow.qr_id !== qrId) {
      throw new AppError(403, 'TOKEN_MISMATCH', '토큰이 이 QR에 대한 것이 아닙니다.');
    }

    const prescription = await prescriptionService.getFullByQrId(qrId);
    if (!prescription) {
      throw new AppError(404, 'QR_NOT_FOUND', '존재하지 않는 QR입니다.');
    }

    if (tokenRow.expires_at.getTime() < Date.now()) {
      throw new AppError(410, 'TOKEN_EXPIRED', '토큰이 만료되었습니다.');
    }

    if (prescription.revoked_at) {
      throw new AppError(410, 'QR_REVOKED', '폐기된 QR입니다.');
    }

    res.status(200).json({
      success: true,
      data: {
        times: prescription.times,
        start_date: prescription.start_date,
        end_date: prescription.end_date,
        medicines: prescription.medicines,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { issueSession, getPrescription };
