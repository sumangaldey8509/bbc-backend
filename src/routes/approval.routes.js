const express = require('express');
const router = express.Router();
const { authenticate, requireModule } = require('../middlewares/auth.middleware');
const approvalController = require('../controllers/approval.controller');

router.use(authenticate);
router.use(requireModule('approvals'));

router.get('/', approvalController.getApprovals);
router.post('/', approvalController.createApproval);
router.put('/', approvalController.decideApproval);

module.exports = router;
