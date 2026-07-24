const crypto = require('crypto');
const env = require('../config/env');

function unauthorized(res) {
  res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' },
  });
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function adminAuth(req, res, next) {
  const provided = req.get('X-API-Key');

  if (!provided || !timingSafeEqualStrings(provided, env.adminApiKey)) {
    return unauthorized(res);
  }

  next();
}

module.exports = adminAuth;
