const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

const PAYLOAD = '{\n  "event": "{{event}}",\n  "template": "{{template}}",\n  "to": "{{to}}",\n  "phone": "{{phone}}",\n  "name": "{{name}}",\n  "message": "{{message}}",\n  "params": {{params}}\n}';

const EVENTS = ['otp', 'broadcast', 'approval_update', 'notice', 'welcome'];

const DEFAULT_TEMPLATE = (event) => ({
  event,
  url: '',
  templateName: event,
  singleLine: true,
  separator: ' | ',
  maxChars: 800,
  payload: PAYLOAD,
});

async function ensureTemplates() {
  const db = mongoose.connection.db;
  if (!db) return;
  for (const e of EVENTS) {
    await db.collection('webhookTemplates').updateOne(
      { event: e },
      { $setOnInsert: DEFAULT_TEMPLATE(e) },
      { upsert: true }
    );
  }
}

const render = (templateStr, vars) =>
  templateStr.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    k === 'params'
      ? JSON.stringify(vars.params || {})
      : JSON.stringify(String(vars[k] ?? '')).slice(1, -1)
  );

async function post(url, payload) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  return { status: r.status, text: (await r.text()).slice(0, 300) };
}

async function sendWA(event, to, vars = {}, trigger = 'system', name = '') {
  const db = mongoose.connection.db;
  if (!db) return;

  const t = (await db.collection('webhookTemplates').findOne({ event })) || DEFAULT_TEMPLATE(event);
  if (!t.url) {
    console.warn(`No webhook URL configured for event "${event}". Skipping transmission.`);
    await db.collection('whatsappLogs').insertOne({
      time: new Date(),
      event,
      trigger,
      to,
      name,
      status: 0,
      detail: 'Webhook URL not set',
      payload: '',
    });
    return;
  }

  const raw = String(vars.message ?? '');
  const sep = t.separator || ' | ';
  const max = t.maxChars || 800;
  const parts = [];
  let cur = '';

  for (const l of raw.split('\n')) {
    if (cur && (cur + sep + l).length > max) {
      parts.push(cur);
      cur = l;
    } else {
      cur = cur ? cur + sep + l : l;
    }
  }
  parts.push(cur);

  for (let i = 0; i < parts.length; i++) {
    const multi = t.singleLine !== false ? parts[i] : raw;
    const msg = parts.length > 1 ? `${multi} (Part ${i + 1}/${parts.length})` : multi;
    const body = render(t.payload, {
      event,
      template: t.templateName || event,
      to,
      phone: to,
      name,
      message: msg,
      message_raw: raw,
      ...vars,
    });

    let res;
    try {
      res = await post(t.url, body);
    } catch (e) {
      res = { status: 0, text: e.message };
    }

    await db.collection('whatsappLogs').insertOne({
      time: new Date(),
      event,
      trigger,
      to,
      name,
      status: res.status,
      detail: (parts.length > 1 ? `[part ${i + 1}/${parts.length}] ` : '') + res.text,
      payload: body,
    });
  }
}

async function resendWA(id) {
  const db = mongoose.connection.db;
  if (!db) return;

  const l = await db.collection('whatsappLogs').findOne({ _id: new ObjectId(String(id)) });
  const t = await db.collection('webhookTemplates').findOne({ event: l?.event });
  if (!l || !t?.url) {
    throw new Error('Cannot resend: log record or destination URL missing');
  }

  const res = await post(t.url, l.payload);
  const { _id, ...rest } = l;
  await db.collection('whatsappLogs').insertOne({
    ...rest,
    time: new Date(),
    trigger: 'resend',
    status: res.status,
    detail: `[resend] ${res.text}`,
  });
}

module.exports = {
  EVENTS,
  ensureTemplates,
  sendWA,
  resendWA,
};
