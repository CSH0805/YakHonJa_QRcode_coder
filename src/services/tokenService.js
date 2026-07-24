const crypto = require('crypto');
const pool = require('../config/db');
const { parseUtcDateTime } = require('../utils/utcDate');

const TOKEN_TTL_SECONDS = 3 * 60 * 60; // 3시간
const TOKEN_TTL_MS = TOKEN_TTL_SECONDS * 1000;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(qrId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  // created_at/expires_at 모두 MySQL NOW()/DATE_ADD가 아니라 Node에서 직접 계산해서 바인딩한다.
  // DB 서버의 세션 타임존이 무엇이든(SYSTEM=KST 등) 두 컬럼이 서로 다른 기준으로 섞이지 않도록
  // 같은 Date.now() 시점을 기준으로 둘 다 UTC로 기록한다 (풀의 timezone:'Z' 설정과 짝을 이룸).
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  await pool.query(
    `INSERT INTO access_tokens (token_hash, qr_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    [tokenHash, qrId, expiresAt, now]
  );

  return { token, expiresIn: TOKEN_TTL_SECONDS, expiresAt };
}

async function findByToken(token) {
  const tokenHash = hashToken(token);
  // 주의: mysql2 pool.query()는 옵션 객체로 dateStrings를 쿼리 단위로 override해도 실제로는
  // 반영되지 않는다(실측 확인됨) - 풀 기본값(dateStrings:true)대로 문자열이 돌아온다.
  // 그래서 문자열로 받은 뒤 여기서 명시적으로 UTC로 파싱해 Date 객체를 만들어 반환한다.
  const [rows] = await pool.query(
    'SELECT token_hash, qr_id, expires_at FROM access_tokens WHERE token_hash = ? LIMIT 1',
    [tokenHash]
  );
  const row = rows[0];
  if (!row) return null;

  return { ...row, expires_at: parseUtcDateTime(row.expires_at) };
}

async function deleteExpired() {
  // NOW()가 아니라 Node의 현재 시각을 바인딩해서 삭제 기준을 통일한다.
  const [result] = await pool.query('DELETE FROM access_tokens WHERE expires_at < ?', [new Date()]);
  return result.affectedRows;
}

module.exports = { TOKEN_TTL_SECONDS, createSession, findByToken, deleteExpired };
