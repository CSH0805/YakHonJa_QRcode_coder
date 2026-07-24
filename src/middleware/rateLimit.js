const rateLimit = require('express-rate-limit');

function tooManyRequestsHandler(req, res) {
  res.status(429).json({
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  });
}

// 세션 발급: IP당 분당 10회
const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// 조회: IP당 분당 60회
const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// 처방전 등록: IP당 분당 20회
const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

module.exports = { sessionLimiter, lookupLimiter, registerLimiter };
