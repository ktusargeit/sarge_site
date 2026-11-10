import React, { useState, useEffect } from 'react';
import { NavTab } from '../types';
import { NEWS_DATA, PROJECTS_DATA } from '../data/mockData';
import { db } from '../lib/firebase';
import { getCachedDoc } from '../lib/firebaseCache';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Shield, ArrowRight, Award, ChevronRight, Cpu, Calendar, Users, Rocket, Plane, 
  Sparkles, CheckCircle2, Trophy, Image as ImageIcon
} from 'lucide-react';
import { BackgroundMedia, parseBackgroundMedia, isVideoMedia } from './BackgroundMedia';
import { formatImageUrl, handleImageFallback } from '../lib/mediaUtils';
export { parseBackgroundMedia };
export type { ParsedMedia } from './BackgroundMedia';

interface HeroProps {
  setActiveTab: (tab: NavTab) => void;
  onSelectProject?: (projectId: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ setActiveTab, onSelectProject }) => {
  const latestNews = NEWS_DATA[0];
    const [visionMission, setVisionMission] = useState({
    vision: 'Milli teknoloji hamlesi vizyonu doğrultusunda, savunma sanayii ve havacılık alanında dünyayla rekabet edebilecek yüksek teknolojili ve yenilikçi projeler üreten öncü bir Ar-Ge merkezi olmak.',
    mission: 'Mühendis adayı gençlerimizi teorik ve pratik eğitimlerle donatarak, takım ruhu ve disiplin içerisinde yerli projelere imza atan, nitelikli ve etik değerlere bağlı mühendisler olarak sektöre kazandırmak.'
  });
  const [projectsData, setProjectsData] = useState<any[]>(PROJECTS_DATA);
  const [spotlights, setSpotlights] = useState<any[]>([]);
  const [heroBannerBg, setHeroBannerBg] = useState<string>(() => {
    try {
      return localStorage.getItem('sarge_hero_banner_bg') || '';
    } catch {
      return '';
    }
  });
  const [heroBgError, setHeroBgError] = useState(false);
  const [statsData, setStatsData] = useState([
    { id: '1', value: '2', label: 'Büyük Ulusal & Uluslararası Başarı', icon: Trophy, color: 'text-amber-400' },
    { id: '3', value: '120+', label: 'Aktif Mühendis Adayı', icon: Users, color: 'text-zinc-200' },
    { id: '4', value: '800+', label: 'Saat Başarılı Test Uçuşu', icon: Plane, color: 'text-zinc-200' }
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let bannerLoaded = false;
        try {
          const bRes = await fetch('/api/content/site_banners');
          if (bRes.ok) {
            const bJson = await bRes.json();
            if (bJson && typeof bJson === 'object' && 'heroBannerBg' in bJson) {
              const val = bJson.heroBannerBg || '';
              setHeroBannerBg(val);
              try {
                if (val) localStorage.setItem('sarge_hero_banner_bg', val);
                else localStorage.removeItem('sarge_hero_banner_bg');
              } catch {}
              bannerLoaded = true;
            }
          }
        } catch {}

        if (!bannerLoaded) {
          const bSnap = await getCachedDoc('content', 'site_banners');
          if (bSnap.exists() && bSnap.data()) {
            const val = bSnap.data().heroBannerBg || '';
            setHeroBannerBg(val);
            try {
              if (val) localStorage.setItem('sarge_hero_banner_bg', val);
              else localStorage.removeItem('sarge_hero_banner_bg');
            } catch {}
            bannerLoaded = true;
          } else {
            const sSnap = await getCachedDoc('content', 'site_settings');
            if (sSnap.exists() && sSnap.data()) {
              const val = sSnap.data().heroBannerBg || '';
              setHeroBannerBg(val);
              try {
                if (val) localStorage.setItem('sarge_hero_banner_bg', val);
                else localStorage.removeItem('sarge_hero_banner_bg');
              } catch {}
            }
          }
        }
        const pSnap = await getCachedDoc('content', 'projects_data');
        if (pSnap.exists() && pSnap.data().data) {
          setProjectsData(pSnap.data().data);
        }
        const vmSnap = await getCachedDoc('content', 'homepage_vision_mission');
        if (vmSnap.exists() && vmSnap.data()) {
          setVisionMission(vmSnap.data() as any);
        }
        const sSnap = await getCachedDoc('content', 'spotlights');
        if (sSnap.exists() && sSnap.data().data && sSnap.data().data.length > 0) {
          setSpotlights(sSnap.data().data);
        } else {
          setSpotlights([
            { title: "Savaşan İHA", desc: "TEKNOFEST 2023 Savaşan İHA yarışmasında otonom it dalaşı ve hedef tespiti görevlerini başarıyla tamamlayarak finalist oldu.", year: "2023", rank: "Türkiye Finalisti" },
            { title: "Yüksek İrtifa Roket", desc: "3000 metre irtifa hedefine başarıyla ulaşan özgün tasarım roketimiz ile TEKNOFEST 2022'de finale kalma başarısı gösterildi.", year: "2022", rank: "Türkiye Finalisti" },
            { title: "TÜBİTAK 2242", desc: "Üniversite Öğrencileri Araştırma Proje Yarışmaları Savunma, Uzay ve Havacılık kategorisinde üstün başarı.", year: "2021", rank: "Bölge 1.si" }
          ]);
        }

        const stSnap = await getCachedDoc('content', 'homepage_stats');
        if (stSnap.exists() && stSnap.data().stats) {
          // Merge icons/colors back since we don't store react components in JSON
          const stData = stSnap.data().stats.filter((s: any) => s.id !== '2');
          const mergedStats = stData.map((s: any, i: number) => ({
            ...s,
            icon: statsData[i]?.icon || Trophy,
            color: statsData[i]?.color || 'text-white'
          }));
          setStatsData(mergedStats);
        }
      } catch (err) {
        console.warn(err);
        setSpotlights([
          { title: "Savaşan İHA", desc: "TEKNOFEST 2023 Savaşan İHA yarışmasında otonom it dalaşı ve hedef tespiti görevlerini başarıyla tamamlayarak finalist oldu.", year: "2023", rank: "Türkiye Finalisti" },
          { title: "Yüksek İrtifa Roket", desc: "3000 metre irtifa hedefine başarıyla ulaşan özgün tasarım roketimiz ile TEKNOFEST 2022'de finale kalma başarısı gösterildi.", year: "2022", rank: "Türkiye Finalisti" },
          { title: "TÜBİTAK 2242", desc: "Üniversite Öğrencileri Araştırma Proje Yarışmaları Savunma, Uzay ve Havacılık kategorisinde üstün başarı.", year: "2021", rank: "Bölge 1.si" }
        ]);
        setVisionMission({
          vision: 'Milli teknoloji hamlesi vizyonu doğrultusunda, savunma sanayii ve havacılık alanında dünyayla rekabet edebilecek yüksek teknolojili ve yenilikçi projeler üreten öncü bir Ar-Ge merkezi olmak.',
          mission: 'Mühendis adayı gençlerimizi teorik ve pratik eğitimlerle donatarak, takım ruhu ve disiplin içerisinde yerli projelere imza atan, nitelikli ve etik değerlere bağlı mühendisler olarak sektöre kazandırmak.'
        });
      }
    };
    fetchData();
  }, []);

  

  return (
    <div className="bg-[#09090b] text-[#E2E8F0] py-4 sm:py-8 lg:py-14 px-3 sm:px-6 lg:px-8 font-sans space-y-6 sm:space-y-16">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-16">

        {/* Hero Section - High Impact Aerospace Aesthetic */}
        <div className="relative bg-[#18181b] border border-[#27272a] rounded-xl sm:rounded-3xl p-4 sm:p-12 lg:p-20 overflow-hidden shadow-2xl flex flex-col items-center justify-center text-center min-h-[220px] sm:min-h-[480px]">
          {heroBannerBg && heroBannerBg.trim() !== '' && (
            <BackgroundMedia url={heroBannerBg} alt="KTÜ SARGE" />
          )}

          <div className="relative z-10 max-w-4xl space-y-3 sm:space-y-8 flex flex-col items-center w-full">
            
            {/* Main Headline */}
            <div className="space-y-2 sm:space-y-5 flex flex-col items-center w-full">
              <h1 className="flex flex-col items-center gap-1 sm:gap-3 w-full">
                <span className="text-2xl xs:text-3xl sm:text-6xl md:text-7xl lg:text-[100px] font-black tracking-tight sm:tracking-tighter text-white font-sans uppercase leading-tight sm:leading-none drop-shadow-2xl max-w-full break-words">
                  KTÜ SARGE
                </span>
                <span className="text-[10px] xs:text-xs sm:text-base lg:text-lg font-medium text-[#94A3B8] tracking-wider sm:tracking-[0.25em] uppercase max-w-full">
                  Geleceğin Savunma Teknolojileri
                </span>
              </h1>
              <p className="text-[11px] sm:text-sm lg:text-base text-[#94A3B8] leading-relaxed max-w-2xl font-normal sm:font-medium tracking-normal sm:tracking-wide px-1 sm:px-0">
                Karadeniz Teknik Üniversitesi bünyesinde; havacılık, savunma sanayii ve otonom sistemler alanında milli mühendislik vizyonuyla çalışan bağımsız Ar-Ge ve inovasyon merkezi.
              </p>
            </div>

            {/* Action Buttons - Compact on mobile, standard on desktop */}
            <div className="pt-1 sm:pt-3 flex flex-wrap gap-2 sm:gap-4 items-center justify-center">
              <button
                onClick={() => setActiveTab('teams')}
                className="px-4 sm:px-7 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 sm:gap-2 shadow-md shadow-blue-900/40 hover:shadow-blue-900/60 border border-blue-400/40 cursor-pointer active:scale-95"
              >
                <span>BİZE KATILIN</span>
              </button>

              <button
                onClick={() => setActiveTab('projects')}
                className="px-4 sm:px-7 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-[#0e1d38] hover:bg-[#162d55] text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 sm:gap-2 border border-[#234b82] hover:border-[#3b75c4] shadow-sm shadow-black/40 cursor-pointer active:scale-95 group"
              >
                <span>PROJELERİMİZİ İNCELEYİN</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-300 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

          </div>
        </div>

        {/* Vision & Mission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
          <div className="bg-[#18181b] p-3.5 sm:p-8 rounded-xl sm:rounded-2xl border border-[#27272a] hover:border-zinc-500/40 transition-colors">
            <h3 className="text-sm sm:text-lg font-bold text-white mb-1.5 sm:mb-3">
              Vizyonumuz
            </h3>
            <p className="text-[11px] sm:text-sm text-[#94A3B8] leading-relaxed">
              {visionMission.vision}
            </p>
          </div>
          <div className="bg-[#18181b] p-3.5 sm:p-8 rounded-xl sm:rounded-2xl border border-[#27272a] hover:border-zinc-500/40 transition-colors">
            <h3 className="text-sm sm:text-lg font-bold text-white mb-1.5 sm:mb-3">
              Misyonumuz
            </h3>
            <p className="text-[11px] sm:text-sm text-[#94A3B8] leading-relaxed">
              {visionMission.mission}
            </p>
          </div>
        </div>

        {/* Wall of Fame - Başarılarımız */}
        <div className="space-y-3 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-3 pb-2 sm:pb-3 border-b border-[#27272a]">
            <div>
              <h2 className="text-base sm:text-2xl font-extrabold text-white">
                Dereceler & Finalistlik
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
            {spotlights.map((ach, i) => (
              <div
                key={i}
                className="bg-[#18181b] p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border border-[#27272a] space-y-2 sm:space-y-4 hover:border-amber-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] sm:text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 sm:py-1 rounded-full border border-amber-500/20">
                      {ach.year}
                    </span>
                    <span className="text-[10px] sm:text-xs font-medium text-[#94A3B8]">
                      {ach.rank}
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-lg font-bold text-white">
                    {ach.title}
                  </h3>
                  <p className="text-[11px] sm:text-sm text-[#94A3B8] leading-relaxed">
                    {ach.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Projects Grid */}
        <div className="space-y-3 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-3 pb-2 sm:pb-3 border-b border-[#27272a]">
            <div>
              <h2 className="text-base sm:text-2xl font-extrabold text-white">
                Öne Çıkan Projelerimiz
              </h2>
              <p className="text-[10px] sm:text-sm text-[#94A3B8] mt-0.5 sm:mt-1">
                Kulübümüz bünyesinde geliştirilen savunma, havacılık ve yapay zeka projeleri.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('projects')}
              className="text-[10px] sm:text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1 group font-sans cursor-pointer self-end sm:self-auto"
            >
              <span>TÜM PROJELERİ GÖR</span>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {(() => {
              const featured = projectsData.filter((p) => p.isFeatured);
              const listToDisplay = featured.length > 0 ? featured : projectsData;
              return listToDisplay.slice(0, 3).map((proj) => {
                const projectImg =
                  proj.image ||
                  proj.imageUrl ||
                  proj.coverImage ||
                  (Array.isArray(proj.gallery) && proj.gallery.length > 0
                    ? typeof proj.gallery[0] === 'string'
                      ? proj.gallery[0]
                      : proj.gallery[0]?.url
                    : '') ||
                  '';

                return (
                  <div
                    key={proj.id}
                    onClick={() => {
                      if (onSelectProject) {
                        onSelectProject(proj.id);
                      } else {
                        setActiveTab('projects');
                      }
                    }}
                    className="bg-[#18181b] border border-[#27272a] rounded-xl sm:rounded-2xl overflow-hidden hover:border-[#234580] transition-all flex flex-col justify-between group cursor-pointer shadow-md hover:shadow-black/50"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-black/60 relative">
                      {projectImg && projectImg.trim() !== '' ? (
                        <img
                          src={formatImageUrl(projectImg)}
                          alt={proj.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageFallback(e, projectImg)}
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0e1d38] via-[#091326] to-[#14264d]">
                          <Rocket className="w-6 h-6 sm:w-10 sm:h-10 text-blue-400/40" />
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between space-y-2.5 sm:space-y-4">
                      <div className="space-y-1 sm:space-y-2">
                        <h3 className="text-xs sm:text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                          {proj.name}
                        </h3>
                        <p className="text-[10px] sm:text-sm text-[#94A3B8] line-clamp-2 leading-relaxed">
                          {proj.shortDesc || proj.fullDesc}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-[#27272a]/80 flex items-center justify-between text-[10px] sm:text-xs font-bold text-slate-300 group-hover:text-white">
                        <span>Detayları İncele</span>
                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

      </div>
    </div>
  );
};

