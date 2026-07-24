const express = require('express');
const webController = require('../controllers/webController');

const router = express.Router();

router.get('/prescription/:qrId', webController.landing);

module.exports = router;
