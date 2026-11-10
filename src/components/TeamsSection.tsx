import React, { useState, useEffect } from 'react';
import { getCachedDoc } from '../lib/firebaseCache';
import { 
  X, 
  ExternalLink, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TeamItem, SocialUnitInfo, ExpoUnitInfo } from '../types';

const DEFAULT_TEAMS: TeamItem[] = [
  { 
    id: '1', 
    title: 'İHA Takımı', 
    desc: 'Otonom insansız hava araçları tasarımı, gövde aerodinamiği, aviyonik sistemler ve yapay zeka destekli görev icrası.', 
    activeProject: 'ALACA İHA', 
    isOpen: true, 
    applicationUrl: 'https://forms.google.com',
    story: '2019 yılında kurulan İHA Takımımız, TEKNOFEST Savaşan İHA ve Sabit Kanat kategorilerinde KTÜ’yü başarıyla temsil etmiştir. Tamamen yerli kompozit gövde üretimi ve otonom takip algoritmaları geliştirmektedir.'
  },
  { 
    id: '2', 
    title: 'Roket Takımı', 
    desc: 'Katı yakıtlı yüksek irtifa roket sistemleri, aviyonik uçuş bilgisayarları ve kademeli paraşüt kurtarma mekanizmaları.', 
    activeProject: 'GÖKÇEN Roket', 
    isOpen: true, 
    applicationUrl: 'https://forms.google.com',
    story: 'Aksaray Roket Atış Alanı’nda gerçekleştirdiği başarılı 3.000m ve 5.000m irtifa atışlarıyla SARGE bünyesindeki en köklü ekiplerden biridir.'
  },
  { 
    id: '3', 
    title: 'Jet Motoru Takımı', 
    desc: 'Mikro jet motoru çekirdek tasarımı, yanma odası simülasyonları ve yüksek devirli turbo bileşenlerin imalatı.', 
    activeProject: 'J-01 Turbojet', 
    isOpen: false, 
    story: 'Milli jet motoru teknolojileri alanında akademik danışmanlarımız ve atölye imkanlarımızla KTÜ’nün ilk prototip mikro turbojet motorunu üretmekteyiz.'
  },
  { 
    id: '4', 
    title: 'Elektronik Harp & Otonom Sistemler', 
    desc: 'Anti-drone savunma sistemleri, RF sinyal karıştırma, yapay görme ve sürü algoritması geliştirme.', 
    activeProject: 'EH-Kalkanı', 
    isOpen: true, 
    applicationUrl: 'https://forms.google.com',
    story: 'Modern muharebe sahasının en kritik alanı olan siber ve elektronik harp sahasında milli yazılım ve donanım çözümleri üretmektedir.'
  },
];

const DEFAULT_SOCIAL_UNIT: SocialUnitInfo = {
  desc: 'Sosyal birim; topluluğumuzun sponsorluk & finans, sosyal medya & tanıtım, etkinlik & organizasyon, medya prodüksiyon ve insan kaynakları süreçlerini yürüten idari ve yaratıcı ekibidir. Projelerimizin finansal olarak desteklenmesi, sanayi kuruluşlarıyla kurumsal anlaşmaların yürütülmesi, konferans ve fuar gibi büyük organizasyonların yönetilmesi ve SARGE markasının geniş kitlelere ulaştırılması bu ekip sayesinde gerçekleştirilir.',
  isOpen: true,
  applicationUrl: 'https://forms.google.com'
};

const DEFAULT_EXPO_UNIT: ExpoUnitInfo = {
  desc: "Karadeniz Teknik Üniversitesi bünyesinde organize edilen, bölgenin ve üniversitemizin en kapsamlı savunma sanayii ve teknoloji fuarı SARGE EXPO; savunma sanayiimizin lider firmalarını, mühendislik takımlarını ve binlerce ziyaretçiyi bir araya getiriyor. Fuar organizasyon komitesinde görev almak veya firma/bireysel katılımcı olmak için detayları inceleyebilir ve başvuruda bulunabilirsiniz.",
  isOpen: true,
  applicationUrl: 'https://forms.google.com'
};

