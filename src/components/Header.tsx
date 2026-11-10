import React, { useState, useEffect } from 'react';
import { NavTab } from '../types';
import { SargeLogo } from './Logos';
import { Shield, Plane, Cpu, Sparkles, Menu, X, ChevronRight, Rocket, Users, Building2, MapPin, ExternalLink, Inbox } from 'lucide-react';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onOpenJoinModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenJoinModal }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems: { id: NavTab; label: string; badge?: string }[] = [
    { id: 'home', label: 'Anasayfa' },
    { id: 'teams', label: 'Bize Katılın' },
    { id: 'projects', label: 'Projelerimiz' },
    { id: 'expo', label: 'SARGE EXPO', badge: '2027' },
    { id: 'announcements', label: 'Basında Biz' },
    { id: 'gallery', label: 'Galeri' },
    { id: 'sponsors', label: 'Sponsorlar' },
    { id: 'contact', label: 'İletişim' },
  ];

  const TAB_HREFS: Record<NavTab, string> = {
    home: '/',
    teams: '/teams',
    projects: '/projects',
    expo: '/expo',
    announcements: '/basinda-biz',
    gallery: '/gallery',
    sponsors: '/sponsors',
    contact: '/contact',
    admin: '/admin'
  };

  const handleTabClick = (tab: NavTab, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 w-full transition-all duration-300">
      {/* Main Navbar */}
      <nav
        className={`w-full transition-all duration-200 ${
          scrolled
            ? 'bg-[#09090b]/95 backdrop-blur-md border-b border-[#27272a] shadow-2xl py-2.5'
            : 'bg-[#09090b] border-b border-[#27272a] py-3'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo & Brand */}
          <a
            href="/"
            onClick={(e) => handleTabClick('home', e)}
            className="flex items-center gap-3 text-left group focus:outline-none shrink-0"
          >
            <SargeLogo size={38} showText={true} />
          </a>

          {/* Desktop Navigation - Clean Tabs matching screenshot */}
          <div className="hidden lg:flex items-center gap-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const href = TAB_HREFS[item.id] || '/';
              return (
                <a
                  key={item.id}
                  href={href}
                  onClick={(e) => handleTabClick(item.id, e)}
                  className={`px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-medium tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#102040] text-white border border-[#234580] shadow-sm'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#18181b] border border-transparent'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-sans font-bold ${
                        isActive
                          ? 'bg-[#183060] text-white border border-[#234580]'
                          : 'bg-[#18181b] text-slate-400 border border-[#27272a]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-[#18181b] focus:outline-none border border-[#27272a]"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Sheet */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#27272a] bg-[#18181b] px-4 pt-3 pb-6 space-y-1.5 mt-2 shadow-2xl">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const href = TAB_HREFS[item.id] || '/';
              return (
                <a
                  key={item.id}
                  href={href}
                  onClick={(e) => handleTabClick(item.id, e)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-[#102040] text-white border border-[#234580]'
                      : 'text-[#94A3B8] hover:bg-[#27272a] hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#183060] text-white border border-[#234580] font-sans">
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}

            <div className="pt-3 border-t border-[#27272a] flex flex-col gap-2">
              <a
                href="/teams"
                onClick={(e) => handleTabClick('teams', e)}
                className="w-full text-center py-2.5 rounded-lg bg-[#102040] hover:bg-[#183060] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-black/40 border border-[#234580] transition-all active:scale-95"
              >
                <span>Bize Katılın (Başvurular Açık)</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};
