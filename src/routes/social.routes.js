const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const socialController = require('../controllers/social.controller');

router.use(authenticate);

router.get('/', socialController.getSocial);
router.post('/', socialController.handleSocialAction);

module.exports = router;
