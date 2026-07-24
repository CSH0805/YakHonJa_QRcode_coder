const pool = require('../config/db');

async function healthz(req, res) {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error' });
  }
}

module.exports = { healthz };
