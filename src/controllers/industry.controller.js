const industryService = require('../services/industry.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');

/**
 * GET /api/industries?q=<term>&limit=20
 * Autocomplete search over the industry catalogue.
 */
const listIndustries = async (req, res) => {
  try {
    const items = await industryService.search(req.query.q, req.query.limit);
    return sendSuccess(
      res,
      items.map((i) => ({ id: i._id, name: i.name })),
      'Industries retrieved.'
    );
  } catch (error) {
    return sendError(res, 'Failed to search industries.', 500, error);
  }
};

/**
 * POST /api/industries  { name }
 * Find-or-create an industry (used when a member types one that isn't listed).
 */
const createIndustry = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return sendError(res, 'An industry "name" is required.', 400);
    }

    const { industry, created } = await industryService.findOrCreate(name, req.user._id);
    return sendSuccess(
      res,
      { id: industry._id, name: industry.name, created },
      created ? 'Industry added to the catalogue.' : 'Industry already exists.',
      created ? 201 : 200
    );
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to add industry.',
      error.statusCode || 500,
      error
    );
  }
};

module.exports = { listIndustries, createIndustry };
