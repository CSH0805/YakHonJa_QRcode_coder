const env = require('./config/env');
const app = require('./app');
const startTokenCleanupCron = require('./cron/cleanupTokens');

app.listen(env.port, () => {
  console.log(`YakSok QR server listening on port ${env.port} (${env.nodeEnv})`);
  startTokenCleanupCron();
});
