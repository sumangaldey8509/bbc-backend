const Role = require('../models/role.model');
const User = require('../models/user.model');

/**
 * Create a new role
 * @param {Object} roleData
 * @returns {Promise<Role>}
 */
const createRole = async (roleData) => {
  return await Role.create(roleData);
};

/**
 * Get role by name
 * @param {string} name
 * @returns {Promise<Role|null>}
 */
const getRoleByName = async (name) => {
  return await Role.findOne({ name: name.toLowerCase().trim() });
};

/**
 * Get all roles
 * @param {Object} filter
 * @returns {Promise<Array<Role>>}
 */
const getAllRoles = async (filter = {}) => {
  return await Role.find(filter).sort({ name: 1 });
};

/**
 * Get role by ID
 * @param {string} id
 * @returns {Promise<Role|null>}
 */
const getRoleById = async (id) => {
  return await Role.findById(id);
};

/**
 * Get all roles, each with a live count of members holding it.
 * @returns {Promise<Array<Object>>}
 */
const getAllRolesWithCounts = async () => {
  const roles = await Role.find({}).sort({ name: 1 }).lean();

  const counts = await User.aggregate([
    { $unwind: '$roles' },
    { $group: { _id: '$roles', count: { $sum: 1 } } },
  ]);
  const countMap = counts.reduce((acc, c) => {
    acc[c._id.toString()] = c.count;
    return acc;
  }, {});

  return roles.map((role) => ({
    ...role,
    memberCount: countMap[role._id.toString()] || 0,
  }));
};

/**
 * Update a role by ID
 * @param {string} id
 * @param {Object} updateData - { name?, description?, permissions?, isActive? }
 * @returns {Promise<Role|null>}
 */
const updateRoleById = async (id, updateData) => {
  const payload = { ...updateData };
  if (typeof payload.name === 'string') {
    payload.name = payload.name.toLowerCase().trim();
  }
  return await Role.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
};

/**
 * Delete a role by ID.
 * @param {string} id
 * @returns {Promise<Role|null>}
 */
const deleteRoleById = async (id) => {
  return await Role.findByIdAndDelete(id);
};

/**
 * Number of users currently assigned a given role.
 * @param {string} id
 * @returns {Promise<number>}
 */
const countMembersWithRole = async (id) => {
  return await User.countDocuments({ roles: id });
};

module.exports = {
  createRole,
  getRoleByName,
  getAllRoles,
  getAllRolesWithCounts,
  getRoleById,
  updateRoleById,
  deleteRoleById,
  countMembersWithRole,
};
