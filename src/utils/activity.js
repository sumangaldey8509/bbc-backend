const mongoose = require('mongoose');

const logActivity = async (user, action, payload = {}) => {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const name = user?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'anonymous');
    await db.collection('activity').insertOne({
      time: new Date(),
      user: name,
      action,
      payload,
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
};

module.exports = { logActivity };
