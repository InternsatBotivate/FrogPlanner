/**
 * avatarService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Uploads/removes a user's profile picture in the "avatars" Supabase Storage
 * bucket. Callers are expected to hand this an already-cropped WebP Blob
 * (see AvatarUploadModal.jsx) — this file only owns the storage I/O.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { supabase } from './supabaseClient';

const AVATARS_BUCKET = 'avatars';
export const MAX_AVATAR_SOURCE_BYTES = 10 * 1024 * 1024; // 10MB cap on the input file

const avatarPath = (userId) => `${userId}/avatar.webp`;

/**
 * uploadAvatar
 * Uploads a cropped WebP Blob to avatars/{userId}/avatar.webp (overwriting
 * any previous photo) and returns its public URL.
 */
export const uploadAvatar = async (userId, blob) => {
  try {
    if (!userId) return { url: null, error: new Error('User ID is required.') };

    const path = avatarPath(userId);
    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, blob, { contentType: 'image/webp', upsert: true });

    if (uploadError) return { url: null, error: uploadError };

    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    // Bust CDN/browser caching so a re-upload shows immediately at the same URL.
    const url = `${data.publicUrl}?v=${Date.now()}`;
    return { url, error: null };
  } catch (err) {
    return { url: null, error: err };
  }
};

/**
 * removeAvatar
 * Deletes the user's stored photo from the bucket.
 */
export const removeAvatar = async (userId) => {
  try {
    if (!userId) return { error: new Error('User ID is required.') };
    const { error } = await supabase.storage.from(AVATARS_BUCKET).remove([avatarPath(userId)]);
    return { error: error ?? null };
  } catch (err) {
    return { error: err };
  }
};