const renderDefaultTeamWatermark = (title: string) => {
  const t = (title || '').toLowerCase();
  if (t.includes('iha') || t.includes('uav') || t.includes('hava')) {
    return (
      <svg viewBox="0 0 200 200" className="w-full h-full text-zinc-500/30 stroke-current fill-none" strokeWidth="2.2">
        <path d="M100 25 L115 70 L190 120 L150 130 L115 110 L100 175 L85 110 L50 130 L10 120 L85 70 Z" strokeLinejoin="round" />
        <path d="M100 70 L100 155 M85 95 L115 95" strokeWidth="1.5" />
      </svg>
    );
  }
  if (t.includes('roket') || t.includes('rocket')) {
    return (
      <svg viewBox="0 0 200 200" className="w-full h-full text-zinc-500/30 stroke-current fill-none" strokeWidth="2.2">
        <path d="M100 20 C115 45 125 80 125 125 L75 125 C75 80 85 45 100 20 Z" strokeLinejoin="round" />
        <path d="M75 110 L50 145 L75 140 Z M125 110 L150 145 L125 140 Z" strokeLinejoin="round" />
        <circle cx="100" cy="70" r="12" strokeWidth="2" />
        <path d="M90 140 L100 175 L110 140" strokeLinejoin="round" />
      </svg>
    );
  }
  if (t.includes('jet') || t.includes('motor')) {
    return (
      <svg viewBox="0 0 200 200" className="w-full h-full text-zinc-500/30 stroke-current fill-none" strokeWidth="2.2">
        <circle cx="100" cy="100" r="75" strokeWidth="2" />
        <circle cx="100" cy="100" r="22" strokeWidth="2.2" />
        <path d="M100 25 Q125 60 100 78 M100 175 Q75 140 100 122 M25 100 Q60 75 78 100 M175 100 Q140 125 122 100" strokeWidth="2" />
        <path d="M47 47 Q80 70 85 85 M153 153 Q120 130 115 115 M47 153 Q70 120 85 115 M153 47 Q130 80 115 85" strokeWidth="2" />
      </svg>
    );
  }
  // Electronic warfare / radar / default
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full text-zinc-500/30 stroke-current fill-none" strokeWidth="2.2">
      <path d="M100 25 L160 50 L160 110 C160 150 100 180 100 180 C100 180 40 150 40 110 L40 50 Z" strokeLinejoin="round" />
      <path d="M70 95 C70 95 85 80 100 80 C115 80 130 95 130 95" strokeWidth="2" strokeLinecap="round" />
      <path d="M80 110 C80 110 90 100 100 100 C110 100 120 110 120 110" strokeWidth="2" strokeLinecap="round" />
      <circle cx="100" cy="125" r="5" fill="currentColor" />
    </svg>
  );
};

import { BackgroundMedia, parseBackgroundMedia, isVideoMedia } from './BackgroundMedia';

interface TeamsSectionProps {
  onNavigateToExpo?: () => void;
}

