import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatImageUrl, handleImageFallback, extractDriveId } from '../lib/mediaUtils';

export interface ParsedMedia {
  type: 'video' | 'image' | 'youtube' | 'drive' | 'vimeo' | 'none';
  url: string;
  driveId?: string;
  youtubeId?: string;
  vimeoId?: string;
}

export const parseBackgroundMedia = (url?: string): ParsedMedia => {
  if (!url || !url.trim()) return { type: 'none', url: '' };
  const trimmed = url.trim();

  // 1. YouTube Link (all formats including watch, youtu.be, shorts, embed, live, mobile)
  const ytMatch = trimmed.match(/(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      url: trimmed,
      youtubeId: ytMatch[1]
    };
  }

  // 2. Vimeo Link
  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/\d+\/video\/|video\/|)(\d+))/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      url: trimmed,
      vimeoId: vimeoMatch[1]
    };
  }

  // 3. HTML5 Video files or direct video URLs (MP4, WebM, Firebase Storage, Cloudinary, etc.)
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('data:video/') ||
    lower.startsWith('blob:') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.m4v') ||
    lower.includes('.mp4?') ||
    lower.includes('.webm?') ||
    lower.includes('.mov?') ||
    lower.includes('/uploads/media_') ||
    lower.includes('gtv-videos-bucket') ||
    lower.includes('firebasestorage.googleapis.com') ||
    lower.includes('firebasestorage.app') ||
    lower.includes('storage.googleapis.com') ||
    lower.includes('cloudfront.net') ||
    lower.includes('cloudinary.com')
  ) {
    return { type: 'video', url: trimmed };
  }

  // 4. Google Drive Link (supports both drive images & drive videos)
  const driveId = extractDriveId(trimmed);
  if (driveId) {
    return {
      type: 'drive',
      url: trimmed,
      driveId: driveId
    };
  }

  // 5. Default to standard Image
  return { type: 'image', url: trimmed };
};

export const isVideoMedia = (url?: string): boolean => {
  const p = parseBackgroundMedia(url);
  return p.type === 'video' || p.type === 'youtube' || p.type === 'vimeo';
};

interface BackgroundMediaProps {
  url?: string;
  alt?: string;
  className?: string;
  gradientOverlay?: boolean;
  onError?: () => void;
}

