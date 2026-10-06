const express = require('express');
const router = express.Router();
const industryController = require('../controllers/industry.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/', authenticate, industryController.listIndustries);
router.post('/', authenticate, industryController.createIndustry);

module.exports = router;
