const express = require('express');
const router = express.Router();
const { authenticate, requireModule } = require('../middlewares/auth.middleware');
const settingsController = require('../controllers/settings.controller');

router.use(authenticate);
router.use(requireModule('settings'));

router.all('/:k', settingsController.handleSettings);

module.exports = router;
