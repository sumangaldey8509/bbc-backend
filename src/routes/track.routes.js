const express = require('express');
const router = express.Router();
const { optionalAuthenticate } = require('../middlewares/auth.middleware');
const trackController = require('../controllers/track.controller');

router.use(optionalAuthenticate);
router.post('/', trackController.trackVisit);

module.exports = router;
