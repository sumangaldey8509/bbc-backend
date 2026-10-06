const mongoose = require('mongoose');
const State = require('../models/state.model');
const City = require('../models/city.model');

const httpError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

const clean = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleCase = (s) =>
  clean(s).replace(/\S+/g, (w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w));

/** Search states. Empty term returns all (alphabetical). */
const searchStates = async (q, limit = 40) => {
  const term = clean(q).toLowerCase();
  const query = term ? { nameLower: { $regex: escapeRegex(term) } } : {};
  return State.find(query)
    .sort({ name: 1 })
    .limit(Math.min(Math.max(Number(limit) || 40, 1), 60))
    .select('name code')
    .lean();
};

const getState = async (stateId) => {
  if (!mongoose.Types.ObjectId.isValid(stateId)) throw httpError('Invalid state id.', 400);
  const state = await State.findById(stateId).lean();
  if (!state) throw httpError('State not found.', 404);
  return state;
};

/** Search cities within a state. */
const searchCities = async (stateId, q, limit = 20) => {
  const state = await getState(stateId);
  const term = clean(q).toLowerCase();
  const query = { state: state._id };
  if (term) query.nameLower = { $regex: escapeRegex(term) };

  return City.find(query)
    .sort({ usageCount: -1, isCurated: -1, name: 1 })
    .limit(Math.min(Math.max(Number(limit) || 20, 1), 50))
    .select('name')
    .lean();
};

/** Find-or-create a city within a state (case-insensitive). */
const findOrCreateCity = async (stateId, name, userId) => {
  const state = await getState(stateId);
  const value = titleCase(name);
  if (value.length < 2) throw httpError('City name must be at least 2 characters.', 400);
  if (value.length > 80) throw httpError('City name is too long.', 400);

  const nameLower = value.toLowerCase();
  const existing = await City.findOne({ state: state._id, nameLower }).lean();
  if (existing) return { city: existing, state, created: false };

  try {
    const city = await City.create({
      name: value,
      nameLower,
      state: state._id,
      stateName: state.name,
      createdBy: userId || null,
    });
    return { city: city.toJSON(), state, created: true };
  } catch (err) {
    if (err.code === 11000) {
      const winner = await City.findOne({ state: state._id, nameLower }).lean();
      return { city: winner, state, created: false };
    }
    throw err;
  }
};

/**
 * Bump a city's usage count when a profile adopts it. Auto-adds the city to the
 * catalogue if it wasn't there. `stateName` is used to resolve the state.
 */
const bumpCityUsage = async (stateName, cityName, delta = 1) => {
  const s = clean(stateName);
  const c = clean(cityName);
  if (!s || !c) return;

  const state = await State.findOne({ nameLower: s.toLowerCase() }).lean();
  if (!state) return;

  await City.updateOne(
    { state: state._id, nameLower: c.toLowerCase() },
    {
      $inc: { usageCount: delta },
      $setOnInsert: { name: c, stateName: state.name },
    },
    { upsert: delta > 0 }
  );
  if (delta < 0) {
    await City.updateMany(
      { state: state._id, nameLower: c.toLowerCase(), usageCount: { $lt: 0 } },
      { $set: { usageCount: 0 } }
    );
  }
};

module.exports = {
  searchStates,
  getState,
  searchCities,
  findOrCreateCity,
  bumpCityUsage,
};
