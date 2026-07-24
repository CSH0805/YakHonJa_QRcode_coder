const mysql = require('mysql2/promise');
const env = require('./env');

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
  timezone: 'Z',
});

module.exports = pool;
