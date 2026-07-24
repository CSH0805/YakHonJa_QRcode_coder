const AppError = require('../utils/AppError');
const { validatePrescriptionInput } = require('../utils/validatePrescriptionInput');
const prescriptionService = require('../services/prescriptionService');
const qrService = require('../services/qrService');

async function register(req, res, next) {
  try {
    const errors = validatePrescriptionInput(req.body);
    if (errors.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', errors.join(' '));
    }

    const { times, start_date, end_date, medicines } = req.body;
    const qrId = await prescriptionService.createPrescription({
      times,
      start_date,
      end_date,
      medicines: medicines.map((m) => ({
        medicine_name: m.medicine_name,
        dose_amount: m.dose_amount,
        caution: m.caution,
      })),
    });

    const qrUrl = qrService.buildQrUrl(qrId);
    const qrImage = await qrService.generateQrImageDataUrl(qrUrl);

    res.status(201).json({
      success: true,
      data: { qr_id: qrId, qr_url: qrUrl, qr_image: qrImage },
    });
  } catch (err) {
    next(err);
  }
}

async function revoke(req, res, next) {
  try {
    const { qrId } = req.params;
    const result = await prescriptionService.revoke(qrId);
    if (!result) {
      throw new AppError(404, 'QR_NOT_FOUND', '존재하지 않는 QR입니다.');
    }

    res.status(200).json({
      success: true,
      data: { qr_id: result.qr_id, revoked_at: result.revoked_at },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, revoke };
