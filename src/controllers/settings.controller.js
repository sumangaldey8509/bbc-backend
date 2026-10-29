const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const { ensureTemplates, sendWA, resendWA } = require('../utils/whatsapp');
const { calculateScores } = require('../utils/trust');
const { logActivity } = require('../utils/activity');

const handleSettings = async (req, res) => {
  try {
    const k = req.params.k;
    const method = req.method;
    const b = req.body || {};
    const db = mongoose.connection.db;

    if (k === 'webhooks') {
      if (method === 'GET') {
        await ensureTemplates();
        const templates = await db.collection('webhookTemplates').find().toArray();
        return sendSuccess(res, { templates });
      }

      if (b.test) {
        await sendWA(
          b.event,
          String(b.test).replace(/\D/g, ''),
          { message: 'Test message from BBC' },
          'test',
          'Test'
        );
        return sendSuccess(res, { ok: true }, 'Test WhatsApp message sent.');
      }

      const { _id, ...t } = b;
      try {
        JSON.parse(t.payload.replace(/\{\{params\}\}/g, '{}').replace(/\{\{\w+\}\}/g, 'x'));
      } catch {
        return sendError(res, 'Invalid JSON payload structure.', 400);
      }

      await db.collection('webhookTemplates').updateOne({ event: t.event }, { $set: t }, { upsert: true });
      await logActivity(req.user, 'webhook.update', { event: t.event });
      return sendSuccess(res, { ok: true }, 'Webhook template updated.');
    }

    if (k === 'logs') {
      if (method === 'POST') {
        await resendWA(b.id);
        return sendSuccess(res, { ok: true }, 'Message resent.');
      }

      const colName = req.query.kind === 'activity' ? 'activity' : 'whatsappLogs';
      const logs = await db.collection(colName).find().sort({ time: -1 }).limit(200).toArray();
      return sendSuccess(res, { logs });
    }

    if (k === 'admins') {
      if (method === 'GET') {
        const doc = await db.collection('settings').findOne({ _id: 'admins' });
        return sendSuccess(res, { numbers: doc?.numbers || [] });
      }

      const nums = (b.numbers || []).map((n) => String(n).replace(/\D/g, '')).filter(Boolean);
      await db.collection('settings').updateOne({ _id: 'admins' }, { $set: { numbers: nums } }, { upsert: true });
      return sendSuccess(res, {
        ok: true,
        warning: nums.length < 11 ? `Only ${nums.length} admin numbers set (minimum 11 expected)` : undefined,
      });
    }

    if (k === 'messages') {
      if (b.kind === 'notice') {
        await db.collection('notices').insertOne({ text: b.text, time: new Date() });
      } else if (b.kind === 'event') {
        await db.collection('events').insertOne({ title: b.title, date: b.date });
      } else if (b.kind === 'broadcast') {
        const memberList = await db.collection('members').find().toArray();
        const adminDoc = await db.collection('settings').findOne({ _id: 'admins' });
        const nums = new Set([
          ...memberList.map((m) => String(m.whatsapp).replace(/\D/g, '')),
          ...(adminDoc?.numbers || []),
        ]);

        for (const n of nums) {
          if (n) {
            await sendWA('broadcast', n, { message: b.text }, 'broadcast');
          }
        }

        await logActivity(req.user, 'broadcast', { count: nums.size });
        return sendSuccess(res, { ok: true, sent: nums.size }, `Broadcast dispatched to ${nums.size} recipients.`);
      } else {
        return sendError(res, 'Invalid message kind.', 400);
      }
      return sendSuccess(res, { ok: true }, 'Message published successfully.');
    }

    if (k === 'trust') {
      if (method === 'GET') {
        const sc = await calculateScores();
        const weights = await db.collection('trustWeights').find().toArray();
        const rawUsers = await db.collection('users').find().project({ name: 1, email: 1, trust: 1 }).toArray();
        const users = rawUsers.map((u) => ({ ...u, ...(sc[String(u._id)] || {}) }));
        return sendSuccess(res, { weights, users });
      }

      if (b.weights) {
        const total = b.weights.reduce((t, w) => t + Number(w.weight || 0), 0);
        if (Math.round(total * 100) !== 10000) {
          return sendError(res, `Total weightage must be exactly 100% (currently ${total}%).`, 400);
        }
        await db.collection('trustWeights').deleteMany({});
        await db.collection('trustWeights').insertMany(
          b.weights.map((w) => ({
            name: w.name,
            key: w.key || w.name.toLowerCase().replace(/\W+/g, '_'),
            weight: Number(w.weight),
          }))
        );
        await logActivity(req.user, 'trust.weights', b.weights);
        return sendSuccess(res, { ok: true }, 'Trust weights updated.');
      }

      if (b.userId) {
        await db.collection('users').updateOne(
          { _id: new ObjectId(String(b.userId)) },
          { $set: { trust: b.trust || {} } }
        );
        return sendSuccess(res, { ok: true }, 'User trust parameters updated.');
      }
    }

    return sendError(res, `Settings endpoint for "${k}" not found.`, 404);
  } catch (error) {
    return sendError(res, error.message || 'Settings operation failed.', 500, error);
  }
};

module.exports = {
  handleSettings,
};
