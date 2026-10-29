const express = require('express');
const router = express.Router();
const { authenticate, requireModule } = require('../middlewares/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');

router.use(authenticate);
router.use(requireModule('dashboard'));

router.get('/', dashboardController.getDashboardSummary);

module.exports = router;
