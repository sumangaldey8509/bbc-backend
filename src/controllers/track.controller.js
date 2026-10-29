const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../helpers/response.helper');

const trackVisit = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const b = req.body || {};
    const day = new Date().toISOString().slice(0, 10);
    const userId = req.user ? String(req.user._id || req.user.id) : null;
    const id = userId || String(b.anon || '').slice(0, 40);

    if (!id) {
      return sendSuccess(res, { success: true });
    }

    await db.collection('visits').updateOne(
      { kind: userId ? 'user' : 'visitor', id, day },
      { $setOnInsert: { at: new Date() } },
      { upsert: true }
    );

    return sendSuccess(res, { success: true });
  } catch (error) {
    return sendError(res, error.message || 'Traffic tracking failed.', 500, error);
  }
};

module.exports = {
  trackVisit,
};
