const mongoose = require('mongoose');

const getBadge = (s) => (s >= 80 ? 'Platinum' : s >= 60 ? 'Gold' : s >= 40 ? 'Silver' : 'Bronze');

const calculateScores = async () => {
  const db = mongoose.connection.db;
  if (!db) return {};

  const w = await db.collection('trustWeights').find().toArray();
  const aw = await db
    .collection('awards')
    .aggregate([
      { $match: { active: true } },
      { $group: { _id: '$to', n: { $sum: 1 } } },
    ])
    .toArray();

  const am = Object.fromEntries(aw.map((a) => [String(a._id), a.n]));
  const out = {};

  const users = await db.collection('users').find().project({ trust: 1 }).toArray();

  for (const u of users) {
    const base = w.reduce((t, x) => t + Number(x.weight || 0) * (((u.trust || {})[x.key] || 0) / 100), 0);
    const awards = am[String(u._id)] || 0;
    const score = Math.round((base + awards) * 10) / 10;
    out[String(u._id)] = { score, awards, badge: getBadge(score) };
  }

  return out;
};

module.exports = {
  getBadge,
  calculateScores,
};
