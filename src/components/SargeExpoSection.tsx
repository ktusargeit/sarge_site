import React, { useState, useEffect } from 'react';
import { Building2, Users, Calendar, MapPin, CheckCircle2, ChevronRight, X, Send, Award, FileText, Sparkles, UserCheck, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { GalleryItem } from '../types';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, orderBy, addDoc } from 'firebase/firestore';
import { getCachedDoc } from '../lib/firebaseCache';

interface SargeExpoSectionProps {
  onShowToast: (msg: string) => void;
}

export const SargeExpoSection: React.FC<SargeExpoSectionProps> = ({ onShowToast }) => {
  const [activeModal, setActiveModal] = useState<'participate' | 'staff' | null>(null);
  const [expoPhotos, setExpoPhotos] = useState<GalleryItem[]>([]);
  const [expoFormUrl, setExpoFormUrl] = useState<string>('https://forms.google.com');
  
  useEffect(() => {
    const loadExpoGallery = async () => {
      try {
        const q = query(collection(db, 'gallery'), where('category', '==', 'expo'));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GalleryItem[];
        setExpoPhotos(items.sort((a,b) => (b.date || '').localeCompare(a.date || '')));
      } catch (err) {
        console.warn('Failed to load expo photos:', err);
      }
    };
    loadExpoGallery();

    const loadExpoLink = async () => {
      try {
        const res = await fetch('/api/content/about_teams');
        if (res.ok) {
          const json = await res.json();
          if (json.expoUnit?.applicationUrl) {
            setExpoFormUrl(json.expoUnit.applicationUrl);
            return;
          }
        }
      } catch {}
      try {
        const snap = await getCachedDoc('content', 'about_teams');
        if (snap.exists() && snap.data().expoUnit?.applicationUrl) {
          setExpoFormUrl(snap.data().expoUnit.applicationUrl);
        }
      } catch {}
    };
    loadExpoLink();
  }, []);


  
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>, successMsg: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const data: Record<string, any> = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    data.type = activeModal === 'participate' ? 'expo_participate' : 'expo_staff';

    try {
      try {
        const res = await fetch('/api/submit-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.headers.get('content-type')?.includes('application/json')) {
          const result = await res.json();
          if (res.ok) {
            onShowToast(successMsg || result.message || 'Başvurunuz başarıyla iletildi.');
            form.reset();
            setActiveModal(null);
          } else {
            onShowToast(result.error || 'Gönderim başarısız oldu.');
          }
          return;
        }
      } catch {}

      const now = Date.now();
      try {
        const lastSent = Number(localStorage.getItem('sarge_expo_cooldown') || '0');
        if (now - lastSent < 30000) {
          onShowToast('Çok sık başvuru gönderiyorsunuz. Lütfen 30 saniye bekleyip tekrar deneyin.');
          return;
        }
        localStorage.setItem('sarge_expo_cooldown', String(now));
      } catch {}

      const cleanPayload: Record<string, string> = {};
      Object.entries(data).forEach(([k, v]) => {
        if (!k.startsWith('_') && typeof v === 'string') {
          cleanPayload[k.slice(0, 50)] = v.trim().slice(0, 2000);
        }
      });
      await addDoc(collection(db, 'form_submissions'), {
        ...cleanPayload,
        timestamp: new Date().toISOString()
      });
      onShowToast(successMsg || 'Başvurunuz başarıyla iletildi.');
      form.reset();
      setActiveModal(null);
    } catch (err) {
      console.warn(err);
      onShowToast('Sunucu bağlantı hatası. Lütfen tekrar deneyin.');
    }
  };

  const handleApplyExpo = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = expoFormUrl || 'https://forms.google.com';
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="py-6 sm:py-16 bg-[#09090b] text-[#E2E8F0] font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-8 sm:space-y-16">

        {/* Hero Section Banner */}
        <div className="relative rounded-xl sm:rounded-3xl bg-[#18181b] border border-[#27272a] p-4 sm:p-12 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-3 sm:space-y-5">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-[#27272a] border border-[#3f3f46]/40 text-zinc-300 text-[10px] sm:text-xs font-sans font-semibold max-w-full">
                SARGE EXPO 2026 TAMAMLANDI • 2027 BAŞVURULARI AÇIK!
              </div>

              <h2 className="text-xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight font-sans">
                SARGE EXPO 2027 <br />
                <span className="text-white">
                  Savunma Sanayii Fuarı
                </span>
              </h2>

              <p className="text-[11px] sm:text-base lg:text-lg text-[#94A3B8] leading-relaxed font-normal max-w-2xl">
                SARGE EXPO 2026 büyük bir başarıyla tamamlandı, şimdi sıra <strong className="text-white">SARGE EXPO 2027</strong> organizasyonunda! Türkiye'nin en büyük ve ilk savunma sanayi organizasyonu için firma stant katılımı ve öğrenci gönüllü görev başvuruları başladı.
              </p>

              {/* Action Buttons for EXPO */}
              <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-2 sm:gap-4">
                <a
                  href="/expo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-4 sm:px-7 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  <span>SARGE EXPO Sitesine Git</span>
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 text-white" />
                </a>

                <button
                  onClick={handleApplyExpo}
                  className="w-full sm:w-auto px-4 sm:px-7 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl bg-[#102040] hover:bg-[#183060] text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/50 border border-[#234580] cursor-pointer active:scale-95"
                >
                  <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  <span>Bize Katılın (Gönüllü & Görevli Başvurusu)</span>
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 text-white" />
                </button>
              </div>
            </div>

            {/* Quick Location & Date Box */}
            <div className="lg:col-span-4 bg-[#121215] p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-[#27272a] space-y-3 sm:space-y-4">
              <h3 className="text-xs sm:text-sm font-bold font-sans text-zinc-300 uppercase tracking-wider">
                EXPO 2027 Tarih & Konum
              </h3>
              
              <div className="space-y-2.5 sm:space-y-3 text-[11px] sm:text-xs text-[#94A3B8]">
                <div className="flex items-start gap-2 sm:gap-2.5">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Mayıs 2027 (Yakında)</span>
                    <span className="text-[#94A3B8]">09:00 - 18:00 Arası Açık</span>
                  </div>
                </div>

                <a href="https://maps.google.com/?q=KTÜ+Osman+Turan+Kongre+Merkezi,+Ortahisar,+Trabzon" target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 sm:gap-2.5 group cursor-pointer">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-bold text-white block group-hover:text-zinc-200 transition-colors">KTÜ Osman Turan Kongre Merkezi</span>
                    <span className="text-[#94A3B8] group-hover:text-slate-300 transition-colors">Kanuni Kampüsü, Ortahisar / Trabzon</span>
                  </div>
                </a>

                <div className="pt-2 border-t border-[#27272a] grid grid-cols-2 gap-2 text-center font-sans">
                  <div className="bg-[#18181b] p-1.5 sm:p-2 rounded-lg border border-[#27272a]">
                    <span className="text-[9px] sm:text-[10px] text-[#94A3B8] block">HEDEF ZİYARETÇİ</span>
                    <span className="text-white font-bold text-xs sm:text-sm">10.000+</span>
                  </div>
                  <div className="bg-[#18181b] p-1.5 sm:p-2 rounded-lg border border-[#27272a]">
                    <span className="text-[9px] sm:text-[10px] text-[#94A3B8] block">FİRMA STANT</span>
                    <span className="text-white font-bold text-xs sm:text-sm">40+</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expo Gallery */}
        {expoPhotos.length > 0 && (
          <div className="space-y-6 pt-16 border-t border-[#27272a] mt-12">
            <h3 className="text-2xl font-bold text-white">
              EXPO'dan Kareler
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {expoPhotos.map((photo) => (
                <div key={photo.id} className="bg-[#18181b] rounded-2xl border border-[#27272a] overflow-hidden group">
                  <div className="aspect-[4/3] w-full overflow-hidden relative">
                    <img src={photo.imageUrl} alt={photo.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-5">
                    <h4 className="text-lg font-bold text-white mb-2">{photo.title}</h4>
                    {photo.description && <p className="text-sm text-[#94A3B8]">{photo.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 2: EXPO VOLUNTEER STAFF APPLICATION */}
      {activeModal === 'staff' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-xl bg-[#18181b] rounded-2xl border border-[#27272a] shadow-2xl p-6 sm:p-8 space-y-6 my-4 sm:my-8 shrink-0">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">EXPO Görev Alma / Gönüllü Başvurusu</h3>
                <p className="text-xs text-[#94A3B8]">KTÜ Öğrencileri İçin Organizasyon Ekibi</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form 
              action="https://formsubmit.co/sarge.iha.2025.2026@gmail.com" 
              method="POST" 
              className="space-y-4 text-xs"
              onSubmit={(e) => handleFormSubmit(e, 'SARGE EXPO Gönüllü başvurunuz başarıyla alınmıştır. Teşekkür ederiz!')}
            >
              <input type="hidden" name="_subject" value="KTÜ SARGE EXPO Gönüllü Başvurusu" />
              <input type="hidden" name="_captcha" value="false" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#E2E8F0] font-sans mb-1">Ad Soyad *</label>
                  <input
                    type="text"
                    name="Ad_Soyad"
                    required
                    placeholder="Adınız ve Soyadınız"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2.5 text-[#E2E8F0] focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#E2E8F0] font-sans mb-1">Öğrenci Numarası *</label>
                  <input
                    type="text"
                    name="Ogrenci_No"
                    required
                    placeholder="Örn: 410293"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2.5 text-[#E2E8F0] focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#E2E8F0] font-sans mb-1">Bölümünüz *</label>
                  <input
                    type="text"
                    name="Bolum"
                    required
                    placeholder="Örn: Bilgisayar Mühendisliği"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2.5 text-[#E2E8F0] focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#E2E8F0] font-sans mb-1">Sınıf</label>
                  <select
                    name="Sinif"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2.5 text-[#E2E8F0] focus:border-zinc-400 focus:outline-none"
                  >
                    <option value="Hazırlık">Hazırlık</option>
                    <option value="1">1. Sınıf</option>
                    <option value="2">2. Sınıf</option>
                    <option value="3">3. Sınıf</option>
                    <option value="4">4. Sınıf</option>
                    <option value="Yüksek Lisans">Yüksek Lisans / Doktora</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#E2E8F0] font-sans mb-1">E-posta Adresi *</label>
                  <input
                    type="email"
                    name="Email"
                    required
                    placeholder="ornek@ktu.edu.tr"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2.5 text-[#E2E8F0] focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#E2E8F0] font-sans mb-1">Telefon Numarası *</label>
                  <input
                    type="tel"
                    name="Telefon"
                    required
                    placeholder="05XX XXX XX XX"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2.5 text-[#E2E8F0] focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#E2E8F0] font-sans mb-1">Görev Almak İstediğiniz Alan *</label>
                <select
                  name="Gorev_Alani"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2.5 text-[#E2E8F0] focus:border-zinc-400 focus:outline-none"
                >
                  <option value="VIP & Protokol Refakat Ağırlama">VIP & Protokol Refakat Ağırlama</option>
                  <option value="Saha & Stant Kurulum Koordinasyonu">Saha & Stant Kurulum Koordinasyonu</option>
                  <option value="Basın, Medya & Fotoğraf Ekibi">Basın, Medya & Fotoğraf Ekibi</option>
                  <option value="Teknik, Ses & Sunum Destek">Teknik, Ses & Sunum Destek</option>
                  <option value="Kayıt & Ziyaretçi Karşılama">Kayıt & Ziyaretçi Karşılama Masa Ekibi</option>
                </select>
              </div>

              <div>
                <label className="block text-[#E2E8F0] font-sans mb-1">Neden Görev Almak İstiyorsunuz?</label>
                <textarea
                  name="Motivasyon"
                  rows={3}
                  placeholder="Kısaca yeteneklerinizden ve motivasyonunuzdan bahsedin..."
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2.5 text-[#E2E8F0] focus:border-zinc-400 focus:outline-none"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-lg bg-[#09090b] text-[#94A3B8] hover:text-white border border-[#27272a]"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#102040] hover:bg-[#183060] text-white font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-black/40 border border-[#234580]"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                  <span>Gönüllü Başvurusunu Tamamla</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
