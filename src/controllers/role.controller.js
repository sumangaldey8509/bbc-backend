const roleService = require('../services/role.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const { validateRolePayload, isValidObjectId } = require('../utils/validator');

const normalizePermissions = (permissions) =>
  Array.isArray(permissions)
    ? [...new Set(permissions.map((p) => p.trim().toLowerCase()).filter(Boolean))]
    : undefined;

/**
 * Create a new role
 */
const createRole = async (req, res) => {
  try {
    const { name, description, permissions, isActive } = req.body;

    const validation = validateRolePayload({ name, description, permissions, isActive });
    if (!validation.isValid) {
      return sendError(res, validation.error, 400);
    }

    const role = await roleService.createRole({
      name: name.trim().toLowerCase(),
      description: description ? description.trim() : '',
      permissions: normalizePermissions(permissions) || [],
      ...(isActive !== undefined ? { isActive } : {}),
    });

    return sendSuccess(res, role, 'Role created successfully', 201);
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 'A role with this name already exists.', 409, error);
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return sendError(res, messages.join(', '), 400, error);
    }
    return sendError(res, 'Failed to create role', 500, error);
  }
};

/**
 * Get all roles (with member counts)
 */
const getRoles = async (req, res) => {
  try {
    const roles = await roleService.getAllRolesWithCounts();
    return sendSuccess(res, roles, 'Roles retrieved successfully');
  } catch (error) {
    return sendError(res, 'Failed to retrieve roles', 500, error);
  }
};

/**
 * Get a role by ID
 */
const getRoleById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, 'Invalid role ID format.', 400);
    }
    const role = await roleService.getRoleById(req.params.id);
    if (!role) {
      return sendError(res, 'Role not found', 404);
    }
    return sendSuccess(res, role, 'Role retrieved successfully');
  } catch (error) {
    return sendError(res, 'Failed to retrieve role', 500, error);
  }
};

/**
 * Update a role by ID
 */
const updateRole = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, 'Invalid role ID format.', 400);
    }

    const { name, description, permissions, isActive } = req.body;
    const validation = validateRolePayload({ name, description, permissions, isActive }, true);
    if (!validation.isValid) {
      return sendError(res, validation.error, 400);
    }

    const update = {};
    if (name !== undefined) update.name = name.trim().toLowerCase();
    if (description !== undefined) update.description = description.trim();
    if (permissions !== undefined) update.permissions = normalizePermissions(permissions);
    if (isActive !== undefined) update.isActive = isActive;

    const role = await roleService.updateRoleById(req.params.id, update);
    if (!role) {
      return sendError(res, 'Role not found', 404);
    }
    return sendSuccess(res, role, 'Role updated successfully');
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 'A role with this name already exists.', 409, error);
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return sendError(res, messages.join(', '), 400, error);
    }
    return sendError(res, 'Failed to update role', 500, error);
  }
};

/**
 * Delete a role by ID (blocked while members still hold it)
 */
const deleteRole = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, 'Invalid role ID format.', 400);
    }

    const inUse = await roleService.countMembersWithRole(req.params.id);
    if (inUse > 0) {
      return sendError(
        res,
        `This role is assigned to ${inUse} ${inUse === 1 ? 'member' : 'members'}. Reassign them before deleting the role.`,
        409
      );
    }

    const role = await roleService.deleteRoleById(req.params.id);
    if (!role) {
      return sendError(res, 'Role not found', 404);
    }
    return sendSuccess(res, null, 'Role deleted successfully');
  } catch (error) {
    return sendError(res, 'Failed to delete role', 500, error);
  }
};

module.exports = {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
};
