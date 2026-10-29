const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const { logActivity } = require('../utils/activity');
const User = require('../models/user.model');
const Role = require('../models/role.model');

const TYPES = ['privilege', 'rfq', 'event', 'mou', 'other'];

const getApprovals = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const { type } = req.query;
    const query = type ? { type } : {};
    const approvals = await db.collection('approvals').find(query).sort({ at: -1 }).toArray();
    return sendSuccess(res, { approvals });
  } catch (error) {
    return sendError(res, error.message || 'Failed to list approvals.', 500, error);
  }
};

const createApproval = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const { type, title, details = '', payload = {} } = req.body || {};

    if (!TYPES.includes(type) || !title) {
      return sendError(res, 'Valid type and title are required.', 400);
    }

    const userName = req.user?.name || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Admin';

    await db.collection('approvals').insertOne({
      type,
      title,
      details,
      payload,
      status: 'pending',
      by: userName,
      at: new Date(),
    });

    await logActivity(req.user, 'approval.create', { type, title });
    return sendSuccess(res, { ok: true }, 'Approval request submitted successfully.', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to submit approval request.', 500, error);
  }
};

const decideApproval = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const { id, decision } = req.body || {};

    if (!id || !['approved', 'rejected'].includes(decision)) {
      return sendError(res, 'Valid approval ID and decision ("approved" or "rejected") are required.', 400);
    }

    const a = await db.collection('approvals').findOne({ _id: new ObjectId(String(id)) });
    if (!a) {
      return sendError(res, 'Approval record not found.', 404);
    }
    if (a.status !== 'pending') {
      return sendError(res, 'This approval request has already been decided.', 400);
    }

    if (decision === 'approved' && a.type === 'privilege' && a.payload?.email) {
      const targetRoleName = String(a.payload.role || '').toLowerCase();
      let roleDoc = await Role.findOne({ name: targetRoleName });
      if (!roleDoc && targetRoleName) {
        roleDoc = await Role.create({ name: targetRoleName, description: `${targetRoleName} role` });
      }

      const updateFields = { role: targetRoleName };
      if (roleDoc) {
        updateFields.roles = [roleDoc._id];
      }

      const updateRes = await User.updateOne(
        { email: a.payload.email.toLowerCase() },
        { $set: updateFields }
      );

      if (!updateRes.matchedCount) {
        return sendError(res, `User with email ${a.payload.email} was not found.`, 404);
      }
    }

    const userName = req.user?.name || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Admin';

    await db.collection('approvals').updateOne(
      { _id: a._id },
      {
        $set: {
          status: decision,
          decidedBy: userName,
          decidedAt: new Date(),
        },
      }
    );

    await logActivity(req.user, 'approval.' + decision, { id, type: a.type });
    return sendSuccess(res, { ok: true }, `Approval successfully marked as ${decision}.`);
  } catch (error) {
    return sendError(res, error.message || 'Failed to update approval decision.', 500, error);
  }
};

module.exports = {
  getApprovals,
  createApproval,
  decideApproval,
};
