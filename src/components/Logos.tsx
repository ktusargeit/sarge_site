import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { getCachedDoc } from '../lib/firebaseCache';
import { doc, getDoc } from 'firebase/firestore';

// Official KTÜ SARGE Club Logo
export const SargeLogo: React.FC<{ className?: string; size?: number; showText?: boolean }> = ({
  className = '',
  size = 40,
  showText = false
}) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getCachedDoc('content', 'site_settings');
        if (snap.exists() && snap.data().logoUrl) {
          setLogoUrl(snap.data().logoUrl);
        }
      } catch (err) {
        console.warn("Logo fetch error:", err);
        // Logo will just fallback to default
      }
    };
    fetchSettings();
  }, []);

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className="relative bg-black border border-slate-800 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-md"
        style={{ width: size, height: size }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="SARGE Logo" className="w-full h-full object-contain p-1" />
        ) : (
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full p-1"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
          {/* Background dark fill */}
          <rect width="200" height="200" fill="#000000" rx="16" />

          {/* Top Horizontal Bars */}
          <line x1="25" y1="65" x2="65" y2="65" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
          <line x1="135" y1="65" x2="175" y2="65" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />

          {/* Top Grid dashes */}
          <rect x="75" y="60" width="8" height="10" fill="#FFFFFF" rx="2" />
          <rect x="87" y="60" width="8" height="10" fill="#FFFFFF" rx="2" />
          <rect x="105" y="60" width="8" height="10" fill="#FFFFFF" rx="2" />
          <rect x="117" y="60" width="8" height="10" fill="#FFFFFF" rx="2" />

          {/* Main Rocket Silhouette forming 'R' center */}
          {/* Nosecone */}
          <path d="M100 35 L106 65 L94 65 Z" fill="#FFFFFF" />
          {/* Main Body Column */}
          <rect x="95" y="65" width="10" height="75" fill="#FFFFFF" />
          {/* Rocket Fins */}
          <path d="M95 125 L86 142 L95 140 Z" fill="#FFFFFF" />
          <path d="M105 125 L114 142 L105 140 Z" fill="#FFFFFF" />
          <path d="M97 140 L100 152 L103 140 Z" fill="#FFFFFF" />

          {/* S A [Rocket] G E Text */}
          <text
            x="20"
            y="122"
            fill="#FFFFFF"
            fontFamily="'Space Grotesk', 'Impact', sans-serif"
            fontWeight="900"
            fontSize="46"
            letterSpacing="-1"
          >
            S
          </text>
          <text
            x="52"
            y="122"
            fill="#FFFFFF"
            fontFamily="'Space Grotesk', 'Impact', sans-serif"
            fontWeight="900"
            fontSize="46"
            letterSpacing="-1"
          >
            A
          </text>
          {/* Center R stylized leg attached to rocket */}
          <path
            d="M96 85 C115 85 116 100 105 106 L118 122 L106 122 L96 106 Z"
            fill="#FFFFFF"
          />

          <text
            x="122"
            y="122"
            fill="#FFFFFF"
            fontFamily="'Space Grotesk', 'Impact', sans-serif"
            fontWeight="900"
            fontSize="46"
            letterSpacing="-1"
          >
            G
          </text>
          <text
            x="158"
            y="122"
            fill="#FFFFFF"
            fontFamily="'Space Grotesk', 'Impact', sans-serif"
            fontWeight="900"
            fontSize="46"
            letterSpacing="-1"
          >
            E
          </text>
        </svg>
        )}
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-[#F8FAFC] tracking-wider font-sans text-sm sm:text-base leading-tight">
              KTÜ SARGE
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-[#94A3B8] font-sans uppercase tracking-wider leading-tight">
            Savunma ve Ar-Ge Topluluğu
          </span>
        </div>
      )}
    </div>
  );
};

