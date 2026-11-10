import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Hero } from './components/Hero';
import { ProjectsSection } from './components/ProjectsSection';
import { TeamsSection } from './components/TeamsSection';
import { SargeExpoSection } from './components/SargeExpoSection';
import { GallerySection } from './components/GallerySection';
import { SponsorsSection } from './components/SponsorsSection';
import { JoinContactSection } from './components/JoinContactSection';
import { AnnouncementsSection } from './components/AnnouncementsSection';

// Lazy load admin panel with retry
const AdminPanel = lazy(async () => {
  try {
    const module = await import('./components/AdminPanel');
    return { default: module.AdminPanel };
  } catch (err) {
    console.warn('AdminPanel load retry...', err);
    await new Promise(r => setTimeout(r, 400));
    const module = await import('./components/AdminPanel');
    return { default: module.AdminPanel };
  }
});

import { NavTab } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SuccessToast } from './components/SuccessToast';
import { getCachedDoc } from './lib/firebaseCache';

export const TAB_PATH_MAP: Partial<Record<NavTab, string>> = {
  home: '/',
  teams: '/teams',
  projects: '/projects',
  expo: '/expo',
  announcements: '/basinda-biz',
  gallery: '/gallery',
  sponsors: '/sponsors',
  contact: '/contact'
};

export const TAB_TITLE_MAP: Record<NavTab, string> = {
  home: 'KTÜ SARGE - Savunma ve Ar-Ge Topluluğu',
  teams: 'Bize Katılın & Takımlarımız | KTÜ SARGE',
  projects: 'Projelerimiz | KTÜ SARGE',
  expo: 'SARGE EXPO | Savunma ve Teknoloji Fuarı | KTÜ SARGE',
  announcements: 'Basında Biz & Haberler | KTÜ SARGE',
  gallery: 'Fotoğraf Galerisi | KTÜ SARGE',
  sponsors: 'Sponsorlarımız & Destekçilerimiz | KTÜ SARGE',
  contact: 'İletişim & Başvuru | KTÜ SARGE',
  admin: 'Yönetici Paneli | KTÜ SARGE'
};

export const ADMIN_SECRET_KEY = (import.meta.env.VITE_ADMIN_GATE_KEY || 'sarge-portal-it-2026').trim();

export const isGateUnlocked = (): boolean => {
  try {
    return sessionStorage.getItem('sarge_gate_unlocked') === '1';
  } catch {
    return false;
  }
};

export const checkSecretKeyInUrl = (): boolean => {
  try {
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    const params = new URLSearchParams(search);
    const yonetimParam = params.get('yonetim') || params.get('gate') || params.get('key');
    
    if ((yonetimParam && yonetimParam.trim() === ADMIN_SECRET_KEY) || hash.includes(ADMIN_SECRET_KEY)) {
      sessionStorage.setItem('sarge_gate_unlocked', '1');
      sessionStorage.setItem('sarge_gate_active', '1');
      return true;
    }
  } catch {}
  return false;
};

