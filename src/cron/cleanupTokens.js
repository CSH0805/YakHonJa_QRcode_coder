const cron = require('node-cron');
const tokenService = require('../services/tokenService');

function startTokenCleanupCron() {
  // 매시 정각에 만료된 access_token 삭제
  cron.schedule('0 * * * *', async () => {
    try {
      const deleted = await tokenService.deleteExpired();
      if (deleted > 0) {
        console.log(`[cron] expired access_tokens 삭제: ${deleted}건`);
      }
    } catch (err) {
      console.error('[cron] 만료 토큰 정리 실패:', err.message);
    }
  });
}

module.exports = startTokenCleanupCron;
