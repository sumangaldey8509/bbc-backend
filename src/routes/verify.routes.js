const express = require('express');
const router = express.Router();
const { authenticate, requireModule } = require('../middlewares/auth.middleware');
const verifyController = require('../controllers/verify.controller');

router.use(authenticate);
router.use(requireModule('members'));

router.post('/', verifyController.handleVerification);

module.exports = router;
