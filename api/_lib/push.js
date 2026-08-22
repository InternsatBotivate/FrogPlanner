// api/_lib/push.js
// ---------------------------------------------------------------------------
// Shared helper to send Expo push notifications and prune dead tokens.
// Uses the Expo Push API (expo-server-sdk), which delivers to both iOS (APNs)
// and Android (FCM) using the ExponentPushToken the app registers. No direct
// FCM/APNs code needed here — Expo's service fans out.
//
// Callers pass a Supabase client (service-role) so we can delete tokens Expo
// reports as no longer valid ("DeviceNotRegistered").
// ---------------------------------------------------------------------------
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

/**
 * sendPushToTokens
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - service-role client
 * @param {string[]} tokens - ExponentPushToken[...] strings
 * @param {{ title: string, body: string, data?: object }} message
 * @returns {Promise<{ sent: number, invalidRemoved: number }>}
 */
export async function sendPushToTokens(supabase, tokens, message) {
  const valid = (tokens || []).filter((t) => Expo.isExpoPushToken(t));
  if (valid.length === 0) return { sent: 0, invalidRemoved: 0 };

  const messages = valid.map((to) => ({
    to,
    // The app's custom notification sound, bundled natively via the
    // expo-notifications `sounds` array in FrogPlanner_App/app.json.
    //
    // Referenced by bare filename, and the two platforms disagree on the
    // extension: iOS wants 'notification.mp3', Android's res/raw lookup wants
    // 'notification'. One payload serves both, so send the iOS form here and
    // let channelId carry Android — on Android the channel's own sound wins
    // regardless of this field, which is why the client bumped the channel id
    // to 'reminders-v2' (a channel's sound is immutable once created).
    //
    // Case-sensitive on both platforms: must match the asset filename and
    // NOTIFICATION_SOUND_IOS in FrogPlanner_App/src/lib/notifications.ts.
    sound: 'notification.mp3',
    // Must match CHANNEL_ID in FrogPlanner_App/src/lib/notifications.ts.
    // Without it Android delivers on the default channel and the custom sound
    // never plays.
    channelId: 'reminders-v2',
    title: message.title,
    body: message.body,
    data: message.data || {},
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...receipts);
    } catch (error) {
      console.error('[push] send chunk failed:', error);
    }
  }

  // Prune tokens Expo says are dead so we stop paying to send to them.
  const deadTokens = [];
  tickets.forEach((ticket, i) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      deadTokens.push(valid[i]);
    }
  });
  if (deadTokens.length > 0) {
    await supabase.from('user_push_tokens').delete().in('token', deadTokens);
  }

  const sent = tickets.filter((t) => t.status === 'ok').length;
  return { sent, invalidRemoved: deadTokens.length };
}

/**
 * sendPushToUser — look up a user's tokens and push to all their devices.
 */
export async function sendPushToUser(supabase, userId, message) {
  const { data, error } = await supabase
    .from('user_push_tokens')
    .select('token')
    .eq('user_id', userId);
  if (error || !data) return { sent: 0, invalidRemoved: 0 };
  return sendPushToTokens(supabase, data.map((r) => r.token), message);
}
