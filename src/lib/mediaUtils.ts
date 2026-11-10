import type React from 'react';

/**
 * Utility functions to parse and normalize Google Drive and other media links
 * Ensures images and videos work seamlessly across all browsers and components.
 */

export const extractDriveId = (url?: string): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:drive\.google\.com\/(?:file\/(?:u\/\d+\/)?d\/|open\?id=|uc\?(?:export=(?:download|view)&)?id=|thumbnail\?id=)|lh3\.googleusercontent\.com\/d\/|drive\.usercontent\.google\.com\/download\?id=)([a-zA-Z0-9_-]{15,})/i
  );
  return match && match[1] ? match[1] : null;
};

/**
 * Transforms any image URL (including Google Drive links) into a directly renderable, high-res web image URL.
 */
export const formatImageUrl = (url?: string): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const driveId = extractDriveId(trimmed);
  if (driveId) {
    // Primary Google high-resolution CDN endpoint (super fast, web-friendly, no cookie/auth requirements)
    return `https://lh3.googleusercontent.com/d/${driveId}=s1600`;
  }

  return trimmed;
};

/**
 * Fallback cascade handler for <img> onError events.
 * If the primary Google Drive endpoint fails, tries secondary endpoints and local server proxy.
 */
export const handleImageFallback = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  originalUrl?: string
) => {
  const target = e.currentTarget;
  if (!originalUrl || typeof originalUrl !== 'string') return;

  const driveId = extractDriveId(originalUrl);
  if (driveId) {
    const currentSrc = target.src || '';

    // Step 1: lh3 failed -> try drive.google.com/thumbnail
    if (currentSrc.includes('lh3.googleusercontent.com')) {
      target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
      return;
    }

    // Step 2: thumbnail failed -> try server-side drive image proxy
    if (currentSrc.includes('thumbnail?id=')) {
      target.src = `/api/drive-image/${driveId}`;
      return;
    }

    // Step 3: server proxy failed -> try direct drive stream
    if (currentSrc.includes('/api/drive-image/')) {
      target.src = `https://drive.google.com/uc?export=view&id=${driveId}`;
      return;
    }
  }
};
