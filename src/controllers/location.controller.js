const locationService = require('../services/location.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');

/** GET /api/states?q= */
const listStates = async (req, res) => {
  try {
    const rows = await locationService.searchStates(req.query.q, req.query.limit);
    return sendSuccess(
      res,
      rows.map((s) => ({ id: s._id, name: s.name, code: s.code })),
      'States retrieved.'
    );
  } catch (error) {
    return sendError(res, 'Failed to load states.', 500, error);
  }
};

/** GET /api/states/:stateId/cities?q= */
const listCities = async (req, res) => {
  try {
    const rows = await locationService.searchCities(req.params.stateId, req.query.q, req.query.limit);
    return sendSuccess(
      res,
      rows.map((c) => ({ id: c._id, name: c.name })),
      'Cities retrieved.'
    );
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to load cities.',
      error.statusCode || 500,
      error
    );
  }
};

/** POST /api/states/:stateId/cities  { name } */
const createCity = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return sendError(res, 'A city "name" is required.', 400);
    }
    const { city, state, created } = await locationService.findOrCreateCity(
      req.params.stateId,
      name,
      req.user._id
    );
    return sendSuccess(
      res,
      { id: city._id, name: city.name, stateName: state.name, created },
      created ? 'City added to the catalogue.' : 'City already exists.',
      created ? 201 : 200
    );
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to add city.',
      error.statusCode || 500,
      error
    );
  }
};

module.exports = { listStates, listCities, createCity };