export const getTabFromPath = (pathname: string, hash: string): NavTab => {
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  
  // 1. Secret key gate in URL -> Enters Admin Panel
  if (checkSecretKeyInUrl()) {
    return 'admin';
  }

  // Keep admin view on F5 refresh while gate is active on root path
  try {
    if (clean === '/' && sessionStorage.getItem('sarge_gate_active') === '1' && sessionStorage.getItem('sarge_gate_unlocked') === '1') {
      return 'admin';
    }
  } catch {}

  // 2. Explicitly block /admin, /yonetim, #admin from opening admin
  if (clean === '/admin' || clean === '/yonetim' || clean === '/panel' || hash === '#admin' || hash === '#admin-sarge') {
    return 'home';
  }

  // 3. Normal tab navigation
  if (clean === '/teams' || clean === '/takimlar' || clean === '/takimlarimiz' || clean === '/team') return 'teams';
  if (clean === '/projects' || clean === '/projeler' || clean === '/projelerimiz' || clean === '/project') return 'projects';
  if (clean === '/expo' || clean === '/sarge-expo' || clean === '/fuar') return 'expo';
  if (clean === '/basinda-biz' || clean === '/basinda' || clean === '/basin' || clean === '/announcements' || clean === '/duyurular' || clean === '/haberler') return 'announcements';
  if (clean === '/gallery' || clean === '/galeri' || clean === '/fotograflar') return 'gallery';
  if (clean === '/sponsors' || clean === '/sponsorlar' || clean === '/sponsorlarimiz') return 'sponsors';
  if (clean === '/contact' || clean === '/iletisim' || clean === '/bize-katilin' || clean === '/katil' || clean === '/join') return 'contact';

  // Default is ALWAYS normal website!
  return 'home';
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    try {
      return getTabFromPath(window.location.pathname, window.location.hash);
    } catch {
      return 'home';
    }
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('project') || params.get('id') || null;
    } catch {
      return null;
    }
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync document title and URL canonical on tab change
  useEffect(() => {
    if (TAB_TITLE_MAP[activeTab]) {
      document.title = TAB_TITLE_MAP[activeTab];
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  // Initial URL synchronization and cleanup
  useEffect(() => {
    try {
      const initialTab = getTabFromPath(window.location.pathname, window.location.hash);
      if (initialTab === 'admin') {
        sessionStorage.setItem('sarge_gate_active', '1');
        window.history.replaceState({ tab: 'admin' }, '', '/');
        return;
      }
      const targetPath = TAB_PATH_MAP[initialTab] || '/';
      const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      
      if (currentPath !== targetPath || window.location.search) {
        window.history.replaceState({ tab: initialTab }, '', targetPath);
      }
    } catch (err) {
      console.warn('URL router init error:', err);
    }
  }, []);

  // Browser back / forward button popstate synchronization
  useEffect(() => {
    const handlePopState = () => {
      try {
        const tab = getTabFromPath(window.location.pathname, window.location.hash);
        const params = new URLSearchParams(window.location.search);
        const projId = params.get('project') || params.get('id');
        setSelectedProjectId(projId || null);
        setActiveTab(tab);
      } catch (e) {
        console.warn('popstate error:', e);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Admin route & hash listener
  useEffect(() => {
    const checkAdminRoute = () => {
      const tab = getTabFromPath(window.location.pathname, window.location.hash);
      if (tab === 'admin') {
        setActiveTab('admin');
      }
    };
    checkAdminRoute();
    window.addEventListener('hashchange', checkAdminRoute);
    window.addEventListener('popstate', checkAdminRoute);
    return () => {
      window.removeEventListener('hashchange', checkAdminRoute);
      window.removeEventListener('popstate', checkAdminRoute);
    };
  }, []);

  // Fetch site icon
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const snap = await getCachedDoc('content', 'site_settings');
        if (snap.exists() && snap.data().logoUrl) {
          const logo = snap.data().logoUrl;
          const links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
          if (links.length > 0) {
            links.forEach((l) => {
              l.href = logo;
            });
          } else {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.href = logo;
            document.head.appendChild(link);
          }
        }
      } catch (err) {}
    };
    fetchLogo();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const handleTabChange = (tab: NavTab, projectId?: string | null) => {
    if (tab !== 'projects') {
      setSelectedProjectId(null);
    } else if (projectId !== undefined) {
      setSelectedProjectId(projectId);
    }

    if (tab === 'admin') {
      if (!isGateUnlocked() && !checkSecretKeyInUrl()) {
        setActiveTab('home');
        return;
      }
      try {
        window.history.pushState({ tab: 'admin' }, '', '/');
      } catch {}
      setActiveTab('admin');
      return;
    }

    const targetPath = TAB_PATH_MAP[tab] || '/';

    try {
      if (window.location.pathname !== targetPath || window.location.hash || window.location.search) {
        window.history.pushState({ tab, projectId }, '', targetPath);
      }
    } catch (err) {
      console.warn('history.pushState warning:', err);
    }

    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#E2E8F0] font-sans selection:bg-zinc-700 selection:text-white flex flex-col justify-between overflow-x-hidden">
      
      {/* Top Header Navigation */}
      {activeTab !== 'admin' && (
        <Header
          activeTab={activeTab}
          setActiveTab={(t) => handleTabChange(t)}
          onOpenJoinModal={() => handleTabChange('contact')}
        />
      )}

      {/* Main Tab View Router */}
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#09090b] text-zinc-400">Yükleniyor...</div>}>
        {activeTab === 'home' && (
          <Hero
            setActiveTab={(t) => handleTabChange(t)}
            onSelectProject={(id) => handleTabChange('projects', id)}
          />
        )}
        {activeTab === 'teams' && <TeamsSection onNavigateToExpo={() => handleTabChange('expo')} />}
        {activeTab === 'projects' && (
          <ProjectsSection
            onOpenJoinModal={() => handleTabChange('contact')}
            initialProjectId={selectedProjectId}
          />
        )}
        {activeTab === 'expo' && <SargeExpoSection onShowToast={showToast} />}
        {activeTab === 'gallery' && <GallerySection />}
        {activeTab === 'announcements' && <AnnouncementsSection />}
        {activeTab === 'sponsors' && <SponsorsSection onShowToast={showToast} />}
        {activeTab === 'contact' && <JoinContactSection onShowToast={showToast} />}
        {activeTab === 'admin' && <AdminPanel onShowToast={showToast} />}
      </Suspense>
      </main>

      {/* Footer */}
      {activeTab !== 'admin' && <Footer setActiveTab={(t) => handleTabChange(t)} />}

      {/* Global Toast */}
      <SuccessToast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
