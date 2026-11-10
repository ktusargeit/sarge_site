import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Newspaper, ExternalLink, Search } from 'lucide-react';
import { PRESS_DATA } from '../data/mockData';
import { PressItem } from '../types';

export const AnnouncementsSection: React.FC = () => {
  const [pressItems, setPressItems] = useState<PressItem[]>(PRESS_DATA);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPress = async () => {
      try {
        const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const data: PressItem[] = [];
        querySnapshot.forEach((doc) => {
          const d = doc.data();
          data.push({
            id: doc.id,
            title: d.title || 'Başlıksız Haber',
            source: d.source || 'Basın',
            sourceUrl: d.sourceUrl || d.url || '',
            imageUrl: d.imageUrl || d.image || '',
            date: d.date || '2026',
            summary: d.summary || d.content || '',
            content: d.content || d.summary || '',
            category: d.category || '',
            timestamp: d.timestamp
          });
        });

        if (data.length > 0) {
          setPressItems(data);
        } else {
          setPressItems(PRESS_DATA);
        }
      } catch (err) {
        console.warn("Haberler çekilemedi, varsayılan basın verileri yüklendi:", err);
        setPressItems(PRESS_DATA);
      } finally {
        setLoading(false);
      }
    };
    fetchPress();
  }, []);

  const filteredItems = pressItems.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item.summary || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-[#09090b] text-[#E2E8F0] min-h-screen py-8 sm:py-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        
        {/* Sayfa Başlık Alanı */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Basında Biz
          </h1>
          <p className="text-xs sm:text-base text-[#94A3B8] leading-relaxed">
            Karadeniz Teknik Üniversitesi Savunma ve Ar-Ge Topluluğu'nun basındaki yansımaları ve haberleri.
          </p>

          {/* Arama Kutusu */}
          <div className="pt-2 max-w-md mx-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Haberlerde ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#18181b] border border-[#27272a] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#94A3B8] text-sm">Haberler yükleniyor...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-[#18181b] rounded-2xl border border-[#27272a] p-8 space-y-2 max-w-md mx-auto">
            <Newspaper className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <h3 className="text-base font-bold text-white">Haber Bulunamadı</h3>
            <p className="text-xs text-[#94A3B8]">Farklı bir arama kelimesi deneyebilirsiniz.</p>
          </div>
        ) : (
          /* Haber Kartları Izgarası: Sadece Fotoğraf, Başlık, Kısa Açıklama */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredItems.map((item) => {
              const rawUrl = (item.sourceUrl || '').trim();
              const safeUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
              const hasUrl = Boolean(safeUrl);
              return (
                <a
                  key={item.id}
                  href={hasUrl ? safeUrl : '#'}
                  target={hasUrl ? '_blank' : '_self'}
                  rel={hasUrl ? 'noopener noreferrer' : ''}
                  onClick={(e) => {
                    if (!hasUrl) {
                      e.preventDefault();
                    }
                  }}
                  className={`group bg-[#18181b] rounded-2xl border border-[#27272a] hover:border-blue-500/60 overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-lg hover:shadow-black/70 ${
                    hasUrl ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div>
                    {/* Fotoğraf (Üzerinde hiçbir yazı, rozet veya öne çıkan etiketi yok) */}
                    <div className="aspect-[16/10] w-full overflow-hidden bg-black relative">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#121215]">
                          <Newspaper className="w-12 h-12 text-zinc-600" />
                        </div>
                      )}
                    </div>

                    {/* Başlık ve Kısa Açıklama */}
                    <div className="p-5 sm:p-6 space-y-3">
                      <h2 className="text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">
                        {item.title}
                      </h2>

                      <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed line-clamp-3">
                        {item.summary || item.content}
                      </p>
                    </div>
                  </div>

                  {/* Alt Kısım: Habere Git Linki */}
                  {hasUrl && (
                    <div className="px-5 sm:px-6 pb-5 pt-0 flex items-center justify-end text-xs font-semibold text-blue-400 group-hover:text-blue-300 transition-colors gap-1.5">
                      <span>Habere Git</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};
