const Industry = require('../models/industry.model');

const httpError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

const clean = (name) => String(name || '').trim().replace(/\s+/g, ' ');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Search the industry catalogue.
 * @param {string} [q] - term; empty returns the most-used / curated entries
 * @param {number} [limit=20]
 * @returns {Promise<Array<{ _id, name, usageCount }>>}
 */
const search = async (q, limit = 20) => {
  const query = {};
  const term = clean(q).toLowerCase();
  if (term) query.nameLower = { $regex: escapeRegex(term) };

  return Industry.find(query)
    .sort({ usageCount: -1, isCurated: -1, name: 1 })
    .limit(Math.min(Math.max(Number(limit) || 20, 1), 50))
    .select('name usageCount')
    .lean();
};

/**
 * Look up an industry by name (case-insensitive); create it if it does not exist.
 * @param {string} name
 * @param {string} [userId]
 * @returns {Promise<{ industry: Object, created: boolean }>}
 */
const findOrCreate = async (name, userId) => {
  const value = clean(name);
  if (value.length < 2) throw httpError('Industry name must be at least 2 characters.', 400);
  if (value.length > 80) throw httpError('Industry name is too long.', 400);

  const nameLower = value.toLowerCase();
  const existing = await Industry.findOne({ nameLower }).lean();
  if (existing) return { industry: existing, created: false };

  try {
    const created = await Industry.create({ name: value, nameLower, createdBy: userId || null });
    return { industry: created.toJSON(), created: true };
  } catch (err) {
    if (err.code === 11000) {
      // Raced with another create — return the winner.
      const winner = await Industry.findOne({ nameLower }).lean();
      return { industry: winner, created: false };
    }
    throw err;
  }
};

/**
 * Reconcile catalogue usage counts after a profile's industry list changes.
 * Unknown names are added to the catalogue automatically.
 * @param {string[]} [added]
 * @param {string[]} [removed]
 */
const applyUsageDelta = async (added = [], removed = []) => {
  for (const raw of added) {
    const value = clean(raw);
    if (!value) continue;
    await Industry.updateOne(
      { nameLower: value.toLowerCase() },
      { $inc: { usageCount: 1 }, $setOnInsert: { name: value } },
      { upsert: true }
    );
  }

  const removedKeys = removed.map((r) => clean(r).toLowerCase()).filter(Boolean);
  if (removedKeys.length) {
    await Industry.updateMany(
      { nameLower: { $in: removedKeys }, usageCount: { $gt: 0 } },
      { $inc: { usageCount: -1 } }
    );
  }
};

module.exports = { search, findOrCreate, applyUsageDelta };
