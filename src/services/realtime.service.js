const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

let supabase = null;
let feedChannel = null;
let isSubscribed = false;

/**
 * Initialize Supabase client instance.
 */
const initSupabase = () => {
  if (!supabase) {
    const url = ((config.supabase && config.supabase.url) || process.env.SUPABASE_URL || '').trim();
    const key = (
      (config.supabase && (config.supabase.serviceRoleKey || config.supabase.anonKey)) ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    ).trim();

    if (url && key) {
      supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }
  return supabase;
};

/**
 * Initialize and subscribe the persistent feed broadcast channel.
 */
const initRealtime = () => {
  const client = initSupabase();
  if (!client) {
    logger.warn('[Supabase Realtime] Supabase credentials not found. Realtime broadcast disabled.');
    return null;
  }

  if (!feedChannel) {
    feedChannel = client.channel('feed', {
      config: { broadcast: { self: false, ack: false } },
    });

    feedChannel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        logger.info('[Supabase Realtime] Feed broadcast channel SUBSCRIBED and ready.');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        isSubscribed = false;
        logger.warn(`[Supabase Realtime] Feed channel status: ${status}. Error: ${err?.message || ''}`);
      }
    });
  }

  return feedChannel;
};

/**
 * Ensure the broadcast channel is ready before sending events.
 */
const ensureSubscribed = async () => {
  const client = initSupabase();
  if (!client) return null;
  if (!feedChannel) initRealtime();
  if (!feedChannel) return null;
  if (isSubscribed) return feedChannel;

  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 50;
      if (isSubscribed || elapsed >= 1500) {
        clearInterval(interval);
        resolve(feedChannel);
      }
    }, 50);
  });
};

/**
 * Broadcast an event over the Supabase Realtime feed channel.
 * @param {string} event - Event name (e.g., 'new_post', 'new_message', 'message_read')
 * @param {object} payload - Event data payload
 */
const broadcastFeedEvent = async (event, payload) => {
  try {
    const channel = await ensureSubscribed();
    if (!channel) {
      logger.warn('[Supabase Realtime] Supabase not configured. Skipping broadcast.');
      return;
    }

    const resp = await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
    logger.info(`[Supabase Realtime] Broadcasted "${event}" event (result: ${resp})`);
  } catch (err) {
    logger.error(`[Supabase Realtime] Error broadcasting "${event}": ${err.message}`);
  }
};

/**
 * Send a content-free invalidation event to a user's private message channel.
 * The client then fetches authorized content from MongoDB through the REST API.
 */
const broadcastPrivateMessageChanged = async (userId) => {
  const client = initSupabase();
  if (!client) return;
  const topic = `user:${String(userId)}:messages`;
  const channel = client.channel(topic, { config: { private: true } });
  try {
    await channel.httpSend('changed', {});
  } catch (err) {
    logger.error(`[Supabase Realtime] Private message signal failed: ${err.message}`);
  } finally {
    await client.removeChannel(channel);
  }
};

module.exports = {
  initSupabase,
  initRealtime,
  broadcastFeedEvent,
  broadcastPrivateMessageChanged,
};
