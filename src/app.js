const path = require('path');
const express = require('express');

const noStore = require('./middleware/noStore');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const apiRouter = require('./routes/api');
const webRouter = require('./routes/web');

const app = express();

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

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.use('/api', apiRouter);
app.use('/', webRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
