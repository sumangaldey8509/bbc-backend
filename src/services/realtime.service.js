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
 * Broadcast an event over the Supabase Realtime feed channel.
 * @param {string} event - Event name (e.g., 'new_post', 'update_post', 'delete_post')
 * @param {object} payload - Post data payload
 */
const broadcastFeedEvent = async (event, payload) => {
  try {
    const client = initSupabase();
    if (!client) {
      logger.warn('[Supabase Realtime] Supabase not configured. Skipping broadcast.');
      return;
    }

    if (!feedChannel) {
      initRealtime();
    }

    if (feedChannel) {
      const resp = await feedChannel.send({
        type: 'broadcast',
        event,
        payload,
      });
      logger.info(`[Supabase Realtime] Broadcasted "${event}" event (result: ${resp})`);
    }
  } catch (err) {
    logger.error(`[Supabase Realtime] Error broadcasting "${event}": ${err.message}`);
  }
};

module.exports = {
  initSupabase,
  initRealtime,
  broadcastFeedEvent,
};

