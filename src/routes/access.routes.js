const express = require('express');
const router = express.Router();
const { authenticate, requireModule } = require('../middlewares/auth.middleware');
const accessController = require('../controllers/access.controller');

router.use(authenticate);
router.use(requireModule('access'));

router.all('/:k', accessController.handleAccess);

module.exports = router;
