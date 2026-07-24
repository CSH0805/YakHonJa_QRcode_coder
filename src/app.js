const path = require('path');
const express = require('express');

const noStore = require('./middleware/noStore');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { healthz } = require('./controllers/healthController');
const apiRouter = require('./routes/api');
const webRouter = require('./routes/web');

const app = express();

// Render 등 리버스 프록시 뒤에서 실행되므로 X-Forwarded-For의 첫 번째 홉만 신뢰한다.
// true를 쓰면 클라이언트가 X-Forwarded-For를 위조해 IP 기반 rate limit을 우회할 수 있어 금지.
app.set('trust proxy', 1);

const WELL_KNOWN_DIR = path.join(__dirname, '..', 'public', '.well-known');

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Android/iOS 앱 링크 검증 파일: 플랫폼이 캐싱해도 되므로 no-store 미들웨어보다 앞에 두어
// 대상에서 제외하고, 확장자가 없어도 정확한 Content-Type을 명시적으로 응답한다
// (express.static의 기본 mime 추론에 맡기지 않는다).
app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(WELL_KNOWN_DIR, 'apple-app-site-association'));
});

app.get('/.well-known/assetlinks.json', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(WELL_KNOWN_DIR, 'assetlinks.json'));
});

app.use(noStore);

// Render 헬스체크 + 콜드 스타트 이후 서비스를 깨우는 용도. 인증 불필요, rate limit 미적용.
// DB까지 SELECT 1로 확인하므로 DB 연결이 끊긴 상태면 503을 반환한다.
app.get('/healthz', healthz);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.use('/api', apiRouter);
app.use('/', webRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
