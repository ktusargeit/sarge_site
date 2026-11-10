import React, { useState, useEffect } from 'react';
import { MapPin, Mail, Phone, Clock, Send } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { getCachedDoc } from '../lib/firebaseCache';

interface JoinContactSectionProps {
  onShowToast: (msg: string) => void;
}

export const JoinContactSection: React.FC<JoinContactSectionProps> = ({ onShowToast }) => {
  const [settings, setSettings] = useState({
    email: 'sarge@ktu.edu.tr',
    phone: '+90 462 377 3000',
    address: 'KTÜ Kanuni Kampüsü, Mühendislik Fak. B Blok, SARGE Atölyesi, Ortahisar / Trabzon',
    contactTitle: 'İletişim',
    contactDesc: 'Projelerimiz, etkinliklerimiz veya sponsorluk süreçlerimiz hakkında bilgi almak için bizimle iletişime geçebilirsiniz.',
    contactDetailsTitle: 'Atölye & Genel İletişim',
    contactWorkingHours: 'Hafta İçi & Cumartesi: 09:00 - 21:00',
    contactFormTitle: 'Bize Mesaj Gönderin'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getCachedDoc('content', 'site_settings');
        if (snap.exists() && snap.data()) {
          setSettings(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (err) {
        console.warn("JoinContact settings fetch error:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data: Record<string, any> = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    data.type = 'contact';

    if (data._gotcha) {
      onShowToast('Mesajınız başarıyla iletildi.');
      form.reset();
      return;
    }

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
            onShowToast(result.message || 'Mesajınız başarıyla iletildi.');
            form.reset();
          } else {
            onShowToast(result.error || 'Gönderim başarısız oldu.');
          }
          return;
        }
      } catch {}

      const now = Date.now();
      try {
        const lastSent = Number(localStorage.getItem('sarge_contact_cooldown') || '0');
        if (now - lastSent < 30000) {
          onShowToast('Çok sık mesaj gönderiyorsunuz. Lütfen 30 saniye bekleyip tekrar deneyin.');
          return;
        }
        localStorage.setItem('sarge_contact_cooldown', String(now));
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
      onShowToast('Mesajınız başarıyla iletildi.');
      form.reset();
    } catch (err) {
      console.warn(err);
      onShowToast('Sunucu bağlantı hatası. Lütfen tekrar deneyin.');
    }
  };

  return (
    <div className="py-6 sm:py-16 bg-[#09090b] text-[#E2E8F0] font-sans min-h-screen">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6 sm:space-y-12">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-4">
          <h2 className="text-xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight">
            {settings.contactTitle || 'İletişim'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed whitespace-pre-wrap px-1 sm:px-0">
            {settings.contactDesc || 'Projelerimiz, etkinliklerimiz veya sponsorluk süreçlerimiz hakkında bilgi almak için bizimle iletişime geçebilirsiniz.'}
          </p>
        </div>

        {/* Contact Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12 items-start">
          
          {/* Contact Details */}
          <div className="space-y-4 sm:space-y-8">
            <div>
              <h3 className="text-base sm:text-xl font-bold text-white mb-3 sm:mb-6">{settings.contactDetailsTitle || 'Atölye & Genel İletişim'}</h3>
              <ul className="space-y-3.5 sm:space-y-6 text-xs sm:text-sm">
                <li className="flex items-start gap-3 sm:gap-4">
                  <div className="mt-0.5 sm:mt-1 text-zinc-400">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block mb-0.5 sm:mb-1">Atölye Adresi</span>
                    <a href={"https://maps.google.com/?q=" + encodeURIComponent(settings.address || "Karadeniz Teknik Üniversitesi, Trabzon")} target="_blank" rel="noopener noreferrer" className="text-slate-400 leading-relaxed whitespace-pre-wrap hover:text-white transition-colors block text-[11px] sm:text-sm">
                      {settings.address}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3 sm:gap-4">
                  <div className="mt-0.5 sm:mt-1 text-zinc-400">
                    <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block mb-0.5 sm:mb-1">E-posta</span>
                    <a
                      href={`mailto:${(settings.email || 'sarge@ktu.edu.tr').trim()}?subject=${encodeURIComponent('KTÜ SARGE İletişim')}`}
                      title="E-posta göndermek için tıklayın"
                      className="text-slate-400 hover:text-white hover:underline underline-offset-4 transition-colors block text-[11px] sm:text-sm cursor-pointer"
                    >
                      {settings.email || 'sarge@ktu.edu.tr'}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3 sm:gap-4">
                  <div className="mt-0.5 sm:mt-1 text-zinc-400">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block mb-0.5 sm:mb-1">Telefon / Santral</span>
                    <a href={`tel:${settings.phone.replace(/[^0-9+]/g, '')}`} className="text-slate-400 hover:text-white transition-colors block text-[11px] sm:text-sm">{settings.phone}</a>
                  </div>
                </li>
                <li className="flex items-start gap-3 sm:gap-4">
                  <div className="mt-0.5 sm:mt-1 text-zinc-400">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block mb-0.5 sm:mb-1">Atölye Çalışma Saatleri</span>
                    <span className="text-slate-400 whitespace-pre-wrap text-[11px] sm:text-sm">{settings.contactWorkingHours || 'Hafta İçi & Cumartesi: 09:00 - 21:00'}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-[#18181b] p-4 sm:p-8 rounded-xl sm:rounded-2xl border border-[#27272a] shadow-lg">
            <h3 className="text-base sm:text-xl font-bold text-white mb-3 sm:mb-6">{settings.contactFormTitle || 'Bize Mesaj Gönderin'}</h3>
            <form 
              action="https://formsubmit.co/sarge.iha.2025.2026@gmail.com" 
              method="POST" 
              className="space-y-3 sm:space-y-5 text-xs sm:text-sm"
              onSubmit={handleFormSubmit}
            >
              <input type="hidden" name="_subject" value="KTÜ SARGE İletişim Formu" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" style={{ display: 'none' }} />
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1 sm:mb-2 text-xs sm:text-sm">Adınız Soyadınız *</label>
                <input
                  type="text"
                  name="Ad_Soyad"
                  required
                  placeholder="Ad Soyad"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-white focus:border-zinc-400 focus:outline-none transition-colors text-xs sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1 sm:mb-2 text-xs sm:text-sm">E-posta Adresiniz *</label>
                <input
                  type="email"
                  name="Email"
                  required
                  placeholder="ornek@domain.com"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-white focus:border-zinc-400 focus:outline-none transition-colors text-xs sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1 sm:mb-2 text-xs sm:text-sm">Konu</label>
                <input
                  type="text"
                  name="Konu"
                  placeholder="Sponsorluk, SARGE EXPO, Genel Bilgi..."
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-white focus:border-zinc-400 focus:outline-none transition-colors text-xs sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1 sm:mb-2 text-xs sm:text-sm">Mesajınız *</label>
                <textarea
                  name="Mesaj"
                  rows={4}
                  required
                  placeholder="İletmek istediğiniz mesajınız..."
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-white focus:border-zinc-400 focus:outline-none transition-colors resize-y text-xs sm:text-sm"
                ></textarea>
              </div>
              
              <button
                type="submit"
                className="w-full py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl bg-[#102040] hover:bg-[#183060] text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-black/50 border border-[#234580] flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                <span>Mesajı Gönder</span>
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
