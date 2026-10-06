const { v2: cloudinary } = require('cloudinary');
const config = require('../config');
const logger = require('../utils/logger');

if (config.cloudinary.configured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
  logger.info('Cloudinary configured');
} else {
  logger.warn('Cloudinary is not configured — /api/uploads will return 503 until CLOUDINARY_* env vars are set.');
}

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {Object} [options]
 * @param {string} [options.folder] - full target folder (defaults to the base folder)
 * @param {'image'|'raw'|'auto'} [options.resourceType='auto']
 * @param {string} [options.filename]
 * @param {string} [options.publicId] - fixed id within the folder (enables overwrite of a stable slot, e.g. "avatar")
 * @param {boolean} [options.overwrite=false]
 * @param {Array<Object>} [options.transformation] - incoming transformation applied to the stored image
 * @returns {Promise<{ url: string, publicId: string, resourceType: string, bytes: number, width?: number, height?: number, format?: string }>}
 */
const uploadBuffer = (
  buffer,
  { folder, resourceType = 'auto', filename, publicId, overwrite = false, transformation } = {}
) => {
  if (!config.cloudinary.configured) {
    const err = new Error('File uploads are not available: Cloudinary is not configured on the server.');
    err.statusCode = 503;
    return Promise.reject(err);
  }

  const targetFolder = folder || config.cloudinary.folder;
  const isImage = resourceType === 'image' || resourceType === 'auto';

  const options = {
    folder: targetFolder,
    resource_type: resourceType,
    overwrite,
  };
  if (isImage) {
    // Compress + right-size on the way in, and normalise to JPG so the stored
    // asset is renderable everywhere (HEIC from iPhones, AVIF, etc. are not).
    options.transformation = transformation || [{ quality: 'auto:good' }];
    options.format = 'jpg';
    options.invalidate = true; // refresh the CDN when overwriting avatar/cover
  }
  if (publicId) {
    options.public_id = publicId;
    options.use_filename = false;
    options.unique_filename = false;
  } else {
    options.use_filename = Boolean(filename);
    options.filename_override = filename;
    options.unique_filename = true;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);

        // Return the direct URL to the stored (already compressed) asset — it
        // carries a real extension and a single format, so <Image> loads it
        // reliably on every platform.
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      }
    );
    stream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary. Resolves quietly if Cloudinary is not
 * configured or the asset does not exist — removal must never block the caller.
 * @param {string} publicId
 * @param {Object} [options]
 * @param {'image'|'raw'|'video'} [options.resourceType='image']
 * @returns {Promise<{ result: string }>}
 */
const destroy = async (publicId, { resourceType = 'image' } = {}) => {
  if (!config.cloudinary.configured || !publicId) {
    return { result: 'skipped' };
  }
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  } catch (error) {
    logger.warn(`Cloudinary destroy failed for ${publicId}: ${error.message}`);
    return { result: 'error' };
  }
};

module.exports = { cloudinary, uploadBuffer, destroy };