// Official ALACA Savaşan İHA Takımı Logo
export const AlacaLogo: React.FC<{ className?: string; size?: number; showSubtitle?: boolean }> = ({
  className = '',
  size = 48,
  showSubtitle = false
}) => {
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="relative bg-[#050810] border border-slate-800/80 rounded-xl p-2 flex items-center justify-center overflow-hidden shadow-xl"
        style={{ width: size * 2.2, height: size }}
      >
        <svg
          viewBox="0 0 400 160"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Metallic Wing Gradients */}
          <defs>
            <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#CBD5E1" />
              <stop offset="70%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>

            <linearGradient id="silverGlint" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="50%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Left Wing Feathers */}
          <path
            d="M 190 85 C 130 50, 70 20, 15 30 C 50 50, 110 70, 175 90 Z"
            fill="url(#chromeGrad)"
          />
          <path
            d="M 185 92 C 120 70, 60 50, 30 55 C 75 75, 130 92, 170 102 Z"
            fill="url(#chromeGrad)"
            opacity="0.85"
          />
          <path
            d="M 180 100 C 135 90, 80 80, 50 85 C 90 100, 135 110, 165 112 Z"
            fill="url(#chromeGrad)"
            opacity="0.7"
          />

          {/* Right Wing Feathers */}
          <path
            d="M 210 85 C 270 50, 330 20, 385 30 C 350 50, 290 70, 225 90 Z"
            fill="url(#chromeGrad)"
          />
          <path
            d="M 215 92 C 280 70, 340 50, 370 55 C 325 75, 270 92, 230 102 Z"
            fill="url(#chromeGrad)"
            opacity="0.85"
          />
          <path
            d="M 220 100 C 265 90, 320 80, 350 85 C 310 100, 265 110, 235 112 Z"
            fill="url(#chromeGrad)"
            opacity="0.7"
          />

          {/* Center Tail Feather Swirl */}
          <path
            d="M 200 95 C 170 120, 150 145, 175 145 C 190 130, 200 115, 200 100 Z"
            fill="url(#chromeGrad)"
          />
          <path
            d="M 200 95 C 230 120, 250 145, 225 145 C 210 130, 200 115, 200 100 Z"
            fill="url(#chromeGrad)"
          />

          {/* ALACA Center Metallic Typography */}
          <text
            x="200"
            y="88"
            textAnchor="middle"
            fill="url(#silverGlint)"
            fontFamily="'Orbitron', 'Space Grotesk', sans-serif"
            fontWeight="900"
            fontSize="48"
            letterSpacing="6"
            filter="url(#glow)"
          >
            ALACA
          </text>

          {/* Metallic Sharp Outlines */}
          <text
            x="200"
            y="88"
            textAnchor="middle"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            fontFamily="'Orbitron', 'Space Grotesk', sans-serif"
            fontWeight="900"
            fontSize="48"
            letterSpacing="6"
          >
            ALACA
          </text>

          {/* Lens Flares */}
          <circle cx="105" cy="68" r="2" fill="#FFFFFF" />
          <circle cx="295" cy="68" r="2" fill="#FFFFFF" />
          <line x1="95" y1="68" x2="115" y2="68" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.8" />
          <line x1="285" y1="68" x2="305" y2="68" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.8" />
        </svg>
      </div>

      {showSubtitle && (
        <span className="text-[10px] font-sans font-bold text-zinc-400 uppercase tracking-wider mt-1">
          Savaşan İHA Takımı
        </span>
      )}
    </div>
  );
};

