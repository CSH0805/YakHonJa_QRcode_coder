const express = require('express');
const prescriptionController = require('../controllers/prescriptionController');
const sessionController = require('../controllers/sessionController');
const adminAuth = require('../middleware/adminAuth');
const { sessionLimiter, lookupLimiter, registerLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// 발급자(의사) 전용 - X-API-Key 인증 필요
router.post('/prescriptions', registerLimiter, adminAuth, prescriptionController.register);
router.delete('/prescriptions/:qrId', adminAuth, prescriptionController.revoke);

// 앱 전용 - 인증 없이 공개 (qrId + 세션 토큰으로 보호됨)
router.post('/prescription-qr/:qrId/session', sessionLimiter, sessionController.issueSession);
router.get('/prescription-qr/:qrId', lookupLimiter, sessionController.getPrescription);

module.exports = router;
