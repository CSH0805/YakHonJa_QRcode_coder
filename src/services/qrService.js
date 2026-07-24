const crypto = require('crypto');
const QRCode = require('qrcode');
const env = require('../config/env');

function generateQrId() {
  return crypto.randomBytes(32).toString('hex');
}

function buildQrUrl(qrId) {
  return `${env.baseUrl}/prescription/${qrId}`;
}

async function generateQrImageDataUrl(url) {
  return QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
}

module.exports = { generateQrId, buildQrUrl, generateQrImageDataUrl };
