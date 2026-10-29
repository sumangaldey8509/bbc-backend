const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../helpers/response.helper');

const ALLOWED = [
  'members',
  'users',
  'approvals',
  'posts',
  'awards',
  'follows',
  'comments',
  'notices',
  'events',
  'visits',
  'whatsappLogs',
];

const HIDE = new Set(['password', 'hash', 'trust', 'c', 'h', 'payload', '__v']);

const flat = (t, doc) =>
  Object.fromEntries(
    Object.entries(doc)
      .filter(([k]) => !HIDE.has(k))
      .map(([k, v]) => [
        `${t}.${k}`,
        v?.toHexString
          ? v.toHexString()
          : v instanceof Date
          ? v.toISOString()
          : typeof v === 'object' && v
          ? JSON.stringify(v)
          : v,
      ])
  );

const getTables = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const out = [];

    for (const t of ALLOWED) {
      const s = await db.collection(t).findOne();
      out.push({
        name: t,
        fields: s ? Object.keys(s).filter((k) => !HIDE.has(k)) : [],
      });
    }

    return sendSuccess(res, { tables: out });
  } catch (error) {
    return sendError(res, error.message || 'Failed to list report tables.', 500, error);
  }
};

const runReport = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const { tables, joins = [] } = req.body || {};

    if (!tables?.length || tables.some((t) => !ALLOWED.includes(t))) {
      return sendError(res, 'Please select valid tables for report generation.', 400);
    }

    const get = async (t) =>
      (await db.collection(t).find().limit(5000).toArray()).map((x) => flat(t, x));

    let rows = await get(tables[0]);

    for (let i = 1; i < tables.length; i++) {
      const j = joins[i - 1];
      if (!j?.left || !j?.right) {
        return sendError(res, `Please choose valid join fields for ${tables[i]}.`, 400);
      }

      const right = await get(tables[i]);
      const rk = `${tables[i]}.${j.right}`;
      const uniq = (arr, k) => {
        const v = arr.map((r) => r[k]);
        return v.every((x) => x != null && x !== '') && new Set(v).size === v.length;
      };

      if (!uniq(right, rk)) {
        return sendError(res, `No unique ID: ${rk} has duplicate or empty values, cannot join.`, 400);
      }
      if (!uniq(rows, j.left)) {
        return sendError(res, `No unique ID: ${j.left} has duplicate or empty values, cannot join.`, 400);
      }

      const idx = new Map(right.map((r) => [String(r[rk]), r]));
      rows = rows.filter((r) => idx.has(String(r[j.left]))).map((r) => ({ ...r, ...idx.get(String(r[j.left])) }));
    }

    return sendSuccess(res, { rows });
  } catch (error) {
    return sendError(res, error.message || 'Failed to generate report.', 500, error);
  }
};

module.exports = {
  getTables,
  runReport,
};