export const BackgroundMedia: React.FC<BackgroundMediaProps> = ({
  url,
  alt = 'Background',
  className = '',
  gradientOverlay = true,
  onError
}) => {
  const [driveFallbackToImage, setDriveFallbackToImage] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Reset error states whenever url changes
  useEffect(() => {
    setDriveFallbackToImage(false);
    setHasError(false);
    setIsPlaying(false);
    setIframeLoaded(false);
  }, [url]);

  const setupVideoElement = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    videoRef.current = el;

    // Direct DOM property assignment (mandatory for WebKit/iOS and Chrome autoplay policies)
    el.defaultMuted = true;
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    el.loop = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.setAttribute('muted', '');
    el.setAttribute('autoplay', '');
    el.setAttribute('loop', '');

    const triggerPlay = () => {
      if (!el) return;
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.setAttribute('muted', '');
      el.setAttribute('autoplay', '');
      el.setAttribute('loop', '');
      const promise = el.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // Autoplay restriction fallback, user interaction will unlock
            setIsPlaying(false);
          });
      }
    };

    // Immediate playback trigger
    triggerPlay();
  }, []);

  // Global mobile & desktop user interaction resume listener: starts video playback instantly on any first touch or scroll
  useEffect(() => {
    const handleUserInteraction = () => {
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.defaultMuted = true;
        videoRef.current.playsInline = true;
        videoRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    };

    window.addEventListener('click', handleUserInteraction, { passive: true, once: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true, once: true });
    window.addEventListener('touchend', handleUserInteraction, { passive: true, once: true });
    window.addEventListener('touchmove', handleUserInteraction, { passive: true, once: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true, once: true });
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true, once: true });
    document.addEventListener('visibilitychange', handleUserInteraction);

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('touchend', handleUserInteraction);
      window.removeEventListener('touchmove', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
      document.removeEventListener('visibilitychange', handleUserInteraction);
    };
  }, []);

  if (!url || !url.trim() || hasError) {
    return null;
  }

  const media = parseBackgroundMedia(url);
  if (media.type === 'none') {
    return null;
  }

  return (
    <>
      {/* 1. YouTube Background Video (Autoplays immediately on mobile & desktop, clean without overlay icons) */}
      {media.type === 'youtube' && media.youtubeId && (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${media.youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${media.youtubeId}&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&enablejsapi=1&fs=0&origin=${origin}`}
            onLoad={(e) => {
              setIframeLoaded(true);
              try {
                // Post instant playVideo command to YouTube API
                e.currentTarget.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
              } catch {}
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] sm:w-[130%] md:w-[120%] lg:w-[115%] h-[160%] sm:h-[130%] md:h-[120%] lg:h-[115%] min-w-full min-h-full object-cover pointer-events-none border-0 opacity-90 transition-opacity duration-300 select-none"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
            title="YouTube Background Video"
            tabIndex={-1}
            loading="eager"
          />
        </div>
      )}

      {/* 2. Vimeo Background Video */}
      {media.type === 'vimeo' && media.vimeoId && (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none">
          <iframe
            src={`https://player.vimeo.com/video/${media.vimeoId}?autoplay=1&loop=1&muted=1&background=1`}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] sm:w-[125%] h-[150%] sm:h-[125%] min-w-full min-h-full object-cover pointer-events-none opacity-90 border-0 transition-opacity duration-300 select-none"
            allow="autoplay; fullscreen"
            title="Vimeo Background Video"
            tabIndex={-1}
            loading="eager"
          />
        </div>
      )}

      {/* 3. Google Drive Media (Supports both Drive Images & Drive Videos, no zoomable iframe) */}
      {media.type === 'drive' && media.driveId && (
        <>
          {driveFallbackToImage ? (
            <img
              src={formatImageUrl(media.url)}
              alt={alt}
              className={`absolute inset-0 w-full h-full object-cover opacity-90 object-center pointer-events-none select-none transition-opacity duration-300 ${className}`}
              referrerPolicy="no-referrer"
              onError={(e) => handleImageFallback(e, media.url)}
              loading="eager"
            />
          ) : (
            <video
              ref={setupVideoElement}
              key={`drive-vid-${media.driveId}`}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              onLoadedMetadata={(e) => {
                e.currentTarget.muted = true;
                e.currentTarget.play().then(() => setIsPlaying(true)).catch(() => {});
              }}
              onLoadedData={(e) => {
                e.currentTarget.muted = true;
                e.currentTarget.play().then(() => setIsPlaying(true)).catch(() => {});
              }}
              onCanPlay={(e) => {
                e.currentTarget.muted = true;
                e.currentTarget.play().then(() => setIsPlaying(true)).catch(() => {});
              }}
              className={`absolute inset-0 w-full h-full object-cover opacity-90 object-center pointer-events-none select-none transition-opacity duration-300 ${className}`}
              onError={() => {
                // If direct video stream fails, it is an image file on Google Drive; smoothly render high-res image
                setDriveFallbackToImage(true);
              }}
            >
              <source src={`/api/stream-drive/${media.driveId}`} type="video/mp4" />
              <source src={`https://drive.usercontent.google.com/download?id=${media.driveId}&export=download&authuser=0`} type="video/mp4" />
              <source src={`https://drive.google.com/uc?export=download&id=${media.driveId}`} type="video/mp4" />
            </video>
          )}
        </>
      )}

      {/* 4. HTML5 Video (MP4 / WebM / Firebase Cloud Video / Direct URL) */}
      {media.type === 'video' && (
        <video
          ref={setupVideoElement}
          key={`video-${media.url}`}
          src={media.url}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onLoadedMetadata={(e) => {
            e.currentTarget.muted = true;
            e.currentTarget.play().then(() => setIsPlaying(true)).catch(() => {});
          }}
          onLoadedData={(e) => {
            e.currentTarget.muted = true;
            e.currentTarget.play().then(() => setIsPlaying(true)).catch(() => {});
          }}
          onCanPlay={(e) => {
            e.currentTarget.muted = true;
            e.currentTarget.play().then(() => setIsPlaying(true)).catch(() => {});
          }}
          onCanPlayThrough={(e) => {
            e.currentTarget.muted = true;
            e.currentTarget.play().then(() => setIsPlaying(true)).catch(() => {});
          }}
          onPlaying={() => setIsPlaying(true)}
          className={`absolute inset-0 w-full h-full object-cover opacity-90 object-center pointer-events-none select-none transition-opacity duration-300 ${className}`}
          onError={() => {
            console.warn("Video playback error for URL:", media.url);
            setHasError(true);
            onError?.();
          }}
        />
      )}

      {/* 5. Standard Static Image (Direct, Google Drive or CDN) */}
      {media.type === 'image' && (
        <img
          src={formatImageUrl(media.url)}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover opacity-90 object-center pointer-events-none select-none transition-opacity duration-300 ${className}`}
          referrerPolicy="no-referrer"
          onError={(e) => {
            handleImageFallback(e, media.url);
          }}
          loading="eager"
        />
      )}

      {/* Gradient vignette overlay for text legibility */}
      {gradientOverlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/25 pointer-events-none select-none" />
      )}
    </>
  );
};

