const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const dataController = require('../controllers/data.controller');

router.use(authenticate);

router.get('/:col', dataController.listDocuments);
router.post('/:col', dataController.createDocument);
router.put('/:col', dataController.updateDocument);
router.delete('/:col', dataController.deleteDocument);

module.exports = router;
