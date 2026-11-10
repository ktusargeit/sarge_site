import React, { useState, useEffect } from 'react';
import { NavTab } from '../types';
import { SargeLogo } from './Logos';
import { Shield, Rocket, MapPin, Mail, Phone, ExternalLink, Heart } from 'lucide-react';
import { db } from '../lib/firebase';
import { getCachedDoc } from '../lib/firebaseCache';
import { doc, getDoc } from 'firebase/firestore';

interface FooterProps {
  setActiveTab: (tab: NavTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveTab }) => {
  
  const [settings, setSettings] = useState({
    email: 'sarge@ktu.edu.tr',
    phone: '+90 462 377 3000',
    address: 'KTÜ Kanuni Kampüsü, Mühendislik Fak. B Blok, SARGE Atölyesi, Ortahisar / Trabzon',
    linkedin: 'https://linkedin.com/company/ktusarge',
    instagram: 'https://instagram.com/ktusarge'
  });
  const [footerSections, setFooterSections] = useState<any[]>([]);


  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getCachedDoc('content', 'site_settings');
        if (snap.exists() && snap.data()) {
          setSettings(prev => ({ ...prev, ...snap.data() }));
        }

        const footSnap = await getCachedDoc('content', 'footer_sections');
        const footRaw = footSnap.exists() ? footSnap.data() : null;
        const footList = footRaw ? (footRaw.data || footRaw.sections) : null;
        if (Array.isArray(footList) && footList.length > 0) {
          setFooterSections(footList);
        } else {
          setFooterSections([
            { title: 'Takımlarımız:', links: ['ALACA Savaşan İHA Takımı', 'Gökçen Roket Takımı', 'Jet Motoru Takımı', 'Elektronik Harp Takımı', 'Gökçen Su Altı Roket Takımı'] }
          ]);
        }
      } catch (err) {
        console.warn("Footer settings fetch error:", err);
        setFooterSections([
          { title: 'Takımlarımız:', links: ['ALACA Savaşan İHA Takımı', 'Gökçen Roket Takımı', 'Jet Motoru Takımı', 'Elektronik Harp Takımı', 'Gökçen Su Altı Roket Takımı'] }
        ]);
      }
    };
    fetchSettings();
  }, []);

  return (
    <footer className="bg-[#09090b] border-t border-[#27272a] text-[#94A3B8] text-sm font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-12 pb-8 sm:pb-12 border-b border-[#27272a]">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            <SargeLogo size={36} showText={true} />

            <p className="text-[11px] sm:text-xs leading-relaxed text-[#94A3B8] pr-0 sm:pr-4">
              Karadeniz Teknik Üniversitesi bünyesinde kurulan Savunma ve Ar-Ge Topluluğu (SARGE); yerli ve milli teknoloji hamlesi doğrultusunda insansız hava araçları, roket sistemleri, jet motorları ve elektronik harp projeleri geliştiren, milli mühendislik vizyonuyla çalışan bağımsız bir Ar-Ge ve inovasyon merkezidir.
            </p>

            {/* Social Media Links with Icons */}
            <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-3">
              <a
                href={/^https?:\/\//i.test((settings.instagram || '').trim()) ? settings.instagram.trim() : 'https://instagram.com/ktusarge'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] hover:border-pink-500/50 text-[#94A3B8] hover:text-white transition-all text-xs sm:text-sm font-sans font-medium group"
              >
                <svg
                  className="w-4 h-4 text-pink-500 group-hover:scale-110 transition-transform shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
                <span>Instagram</span>
              </a>
              <a
                href={/^https?:\/\//i.test((settings.linkedin || '').trim()) ? settings.linkedin.trim() : 'https://linkedin.com/company/ktusarge'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] hover:border-blue-500/50 text-[#94A3B8] hover:text-white transition-all text-xs sm:text-sm font-sans font-medium group"
              >
                <svg
                  className="w-4 h-4 text-[#0A66C2] group-hover:scale-110 transition-transform shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                </svg>
                <span>LinkedIn</span>
              </a>
            </div>

            {/* App Download & Web App Section */}
            <div className="pt-2 space-y-2">
              <p className="text-[11px] sm:text-xs font-semibold text-zinc-300">
                Uygulamamızı İndirin &amp; Kullanın:
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {/* Google Play Store Badge Button */}
                <a
                  href="https://play.google.com/store/apps/details?id=com.sargektu.sarge&hl=tr"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="KTÜ SARGE Mobil Uygulamasını Google Play'den İndirin"
                  className="group inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-b from-[#18181b] to-[#09090b] border border-zinc-700/80 hover:border-zinc-400/90 shadow-lg shadow-black/60 hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                >
                  <svg
                    className="w-6 h-6 shrink-0 transition-transform duration-300 group-hover:scale-110"
                    viewBox="0 0 512 512"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M48 59.49v393a14.07 14.07 0 0 0 21.59 11.89L301 256 69.59 47.6A14.07 14.07 0 0 0 48 59.49Z"
                      fill="#00D2FF"
                    />
                    <path
                      d="M369.5 187.5 101.21 31.35A24 24 0 0 0 69.59 47.6L301 256l68.5-68.5Z"
                      fill="#00F076"
                    />
                    <path
                      d="M301 256 69.59 464.4a24 24 0 0 0 31.62 16.25L369.5 324.5 301 256Z"
                      fill="#FF3A44"
                    />
                    <path
                      d="M451.72 235.22 369.5 187.5 301 256l68.5 68.5 82.22-47.72a24 24 0 0 0 0-41.56Z"
                      fill="#FFC900"
                    />
                  </svg>
                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-400 group-hover:text-zinc-300 font-semibold">
                      GOOGLE PLAY&apos;DEN
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                      Uygulamamızı İndirin
                    </span>
                  </div>
                </a>

                {/* iPhone / Web App Badge Button */}
                <a
                  href="https://ktu-sarge-web.netlify.app/#/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="iPhone Kullanıcıları İçin KTÜ SARGE Web Uygulamamız"
                  className="group inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-b from-[#18181b] to-[#09090b] border border-zinc-700/80 hover:border-zinc-400/90 shadow-lg shadow-black/60 hover:shadow-zinc-500/10 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                >
                  <svg
                    className="w-6 h-6 text-white shrink-0 transition-transform duration-300 group-hover:scale-110"
                    viewBox="0 0 384 512"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                  </svg>
                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-400 group-hover:text-zinc-300 font-semibold">
                      iPHONE KULLANICILARI İÇİN
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                      Uygulamamız (Web)
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Special Teams & Units */}
          <div className="space-y-2.5 sm:space-y-3">
            <h4 className="text-[11px] sm:text-xs font-bold text-blue-400 uppercase tracking-wider font-sans">
              Takımlar & Birimler
            </h4>
            <div className="space-y-2.5 sm:space-y-3 text-[11px] sm:text-xs">
              {footerSections.map((sec, i) => (
                <div key={i}>
                  <span className="text-zinc-200 font-bold block mb-1">{sec.title}</span>
                  <ul className="space-y-1 text-[#CBD5E1]">
                    {sec.links?.map((link: string, j: number) => (
                      <li key={j}>
                        <a href="#teams" onClick={(e) => {
                          e.preventDefault();
                          setActiveTab('teams');
                          window.scrollTo(0, 0);
                        }} className="hover:text-white transition-colors inline-block cursor-pointer">
                          • {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="pt-1 sm:pt-2">
                <button
                  onClick={() => { setActiveTab('teams'); window.scrollTo(0, 0); }}
                  className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <span>→ Bize Katılın (Açık Başvurular)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2.5 sm:space-y-3">
            <h4 className="text-[11px] sm:text-xs font-bold text-blue-400 uppercase tracking-wider font-sans">
              İletişim & Atölye
            </h4>
            <ul className="space-y-2 sm:space-y-2.5 text-[11px] sm:text-xs">
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 shrink-0 mt-0.5" />
                <a href={"https://maps.google.com/?q=" + encodeURIComponent(settings.address || "Karadeniz Teknik Üniversitesi, Trabzon")} target="_blank" rel="noopener noreferrer" className="whitespace-pre-wrap hover:text-white transition-colors">
                  {settings.address}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${(settings.email || 'sarge@ktu.edu.tr').trim()}?subject=${encodeURIComponent('KTÜ SARGE İletişim')}`}
                  title="E-posta göndermek için tıklayın"
                  className="inline-flex items-center gap-2 hover:text-white transition-colors cursor-pointer group"
                >
                  <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 group-hover:text-blue-400 transition-colors shrink-0" />
                  <span className="underline-offset-4 group-hover:underline">{settings.email || 'sarge@ktu.edu.tr'}</span>
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 shrink-0" />
                <a href={`tel:${settings.phone.replace(/[^0-9+]/g, '')}`} className="hover:text-white transition-colors">{settings.phone}</a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 text-[10px] sm:text-xs text-[#94A3B8] text-center sm:text-left">
          <p>
            © {new Date().getFullYear()} KTÜ Savunma ve Ar-Ge Topluluğu (SARGE). Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-4">
            <span>Karadeniz Teknik Üniversitesi Resmi Öğrenci Topluluğudur</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
