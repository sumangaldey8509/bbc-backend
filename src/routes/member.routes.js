const express = require('express');
const router = express.Router();
const { authenticate, requireModule } = require('../middlewares/auth.middleware');
const memberController = require('../controllers/member.controller');

router.use(authenticate);
router.use(requireModule('members'));

router.get('/', memberController.getMembers);
router.post('/', memberController.createMember);

module.exports = router;
