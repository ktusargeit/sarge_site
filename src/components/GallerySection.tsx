import React, { useState, useEffect } from 'react';
import { GALLERY_ITEMS } from '../data/mockData';
import { GalleryItem } from '../types';
import { Image as ImageIcon, X, MapPin, Calendar, Maximize2, Shield, Wrench, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatImageUrl, handleImageFallback } from '../lib/mediaUtils';

export const GallerySection: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryItem | null>(null);
  const [firebaseItems, setFirebaseItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    const loadGallery = async () => {
      try {
        const q = query(collection(db, 'gallery'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            category: data.category || 'atolye',
            categoryLabel: data.category === 'atolye' ? 'Atölye Çalışmaları' : data.category === 'expo' ? 'SARGE EXPO' : 'Saha & Test',
            imageUrl: data.imageUrl || '',
            date: data.date || '',
            location: data.location || '',
            description: data.description || ''
          } as GalleryItem;
        });
        setFirebaseItems(items);
      } catch (err) {
        console.warn("Firebase fetch error:", err);
        setFirebaseItems(GALLERY_ITEMS);
      }
    };
    loadGallery();
  }, []);

  const categories = [
    { id: 'all', label: 'Tüm Galeri' },
    { id: 'atolye', label: 'Atölye & Üretim Fotoğrafları', icon: Wrench },
    { id: 'expo', label: 'SARGE EXPO Fotoğrafları', icon: Sparkles },
    { id: 'saha', label: 'Saha & Test Fotoğrafları', icon: Shield },
  ];

  const filteredItems = activeCategory === 'all'
    ? firebaseItems
    : firebaseItems.filter((item) => item.category === activeCategory);

  // Keyboard listener for ESC key to close lightbox
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="py-6 sm:py-16 bg-[#09090b] text-[#E2E8F0] font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6 sm:space-y-12">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-1.5 sm:space-y-3">
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[#F8FAFC] tracking-tight">
            GALERİ
          </h2>
          <p className="text-[11px] sm:text-sm text-[#94A3B8] leading-relaxed px-1 sm:px-0">
            Mühendislik atölyemizden canlı kareler, üretim anları, saha testleri ve SARGE EXPO fuarımızın unutulmaz anları.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#102040] hover:bg-[#183060] text-white shadow-md shadow-black/40 border border-[#234580]'
                    : 'bg-[#18181b] text-[#94A3B8] hover:text-white hover:bg-[#27272a] border border-[#27272a]'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Photos Masonry/Grid Layout */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 sm:py-20 bg-[#18181b] rounded-xl sm:rounded-3xl border border-[#27272a]">
            <ImageIcon className="w-8 h-8 sm:w-12 sm:h-12 text-[#334155] mx-auto mb-2 sm:mb-4" />
            <h3 className="text-[#94A3B8] font-medium text-sm sm:text-lg">Bu kategoride henüz fotoğraf bulunmuyor</h3>
            <p className="text-[#64748B] text-xs sm:text-sm mt-1 sm:mt-2">Admin panelinden yeni fotoğraflar ekleyebilirsiniz.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => setSelectedPhoto(item)}
                  className="group relative rounded-2xl bg-[#18181b] border border-[#27272a] hover:border-zinc-500/40 overflow-hidden cursor-pointer shadow-lg aspect-[4/3]"
                >
                <img
                  src={formatImageUrl(item.imageUrl)}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageFallback(e, item.imageUrl)}
                  loading="lazy"
                />

                {/* Dark Vignette Gradient */}
                
                {/* Bottom Caption Overlay (Persistent) */}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                  <h4 className="text-sm font-bold text-white font-sans drop-shadow-md">
                    {item.title}
                  </h4>
                  {item.description && (
                    <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 drop-shadow-md leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>


              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        )}

      </div>

      {/* LIGHTBOX MODAL */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/90 backdrop-blur-xl overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl bg-[#18181b] rounded-2xl border border-[#27272a] overflow-hidden shadow-2xl my-4 sm:my-8 shrink-0"
          >
            <div className="flex items-center justify-between p-4 bg-transparent absolute top-0 right-0 z-10 w-full">
              <div className="flex-1"></div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-all"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative max-h-[70vh] bg-black flex items-center justify-center overflow-hidden">
              <img
                src={formatImageUrl(selectedPhoto.imageUrl)}
                alt={selectedPhoto.title}
                className="max-h-[70vh] w-auto max-w-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => handleImageFallback(e, selectedPhoto.imageUrl)}
              />
            </div>

            <div className="p-6 bg-[#18181b]">
              <h3 className="text-lg font-semibold text-white mb-2">{selectedPhoto.title}</h3>
              {selectedPhoto.description && (
                <p className="text-sm text-slate-400 leading-relaxed mb-4">{selectedPhoto.description}</p>
              )}
              
              {(selectedPhoto.location || selectedPhoto.date) && (
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-4 border-t border-[#27272a]">
                  {selectedPhoto.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {selectedPhoto.location}
                    </span>
                  )}
                  {selectedPhoto.date && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> {selectedPhoto.date}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
