const { ObjectId } = require('mongodb');
const Role = require('../models/role.model');
const User = require('../models/user.model');
const { MODULES } = require('../middlewares/auth.middleware');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const { logActivity } = require('../utils/activity');

const handleAccess = async (req, res) => {
  try {
    const k = req.params.k;
    const method = req.method;
    const b = req.body || {};

    // Ensure member role exists
    const memberRole = await Role.findOne({ name: 'member' });
    if (!memberRole) {
      await Role.create({ name: 'member', description: 'Council member', modules: ['feed', 'profile'] });
    }

    if (k === 'roles') {
      if (method === 'GET') {
        const allRoles = await Role.find().lean();
        return sendSuccess(res, { roles: allRoles, modules: MODULES });
      }

      if (method === 'POST') {
        const name = String(b.name || '').trim().toLowerCase();
        if (!name || name === 'admin') {
          return sendError(res, 'Invalid role name.', 400);
        }
        const existing = await Role.findOne({ name });
        if (existing) {
          return sendError(res, 'Role already exists.', 400);
        }

        const newRole = await Role.create({
          name,
          description: b.description || `${name} role`,
          modules: ['feed', 'profile'],
        });

        await logActivity(req.user, 'role.create', { name });
        return sendSuccess(res, { ok: true, role: newRole }, 'Role created successfully.', 201);
      }
    }

    if (k === 'users') {
      if (method === 'GET') {
        const users = await User.find()
          .select('-password -__v')
          .populate('roles')
          .lean();

        const formatted = users.map((u) => {
          const roleNames = (u.roles || []).map((r) => (r && r.name ? r.name : String(r)));
          const role = roleNames.includes('admin') || u.role === 'admin' ? 'admin' : roleNames[0] || u.role || 'member';
          const name = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User';
          return {
            ...u,
            name,
            role,
          };
        });

        return sendSuccess(res, { users: formatted });
      }

      if (method === 'PUT') {
        const id = b.id || b._id;
        if (!id) {
          return sendError(res, 'User ID is required.', 400);
        }

        const targetUser = await User.findById(id);
        if (!targetUser) {
          return sendError(res, 'User not found.', 404);
        }
        if (targetUser.superAdmin) {
          return sendError(res, 'Super Admin role cannot be changed.', 403);
        }

        const newRoleName = String(b.role || '').toLowerCase();
        let roleDoc = await Role.findOne({ name: newRoleName });
        if (!roleDoc && newRoleName) {
          roleDoc = await Role.create({ name: newRoleName, description: `${newRoleName} role` });
        }

        const updateFields = { role: newRoleName };
        if (roleDoc) {
          updateFields.roles = [roleDoc._id];
        }

        await User.updateOne({ _id: new ObjectId(String(id)) }, { $set: updateFields });
        await logActivity(req.user, 'user.role', { id, role: newRoleName });
        return sendSuccess(res, { ok: true }, 'User role updated successfully.');
      }
    }

    if (k === 'modules') {
      if (method === 'PUT') {
        const roleName = String(b.name || '').toLowerCase();
        if (roleName === 'admin') {
          return sendError(res, 'Admin always has full module access.', 400);
        }

        const filteredModules = (b.modules || []).filter((m) => MODULES.includes(m));
        await Role.updateOne(
          { name: roleName },
          { $set: { modules: filteredModules } },
          { upsert: true }
        );

        await logActivity(req.user, 'role.modules', { name: roleName, modules: filteredModules });
        return sendSuccess(res, { ok: true }, 'Role modules updated successfully.');
      }
    }

    return sendError(res, `Access endpoint for "${k}" not found.`, 404);
  } catch (error) {
    return sendError(res, error.message || 'Access management operation failed.', 500, error);
  }
};

module.exports = {
  handleAccess,
};
