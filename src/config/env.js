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
  },
  port: Number(process.env.PORT || 3000),
  baseUrl: required('BASE_URL').replace(/\/+$/, ''),
  adminApiKey: required('ADMIN_API_KEY'),
  nodeEnv: process.env.NODE_ENV || 'development',
};
