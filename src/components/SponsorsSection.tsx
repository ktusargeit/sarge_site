import React from 'react';

import { Sponsor } from '../types';
import { Building2, ExternalLink, Download, Send, CheckCircle2, Award, Shield, FileText, ChevronRight } from 'lucide-react';
import { getCachedDoc } from '../lib/firebaseCache';
import { useState, useEffect } from 'react';

interface SponsorsSectionProps {
  onShowToast: (msg: string) => void;
}

export const SponsorsSection: React.FC<SponsorsSectionProps> = ({ onShowToast }) => {
  const [sponsorsData, setSponsorsData] = useState<Sponsor[]>([]);
  useEffect(() => {
    const fetchSponsors = async () => {
      try {
        const snap = await getCachedDoc('content', 'sponsors');
        if (snap.exists() && snap.data().data) {
          setSponsorsData(snap.data().data);
        }
      } catch (err) { 
        console.warn(err); 
        setSponsorsData([
          { id: '1', name: 'KTÜ', tier: 'ana', tierLabel: 'Ana Sponsor', logoUrl: '', website: 'https://ktu.edu.tr', description: 'Üniversitemiz' }
        ]);
      }
    };
    fetchSponsors();
  }, []);
  
  
    const mainSponsors = sponsorsData.filter((s) => s.tier === 'ana');
  const platinSponsors = sponsorsData.filter((s) => s.tier === 'platin');
  const altınSponsors = sponsorsData.filter((s) => s.tier === 'altin');
  const gumusSponsors = sponsorsData.filter((s) => s.tier === 'gumus');

  return (
    <div className="py-6 sm:py-16 bg-[#09090b] text-[#E2E8F0] font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-8 sm:space-y-16">

        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto space-y-1.5 sm:space-y-3">
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[#F8FAFC] tracking-tight">
            Sponsorlarımız ve Çözüm Ortaklarımız
          </h2>
          <p className="text-[11px] sm:text-sm text-[#94A3B8] leading-relaxed px-1 sm:px-0">
            Milli Teknoloji Hamlesi vizyonumuza inanan, projelerimize malzeme, yazılım, test ve imalat desteği sağlayan kurumlar.
          </p>
        </div>

        {sponsorsData.length === 0 ? (
          <div className="bg-[#18181b] p-6 sm:p-8 rounded-xl sm:rounded-2xl border border-[#27272a] text-center space-y-2 sm:space-y-3">
            <p className="text-xs sm:text-sm text-[#94A3B8]">
              Yeni dönem sponsorluk görüşmelerimiz ve destek başvuru süreçlerimiz devam etmektedir.
            </p>
          </div>
        ) : (
          <>
            {/* Tier 1: Ana Sponsorlar */}
            {mainSponsors.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-[10px] sm:text-xs font-sans font-bold uppercase tracking-wider text-amber-400 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
                    Ana Sponsorlar
                  </span>
                  <div className="h-px bg-[#27272a] flex-1"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6">
                  {mainSponsors.map((sponsor) => (
                    <div
                      key={sponsor.id}
                      className="bg-[#18181b] p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border border-amber-500/30 transition-all flex flex-col sm:flex-row items-center gap-3 sm:gap-6 shadow-xl relative group"
                    >
                      <div className="w-full sm:w-40 h-20 sm:h-24 bg-[#121215] rounded-lg sm:rounded-xl border border-[#27272a] flex items-center justify-center p-2 sm:p-3 shrink-0">
                        <span className="font-extrabold font-sans text-base sm:text-lg text-white tracking-wider">
                          {sponsor.name}
                        </span>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2 text-center sm:text-left flex-1">
                        <div className="flex items-center justify-center sm:justify-between">
                          <h3 className="text-sm sm:text-lg font-bold text-white font-sans">{sponsor.name}</h3>
                          {sponsor.website && /^https?:\/\//i.test(sponsor.website.trim()) && (
                            <a
                              href={sponsor.website.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] sm:text-xs text-zinc-300 hover:text-white flex items-center gap-1 font-sans"
                            >
                              <span>Web Sitesi</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-relaxed">
                          {sponsor.description}
                        </p>
                        <div className="pt-0.5 sm:pt-1 text-[10px] sm:text-[11px] font-sans text-[#94A3B8]">
                          Desteklenen Projeler: <span className="text-amber-300 font-semibold">{sponsor.supportedProjects?.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tier 2: Platin Sponsorlar */}
            {platinSponsors.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-sans font-bold uppercase tracking-wider text-white px-3 py-1 rounded-md bg-[#27272a] border border-[#3f3f46]/40">
                    Platin Sponsorlar
                  </span>
                  <div className="h-px bg-[#27272a] flex-1"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {platinSponsors.map((sponsor) => (
                    <div
                      key={sponsor.id}
                      className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] transition-all flex flex-col sm:flex-row items-center gap-6 shadow-lg"
                    >
                      <div className="w-full sm:w-36 h-20 bg-[#121215] rounded-xl border border-[#27272a] flex items-center justify-center p-3 shrink-0">
                        <span className="font-bold font-sans text-base text-white tracking-wider">
                          {sponsor.name}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-center sm:text-left flex-1">
                        <h3 className="text-base font-bold text-white font-sans">{sponsor.name}</h3>
                        <p className="text-xs text-[#94A3B8] leading-relaxed">
                          {sponsor.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tier 3: Altın & Gümüş Sponsorlar */}
            {(altınSponsors.length > 0 || gumusSponsors.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-sans font-bold uppercase tracking-wider text-[#CBD5E1] px-3 py-1 rounded-md bg-[#18181b] border border-[#27272a]">
                    Altın, Gümüş & Kurumsal Destekçiler
                  </span>
                  <div className="h-px bg-[#27272a] flex-1"></div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[...altınSponsors, ...gumusSponsors].map((sponsor) => (
                    <div
                      key={sponsor.id}
                      className="bg-[#18181b] p-4 rounded-xl border border-[#27272a] transition-all text-center space-y-2"
                    >
                      <div className="h-14 bg-[#121215] rounded-lg border border-[#27272a] flex items-center justify-center p-2">
                        <span className="font-bold font-sans text-xs text-white">
                          {sponsor.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#94A3B8] line-clamp-2">
                        {sponsor.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};
