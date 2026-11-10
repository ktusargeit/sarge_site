import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { getCachedDoc } from '../lib/firebaseCache';
import { doc, getDoc } from 'firebase/firestore';
import { Target, Compass, Award, CheckCircle2, ChevronRight, Layers } from 'lucide-react';

export const AboutSection: React.FC = () => {
  const [aboutTeams, setAboutTeams] = useState<any[]>([]);

  useEffect(() => {
    const fetchAboutTeams = async () => {
      try {
        const snap = await getCachedDoc('content', 'about_teams');
        const raw = snap.exists() ? snap.data() : null;
        const list = raw ? (raw.data || raw.teams) : null;
        if (Array.isArray(list) && list.length > 0) {
          setAboutTeams(list);
        } else {
          setAboutTeams([
            { title: 'ALACA Savaşan İHA Takımı', desc: 'TEKNOFEST Savaşan İHA Yarışması için otonom it dalaşı kabiliyetine sahip Göktuğ projesini geliştiren ekip.' },
            { title: 'Gökçen Roket Takımı', desc: 'Orta irtifa kategorisinde, kendi paraşütünü ve faydalı yükünü taşıyan roket sistemleri tasarlayan ekip.' },
            { title: 'Jet Motoru Takımı', desc: 'Mini jet motoru tasarımı, üretimi ve termodinamik testlerini gerçekleştiren öncü mühendislik ekibi.' },
            { title: 'Elektronik Harp Takımı', desc: 'Hava platformları için elektronik taarruz ve savunma sistemleri, RF karıştırma ve sinyal istihbaratı projeleri geliştiren özel birim.' }
          ]);
        }
      } catch (err) {
        console.warn("Error fetching about teams", err);
      }
    };
    fetchAboutTeams();
  }, []);

  return (
    <div className="py-6 sm:py-16 bg-[#09090b] text-[#E2E8F0] font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-8 sm:space-y-16">
        {/* Section 1: Purpose, Mission & Vision */}
        <div>
          <div className="text-center max-w-3xl mx-auto space-y-1.5 sm:space-y-3 mb-6 sm:mb-12">
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[#F8FAFC] tracking-tight font-display">
              Milli Teknoloji Hamlesinin Karadeniz’deki Öncü Gücü
            </h2>
            <p className="text-[11px] sm:text-sm text-[#94A3B8] leading-relaxed px-1 sm:px-0">
              Karadeniz Teknik Üniversitesi bünyesinde kurulan Savunma ve Ar-Ge Topluluğu (SARGE), teori ile pratiği birleştirerek havacılık, savunma sanayii ve otonom sistemleri tasarlar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-6">
            
            {/* Card 1: Amacımız */}
            <div className="bg-[#18181b] p-4 sm:p-8 rounded-xl sm:rounded-2xl border border-[#27272a] space-y-2.5 sm:space-y-4 relative group">
              <h3 className="text-base sm:text-lg font-bold text-white font-display">Amacımız</h3>
              <p className="text-[11px] sm:text-sm text-[#94A3B8] leading-relaxed">
                Üniversitemiz bünyesindeki mühendislik ve fen bilimleri öğrencilerine savunma sanayii ve ileri teknoloji standartlarında atölye imkânı sağlamak, Ar-Ge kültürünü aşılamak ve projelerini hayata geçirmelerine olanak tanımaktır.
              </p>
              <ul className="space-y-1.5 sm:space-y-2 pt-2 border-t border-[#27272a] text-[11px] sm:text-xs text-[#CBD5E1]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-300 shrink-0" />
                  <span>Teorik bilginin pratik üretime dönüşmesi</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>Teknofest ve uluslararası yarışmalara katılım</span>
                </li>
              </ul>
            </div>

            {/* Card 2: Misyonumuz */}
            <div className="bg-[#18181b] p-6 sm:p-8 rounded-2xl border border-[#27272a] space-y-4 relative group">
              <h3 className="text-lg font-bold text-white font-display">Misyonumuz</h3>
              <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                Yerli ve milli üretim bilincini benimsemiş, etik değerlere bağlı, analitik düşünebilen ve inovatif çözümler üretebilen nitelikli mühendisler ve liderler yetiştirmektir.
              </p>
              <ul className="space-y-2 pt-2 border-t border-[#27272a] text-xs text-[#CBD5E1]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>Yüksek mühendislik etiği ve liderlik yeteneği</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>Bağımsız Ar-Ge ve yerlileştirme kültürü</span>
                </li>
              </ul>
            </div>

            {/* Card 3: Vizyonumuz */}
            <div className="bg-[#18181b] p-6 sm:p-8 rounded-2xl border border-[#27272a] space-y-4 relative group">
              <h3 className="text-lg font-bold text-white font-display">Vizyonumuz</h3>
              <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                Karadeniz Teknik Üniversitesi'ni öğrenci tabanlı havacılık, roketçilik ve otonom sistemler araştırmalarında Türkiye’nin ve bölgenin en saygın teknoloji merkezi konumuna getirmektir.
              </p>
              <ul className="space-y-2 pt-2 border-t border-[#27272a] text-xs text-[#CBD5E1]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>SARGE EXPO ile sanayi-üniversite buluşması</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>Patentli öğrenci buluşları ve spin-off girişimler</span>
                </li>
              </ul>
            </div>

          </div>
        </div>

        
</div>
    </div>
  );
};
