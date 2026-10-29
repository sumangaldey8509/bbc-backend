const express = require('express');
const router = express.Router();
const { authenticate, requireModule } = require('../middlewares/auth.middleware');
const reportController = require('../controllers/report.controller');

router.use(authenticate);
router.use(requireModule('reports'));

router.get('/', reportController.getTables);
router.post('/', reportController.runReport);

module.exports = router;
