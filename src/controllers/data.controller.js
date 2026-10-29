const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { COLS } = require('../config/modules');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const { logActivity } = require('../utils/activity');

const getCol = (colName) => {
  return mongoose.connection.db.collection('m_' + colName);
};

const listDocuments = async (req, res) => {
  try {
    const colName = req.params.col;
    const c = COLS[colName];
    if (!c) {
      return sendError(res, `Unknown module: ${colName}`, 404);
    }

    const col = getCol(colName);
    const rows = await col.find().sort({ at: -1 }).limit(500).toArray();
    return sendSuccess(res, { rows });
  } catch (error) {
    return sendError(res, error.message || 'Failed to list collection records.', 500, error);
  }
};

const createDocument = async (req, res) => {
  try {
    const colName = req.params.col;
    const c = COLS[colName];
    if (!c) {
      return sendError(res, `Unknown module: ${colName}`, 404);
    }

    const col = getCol(colName);
    const b = req.body || {};
    const pick = Object.fromEntries(c.f.map(([k]) => [k, b[k] ?? '']));

    const doc = {
      ...pick,
      ...(c.status ? { status: 'Pending' } : {}),
      by: req.user?.name || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Admin',
      at: new Date(),
    };

    const result = await col.insertOne(doc);
    await logActivity(req.user, `${colName}.create`, { id: result.insertedId });

    return sendSuccess(res, { ok: true, id: result.insertedId }, 'Document created successfully.', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to create document.', 500, error);
  }
};

const updateDocument = async (req, res) => {
  try {
    const colName = req.params.col;
    const c = COLS[colName];
    if (!c) {
      return sendError(res, `Unknown module: ${colName}`, 404);
    }

    const col = getCol(colName);
    const b = req.body || {};
    const id = b.id || b._id;
    if (!id) {
      return sendError(res, 'Document ID is required.', 400);
    }

    const pick = Object.fromEntries(c.f.map(([k]) => [k, b[k] ?? '']));

    await col.updateOne(
      { _id: new ObjectId(String(id)) },
      { $set: { ...pick, ...(c.status && b.status ? { status: b.status } : {}) } }
    );

    await logActivity(req.user, `${colName}.update`, { id });
    return sendSuccess(res, { ok: true }, 'Document updated successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to update document.', 500, error);
  }
};

const deleteDocument = async (req, res) => {
  try {
    const colName = req.params.col;
    const c = COLS[colName];
    if (!c) {
      return sendError(res, `Unknown module: ${colName}`, 404);
    }

    const col = getCol(colName);
    const b = req.body || {};
    const id = b.id || b._id || req.query.id;
    if (!id) {
      return sendError(res, 'Document ID is required.', 400);
    }

    await col.deleteOne({ _id: new ObjectId(String(id)) });
    await logActivity(req.user, `${colName}.delete`, { id });
    return sendSuccess(res, { ok: true }, 'Document deleted successfully.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to delete document.', 500, error);
  }
};

module.exports = {
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
};