// Savaşan İHA Aircraft "Göktuğ" Image
export const GoktugAircraftCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#18181b] border border-[#27272a] group ${className}`}>
      {/* High Quality Aircraft Visual Representation */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900">
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover">
          {/* Workshop Tile Floor Background */}
          <rect width="800" height="450" fill="#1e2430" />
          <path d="M0 100 L800 100 M0 200 L800 200 M0 300 L800 300 M0 400 L800 400" stroke="#2a3242" strokeWidth="1" />
          <path d="M200 0 L200 450 M400 0 L400 450 M600 0 L600 450" stroke="#2a3242" strokeWidth="1" />

          {/* Aircraft Main Fuselage (Black Composite / Fiber) */}
          <path d="M 180 230 C 240 210, 480 200, 620 280 C 580 320, 360 300, 220 280 Z" fill="#11151c" stroke="#384459" strokeWidth="3" />
          <path d="M 520 260 L 620 280 L 580 310 Z" fill="#080a0f" />

          {/* Main White Wings with Blue Wingtips */}
          {/* Left Wing */}
          <path d="M 100 370 L 480 230 L 460 200 L 60 310 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="2" />
          <path d="M 60 310 L 100 370 L 120 360 L 80 300 Z" fill="#0284C7" />

          {/* Right Wing */}
          <path d="M 280 140 L 660 210 L 640 190 L 260 120 Z" fill="#E2E8F0" opacity="0.9" stroke="#CBD5E1" strokeWidth="2" />
          <path d="M 640 190 L 660 210 L 670 205 L 650 185 Z" fill="#0284C7" />

          {/* Dual Blue Electric Motor Mounts */}
          <rect x="420" y="220" width="30" height="15" fill="#0284C7" rx="3" stroke="#38BDF8" strokeWidth="1.5" />
          <circle cx="435" cy="235" r="8" fill="#1E293B" stroke="#0284C7" strokeWidth="2" />
          
          <rect x="520" y="240" width="30" height="15" fill="#0284C7" rx="3" stroke="#38BDF8" strokeWidth="1.5" />
          <circle cx="535" cy="255" r="8" fill="#1E293B" stroke="#0284C7" strokeWidth="2" />

          {/* Tail Elevator & Blue Stripes */}
          <path d="M 280 140 L 360 110 L 420 120 L 320 160 Z" fill="#F1F5F9" />
          <path d="M 280 140 L 300 132 L 340 145 L 320 160 Z" fill="#0284C7" />

          <path d="M 220 110 L 250 50 L 270 50 L 250 115 Z" fill="#0284C7" />

          {/* Exposed Nose Avionics & Jetson AI Board */}
          <rect x="510" y="240" width="40" height="30" fill="#0F172A" rx="4" stroke="#38BDF8" strokeWidth="1.5" />
          <rect x="520" y="245" width="20" height="20" fill="#1E293B" />
          {/* Fan & Heatsink */}
          <circle cx="530" cy="255" r="7" fill="#0284C7" />
          <circle cx="530" cy="255" r="3" fill="#38BDF8" />

          {/* Safety Button (Red Emergency Stop Switch) */}
          <circle cx="480" cy="225" r="9" fill="#DC2626" stroke="#FEF08A" strokeWidth="2" />

          {/* Landing Wheel Leg */}
          <path d="M 460 280 Q 420 370 390 410" stroke="#0F172A" strokeWidth="10" strokeLinecap="round" />
          <circle cx="390" cy="410" r="18" fill="#090D16" stroke="#475569" strokeWidth="4" />
        </svg>

        {/* Overlay Gradient & Badge */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-transparent to-black/30"></div>

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="bg-black/80 backdrop-blur-md text-zinc-200 border border-white/20 px-3 py-1 rounded-lg text-xs font-sans font-bold">
            ALACA SAVAŞAN İHA TAKIMI
          </span>
          <span className="bg-white text-zinc-950 px-2.5 py-1 rounded-lg text-xs font-sans font-bold">
            UÇAK: GÖKTUĞ
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3 bg-[#09090b]/90 backdrop-blur-md border border-[#27272a] p-3 rounded-xl flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white font-sans flex items-center gap-2">
              <span>GÖKTUĞ</span>
              <span className="text-[10px] bg-[#27272a] text-zinc-200 border border-[#3f3f46]/40 px-2 py-0.5 rounded font-normal">
                TEKNOFEST 2026 Hazırlık
              </span>
            </h4>
            <p className="text-[11px] text-[#94A3B8]">
              160 cm Kanat • Karbon Gövde • 6.5 kg Kalkış Ağırlığı • 20 m/s Seyir • 45 dk Uçuş • YOLOv10 Otonom İt Dalaşı
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
