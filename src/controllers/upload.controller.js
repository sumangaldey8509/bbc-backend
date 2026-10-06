const { uploadBuffer } = require('../lib/cloudinary');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const { userFolderSlug } = require('../utils/slug');
const config = require('../config');

const IMAGE_MIME = /^image\/(png|jpe?g|webp|gif|heic|heif)$/i;
const DOC_MIME = /^application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i;

/**
 * POST /api/uploads — multipart, field `file`, optional `kind`
 * ("avatar" | "cover" | "document").
 *
 * Everything a member uploads lands in one folder:
 *   <CLOUDINARY_FOLDER>/users/<firstname_lastname>
 * Avatar and cover use fixed ids ("avatar" / "cover") so re-uploading replaces
 * them; documents keep unique ids so all versions are retained.
 *
 * Returns { url, publicId, resourceType, bytes, format }.
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 'No file was uploaded (expected multipart field "file").', 400);
    }

    const kind = String(req.body.kind || '').toLowerCase();
    const isImageKind = kind === 'avatar' || kind === 'cover';
    const mime = req.file.mimetype || '';

    if (isImageKind && !IMAGE_MIME.test(mime)) {
      return sendError(res, 'Avatar and cover uploads must be an image (PNG, JPG, WEBP).', 400);
    }
    if (kind === 'document' && !IMAGE_MIME.test(mime) && !DOC_MIME.test(mime)) {
      return sendError(res, 'Documents must be a PDF, Word file, or image.', 400);
    }

    const folder = `${config.cloudinary.folder}/users/${userFolderSlug(req.user)}`;
    const isRawDoc = DOC_MIME.test(mime);

    // Right-size + compress images as they come in. The member has already
    // cropped to the target aspect ratio client-side, so only cap dimensions.
    let transformation;
    if (!isRawDoc) {
      if (kind === 'avatar') {
        transformation = [{ width: 768, height: 768, crop: 'limit' }, { quality: 'auto:good' }];
      } else if (kind === 'cover') {
        transformation = [{ width: 1600, crop: 'limit' }, { quality: 'auto:good' }];
      } else {
        transformation = [{ width: 2000, crop: 'limit' }, { quality: 'auto:good' }];
      }
    }

    const result = await uploadBuffer(req.file.buffer, {
      folder,
      resourceType: isRawDoc ? 'raw' : 'image',
      filename: req.file.originalname,
      publicId: kind === 'avatar' ? 'avatar' : kind === 'cover' ? 'cover' : undefined,
      overwrite: isImageKind,
      transformation,
    });

    return sendSuccess(res, result, 'File uploaded.', 201);
  } catch (error) {
    return sendError(
      res,
      error.message || 'Upload failed.',
      error.statusCode || (error.http_code === 400 ? 400 : 502),
      error
    );
  }
};

module.exports = { uploadFile };
