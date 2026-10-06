const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const uploadController = require('../controllers/upload.controller');
const { sendError } = require('../helpers/response.helper');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// POST /api/uploads  (multipart/form-data, field: "file")
router.post(
  '/',
  authenticate,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 10 MB).' : err.message;
        return sendError(res, message, 400, err);
      }
      if (err) return sendError(res, err.message || 'Upload failed.', 400, err);
      next();
    });
  },
  uploadController.uploadFile
);

module.exports = router;
