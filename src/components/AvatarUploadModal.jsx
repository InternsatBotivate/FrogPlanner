/**
 * AvatarUploadModal.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Lets a user pick or capture a photo, crop it to a square, and upload it as
 * their profile picture. Any input image format is drawn onto a canvas and
 * re-encoded as WebP client-side before it ever reaches avatarService.
 * ──────────────────────────────────────────────────────────────────────────
 */
import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Camera, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadAvatar, MAX_AVATAR_SOURCE_BYTES } from '../lib/avatarService';
import { useAuthStore } from '../store/authStore';

// Draws the cropped region of `imageSrc` onto a canvas and resolves a WebP Blob.
async function cropToWebpBlob(imageSrc, cropPixels) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const size = Math.round(Math.min(cropPixels.width, cropPixels.height));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    size,
    size,
    0,
    0,
    size,
    size,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))),
      'image/webp',
      0.85,
    );
  });
}

export default function AvatarUploadModal({ isOpen, onClose }) {
  const user = useAuthStore((state) => state.user);
  const updateAvatar = useAuthStore((state) => state.updateAvatar);

  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      toast.error('Image is too large — please choose one under 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await cropToWebpBlob(imageSrc, croppedAreaPixels);
      const { url, error: uploadError } = await uploadAvatar(user.id, blob);
      if (uploadError || !url) throw uploadError || new Error('Upload failed.');

      const { error: saveError } = await updateAvatar(url);
      if (saveError) throw saveError;

      toast.success('Profile picture updated!');
      handleClose();
    } catch (err) {
      toast.error(err.message || 'Could not update your profile picture.');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-[200] p-3 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-black text-gray-800">Profile Picture</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!imageSrc ? (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-green-200 rounded-xl py-10 cursor-pointer hover:bg-green-50/50 transition-colors">
              <Camera className="text-green-500" size={28} />
              <span className="text-sm font-bold text-gray-700">Choose or take a photo</span>
              <span className="text-xs text-gray-400">PNG, JPG, or any image — up to 10MB</span>
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          ) : (
            <>
              <div className="relative w-full h-64 bg-gray-900 rounded-xl overflow-hidden">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-green-600"
              />
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 flex gap-2">
          {imageSrc && (
            <button
              onClick={() => setImageSrc(null)}
              disabled={saving}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition font-bold uppercase tracking-wider disabled:opacity-50"
            >
              Choose another
            </button>
          )}
          <button
            onClick={imageSrc ? handleSave : handleClose}
            disabled={saving || (imageSrc && !croppedAreaPixels)}
            className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-xs text-white transition font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {imageSrc ? (saving ? 'Saving...' : 'Save Photo') : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
