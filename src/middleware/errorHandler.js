const AppError = require('../utils/AppError');

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: '요청하신 경로를 찾을 수 없습니다.' },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '요청 본문이 올바른 JSON 형식이 아닙니다.' },
    });
  }

  // 내부 정보(스택 트레이스, SQL 등)는 응답에 절대 노출하지 않는다.
  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
  });
}

module.exports = { notFoundHandler, errorHandler };
