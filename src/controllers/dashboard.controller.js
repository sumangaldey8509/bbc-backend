const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../helpers/response.helper');

const getDashboardSummary = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const m = db.collection('members');
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const pre = start.toISOString().slice(0, 8);
    const sd = pre + '01';

    const cats = await m
      .aggregate([{ $group: { _id: '$category', value: { $sum: 1 } } }])
      .toArray();

    const total = await m.countDocuments();
    const visits = await db.collection('visits').find({ day: { $gte: sd } }).toArray();
    const mem = await m.find({ createdAt: { $gte: start } }).project({ createdAt: 1 }).toArray();

    const days = now.getDate();
    const conv = [];

    for (let i = 1; i <= days; i++) {
      const day = pre + String(i).padStart(2, '0');
      conv.push({
        day: i,
        visitors: visits.filter((v) => v.day === day && v.kind === 'visitor').length,
        converted: mem.filter((x) => new Date(x.createdAt).toISOString().slice(0, 10) === day).length,
      });
    }

    const active = visits.filter((v) => v.kind === 'user').length;
    const pendingApprovals = await db.collection('approvals').countDocuments({ status: 'pending' });
    const pendingRequests = await db.collection('m_membership_requests').countDocuments({ status: 'Pending' });

    const notices = await db.collection('notices').find().sort({ _id: -1 }).limit(20).toArray();
    const events = await db.collection('events').find().sort({ date: 1 }).limit(20).toArray();
    const recent = await m
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .project({ name: 1, company: 1, whatsapp: 1, officialMail: 1, category: 1, createdAt: 1 })
      .toArray();

    const wishes = await m
      .find({ birthday: { $exists: true, $ne: '' } })
      .limit(20)
      .project({ name: 1, birthday: 1 })
      .toArray();

    const monthReferrals = await db.collection('referrals').countDocuments({ createdAt: { $gte: start } });

    const summary = {
      totalMembers: total,
      newRequests: pendingApprovals + pendingRequests,
      categoryTypes: cats.length,
      avgDailyUsage: total ? Math.round((active / days / total) * 1000) / 10 : 0,
      monthReferrals,
      categories: cats.map((c) => ({ name: c._id || 'Uncategorised', value: c.value })),
      conversion: conv,
      notices,
      events,
      recent,
      goals: { members: 500, requests: 50, categories: 12, usage: 100, referrals: 100 },
      wishes,
    };

    return sendSuccess(res, summary);
  } catch (error) {
    return sendError(res, error.message || 'Failed to retrieve dashboard analytics.', 500, error);
  }
};

module.exports = {
  getDashboardSummary,
};
