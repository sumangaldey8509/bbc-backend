/**
 * Standardized API response helper
 */

const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const base = {
    success: true,
    message,
    data,
  };

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return res.status(statusCode).json({
      ...data,
      ...base,
    });
  }

  return res.status(statusCode).json(base);
};

const sendError = (res, message = 'Something went wrong', statusCode = 500, error = null) => {
  const response = {
    success: false,
    message,
    error: message,
  };

  if (error && process.env.NODE_ENV === 'development') {
    response.details = typeof error === 'object' && error.message ? error.message : error;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError,
};