export const TeamsSection: React.FC<TeamsSectionProps> = ({ onNavigateToExpo }) => {
  const [teams, setTeams] = useState<TeamItem[]>(DEFAULT_TEAMS);
  const [socialUnit, setSocialUnit] = useState<SocialUnitInfo>(DEFAULT_SOCIAL_UNIT);
  const [expoUnit, setExpoUnit] = useState<ExpoUnitInfo>(DEFAULT_EXPO_UNIT);
  const [selectedTeam, setSelectedTeam] = useState<TeamItem | null>(null);
  const [teamsBannerBg, setTeamsBannerBg] = useState<string>(() => {
    try {
      return localStorage.getItem('sarge_teams_banner_bg') || '';
    } catch {
      return '';
    }
  });
  const [teamsBgError, setTeamsBgError] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        let loadedTeams: TeamItem[] | null = null;
        let loadedSocial: SocialUnitInfo | null = null;
        let loadedExpo: ExpoUnitInfo | null = null;

        let bannerLoaded = false;
        try {
          const bRes = await fetch('/api/content/site_banners');
          if (bRes.ok) {
            const bJson = await bRes.json();
            if (bJson && typeof bJson === 'object' && 'teamsBannerBg' in bJson) {
              const val = bJson.teamsBannerBg || '';
              setTeamsBannerBg(val);
              try {
                if (val) localStorage.setItem('sarge_teams_banner_bg', val);
                else localStorage.removeItem('sarge_teams_banner_bg');
              } catch {}
              bannerLoaded = true;
            }
          }
        } catch {}

        if (!bannerLoaded) {
          try {
            const bSnap = await getCachedDoc('content', 'site_banners');
            if (bSnap.exists() && bSnap.data()) {
              const val = bSnap.data().teamsBannerBg || '';
              setTeamsBannerBg(val);
              try {
                if (val) localStorage.setItem('sarge_teams_banner_bg', val);
                else localStorage.removeItem('sarge_teams_banner_bg');
              } catch {}
              bannerLoaded = true;
            } else {
              const sSnap = await getCachedDoc('content', 'site_settings');
              if (sSnap.exists() && sSnap.data()) {
                const val = sSnap.data().teamsBannerBg || '';
                setTeamsBannerBg(val);
                try {
                  if (val) localStorage.setItem('sarge_teams_banner_bg', val);
                  else localStorage.removeItem('sarge_teams_banner_bg');
                } catch {}
              }
            }
          } catch {}
        }

        try {
          const res = await fetch('/api/content/about_teams');
          if (res.ok) {
            const json = await res.json();
            const list = json.data || json.teams;
            if (Array.isArray(list) && list.length > 0) {
              loadedTeams = list;
            }
            if (json.socialUnit && typeof json.socialUnit === 'object') {
              loadedSocial = json.socialUnit;
            }
            if (json.expoUnit && typeof json.expoUnit === 'object') {
              loadedExpo = json.expoUnit;
            }
            if (!bannerLoaded && json.teamsBannerBg !== undefined) {
              const val = json.teamsBannerBg || '';
              setTeamsBannerBg(val);
              try {
                if (val) localStorage.setItem('sarge_teams_banner_bg', val);
                else localStorage.removeItem('sarge_teams_banner_bg');
              } catch {}
            }
          }
        } catch {}

        if (!loadedTeams || !loadedSocial || !loadedExpo) {
          const snap = await getCachedDoc('content', 'about_teams');
          if (snap.exists()) {
            const raw = snap.data();
            const list = raw.data || raw.teams;
            if (Array.isArray(list) && list.length > 0 && !loadedTeams) {
              loadedTeams = list;
            }
            if (raw.socialUnit && typeof raw.socialUnit === 'object' && !loadedSocial) {
              loadedSocial = raw.socialUnit;
            }
            if (raw.expoUnit && typeof raw.expoUnit === 'object' && !loadedExpo) {
              loadedExpo = raw.expoUnit;
            }
            if (raw.teamsBannerBg && !teamsBannerBg) {
              const val = raw.teamsBannerBg || '';
              setTeamsBannerBg(val);
              try {
                if (val) localStorage.setItem('sarge_teams_banner_bg', val);
                else localStorage.removeItem('sarge_teams_banner_bg');
              } catch {}
            }
          }
        }

        if (loadedTeams && loadedTeams.length > 0) {
          setTeams(loadedTeams);
        }
        if (loadedSocial) {
          setSocialUnit(loadedSocial);
        }
        if (loadedExpo) {
          setExpoUnit(loadedExpo);
        }
      } catch (err) {
        console.warn('TeamsSection data load error:', err);
      }
    };
    fetchContent();
  }, []);

  const handleApplyClick = (e: React.MouseEvent, url?: string, title?: string) => {
    e.stopPropagation();
    if (!url) {
      alert(`"${title || 'Bu birim'}" için başvuru linki henüz tanımlanmamış. Lütfen topluluk yönetimiyle iletişime geçiniz.`);
      return;
    }
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="teams" className="py-6 sm:py-16 bg-[#09090b] text-[#E2E8F0] font-sans min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-8 sm:space-y-16">
        
        {/* Top Banner: SARGE Ailesine Katılın */}
        <div className="relative rounded-xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-[#0e1e3d] via-[#091326] to-[#14264d] border border-[#234580]/70 p-5 sm:p-12 md:p-16 text-center shadow-2xl shadow-black/60 min-h-[220px] sm:min-h-[340px] flex flex-col items-center justify-center">
          {teamsBannerBg && teamsBannerBg.trim() !== '' && (
            <BackgroundMedia url={teamsBannerBg} alt="SARGE Ailesine Katılın" />
          )}

          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-2 sm:space-y-4">
            <h1 className="text-xl xs:text-2xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg">
              SARGE Ailesine Katılın!
            </h1>

            <p className="text-[11px] sm:text-base lg:text-lg text-slate-200 leading-relaxed font-normal drop-shadow">
              Karadeniz Teknik Üniversitesi bünyesinde geleceğin savunma teknolojilerini, insansız sistemlerini ve büyük organizasyonlarını birlikte inşa ediyoruz. Mühendislik takımlarımızda veya sosyal birimimizde yerinizi alarak bu büyük ailenin bir parçası olun.
            </p>
          </div>
        </div>

        {/* BÖLÜM 1: TAKIMLARIMIZ */}
        <div className="space-y-3 sm:space-y-8">
          <div className="border-b border-[#27272a] pb-2 sm:pb-4">
            <h2 className="text-base sm:text-3xl font-extrabold text-white tracking-tight">
              Takımlarımız
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
            {teams.map((team, index) => {
              const isOpen = team.isOpen !== false;
              return (
                <div 
                  key={team.id || index}
                  onClick={() => setSelectedTeam(team)}
                  className="group relative bg-[#18181b] p-3.5 sm:p-8 rounded-xl sm:rounded-2xl border border-[#27272a] hover:border-zinc-500/40 transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer hover:shadow-xl hover:shadow-black/50 min-h-[140px] sm:min-h-[220px]"
                >
                  {/* Team background logo watermark */}
                  <div className="absolute -right-4 sm:-right-6 top-1/2 -translate-y-1/2 w-28 sm:w-60 h-28 sm:h-60 opacity-15 sm:opacity-20 group-hover:opacity-30 pointer-events-none transition-all duration-300 flex items-center justify-center">
                    {team.imageUrl ? (
                      <img src={team.imageUrl} alt={team.title} className="w-full h-full object-contain filter drop-shadow-xl" />
                    ) : (
                      renderDefaultTeamWatermark(team.title)
                    )}
                  </div>

                  <div className="relative z-10 space-y-1.5 sm:space-y-4">
                    {/* Clean Team Title */}
                    <div>
                      <h3 className="text-sm sm:text-2xl font-bold text-white group-hover:text-zinc-200 transition-colors">
                        {team.title}
                      </h3>
                    </div>

                    {/* Description: What the team does */}
                    <p className="text-[11px] sm:text-sm text-slate-300 leading-relaxed font-normal max-w-lg">
                      {team.desc}
                    </p>

                    {/* Story Preview button */}
                    {team.story && (
                      <div className="pt-0.5 sm:pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTeam(team);
                          }}
                          className="text-[10px] sm:text-xs text-slate-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>Takım Hikayesini & Geçmişini Oku</span>
                          <ArrowRight className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-slate-400" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Application Button */}
                  <div className="relative z-10 pt-2.5 sm:pt-4 mt-2 sm:mt-6 border-t border-[#27272a] flex items-center justify-end">
                    {isOpen ? (
                      <button
                        onClick={(e) => handleApplyClick(e, team.applicationUrl, team.title)}
                        className="px-3.5 sm:px-5 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-[#102040] hover:bg-[#183060] text-white font-bold text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-black/40 border border-[#234580] transition-all cursor-pointer active:scale-95"
                      >
                        <span>Başvur</span>
                        <ExternalLink className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-3.5 sm:px-5 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-[#27272a] text-zinc-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider cursor-not-allowed"
                      >
                        Dönem Kapalı
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BÖLÜM 2: SOSYAL BİRİMLER */}
        <div className="space-y-3 sm:space-y-6 pt-1 sm:pt-4">
          <div className="border-b border-[#27272a] pb-2 sm:pb-4">
            <h2 className="text-base sm:text-3xl font-extrabold text-white tracking-tight">
              Sosyal Birimler
            </h2>
          </div>

          {/* Clean Card for Social Unit */}
          <div className="bg-[#18181b] p-3.5 sm:p-8 rounded-xl sm:rounded-2xl border border-[#27272a] space-y-3 sm:space-y-6">
            <p className="text-[11px] sm:text-base text-slate-300 leading-relaxed font-normal">
              {socialUnit.desc}
            </p>

            {/* Bottom Row: Application Button */}
            <div className="pt-3 sm:pt-6 border-t border-[#27272a] flex justify-end">
              {socialUnit.isOpen !== false ? (
                <button
                  onClick={(e) => handleApplyClick(e, socialUnit.applicationUrl, 'Sosyal Birimler')}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#102040] hover:bg-[#183060] text-white font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-black/40 border border-[#234580] transition-all cursor-pointer active:scale-95"
                >
                  <span>Başvur</span>
                  <ExternalLink className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                </button>
              ) : (
                <button
                  disabled
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#27272a] text-zinc-500 text-[11px] sm:text-xs font-semibold uppercase tracking-wider cursor-not-allowed"
                >
                  Dönem Kapalı
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BÖLÜM 3: SARGE EXPO */}
        <div className="space-y-3 sm:space-y-6 pt-1 sm:pt-4">
          <div className="border-b border-[#27272a] pb-2 sm:pb-4">
            <h2 className="text-base sm:text-3xl font-extrabold text-white tracking-tight">
              SARGE EXPO
            </h2>
          </div>

          {/* Clean Card for SARGE EXPO */}
          <div className="relative bg-[#18181b] p-3.5 sm:p-8 rounded-xl sm:rounded-2xl border border-[#27272a] space-y-3 sm:space-y-6 overflow-hidden group">
            <p className="text-[11px] sm:text-base text-slate-300 leading-relaxed font-normal relative z-10">
              {expoUnit.desc}
            </p>

            {/* Bottom Row: Başvuru Yap Butonu -> Navigates to SARGE EXPO tab */}
            <div className="pt-3 sm:pt-6 border-t border-[#27272a] flex justify-end relative z-10">
              <button
                onClick={() => {
                  if (onNavigateToExpo) {
                    onNavigateToExpo();
                  } else {
                    window.location.hash = '#expo';
                  }
                  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#102040] hover:bg-[#183060] text-white font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-black/40 border border-[#234580] transition-all cursor-pointer active:scale-95"
              >
                <span>Başvuru Yap</span>
                <ArrowRight className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Team Story & Detail Modal */}
      <AnimatePresence>
        {selectedTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTeam(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#18181b] border border-[#27272a] rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col z-10"
            >
              <button 
                onClick={() => setSelectedTeam(null)}
                className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#27272a] text-[#CBD5E1] hover:text-white hover:bg-[#3f3f46] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <div className="flex items-center gap-3 sm:gap-4 border-b border-[#27272a] pb-4 sm:pb-6 pr-8 sm:pr-10">
                {selectedTeam.imageUrl && (
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[#121215] border border-[#27272a] p-1.5 sm:p-2 flex items-center justify-center shrink-0">
                    <img src={selectedTeam.imageUrl} alt={selectedTeam.title} className="w-full h-full object-contain" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg sm:text-2xl font-bold text-white">{selectedTeam.title}</h3>
                </div>
              </div>

              <div className="overflow-y-auto py-4 sm:py-6 space-y-4 sm:space-y-6 text-xs sm:text-sm text-slate-300">
                <div>
                  <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2">
                    Takım Hakkında
                  </h4>
                  <p className="leading-relaxed bg-[#121215] p-3 sm:p-4 rounded-lg sm:rounded-xl border border-[#27272a]">
                    {selectedTeam.desc}
                  </p>
                </div>

                {selectedTeam.story && (
                  <div>
                    <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2">
                      Takım Hikayesi ve Başarıları
                    </h4>
                    <p className="leading-relaxed whitespace-pre-line bg-[#121215] p-3 sm:p-4 rounded-lg sm:rounded-xl border border-[#27272a]">
                      {selectedTeam.story}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 sm:pt-4 border-t border-[#27272a] flex items-center justify-end">
                {selectedTeam.isOpen !== false ? (
                  <button
                    onClick={(e) => handleApplyClick(e, selectedTeam.applicationUrl, selectedTeam.title)}
                    className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#102040] hover:bg-[#183060] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-black/40 border border-[#234580] transition-all cursor-pointer active:scale-95"
                  >
                    <span>Google Forms ile Başvur</span>
                    <ExternalLink className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  </button>
                ) : (
                  <span className="text-[11px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider">Başvuru Dönemi Kapalı</span>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};