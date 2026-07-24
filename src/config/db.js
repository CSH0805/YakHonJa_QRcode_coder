const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('./env');

const CA_BUNDLE_PATH = path.join(__dirname, '..', '..', 'certs', 'ap-northeast-2-bundle.pem');

function buildSslOption() {
  if (!env.db.ssl) return undefined;

  let ca;
  try {
    ca = fs.readFileSync(CA_BUNDLE_PATH);
  } catch (err) {
    throw new Error(
      `DB_SSL=true인데 CA 번들을 읽을 수 없습니다 (${CA_BUNDLE_PATH}). ` +
        'README의 "RDS CA 번들 다운로드" 절차를 따르거나, 로컬 개발 등 정말 SSL이 필요 없는 ' +
        '환경이라면 .env에 DB_SSL=false를 설정하세요.'
    );
  }

  // rejectUnauthorized는 절대 false로 두지 않는다 (중간자 공격 방어 무력화 방지).
  // CA 번들로 서버 인증서를 실제로 검증한다.
  return { ca, rejectUnauthorized: true };
}

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  // 서버/DB가 어떤 로컬 타임존에 있든 DATETIME 값을 UTC 기준으로 쓰고 읽는다.
  // (access_tokens.expires_at처럼 Date 객체를 직접 바인딩하는 컬럼에 적용됨)
  // RDS 기본 타임존도 UTC지만, 이 옵션은 DB 서버 설정과 무관하게 항상 보장하기 위한 것이므로
  // 절대 제거하지 않는다.
  timezone: 'Z',
  ssl: buildSslOption(),
  // RDS는 네트워크를 경유하므로 로컬(127.0.0.1)보다 초기 연결 지연이 클 수 있다.
  connectTimeout: 10000,
  // RDS의 idle connection timeout으로 커넥션이 끊기는 것을 막기 위해 TCP keep-alive를 켠다.
  enableKeepAlive: true,
});

module.exports = pool;
