require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name}가 설정되지 않았습니다. .env를 확인하세요.`);
  }
  return value;
}

module.exports = {
  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    // 기본값 true: RDS 등 네트워크를 경유하는 접속은 SSL이 기본이어야 한다.
    // 명시적으로 "false"를 넣은 경우에만(예: 로컬 127.0.0.1) 끈다.
    ssl: process.env.DB_SSL !== 'false',
  },
  port: Number(process.env.PORT || 3000),
  baseUrl: required('BASE_URL').replace(/\/+$/, ''),
  adminApiKey: required('ADMIN_API_KEY'),
  nodeEnv: process.env.NODE_ENV || 'development',
};
