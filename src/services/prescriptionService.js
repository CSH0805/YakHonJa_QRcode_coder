const pool = require('../config/db');
const { generateQrId } = require('./qrService');

async function createPrescription(input) {
  const qrId = generateQrId();
  const { times, start_date, end_date, medicines } = input;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO prescriptions (qr_id, times, start_date, end_date, revoked_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [qrId, JSON.stringify(times), start_date, end_date, new Date()]
    );

    for (let i = 0; i < medicines.length; i += 1) {
      const { medicine_name, dose_amount, caution } = medicines[i];
      await conn.query(
        `INSERT INTO prescription_items (qr_id, medicine_name, dose_amount, caution, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [qrId, medicine_name, dose_amount, caution || null, i]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return qrId;
}

// 랜딩 페이지용 - 존재 여부/폐기 여부만 확인 (처방 내용은 절대 조회하지 않음)
async function getStatus(qrId) {
  const [rows] = await pool.query(
    'SELECT qr_id, revoked_at FROM prescriptions WHERE qr_id = ? LIMIT 1',
    [qrId]
  );
  if (!rows[0]) return null;
  return { exists: true, revoked: rows[0].revoked_at !== null };
}

// 인증된 앱 조회용 - 처방 전체(공통 일정 + 약 목록) 반환
async function getFullByQrId(qrId) {
  // start_date/end_date는 타임존 개념이 없는 달력 날짜이므로 DATE_FORMAT으로 항상
  // 'YYYY-MM-DD' 문자열로 반환되도록 강제한다 (드라이버 설정 변경 등에도 안전).
  const [prescriptionRows] = await pool.query(
    `SELECT qr_id, times,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
            revoked_at
     FROM prescriptions WHERE qr_id = ? LIMIT 1`,
    [qrId]
  );
  const prescription = prescriptionRows[0];
  if (!prescription) return null;

  const [itemRows] = await pool.query(
    `SELECT medicine_name, dose_amount, caution
     FROM prescription_items WHERE qr_id = ? ORDER BY sort_order ASC, id ASC`,
    [qrId]
  );

  return {
    qr_id: prescription.qr_id,
    times: typeof prescription.times === 'string' ? JSON.parse(prescription.times) : prescription.times,
    start_date: prescription.start_date,
    end_date: prescription.end_date,
    revoked_at: prescription.revoked_at,
    medicines: itemRows.map((row) => ({
      medicine_name: row.medicine_name,
      dose_amount: row.dose_amount,
      caution: row.caution,
    })),
  };
}

async function revoke(qrId) {
  const [rows] = await pool.query('SELECT qr_id, revoked_at FROM prescriptions WHERE qr_id = ? LIMIT 1', [qrId]);
  const row = rows[0];
  if (!row) return null;

  if (!row.revoked_at) {
    await pool.query('UPDATE prescriptions SET revoked_at = ? WHERE qr_id = ?', [new Date(), qrId]);
  }
  await pool.query('DELETE FROM access_tokens WHERE qr_id = ?', [qrId]);

  const [after] = await pool.query('SELECT qr_id, revoked_at FROM prescriptions WHERE qr_id = ? LIMIT 1', [qrId]);
  return after[0];
}

module.exports = { createPrescription, getStatus, getFullByQrId, revoke };
