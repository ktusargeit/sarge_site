import React, { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { getCachedDoc, clearCache } from '../lib/firebaseCache';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Lock, LogOut, Plus, Trash2, Image as ImageIcon, Settings, Users, MessageSquare, Database, Check, Home, Edit3, X, Bell, Layers, Award, Sparkles, Upload, Star, ChevronLeft, ChevronRight, Eye, EyeOff, ShieldCheck, ShieldAlert, ExternalLink, HeartHandshake, Megaphone, BadgePercent, Calendar, Palette, Video, Film, ArrowLeft, Globe, Newspaper } from 'lucide-react';
import { PROJECTS_DATA as initialProjects } from '../data/mockData';
import { BackgroundMedia, parseBackgroundMedia, isVideoMedia } from './BackgroundMedia';
import { formatImageUrl, handleImageFallback } from '../lib/mediaUtils';

// Primary Root Admin Constants (PBKDF2-SHA256, 100,000 iterations, 32 bytes)
const DEFAULT_ADMIN_USER = 'Sarge_it';
const DEFAULT_ADMIN_SALT = '0aa07ec91234eaf869fc1a46886dab147232fd63ab7d4981874ee3391c9b93f2';
const DEFAULT_ADMIN_HASH = 'c4935fb2a2471f721c62765037dbc30975f3a5fc97ff673b5168a045f6ec0a6d';
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const FIRESTORE_ADMIN_NOTE =
  "Firestore uzerinden yeni yonetici eklemek icin 'admins' dizisine { username: 'kullanici_adi', password: 'sifre', role: 'Yonetici', active: true } ekleyin. Sistem duz metin sifreyi otomatik olarak PBKDF2-SHA256 ile sifreleyip kaydeder. Yonetici silmek icin diziden cikarabilir veya active: false yapabilirsiniz.";

async function computePbkdf2Hex(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toLowerCase();
}

function generateRandomHex(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  window.crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getVisitorIpAndLocation(): Promise<{ ip: string; location: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d && d.ip) {
        const country = d.country || '';
        const city = d.city || '';
        const region = d.region && d.region !== city ? ` (${d.region})` : '';
        const isp = d.connection?.isp || d.connection?.org || '';
        const loc = [country, city].filter(Boolean).join(' / ') + region;
        return {
          ip: String(d.ip),
          location: isp ? `${loc} - [${isp}]` : loc || 'Bilinmeyen Konum'
        };
      }
    }
  } catch {}
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d && d.ip) {
        const country = d.country_name || '';
        const city = d.city || '';
        const isp = d.org || '';
        const loc = [country, city].filter(Boolean).join(' / ');
        return {
          ip: String(d.ip),
          location: isp ? `${loc} - [${isp}]` : loc || 'Bilinmeyen Konum'
        };
      }
    }
  } catch {}
  return { ip: 'Bilinmeyen-IP', location: 'İnternet Konumu (Detay Alınamadı)' };
}

async function syncFirestoreAdmins(): Promise<any[]> {
  const defaultAdmin = {
    id: 'root-admin',
    username: DEFAULT_ADMIN_USER,
    role: 'Ana Sistem Yöneticisi (IT)',
    salt: DEFAULT_ADMIN_SALT,
    passwordHash: DEFAULT_ADMIN_HASH,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  try {
    const refDoc = doc(db, 'content', 'admin_users');
    const snap = await getDoc(refDoc);
    if (snap.exists() && snap.data()) {
      const data = snap.data();
      const rawList = Array.isArray(data.admins)
        ? data.admins
        : Array.isArray(data.data)
        ? data.data
        : data.username
        ? [data]
        : [];

      if (rawList.length > 0) {
        const normalized: any[] = [];
        let changed = false;

        for (const item of rawList) {
          if (!item || typeof item !== 'object') continue;
          let uname = String(item.username || item.user || '').trim();
          if (!uname) continue;

          let salt = String(item.salt || '').trim();
          let passwordHash = String(item.passwordHash || item.hash || '').trim().toLowerCase();
          const plainPassword = typeof item.password === 'string' ? item.password.trim() : '';

          // Migrate legacy root-admin username/hash if present
          if (uname.toLowerCase() === 'sarge-admin-it') {
            uname = DEFAULT_ADMIN_USER;
            salt = DEFAULT_ADMIN_SALT;
            passwordHash = DEFAULT_ADMIN_HASH;
            changed = true;
          }

          if (plainPassword) {
            salt = generateRandomHex(32);
            passwordHash = await computePbkdf2Hex(plainPassword, salt);
            changed = true;
          }

          if (!salt || !passwordHash) {
            if (uname.toLowerCase() === DEFAULT_ADMIN_USER.toLowerCase()) {
              salt = DEFAULT_ADMIN_SALT;
              passwordHash = DEFAULT_ADMIN_HASH;
              changed = true;
            } else {
              continue;
            }
          }

          normalized.push({
            id: String(item.id || `adm_${uname.toLowerCase().replace(/[^a-z0-9]/g, '_')}`),
            username: uname,
            role: String(item.role || 'Yönetici').trim(),
            salt,
            passwordHash,
            active: item.active !== false,
            createdAt: String(item.createdAt || new Date().toISOString())
          });
        }

        if (!normalized.some((a) => a.username.toLowerCase() === DEFAULT_ADMIN_USER.toLowerCase())) {
          normalized.unshift(defaultAdmin);
          changed = true;
        }

        if (normalized.length > 0) {
          if (changed) {
            try {
              await setDoc(refDoc, {
                _Kullanim_Notu: FIRESTORE_ADMIN_NOTE,
                admins: normalized,
                _lastUpdated: new Date().toISOString()
              });
            } catch {}
          }
          return normalized;
        }
      }
    }

    // Document does not exist yet in Firestore -> initialize it automatically
    try {
      await setDoc(refDoc, {
        _Kullanim_Notu: FIRESTORE_ADMIN_NOTE,
        admins: [defaultAdmin],
        _lastUpdated: new Date().toISOString()
      });
    } catch {}
  } catch {}

  return [defaultAdmin];
}

interface AdminPanelProps {
  onShowToast: (msg: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onShowToast }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const recompressBase64Image = (dataUri: string, maxWidth = 800, maxHeight = 600, quality = 0.62): Promise<string> => {
    if (!dataUri || !dataUri.startsWith('data:image/')) return Promise.resolve(dataUri);
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxHeight) {
            if (width / maxWidth > height / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage(img, 0, 0, width, height);
          }
          const compressed = canvas.toDataURL('image/jpeg', quality);
          // Only return if it's actually smaller or equal
          resolve(compressed.length < dataUri.length ? compressed : dataUri);
        } catch {
          resolve(dataUri);
        }
      };
      img.onerror = () => resolve(dataUri);
      img.src = dataUri;
    });
  };

  const uploadToStorage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > 25 * 1024 * 1024) {
        reject(new Error("Dosya boyutu 25MB'dan büyük olamaz."));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawResult = event.target?.result as string;
        if (!rawResult) {
          reject(new Error("Dosya okunamadı."));
          return;
        }

        const img = new window.Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            // Web ve mobil için ideal optimize boyutlandırma (1MB Firestore sınırını asla aşmaz)
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
              if (width / MAX_WIDTH > height / MAX_HEIGHT) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              } else {
                width = Math.round((width * MAX_HEIGHT) / height);
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'medium';
              ctx.drawImage(img, 0, 0, width, height);
            }

            // Standart web sıkıştırması: ~35KB - 50KB boyutunda net ve anında açılan JPEG
            const base64Data = canvas.toDataURL('image/jpeg', 0.65);
            resolve(base64Data);
          } catch (e: any) {
            if (rawResult.startsWith('data:image/')) {
              resolve(rawResult);
            } else {
              reject(new Error(e?.message || 'Resim işlenirken hata oluştu.'));
            }
          }
        };
        img.onerror = () => {
          if (rawResult.startsWith('data:image/svg') || rawResult.length < 200000) {
            resolve(rawResult);
          } else {
            reject(new Error("Görsel okunamadı veya formatı desteklenmiyor. JPG veya PNG seçmeyi deneyin."));
          }
        };
        img.src = rawResult;
      };
      reader.onerror = () => reject(new Error("Dosya okunamadı."));
      reader.readAsDataURL(file);
    });
  };

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [spotlights, setSpotlights] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [aboutTeams, setAboutTeams] = useState<any[]>([]);
  const [socialUnit, setSocialUnit] = useState<any>({
    desc: 'Sosyal birim; topluluğumuzun sponsorluk & finans, sosyal medya & tanıtım, etkinlik & organizasyon, medya prodüksiyon ve insan kaynakları süreçlerini yürüten idari ve yaratıcı ekibidir. Projelerimizin finansal olarak desteklenmesi, sanayi kuruluşlarıyla kurumsal anlaşmaların yürütülmesi, konferans ve fuar gibi büyük organizasyonların yönetilmesi ve SARGE markasının geniş kitlelere ulaştırılması bu ekip sayesinde gerçekleştirilir.',
    isOpen: true,
    applicationUrl: 'https://forms.google.com'
  });
  const [expoUnit, setExpoUnit] = useState<any>({
    desc: 'Karadeniz Teknik Üniversitesi bünyesinde organize edilen, bölgenin ve üniversitemizin en kapsamlı savunma sanayii ve teknoloji fuarı SARGE EXPO; savunma sanayiimizin lider firmalarını, mühendislik takımlarını ve binlerce ziyaretçiyi bir araya getiriyor. Fuar organizasyon komitesinde görev almak veya firma/bireysel katılımcı olmak için detayları inceleyebilir ve başvuruda bulunabilirsiniz.',
    isOpen: true,
    applicationUrl: 'https://forms.google.com'
  });
  const [footerSections, setFooterSections] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'gallery' | 'projects' | 'home' | 'sponsors' | 'submissions' | 'settings' | 'security' | 'announcements' | 'aboutFooter'>('gallery');
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [activeLockouts, setActiveLockouts] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [visionMission, setVisionMission] = useState({
    vision: '',
    mission: ''
  });
  const [sponsorsData, setSponsorsData] = useState<any[]>([]);
  const [siteSettings, setSiteSettings] = useState({
    logoUrl: '',
    email: 'sarge@ktu.edu.tr',
    phone: '+90 462 377 3000',
    address: 'Karadeniz Teknik Üniversitesi\nMakine Mühendisliği Bölümü\nSARGE Atölyesi, Ortahisar/Trabzon',
    linkedin: 'https://linkedin.com/company/ktusarge',
    instagram: 'https://instagram.com/ktusarge',
    contactTitle: 'İletişim',
    contactDesc: 'Projelerimiz, etkinliklerimiz veya sponsorluk süreçlerimiz hakkında bilgi almak için bizimle iletişime geçebilirsiniz.',
    contactDetailsTitle: 'Atölye & Genel İletişim',
    contactWorkingHours: 'Hafta İçi & Cumartesi: 09:00 - 21:00',
    contactFormTitle: 'Bize Mesaj Gönderin'
  });

  const [siteBanners, setSiteBanners] = useState({
    heroBannerBg: '',
    teamsBannerBg: ''
  });
  const [galleryItems, setGalleryItems] = useState<any[]>([]);

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    summary: '',
    source: 'Anadolu Ajansı',
    sourceUrl: '',
    imageUrl: '',
    category: 'Ulusal Basın',
    date: ''
  });
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  const [newImage, setNewImage] = useState({ title: '', category: 'atolye', imageUrl: '', date: '', location: '', description: '' });
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');

  const [projectsData, setProjectsData] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const getAuthHeaders = (overrideToken?: string) => {
    const token = overrideToken || authToken || sessionStorage.getItem('sargeAdminToken') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Primary server API with automatic Firestore fallback when running on static hosting (e.g. Vercel)
  const postContentDoc = async (docId: string, payload: any) => {
    try {
      const res = await fetch(`/api/admin/content/${docId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        return res;
      }
    } catch {}

    // Direct Firestore fallback (Vercel static hosting)
    await setDoc(doc(db, 'content', docId), payload);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  useEffect(() => {
    // Ensure Firestore content/admin_users is initialized and synced
    syncFirestoreAdmins().catch(() => {});

    const token = sessionStorage.getItem('sargeAdminToken');
    if (token) {
      fetch('/api/admin/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(async res => {
          if (res.status === 404 || res.status === 405 || !res.headers.get('content-type')?.includes('application/json')) {
            if (token.startsWith('fb_admin_')) {
              return { authenticated: true };
            }
            throw new Error('Unauthorized');
          }
          if (!res.ok) throw new Error('Unauthorized');
          return res.json();
        })
        .then(data => {
          if (data && (data.authenticated || data.valid || data.success)) {
            setAuthToken(token);
            setIsAuthenticated(true);
            loadAllData(token);
          } else {
            sessionStorage.removeItem('sargeAdminToken');
            setAuthToken(null);
            setIsAuthenticated(false);
          }
        })
        .catch(() => {
          if (token.startsWith('fb_admin_')) {
            setAuthToken(token);
            setIsAuthenticated(true);
            loadAllData(token);
          } else {
            sessionStorage.removeItem('sargeAdminToken');
            setAuthToken(null);
            setIsAuthenticated(false);
          }
        });
    }
  }, []);

  const loadSpotlights = async () => {
    const snap = await getCachedDoc('content', 'spotlights');
    if (snap.exists() && snap.data().data && snap.data().data.length > 0) setSpotlights(snap.data().data); else setSpotlights([
            { title: "Savaşan İHA", desc: "TEKNOFEST 2023 Savaşan İHA yarışmasında otonom it dalaşı ve hedef tespiti görevlerini başarıyla tamamlayarak finalist oldu.", year: "2023", rank: "Türkiye Finalisti" },
            { title: "Yüksek İrtifa Roket", desc: "3000 metre irtifa hedefine başarıyla ulaşan özgün tasarım roketimiz ile TEKNOFEST 2022'de finale kalma başarı gösterildi.", year: "2022", rank: "Türkiye Finalisti" },
            { title: "TÜBİTAK 2242", desc: "Üniversite Öğrencileri Araştırma Proje Yarışmaları Savunma, Uzay ve Havacılık kategorisinde üstün başarı.", year: "2021", rank: "Bölge 1.si" }
          ]);
  };
  const loadAboutTeams = async () => {
    try {
      let loadedList: any[] | null = null;
      try {
        const res = await fetch('/api/content/about_teams');
        if (res.ok) {
          const json = await res.json();
          const list = json.data || json.teams;
          if (Array.isArray(list) && list.length > 0) {
            loadedList = list;
          }
          if (json.socialUnit && typeof json.socialUnit === 'object') {
            setSocialUnit(json.socialUnit);
          }
          if (json.expoUnit && typeof json.expoUnit === 'object') {
            setExpoUnit(json.expoUnit);
          }
        }
      } catch {}

      if (!loadedList) {
        const snap = await getCachedDoc('content', 'about_teams');
        const raw = snap.exists() ? snap.data() : null;
        const list = raw ? (raw.data || raw.teams) : null;
        if (Array.isArray(list) && list.length > 0) {
          loadedList = list;
        }
        if (raw && raw.socialUnit && typeof raw.socialUnit === 'object') {
          setSocialUnit(raw.socialUnit);
        }
        if (raw && raw.expoUnit && typeof raw.expoUnit === 'object') {
          setExpoUnit(raw.expoUnit);
        }
      }

      if (loadedList && loadedList.length > 0) {
        setAboutTeams(loadedList);
      } else {
        setAboutTeams([
          { 
            id: '1', 
            title: 'ALACA Savaşan İHA Takımı', 
            desc: 'Otonom insansız hava araçları tasarımı ve üretimi.', 
            activeProject: 'ALACA İHA', 
            isOpen: true, 
            applicationUrl: 'https://forms.google.com'
          },
          { 
            id: '2', 
            title: 'GÖKÇEN Roket Takımı', 
            desc: 'Katı yakıtlı yüksek irtifa roket sistemleri.', 
            activeProject: 'GÖKÇEN Roket', 
            isOpen: true, 
            applicationUrl: 'https://forms.google.com'
          },
          { 
            id: '3', 
            title: 'Jet Motoru Takımı', 
            desc: 'Mikro jet motoru çekirdek tasarımı.', 
            activeProject: 'J-01 Turbojet', 
            isOpen: false,
            applicationUrl: ''
          },
          { 
            id: '4', 
            title: 'Elektronik Harp & Radar', 
            desc: 'Anti-drone ve elektronik harp sistemleri.', 
            activeProject: 'EH-Kalkanı', 
            isOpen: true, 
            applicationUrl: 'https://forms.google.com'
          },
        ]);
      }
    } catch (err) {
      console.warn("loadAboutTeams error:", err);
    }
  };
  const loadFooterSections = async () => {
    const snap = await getCachedDoc('content', 'footer_sections');
    const raw = snap.exists() ? snap.data() : null;
    const list = raw ? (raw.data || raw.sections) : null;
    if (Array.isArray(list) && list.length > 0) {
      setFooterSections(list);
    } else {
      setFooterSections([
        { title: 'Takımlarımız:', links: ['ALACA Savaşan İHA Takımı', 'Gökçen Roket Takımı', 'Jet Motoru Takımı', 'Elektronik Harp Takımı', 'Gökçen Su Altı Roket Takımı'] }
      ]);
    }
  };
  const loadAnnouncements = async () => {
    try {
      const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      const anns: any[] = [];
      snap.forEach(d => anns.push({ id: d.id, ...d.data() }));
      setAnnouncements(anns);
    } catch (err) {
      console.warn("Error loading announcements:", err);
    }
  };

  const loadSecurityLogs = async (overrideToken?: string) => {
    setIsLoadingLogs(true);
    try {
      const token = overrideToken || authToken || sessionStorage.getItem('sargeAdminToken');
      if (token) {
        try {
          const res = await fetch('/api/admin/security-logs', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const data = await res.json();
            setSecurityLogs(data.logs || []);
            setActiveLockouts(data.activeLockouts || []);
            return;
          }
        } catch {}
      }

      // Firestore direct load (works on Vercel static hosting)
      const snap = await getDoc(doc(db, 'content', 'security_logs'));
      if (snap.exists() && snap.data()) {
        const d = snap.data();
        const logs = Array.isArray(d.logs) ? d.logs : [];
        const lockoutsObj = d.lockouts && typeof d.lockouts === 'object' ? d.lockouts : {};
        const now = Date.now();
        const activeList: any[] = [];
        Object.entries(lockoutsObj).forEach(([ipKey, rec]: [string, any]) => {
          if (rec && Number(rec.lockedUntil) > now) {
            activeList.push({
              ip: ipKey,
              attempts: Number(rec.attempts) || MAX_LOGIN_ATTEMPTS,
              remainingMinutes: Math.ceil((Number(rec.lockedUntil) - now) / 60000),
              lockedUntil: new Date(Number(rec.lockedUntil)).toLocaleTimeString('tr-TR')
            });
          }
        });
        setSecurityLogs(logs);
        setActiveLockouts(activeList);
      } else {
        setSecurityLogs([]);
        setActiveLockouts([]);
      }
    } catch (err) {
      console.warn("Error loading security logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleUnbanIp = async (ipToUnban: string) => {
    try {
      const token = authToken || sessionStorage.getItem('sargeAdminToken');
      try {
        const res = await fetch('/api/admin/security-unban', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ ip: ipToUnban })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          onShowToast(data.message || 'IP kilidi kaldırıldı.');
          loadSecurityLogs();
          return;
        }
      } catch {}

      // Firestore fallback (Vercel static hosting)
      const refDoc = doc(db, 'content', 'security_logs');
      const snap = await getDoc(refDoc);
      if (snap.exists() && snap.data()) {
        const d = snap.data();
        const lockouts = { ...(d.lockouts || {}) };
        delete lockouts[ipToUnban];
        const logs = Array.isArray(d.logs)
          ? d.logs.map((l: any) => (l.ip === ipToUnban ? { ...l, isLocked: false } : l))
          : [];
        await setDoc(refDoc, {
          ...d,
          logs,
          lockouts,
          _lastUpdated: new Date().toISOString()
        });
      }
      try {
        localStorage.removeItem('sarge_login_lockout');
      } catch {}
      onShowToast(`${ipToUnban} adresinin banı başarıyla kaldırıldı.`);
      loadSecurityLogs();
    } catch {
      onShowToast('Ban kaldırılırken hata oluştu.');
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Tüm güvenlik kayıtlarını temizlemek istediğinize emin misiniz?')) return;
    try {
      const token = authToken || sessionStorage.getItem('sargeAdminToken');
      try {
        const res = await fetch('/api/admin/security-logs', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          onShowToast('Güvenlik kayıtları temizlendi.');
          loadSecurityLogs();
          return;
        }
      } catch {}

      // Firestore fallback (Vercel static hosting)
      await setDoc(doc(db, 'content', 'security_logs'), {
        logs: [],
        lockouts: {},
        _lastUpdated: new Date().toISOString()
      });
      try {
        localStorage.removeItem('sarge_login_lockout');
      } catch {}
      onShowToast('Güvenlik kayıtları temizlendi.');
      loadSecurityLogs();
    } catch {
      onShowToast('İşlem başarısız.');
    }
  };
  const loadVisionMission = async () => {
    const snap = await getCachedDoc('content', 'homepage_vision_mission');
    if (snap.exists() && snap.data()) {
      setVisionMission(snap.data() as any);
    }
  };
  const loadSponsors = async () => {
    const snap = await getCachedDoc('content', 'sponsors');
    if (snap.exists() && snap.data().data && snap.data().data.length > 0) {
      setSponsorsData(snap.data().data);
    }
  };
  const loadSiteBanners = async () => {
    try {
      let bData = { heroBannerBg: '', teamsBannerBg: '' };
      let fetched = false;
      try {
        const res = await fetch('/api/content/site_banners');
        if (res.ok) {
          const json = await res.json();
          if (json && typeof json === 'object' && ('heroBannerBg' in json || 'teamsBannerBg' in json)) {
            bData = {
              heroBannerBg: json.heroBannerBg || '',
              teamsBannerBg: json.teamsBannerBg || ''
            };
            fetched = true;
          }
        }
      } catch {}

      if (!fetched) {
        const snap = await getCachedDoc('content', 'site_banners');
        if (snap.exists() && snap.data()) {
          bData = {
            heroBannerBg: snap.data().heroBannerBg || '',
            teamsBannerBg: snap.data().teamsBannerBg || ''
          };
          fetched = true;
        }
      }

      if (!fetched) {
        const sSnap = await getCachedDoc('content', 'site_settings');
        if (sSnap.exists() && sSnap.data()) {
          bData = {
            heroBannerBg: sSnap.data().heroBannerBg || '',
            teamsBannerBg: sSnap.data().teamsBannerBg || ''
          };
        }
      }

      setSiteBanners(bData);
    } catch (err) {
      console.warn("loadSiteBanners error:", err);
    }
  };

  const loadAllData = (token?: string) => {
    loadGallery();
    loadProjects();
    loadSubmissions(token);
    loadSettings();
    loadSiteBanners();
    loadSponsors();
    loadVisionMission();
    loadSpotlights();
    loadAboutTeams();
    loadFooterSections();
    loadAnnouncements();
    loadSecurityLogs(token);
  };

  const loadSettings = async () => {
    try {
      const snap = await getCachedDoc('content', 'site_settings');
      if (snap.exists() && snap.data()) {
        setSiteSettings(prev => ({ ...prev, ...snap.data() }));
      }
    } catch(err) {
      console.warn(err);
    }
  };
  
  const loadGallery = async () => {
    try {
      const q = query(collection(db, 'gallery'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      setGalleryItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn(err);
    }
  };

  const loadProjects = async () => {
    try {
      const snap = await getCachedDoc('content', 'projects_data');
      if (snap.exists() && snap.data()?.data && Array.isArray(snap.data().data)) {
        setProjectsData(snap.data().data);
      } else {
        setProjectsData([]);
      }
    } catch (err) {
      console.warn(err);
      setProjectsData([]);
    }
  };

  const loadSubmissions = async (tokenOverride?: string) => {
    try {
      const token = tokenOverride || authToken || sessionStorage.getItem('sargeAdminToken');
      if (token) {
        try {
          const res = await fetch('/api/admin/submissions', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const json = await res.json();
            setSubmissions(json.data || []);
            return;
          }
        } catch {}
      }

      // Firestore direct load (works on Vercel static hosting)
      const q = query(collection(db, 'form_submissions'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setSubmissions(list);
    } catch (err) {
      console.warn(err);
    }
  };

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setLoginError(null);

    const userToTest = (customUser !== undefined ? customUser : username).trim();
    const passToTest = (customPass !== undefined ? customPass : password).trim();
    const cleanUser = userToTest.trim();
    const cleanPass = passToTest.trim();

    if (!cleanUser || !cleanPass) {
      setLoginError('Lütfen kullanıcı adı ve şifrenizi giriniz.');
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      // 1. Try backend server API first (Localhost / Node server)
      let handledByServer = false;
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password: cleanPass })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json().catch(() => null);
          if (data && (data.token || data.error)) {
            handledByServer = true;
            if (res.ok && data.token) {
              setAuthToken(data.token);
              sessionStorage.setItem('sargeAdminToken', data.token);
              setIsAuthenticated(true);
              setLoginError(null);
              onShowToast('Giriş başarılı.');
              loadAllData(data.token);
              return;
            } else {
              setLoginError(data.error || 'Hatalı kullanıcı adı veya şifre. Lütfen bilgilerinizi kontrol ediniz.');
              return;
            }
          }
        }
      } catch {}

      if (handledByServer) return;

      // 2. Static Hosting / Vercel Mode: Authenticate directly via Firestore + Web Crypto PBKDF2-SHA256
      const now = Date.now();
      const visitor = await getVisitorIpAndLocation();
      const clientIp = visitor.ip || 'Bilinmeyen-IP';

      const secRef = doc(db, 'content', 'security_logs');
      let secLogs: any[] = [];
      let lockoutsMap: Record<string, { attempts: number; lockedUntil: number; lastAttempt: number }> = {};

      try {
        const secSnap = await getDoc(secRef);
        if (secSnap.exists() && secSnap.data()) {
          const sd = secSnap.data();
          if (Array.isArray(sd.logs)) secLogs = sd.logs;
          if (sd.lockouts && typeof sd.lockouts === 'object') lockoutsMap = { ...sd.lockouts };
        }
      } catch {}

      let localLock: { attempts: number; lockedUntil: number; lastAttempt: number } | null = null;
      try {
        const rawLocal = localStorage.getItem('sarge_login_lockout');
        if (rawLocal) localLock = JSON.parse(rawLocal);
      } catch {}

      const ipRecord = lockoutsMap[clientIp] || localLock || { attempts: 0, lockedUntil: 0, lastAttempt: 0 };
      const effectiveLockedUntil = Math.max(Number(ipRecord.lockedUntil) || 0, Number(localLock?.lockedUntil) || 0);

      if (effectiveLockedUntil > now) {
        const waitMinutes = Math.ceil((effectiveLockedUntil - now) / 60000);
        setLoginError(
          `Çok fazla hatalı giriş denemesi yapıldı. Güvenlik nedeniyle erişiminiz ${waitMinutes} dakika boyunca askıya alınmıştır.`
        );
        return;
      }

      const admins = await syncFirestoreAdmins();
      const matchedAdmin = admins.find(
        (a: any) => a.active !== false && String(a.username || '').toLowerCase() === cleanUser.toLowerCase()
      );

      let isAuthValid = false;
      if (matchedAdmin) {
        const computedHash = await computePbkdf2Hex(cleanPass, String(matchedAdmin.salt || DEFAULT_ADMIN_SALT));
        if (computedHash === String(matchedAdmin.passwordHash || '').toLowerCase()) {
          isAuthValid = true;
        }
      } else {
        // Compute dummy PBKDF2 hash to prevent timing enumeration
        await computePbkdf2Hex(cleanPass, DEFAULT_ADMIN_SALT);
      }

      if (isAuthValid) {
        delete lockoutsMap[clientIp];
        try {
          localStorage.removeItem('sarge_login_lockout');
        } catch {}
        try {
          await setDoc(secRef, {
            logs: secLogs,
            lockouts: lockoutsMap,
            _lastUpdated: new Date().toISOString()
          });
        } catch {}

        const fbToken = `fb_admin_${generateRandomHex(24)}`;
        setAuthToken(fbToken);
        sessionStorage.setItem('sargeAdminToken', fbToken);
        setIsAuthenticated(true);
        setLoginError(null);
        onShowToast('Giriş başarılı.');
        loadAllData(fbToken);
        return;
      }

      // Failed login attempt: increment counter & log security event
      let prevAttempts = Number(ipRecord.attempts) || 0;
      if (ipRecord.lockedUntil && ipRecord.lockedUntil <= now) {
        prevAttempts = 0;
      }
      const currentAttempts = prevAttempts + 1;
      const isLockoutNow = currentAttempts >= MAX_LOGIN_ATTEMPTS;
      const newLockedUntil = isLockoutNow ? now + LOGIN_LOCKOUT_MS : 0;

      const updatedRecord = {
        attempts: currentAttempts,
        lockedUntil: newLockedUntil,
        lastAttempt: now
      };
      lockoutsMap[clientIp] = updatedRecord;
      try {
        localStorage.setItem('sarge_login_lockout', JSON.stringify(updatedRecord));
      } catch {}

      const nowDate = new Date();
      const dateFormatted = nowDate.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const logEntry = {
        id: `sec_${Date.now()}_${generateRandomHex(3)}`,
        ip: clientIp,
        type: isLockoutNow ? 'LOCKOUT' : 'FAILED_ATTEMPT',
        attempts: currentAttempts,
        triedUsername: cleanUser.slice(0, 64),
        userAgent: (navigator.userAgent || 'Bilinmiyor').slice(0, 250),
        location: visitor.location,
        timestamp: nowDate.toISOString(),
        dateFormatted,
        isLocked: isLockoutNow
      };

      const trimmedLogs = [logEntry, ...secLogs].slice(0, 100);
      try {
        await setDoc(secRef, {
          logs: trimmedLogs,
          lockouts: lockoutsMap,
          _lastUpdated: nowDate.toISOString()
        });
      } catch {}

      if (isLockoutNow) {
        setLoginError(
          '5 kez üst üste hatalı giriş denemesi yaptınız! Güvenlik nedeniyle IP adresiniz 15 dakika süreyle kilitlenmiştir.'
        );
      } else {
        const remaining = MAX_LOGIN_ATTEMPTS - currentAttempts;
        setLoginError(`Hatalı kullanıcı adı veya şifre. Kalan deneme hakkı: ${remaining}`);
      }
    } catch (fetchErr) {
      setLoginError('Bağlantı hatası oluştu. Lütfen tekrar deneyiniz.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch {}
    setIsAuthenticated(false);
    setAuthToken(null);
    sessionStorage.removeItem('sargeAdminToken');
    sessionStorage.removeItem('sarge_gate_unlocked');
    sessionStorage.removeItem('sarge_gate_active');
    setUsername('');
    setPassword('');
    onShowToast('Çıkış yapıldı.');
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const url = await uploadToStorage(file);
      callback(url);
      onShowToast("Fotoğraf seçildi ve hazırlandı.");
    } catch(err: any) {
      console.error(err);
      onShowToast(err?.message || "Resim yüklenemedi.");
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImage.imageUrl || !newImage.imageUrl.trim()) {
      onShowToast('Lütfen bir fotoğraf seçin veya görsel URL girin.');
      return;
    }
    setIsLoading(true);
    let saved = false;

    const normalizedImageUrl = formatImageUrl(newImage.imageUrl);
    const payloadImage = {
      ...newImage,
      imageUrl: normalizedImageUrl,
      id: editingImageId
    };

    try {
      clearCache();
      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payloadImage)
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        saved = true;
      }
    } catch {}

    if (!saved) {
      try {
        const docPayload = {
          title: payloadImage.title,
          category: payloadImage.category,
          imageUrl: payloadImage.imageUrl,
          date: payloadImage.date || new Date().toLocaleDateString('tr-TR'),
          location: payloadImage.location || 'KTÜ SARGE',
          description: payloadImage.description || '',
          timestamp: new Date().toISOString()
        };
        if (editingImageId) {
          await setDoc(doc(db, 'gallery', editingImageId), docPayload);
        } else {
          await addDoc(collection(db, 'gallery'), docPayload);
        }
        saved = true;
      } catch (err) {
        console.warn('Firestore gallery save failed:', err);
        onShowToast('Fotoğraf kaydedilirken hata oluştu.');
        setIsLoading(false);
        return;
      }
    }

    if (saved) {
      onShowToast(editingImageId ? 'Fotoğraf başarıyla güncellendi.' : 'Fotoğraf galeriye eklendi.');
      setNewImage({ title: '', category: 'atolye', imageUrl: '', date: '', location: '', description: '' });
      setEditingImageId(null);
      await loadGallery();
    }
    setIsLoading(false);
  };

  const handleDeleteImage = async (id: string) => {
    if (!window.confirm('Bu fotoğrafı silmek istediğinize emin misiniz?')) return;
    setIsLoading(true);
    let deleted = false;
    try {
      clearCache();
      const res = await fetch(`/api/admin/gallery/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        deleted = true;
      }
    } catch {}

    if (!deleted) {
      try {
        await deleteDoc(doc(db, 'gallery', id));
        deleted = true;
      } catch (err) {
        console.warn('Firestore gallery delete failed:', err);
      }
    }

    if (deleted) {
      onShowToast('Fotoğraf silindi.');
      await loadGallery();
    } else {
      onShowToast('Fotoğraf silinirken hata oluştu.');
    }
    setIsLoading(false);
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!window.confirm('Bu başvuruyu silmek istediğinize emin misiniz?')) return;
    try {
      try {
        const res = await fetch(`/api/admin/submissions/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          onShowToast('Başvuru silindi.');
          loadSubmissions();
          return;
        }
      } catch {}

      await deleteDoc(doc(db, 'form_submissions', id));
      onShowToast('Başvuru silindi.');
      loadSubmissions();
    } catch (err) {
      onShowToast('Hata oluştu.');
    }
  };

  // Projects logic
  const handleProjectChange = (index: number, field: string, value: any) => {
    const newProjs = [...projectsData];
    newProjs[index] = { ...newProjs[index], [field]: value };
    if (field === 'fullDesc') {
      newProjs[index].shortDesc = value;
    }
    setProjectsData(newProjs);
  };

  const handleSpecChange = (projIndex: number, specIndex: number, field: 'label' | 'value', value: string) => {
    const newProjs = [...projectsData];
    newProjs[projIndex].specs[specIndex][field] = value;
    setProjectsData(newProjs);
  };

  const handleAddSpec = (projIndex: number) => {
    const newProjs = [...projectsData];
    if(!newProjs[projIndex].specs) newProjs[projIndex].specs = [];
    newProjs[projIndex].specs.push({ label: 'Yeni Etiket', value: 'Yeni Değer' });
    setProjectsData(newProjs);
  };

  const handleRemoveSpec = (projIndex: number, specIndex: number) => {
    const newProjs = [...projectsData];
    newProjs[projIndex].specs.splice(specIndex, 1);
    setProjectsData(newProjs);
  };

  const handleAddProject = () => {
    const newProj = {
      id: 'yeni-proje-' + Date.now(),
      name: 'Yeni Proje',
      category: 'havacilik',
      categoryLabel: 'Havacılık',
      shortDesc: '',
      fullDesc: '',
      image: '',
      code: 'PRJ-NEW',
      status: 'Geliştirme Aşamasında',
      timeline: '2026',
      isFeatured: false,
      specs: [{ label: 'Uçak İsmi', value: 'Bilinmiyor' }]
    };
    setProjectsData([newProj, ...projectsData]);
  };

  const handleDeleteProject = (index: number) => {
    if (!window.confirm('Projeyi silmek istediğinize emin misiniz?')) return;
    const newProjs = [...projectsData];
    newProjs.splice(index, 1);
    setProjectsData(newProjs);
  };

  const optimizeProjectsDataForSave = async (projects: any[]): Promise<any[]> => {
    let currentData = projects.map(p => ({
      ...p,
      shortDesc: (!p.shortDesc || p.shortDesc === 'Kısa açıklama') ? (p.fullDesc || '') : p.shortDesc
    }));
    let serialized = JSON.stringify(currentData);
    
    // Firestore max document size is 1,048,576 bytes. We target safely < 850,000 bytes.
    if (serialized.length <= 850000) {
      return currentData;
    }

    onShowToast('Fotoğraflar 1 MB veritabanı sınırına uygun olarak optimize ediliyor...');

    // Kademe 1: Tüm büyük base64 resimleri 750x550 ve 0.60 kalite ile sıkıştır
    currentData = await Promise.all(
      currentData.map(async (p) => {
        let newImage = p.image;
        if (typeof newImage === 'string' && newImage.startsWith('data:image/')) {
          newImage = await recompressBase64Image(newImage, 750, 550, 0.60);
        }
        let newGallery = Array.isArray(p.gallery) ? [...p.gallery] : [];
        newGallery = await Promise.all(
          newGallery.map(async (g) => {
            if (typeof g === 'string' && g.startsWith('data:image/')) {
              return await recompressBase64Image(g, 750, 550, 0.60);
            }
            return g;
          })
        );
        return { ...p, image: newImage, gallery: newGallery };
      })
    );

    serialized = JSON.stringify(currentData);
    if (serialized.length <= 850000) {
      return currentData;
    }

    // Kademe 2 (Eğer hala 850KB'dan büyükse, örn 10+ adet fotoğraf varsa): 640x480 ve 0.52 kalite
    currentData = await Promise.all(
      currentData.map(async (p) => {
        let newImage = p.image;
        if (typeof newImage === 'string' && newImage.startsWith('data:image/')) {
          newImage = await recompressBase64Image(newImage, 640, 480, 0.52);
        }
        let newGallery = Array.isArray(p.gallery) ? [...p.gallery] : [];
        newGallery = await Promise.all(
          newGallery.map(async (g) => {
            if (typeof g === 'string' && g.startsWith('data:image/')) {
              return await recompressBase64Image(g, 640, 480, 0.52);
            }
            return g;
          })
        );
        return { ...p, image: newImage, gallery: newGallery };
      })
    );

    return currentData;
  };

  const handleSaveProjects = async () => {
    setIsLoading(true);
    try {
      clearCache();
      const safeProjects = await optimizeProjectsDataForSave(projectsData);
      setProjectsData(safeProjects);

      let saved = false;
      try {
        const res = await fetch('/api/admin/content/projects_data', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ data: safeProjects })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const resJson = await res.json().catch(() => null);
          if (resJson?.data && Array.isArray(resJson.data)) {
            setProjectsData(resJson.data);
          }
          saved = true;
        }
      } catch {}

      if (!saved) {
        await setDoc(doc(db, 'content', 'projects_data'), { data: safeProjects });
        saved = true;
      }
      onShowToast('Projeler başarıyla kaydedildi!');
    } catch (err: any) {
      console.error('Save projects error:', err);
      onShowToast('Projeler kaydedilirken hata: ' + (err?.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSpotlights = async () => {
    try {
      clearCache();
      let saved = false;
      try {
        const res = await fetch('/api/admin/content/spotlights', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ data: spotlights })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) saved = true;
      } catch {}

      if (!saved) {
        await setDoc(doc(db, 'content', 'spotlights'), { data: spotlights });
        saved = true;
      }
      onShowToast('Dereceler başarıyla kaydedildi!');
    } catch (err: any) {
      onShowToast('Hata: ' + (err?.message || err));
    }
  };

  const handleTeamImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const url = await uploadToStorage(file);
      
      const nt = [...aboutTeams];
      nt[index].imageUrl = url;
      setAboutTeams(nt);
      onShowToast('Takım fotoğrafı yüklendi!');
    } catch (err) {
      alert("Fotoğraf yüklenirken hata oluştu: " + err);
    }
  };

  const handleSaveAboutTeams = async () => {
    setIsLoading(true);
    try {
      clearCache();
      const cleanBannerBg = siteBanners.teamsBannerBg || '';
      const payload = { 
        data: aboutTeams, 
        teams: aboutTeams, 
        socialUnit: socialUnit,
        expoUnit: expoUnit,
        socialUnits: [socialUnit],
        teamsBannerBg: cleanBannerBg
      };

      await postContentDoc('about_teams', payload);

      // Also ensure site_banners is synced
      await postContentDoc('site_banners', {
        heroBannerBg: siteBanners.heroBannerBg || '',
        teamsBannerBg: cleanBannerBg
      });

      clearCache('content', 'about_teams');
      clearCache('content', 'site_banners');
      clearCache('content', 'site_settings');
      clearCache();

      try {
        if (cleanBannerBg) {
          localStorage.setItem('sarge_teams_banner_bg', cleanBannerBg);
        } else {
          localStorage.removeItem('sarge_teams_banner_bg');
        }
      } catch {}

      onShowToast('Takımlar, başlık arka planı ve tüm değişiklikler kaydedildi!');
    } catch (err: any) {
      onShowToast('Hata: ' + (err?.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const uploadBinaryToServer = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/admin/upload-binary?fileName=${encodeURIComponent(file.name)}`, true);
      
      const token = authToken || sessionStorage.getItem('sargeAdminToken');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgressText(`Yükleniyor (%${percent})...`);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data?.url) {
              resolve(data.url);
            } else {
              reject(new Error(data?.error || 'Sunucu URL dönmedi'));
            }
          } catch (e) {
            reject(new Error('Sunucu yanıtı okunamadı'));
          }
        } else {
          reject(new Error(`Yükleme başarısız (HTTP ${xhr.status})`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Ağ bağlantısı hatası oluştu'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Yükleme zaman aşımına uğradı'));
      };

      xhr.timeout = 180000;
      xhr.send(file);
    });
  };

  const handleBannerMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, bannerKey: 'heroBannerBg' | 'teamsBannerBg') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setUploadProgressText('Yükleme başlatılıyor...');
    try {
      const isVideo = file.type.startsWith('video/') || !!file.name.match(/\.(mp4|webm|mov|ogg)$/i);
      let uploadedUrl = '';

      // 1. Primary: Direct Firebase Cloud Storage Upload (Reliable global CDN, works 100% on Vercel)
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageRef = ref(storage, `banners/${Date.now()}_${cleanName}`);
        
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgressText(`Buluta yükleniyor (%${percent})...`);
            },
            (error) => {
              console.warn('Firebase Storage upload error:', error);
              reject(error);
            },
            async () => {
              try {
                uploadedUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve();
              } catch (urlErr) {
                reject(urlErr);
              }
            }
          );
        });
      } catch (fbErr) {
        console.warn('Firebase Storage upload failed, trying server stream fallback:', fbErr);
      }

      // 2. Fallback: Binary Streaming to Server
      if (!uploadedUrl) {
        try {
          uploadedUrl = await uploadBinaryToServer(file);
        } catch (streamErr) {
          console.warn('Binary stream upload error, trying base64 endpoint...', streamErr);
        }
      }

      // 3. Fallback: Base64 endpoint
      if (!uploadedUrl && isVideo) {
        try {
          const base64Data: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });

          const res = await fetch('/api/admin/upload-media', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              fileName: file.name,
              fileData: base64Data,
              fileType: file.type
            })
          });
          if (res.ok) {
            const json = await res.json();
            if (json?.url) uploadedUrl = json.url;
          }
        } catch (b64Err) {
          console.warn('Base64 upload failed:', b64Err);
        }
      }

      // 4. Fallback for images
      if (!uploadedUrl && !isVideo) {
        uploadedUrl = await uploadToStorage(file);
      }

      if (!uploadedUrl) {
        throw new Error("Dosya yüklenemedi. YouTube video linki kullanabilir veya doğrudan bir MP4 video linki girebilirsiniz.");
      }

      setSiteBanners(prev => ({ ...prev, [bannerKey]: uploadedUrl }));
      setUploadProgressText('');
      onShowToast(isVideo ? 'Video buluta başarıyla yüklendi! "Arka Planı Kaydet" butonuna basarak yayınlayabilirsiniz.' : 'Fotoğraf seçildi! "Arka Planı Kaydet" butonuna basınız.');
    } catch (err: any) {
      console.error('handleBannerMediaUpload error:', err);
      setUploadProgressText('');
      onShowToast("Hata: " + (err?.message || err));
    } finally {
      setIsLoading(false);
      setUploadProgressText('');
      e.target.value = '';
    }
  };

  // Backward compatibility alias
  const handleBannerImageUpload = handleBannerMediaUpload;

  const handleSaveSiteBanners = async () => {
    setIsLoading(true);
    try {
      clearCache();
      const cleanBanners = {
        heroBannerBg: siteBanners.heroBannerBg || '',
        teamsBannerBg: siteBanners.teamsBannerBg || ''
      };

      // Server API only
      await postContentDoc('site_banners', cleanBanners);

      // Also keep siteSettings in sync
      setSiteSettings(prev => ({
        ...prev,
        heroBannerBg: cleanBanners.heroBannerBg,
        teamsBannerBg: cleanBanners.teamsBannerBg
      }));

      await postContentDoc('site_settings', {
        ...siteSettings,
        heroBannerBg: cleanBanners.heroBannerBg,
        teamsBannerBg: cleanBanners.teamsBannerBg
      });

      clearCache('content', 'site_banners');
      clearCache('content', 'site_settings');
      clearCache('content', 'about_teams');
      clearCache();

      try {
        if (cleanBanners.heroBannerBg) {
          localStorage.setItem('sarge_hero_banner_bg', cleanBanners.heroBannerBg);
        } else {
          localStorage.removeItem('sarge_hero_banner_bg');
        }
        if (cleanBanners.teamsBannerBg) {
          localStorage.setItem('sarge_teams_banner_bg', cleanBanners.teamsBannerBg);
        } else {
          localStorage.removeItem('sarge_teams_banner_bg');
        }
      } catch {}

      onShowToast(
        (!cleanBanners.heroBannerBg && !cleanBanners.teamsBannerBg)
          ? 'Arka plan fotoğrafları kaldırıldı ve kaydedildi!'
          : 'Başlık arka planı başarıyla kaydedildi!'
      );
    } catch (err: any) {
      console.error('Save banners error:', err);
      onShowToast('Hata: ' + (err?.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFooterSections = async () => {
    try {
      await postContentDoc('footer_sections', { data: footerSections, sections: footerSections });
      clearCache('content', 'footer_sections');
      clearCache();
      onShowToast('Footer bölümleri başarıyla kaydedildi!');
    } catch (err: any) {
      onShowToast('Hata: ' + (err?.message || err));
    }
  };
  
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleVal = (newAnnouncement.title || '').trim();
    const contentVal = (newAnnouncement.content || newAnnouncement.summary || '').trim();
    const summaryVal = (newAnnouncement.summary || newAnnouncement.content || '').trim();
    const dateVal = (newAnnouncement.date || '').trim() || new Date().toISOString().split('T')[0];
    if (!titleVal || (!contentVal && !summaryVal)) return;
    
    setIsLoading(true);
    const annData = {
      title: titleVal,
      content: contentVal,
      summary: summaryVal,
      source: (newAnnouncement.source || 'Basın Bülteni').trim(),
      sourceUrl: (newAnnouncement.sourceUrl || '').trim(),
      imageUrl: (newAnnouncement.imageUrl || '').trim(),
      category: (newAnnouncement.category || 'Ulusal Basın').trim(),
      date: dateVal,
      timestamp: new Date().toISOString()
    };

    let saved = false;
    let savedId = '';

    try {
      clearCache();
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(annData)
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json().catch(() => null);
        savedId = data?.id || '';
        saved = true;
      }
    } catch {}

    if (!saved) {
      try {
        const refAdded = await addDoc(collection(db, 'announcements'), annData);
        savedId = refAdded.id;
        saved = true;
      } catch (err) {
        console.warn('Firestore announcement save error:', err);
      }
    }

    setIsLoading(false);

    if (saved) {
      setAnnouncements([{ id: savedId || Date.now().toString(), ...annData }, ...announcements]);
      setNewAnnouncement({
        title: '',
        content: '',
        summary: '',
        source: 'Anadolu Ajansı',
        sourceUrl: '',
        imageUrl: '',
        category: 'Ulusal Basın',
        date: ''
      });
      setShowAnnouncementForm(false);
      onShowToast('Basın haberi / duyuru başarıyla eklendi.');
      loadAnnouncements();
    } else {
      onShowToast('Haber eklenirken hata oluştu.');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
    setIsLoading(true);
    let deleted = false;

    try {
      clearCache();
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        deleted = true;
      }
    } catch {}

    if (!deleted) {
      try {
        await deleteDoc(doc(db, 'announcements', id));
        deleted = true;
      } catch (err) {
        console.warn('Firestore announcement delete error:', err);
      }
    }

    setIsLoading(false);

    if (deleted) {
      setAnnouncements(announcements.filter(a => a.id !== id));
      onShowToast('Duyuru silindi.');
    } else {
      onShowToast('Duyuru silinirken hata oluştu.');
    }
  };

  const handleSaveVisionMission = async () => {
    try {
      clearCache();
      await postContentDoc('homepage_vision_mission', visionMission);
      onShowToast('Vizyon / Misyon kaydedildi!');
    } catch (err: any) {
      onShowToast('Hata: ' + (err?.message || err));
    }
  };

  const handleSaveSettings = async () => {
    try {
      clearCache();
      await postContentDoc('site_settings', siteSettings);
      onShowToast('Site ayarları kaydedildi!');
    } catch (err: any) {
      onShowToast('Hata: ' + (err?.message || err));
    }
  };

  const handleSaveSponsors = async () => {
    try {
      clearCache();
      await postContentDoc('sponsors', { data: sponsorsData });
      onShowToast('Sponsorlar başarıyla kaydedildi!');
    } catch (err: any) {
      onShowToast('Hata: ' + (err?.message || err));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="py-24 px-4 min-h-[70vh] flex items-center justify-center bg-[#09090b]">
        <div className="bg-[#18181b] p-8 rounded-2xl border border-[#27272a] max-w-md w-full shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="bg-white/10 p-4 rounded-full border border-zinc-500/20 text-zinc-300">
              <Lock className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2 font-sans">SARGE Yönetici Girişi</h2>
          <p className="text-xs text-center text-slate-400 mb-6">Yönetim paneline erişmek için lütfen yetkili kullanıcı adı ve şifrenizi giriniz.</p>
          
          {loginError && (
            <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs leading-relaxed text-center">
              {loginError}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[#94A3B8] text-sm mb-1.5 font-medium">Kullanıcı Adı</label>
              <input
                type="text"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  if (loginError) setLoginError(null);
                }}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                placeholder="Kullanıcı adınızı girin"
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-3 text-white focus:border-zinc-400 outline-none text-sm placeholder:text-zinc-600 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[#94A3B8] text-sm mb-1.5 font-medium">Şifre</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="current-password"
                  placeholder="Şifrenizi girin"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-3 pr-11 text-white focus:border-zinc-400 outline-none text-sm placeholder:text-zinc-600 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/40 text-sm mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Giriş Yap</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#27272a] text-center space-y-3">
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem('sarge_gate_active');
                sessionStorage.removeItem('sarge_gate_unlocked');
                window.location.href = '/';
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 rounded-xl transition-all border border-zinc-700/50 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Normal Siteye Geri Dön
            </button>
            <p className="text-[11px] text-zinc-500">
              Bu alan yalnızca yetkili yöneticilere açıktır.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 bg-[#09090b] text-[#E2E8F0] min-h-screen">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
          <div className="flex items-center gap-4 mb-4 sm:mb-0">
            <div className="bg-white/10 p-3 rounded-lg border border-zinc-500/30">
              <Settings className="w-6 h-6 text-zinc-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-sans">SARGE Yönetim</h1>
              <p className="text-sm text-[#94A3B8]">Yetkili Girişi Yapıldı</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sessionStorage.removeItem('sarge_gate_active');
                sessionStorage.removeItem('sarge_gate_unlocked');
                window.location.href = '/';
              }}
              className="flex items-center gap-2 bg-zinc-800 text-zinc-300 border border-zinc-700/80 px-4 py-2 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors text-sm cursor-pointer"
            >
              <Globe className="w-4 h-4" /> Normal Siteye Dön
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-colors text-sm cursor-pointer">
              <LogOut className="w-4 h-4" /> Çıkış Yap
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => setActiveTab('gallery')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'gallery' ? 'bg-white text-zinc-950 font-bold' : 'bg-[#18181b] text-[#94A3B8] hover:bg-[#27272a]'}`}>
            <ImageIcon className="w-4 h-4" /> Galeri
          </button>
          <button onClick={() => setActiveTab('projects')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'projects' ? 'bg-white text-zinc-950 font-bold' : 'bg-[#18181b] text-[#94A3B8] hover:bg-[#27272a]'}`}>
            <Database className="w-4 h-4" /> Takımlar & Projeler
          </button>
          <button onClick={() => setActiveTab('home')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'home' ? 'bg-white text-zinc-950 font-bold' : 'bg-[#18181b] text-[#94A3B8] hover:bg-[#27272a]'}`}>
            <Home className="w-4 h-4" /> Anasayfa (Vizyon/Misyon)
          </button>
          
          <button onClick={() => setActiveTab('sponsors')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'sponsors' ? 'bg-white text-zinc-950 font-bold' : 'bg-[#18181b] text-[#94A3B8] hover:bg-[#27272a]'}`}>
            <Award className="w-4 h-4" /> Sponsorlar
          </button>
          <button onClick={() => setActiveTab('announcements')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'announcements' ? 'bg-white text-zinc-950 font-bold' : 'bg-[#18181b] text-[#94A3B8] hover:bg-[#27272a]'}`}>
            <Newspaper className="w-4 h-4" /> Basında Biz & Haberler
          </button>
          <button onClick={() => setActiveTab('aboutFooter')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'aboutFooter' ? 'bg-white text-zinc-950 font-bold' : 'bg-[#18181b] text-[#94A3B8] hover:bg-[#27272a]'}`}>
            <Layers className="w-4 h-4 text-zinc-300" /> Bize Katılın & Takımlar
          </button>
<button onClick={() => setActiveTab('submissions')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'submissions' ? 'bg-white text-zinc-950 font-bold' : 'bg-[#18181b] text-[#94A3B8] hover:bg-[#27272a]'}`}>
            <MessageSquare className="w-4 h-4" /> Başvurular
          </button>

          <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'settings' ? 'bg-white text-zinc-950 font-bold' : 'bg-[#18181b] text-[#94A3B8] hover:bg-[#27272a]'}`}>
            <Settings className="w-4 h-4" /> Site Ayarları
          </button>

          <button onClick={() => { setActiveTab('security'); loadSecurityLogs(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors relative ${activeTab === 'security' ? 'bg-red-600 text-white font-bold shadow-lg shadow-red-600/30' : 'bg-[#18181b] text-[#94A3B8] hover:bg-[#27272a]'}`}>
            <ShieldAlert className={`w-4 h-4 ${activeTab === 'security' ? 'text-white' : 'text-red-400'}`} /> Güvenlik & Ban Günlüğü
            {activeLockouts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-red-500 text-white font-bold rounded-full animate-pulse">
                {activeLockouts.length} Banlı
              </span>
            )}
          </button>
        </div>

        {activeTab === 'gallery' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-[#18181b] p-6 rounded-2xl border border-[#27272a] h-fit">
              <div className="flex justify-between items-center mb-4 border-b border-[#27272a] pb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">{editingImageId ? "Fotoğraf Güncelle" : "Fotoğraf Ekle"}</h2>
              </div>
              <form onSubmit={handleAddImage} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Fotoğraf Yükle veya Bağlantı Gir</label>
                  
                  {newImage.imageUrl ? (
                    <div className="space-y-2">
                      <div className="relative rounded-xl overflow-hidden h-36 border border-[#27272a] bg-black group">
                        <img 
                          src={formatImageUrl(newImage.imageUrl)} 
                          alt="Preview" 
                          className="w-full h-full object-contain" 
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageFallback(e, newImage.imageUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => setNewImage({ ...newImage, imageUrl: '' })}
                          className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs"
                          title="Fotoğrafı Kaldır"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Kaldır</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-400 font-medium">✓ Fotoğraf başarıyla yüklendi ve hazır.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#27272a] hover:border-zinc-500/60 rounded-xl p-4 cursor-pointer bg-[#09090b] hover:bg-[#18181b] transition-all text-center">
                        <Upload className="w-6 h-6 text-zinc-300 mb-1" />
                        <span className="text-xs font-semibold text-white">Bilgisayardan / Telefondan Seç</span>
                        <span className="text-[10px] text-[#94A3B8] mt-0.5">JPG, PNG, WebP (Otomatik optimize edilir)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileChange(e, (url) => setNewImage({ ...newImage, imageUrl: url }))}
                        />
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">veya</span>
                        <input
                          type="url"
                          placeholder="Görsel URL veya Drive Linki Yapıştır"
                          value={newImage.imageUrl}
                          onChange={(e) => setNewImage({ ...newImage, imageUrl: e.target.value })}
                          className="flex-1 bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-[#64748B] focus:border-zinc-400 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">Başlık</label>
                  <input required type="text" value={newImage.title} onChange={e => setNewImage({...newImage, title: e.target.value})} placeholder="Örn: SARGE Göktuğ İHA Test Uçuşu" className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">Tarih</label>
                    <input type="date" value={newImage.date} onChange={e => setNewImage({...newImage, date: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">Konum</label>
                    <input type="text" value={newImage.location} placeholder="Örn: Trabzon / KTÜ" onChange={e => setNewImage({...newImage, location: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">Kategori</label>
                  <select value={newImage.category} onChange={e => setNewImage({...newImage, category: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none">
                    <option value="atolye">Atölye Çalışmaları</option>
                    <option value="expo">SARGE EXPO</option>
                    <option value="saha">Saha & Test</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={isLoading} className="flex-1 bg-white hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                    {isLoading ? (
                      <span className="text-xs">İşleniyor...</span>
                    ) : editingImageId ? (
                      <><Edit3 className="w-4 h-4" /> Güncelle</>
                    ) : (
                      <><Plus className="w-4 h-4" /> Galeriye Ekle</>
                    )}
                  </button>
                  {editingImageId && (
                    <button type="button" onClick={() => { setEditingImageId(null); setNewImage({ title: '', category: 'atolye', imageUrl: '', date: '', location: '', description: '' }); }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                      <X className="w-4 h-4" /> İptal
                    </button>
                  )}
                </div>
              </form>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {galleryItems.map(item => (
                <div key={item.id} className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden group">
                  <div className="aspect-video w-full bg-black relative">
                    <img 
                      src={formatImageUrl(item.imageUrl)} 
                      alt={item.title} 
                      className="w-full h-full object-cover opacity-80" 
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageFallback(e, item.imageUrl)}
                    />
                    <button onClick={() => { setEditingImageId(item.id); setNewImage(item); window.scrollTo({top:0, behavior:'smooth'}); }} className="absolute top-2 right-12 bg-white text-zinc-950 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" title="Düzenle"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteImage(item.id)} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4"><h3 className="text-white font-bold text-sm truncate">{item.title}</h3><p className="text-xs text-[#94A3B8] truncate">{item.category}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
            <div className="flex justify-between items-center mb-6 border-b border-[#27272a] pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-zinc-300" />
                Takımlar ve Proje Verileri
              </h2>
              <div className="flex gap-2">
                <button onClick={handleAddProject} className="bg-[#27272a] hover:bg-[#2B364E] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors">
                  <Plus className="w-4 h-4" /> Yeni Ekle
                </button>
                <button onClick={handleSaveProjects} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors">
                  <Check className="w-4 h-4" /> Değişiklikleri Kaydet
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              {projectsData.map((proj, index) => (
                <div key={index} className="bg-[#09090b] p-5 rounded-xl border border-[#27272a] relative">
                  <button onClick={() => handleDeleteProject(index)} className="absolute top-4 right-4 text-[#94A3B8] hover:text-red-400 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">Proje/Takım Adı</label>
                        <input type="text" value={proj.name} onChange={e => handleProjectChange(index, 'name', e.target.value)} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-[#94A3B8] mb-1">Kategori (ID)</label>
                          <input type="text" value={proj.category} onChange={e => handleProjectChange(index, 'category', e.target.value)} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs text-[#94A3B8] mb-1">Kategori Etiketi</label>
                          <input type="text" value={proj.categoryLabel} onChange={e => handleProjectChange(index, 'categoryLabel', e.target.value)} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                        </div>
                      </div>
                      <div className={`p-3.5 rounded-xl border transition-all ${proj.isFeatured ? 'bg-zinc-800/80 border-zinc-400' : 'bg-[#18181b] border-[#27272a]'}`}>
                        <label htmlFor={`featured-${index}`} className="flex items-center gap-3 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={!!proj.isFeatured} 
                            onChange={e => handleProjectChange(index, 'isFeatured', e.target.checked)} 
                            id={`featured-${index}`}
                            className="w-5 h-5 rounded border-gray-600 text-white focus:ring-zinc-400/20 bg-[#09090b] cursor-pointer"
                          />
                          <div>
                            <span className="text-sm font-bold text-white flex items-center gap-2">
                              Ana Sayfa Vitrininde Göster (Öne Çıkar)
                              {proj.isFeatured && (
                                <span className="text-[10px] bg-white text-zinc-950 font-extrabold px-2 py-0.5 rounded">
                                  VİTRİNDE AKTİF
                                </span>
                              )}
                            </span>
                            <p className="text-xs text-[#94A3B8] mt-0.5">
                              İşaretlendiğinde bu proje ana sayfadaki vitrin bölümünde sergilenir.
                            </p>
                          </div>
                        </label>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">Proje Hakkında</label>
                        <textarea value={proj.fullDesc} onChange={e => handleProjectChange(index, 'fullDesc', e.target.value)} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" rows={2} />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-300 font-bold mb-1">Proje Hikayesi (Tıklanınca Açılan)</label>
                        <textarea value={proj.story || ''} onChange={e => handleProjectChange(index, 'story', e.target.value)} className="w-full bg-[#18181b] border border-sky-900 rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" rows={5} placeholder="Projenin geçmişini, hikayesini buraya yazın..." />
                      </div>
                    </div>
                    <div className="space-y-4">
                      {/* Unified Photos & Gallery Management */}
                      <div className="p-4 rounded-xl border border-[#27272a] bg-[#121215] space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <label className="block text-sm font-bold text-white flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-zinc-300" />
                              Proje Fotoğrafları & Galerisi
                            </label>
                            <p className="text-[11px] text-[#94A3B8] mt-0.5">
                              Tek seferde birden fazla fotoğraf seçebilirsiniz. 1 MB sınırına göre optimize edilerek kaydedilir.
                            </p>
                          </div>
                          {(() => {
                            const totalCount = [proj.image, ...(proj.gallery || [])].filter((u): u is string => Boolean(u && u.trim())).length;
                            return (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-950 text-zinc-200 border border-sky-800/60">
                                {totalCount} Fotoğraf
                              </span>
                            );
                          })()}
                        </div>

                        {/* Multi-file Upload Dropzone */}
                        <div>
                          <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-500/40 hover:border-sky-400 bg-sky-500/5 hover:bg-white/10 rounded-xl p-4 cursor-pointer transition-all text-center group">
                            <Upload className="w-6 h-6 text-zinc-300 group-hover:scale-110 transition-transform mb-1.5" />
                            <span className="text-xs sm:text-sm font-bold text-white group-hover:text-zinc-200">
                              Fotoğrafları Seç (Birden Fazla Seçebilirsiniz)
                            </span>
                            <span className="text-[11px] text-[#94A3B8] mt-0.5">
                              Fotoğraflar otomatik optimize edilerek projeye eklenir
                            </span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []) as File[];
                                if (files.length === 0) return;
                                setIsLoading(true);
                                try {
                                  const urls = await Promise.all(files.map(f => uploadToStorage(f)));
                                  let newCover = proj.image;
                                  let newGallery = [...(proj.gallery || [])];

                                  urls.forEach((url) => {
                                    if (!newCover || newCover.trim() === '') {
                                      newCover = url;
                                    } else if (!newGallery.includes(url) && url !== newCover) {
                                      newGallery.push(url);
                                    }
                                  });

                                  const updated = [...projectsData];
                                  updated[index] = {
                                    ...proj,
                                    image: newCover,
                                    gallery: newGallery
                                  };
                                  setProjectsData(updated);
                                  onShowToast(`${files.length} fotoğraf başarıyla optimize edilerek eklendi.`);
                                } catch (err: any) {
                                  console.error(err);
                                  onShowToast("Fotoğraf yükleme hatası: " + (err?.message || err));
                                } finally {
                                  setIsLoading(false);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                        </div>

                        {/* Or URL input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            id={`proj-url-${index}`}
                            placeholder="veya Görsel URL'si ekle (https://...)"
                            className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-zinc-400 outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.currentTarget;
                                const rawVal = input.value.trim();
                                if (!rawVal) return;
                                const val = formatImageUrl(rawVal);
                                const newCover = (!proj.image || proj.image.trim() === '') ? val : proj.image;
                                const newGallery = newCover === val ? (proj.gallery || []) : [...(proj.gallery || []), val];
                                const updated = [...projectsData];
                                updated[index] = { ...proj, image: newCover, gallery: newGallery };
                                setProjectsData(updated);
                                input.value = '';
                                onShowToast('Görsel URL eklendi.');
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(`proj-url-${index}`) as HTMLInputElement;
                              const rawVal = input?.value.trim();
                              if (!rawVal) return;
                              const val = formatImageUrl(rawVal);
                              const newCover = (!proj.image || proj.image.trim() === '') ? val : proj.image;
                              const newGallery = newCover === val ? (proj.gallery || []) : [...(proj.gallery || []), val];
                              const updated = [...projectsData];
                              updated[index] = { ...proj, image: newCover, gallery: newGallery };
                              setProjectsData(updated);
                              input.value = '';
                              onShowToast('Görsel URL eklendi.');
                            }}
                            className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                          >
                            URL Ekle
                          </button>
                        </div>

                        {/* Photos Grid Display */}
                        {(() => {
                          const allImgs: string[] = [];
                          if (proj.image && proj.image.trim() !== '') allImgs.push(proj.image);
                          if (proj.gallery && Array.isArray(proj.gallery)) {
                            proj.gallery.forEach((g) => {
                              if (g && g.trim() !== '' && !allImgs.includes(g)) {
                                allImgs.push(g);
                              }
                            });
                          }

                          if (allImgs.length === 0) {
                            return (
                              <div className="flex flex-col items-center justify-center p-5 rounded-lg border border-dashed border-[#27272a] bg-[#09090b] text-center">
                                <ImageIcon className="w-8 h-8 text-slate-600 mb-1.5" />
                                <span className="text-xs text-[#94A3B8]">Henüz fotoğraf eklenmedi.</span>
                                <span className="text-[11px] text-slate-500 mt-0.5">Yukarıdaki alandan tek veya çoklu fotoğraf yükleyebilirsiniz.</span>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
                                <span>Yüklenen Fotoğraflar ({allImgs.length}):</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...projectsData];
                                      updated[index] = { ...proj, image: '', gallery: [] };
                                      setProjectsData(updated);
                                      onShowToast('Bu projedeki tüm fotoğraflar kaldırıldı. "Değişiklikleri Kaydet" butonuna basarak fotoğrafsız olarak kaydedebilirsiniz.');
                                    }}
                                    className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Tüm fotoğrafları silip projeyi fotoğrafsız bırak"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Tüm Fotoğrafları Kaldır</span>
                                  </button>
                                  <span className="text-slate-400 hidden sm:inline">• "Kapak Yap" ile ana görseli belirleyebilirsiniz</span>
                                </div>
                              </div>
                              <div className="bg-sky-950/30 border border-sky-800/40 rounded-lg p-2.5 text-[11px] text-zinc-200 flex items-center justify-between gap-2">
                                <span><strong>Yüksek Kalite:</strong> Yüklenen görseller optimize edilerek işlenir. İstediğiniz fotoğrafı silebilir veya projeyi fotoğrafsız kaydedebilirsiniz.</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1">
                                {allImgs.map((imgUrl, imgIdx) => {
                                  const isCover = imgUrl === proj.image;
                                  return (
                                    <div key={imgIdx} className={`relative rounded-lg overflow-hidden border aspect-video bg-black group transition-all ${isCover ? 'border-emerald-500/80 ring-2 ring-emerald-500/30' : 'border-[#27272a] hover:border-slate-500'}`}>
                                      <img 
                                        src={formatImageUrl(imgUrl)} 
                                        alt="Project photo" 
                                        className="w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                        onError={(e) => handleImageFallback(e, imgUrl)}
                                      />
                                      
                                      {/* Cover Badge */}
                                      {isCover ? (
                                        <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5 z-10">
                                          <Star className="w-2.5 h-2.5 fill-current" /> Kapak
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...projectsData];
                                            const remaining = allImgs.filter(u => u !== imgUrl);
                                            updated[index] = {
                                              ...proj,
                                              image: imgUrl,
                                              gallery: remaining
                                            };
                                            setProjectsData(updated);
                                            onShowToast('Kapak fotoğrafı güncellendi.');
                                          }}
                                          className="absolute top-1 left-1 bg-black/70 hover:bg-white text-zinc-950 text-[9px] font-medium px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        >
                                          Kapak Yap
                                        </button>
                                      )}

                                      {/* Order Reorder Arrow Buttons */}
                                      <div className="absolute bottom-1 left-1 flex items-center gap-1 z-10">
                                        {imgIdx > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newImgs = [...allImgs];
                                              const temp = newImgs[imgIdx];
                                              newImgs[imgIdx] = newImgs[imgIdx - 1];
                                              newImgs[imgIdx - 1] = temp;
                                              const updated = [...projectsData];
                                              updated[index] = {
                                                ...proj,
                                                image: newImgs[0],
                                                gallery: newImgs.slice(1)
                                              };
                                              setProjectsData(updated);
                                              onShowToast('Fotoğraf sola taşındı.');
                                            }}
                                            className="bg-black/80 hover:bg-white text-zinc-950 p-1 rounded shadow text-[10px] transition-colors"
                                            title="Önceki Sıraya Taşı (Sola)"
                                          >
                                            <ChevronLeft className="w-3 h-3" />
                                          </button>
                                        )}
                                        {imgIdx < allImgs.length - 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newImgs = [...allImgs];
                                              const temp = newImgs[imgIdx];
                                              newImgs[imgIdx] = newImgs[imgIdx + 1];
                                              newImgs[imgIdx + 1] = temp;
                                              const updated = [...projectsData];
                                              updated[index] = {
                                                ...proj,
                                                image: newImgs[0],
                                                gallery: newImgs.slice(1)
                                              };
                                              setProjectsData(updated);
                                              onShowToast('Fotoğraf sağa taşındı.');
                                            }}
                                            className="bg-black/80 hover:bg-white text-zinc-950 p-1 rounded shadow text-[10px] transition-colors"
                                            title="Sonraki Sıraya Taşı (Sağa)"
                                          >
                                            <ChevronRight className="w-3 h-3" />
                                          </button>
                                        )}
                                        <span className="bg-black/70 text-slate-300 text-[9px] px-1 py-0.5 rounded font-mono">
                                          #{imgIdx + 1}
                                        </span>
                                      </div>

                                      {/* Delete Button */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...projectsData];
                                          const remaining = allImgs.filter(u => u !== imgUrl);
                                          updated[index] = {
                                            ...proj,
                                            image: isCover ? (remaining[0] || '') : (remaining.length === 0 ? '' : proj.image),
                                            gallery: isCover ? (remaining.slice(1) || []) : (proj.gallery || []).filter(u => u !== imgUrl)
                                          };
                                          setProjectsData(updated);
                                          onShowToast(remaining.length === 0 ? 'Fotoğraf kaldırıldı. Proje fotoğrafsız olarak kaydedilebilir.' : 'Fotoğraf silindi.');
                                        }}
                                        className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        title="Fotoğrafı Kaldır"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-[#94A3B8] mb-1">Durum</label>
                          <input type="text" value={proj.status} onChange={e => handleProjectChange(index, 'status', e.target.value)} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs text-[#94A3B8] mb-1">Kod / Yıl</label>
                          <input type="text" value={proj.code} onChange={e => handleProjectChange(index, 'code', e.target.value)} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-[#94A3B8] mb-1">Başarı / Etiket (Sarı İkonlu)</label>
                          <input type="text" value={proj.achievement || ''} onChange={e => handleProjectChange(index, 'achievement', e.target.value)} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs text-[#94A3B8] mb-1">Yarışma</label>
                          <input type="text" value={proj.competition || ''} onChange={e => handleProjectChange(index, 'competition', e.target.value)} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs text-[#94A3B8]">Teknik Özellikler (Uçak İsmi, Seyir Hızı vb.)</label>
                          <button onClick={() => handleAddSpec(index)} className="text-xs text-zinc-300 hover:text-zinc-200 font-bold">+ Özellik Ekle</button>
                        </div>
                        <div className="space-y-2">
                          {proj.specs?.map((spec: any, sIndex: number) => (
                            <div key={sIndex} className="flex gap-2">
                              <input type="text" placeholder="Etiket (Örn: Seyir Hızı)" value={spec.label} onChange={e => handleSpecChange(index, sIndex, 'label', e.target.value)} className="w-1/3 bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                              <input type="text" placeholder="Değer (Örn: 20 m/s)" value={spec.value} onChange={e => handleSpecChange(index, sIndex, 'value', e.target.value)} className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                              <button onClick={() => handleRemoveSpec(index, sIndex)} className="px-3 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"><X className="w-4 h-4" /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'home' && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Ana Sayfa KTÜ SARGE Başlık Arka Plan Fotoğrafı veya Videosu */}
            <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#27272a] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-zinc-300" />
                    KTÜ SARGE Başlık Arka Planı (Fotoğraf veya Video)
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Ana sayfadaki büyük &ldquo;KTÜ SARGE&rdquo; başlığının arkasına döngüsel (loop) oynayan video (MP4/WebM) veya fotoğraf ekleyin. Video otomatik ve sessiz olarak sürekli döner. Yazıların net okunması için zarif bir koyu gradyan uygulanır.
                  </p>
                </div>
                <button 
                  onClick={handleSaveSiteBanners} 
                  disabled={isLoading}
                  className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-black/40 shrink-0 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Arka Planı Kaydet
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <input
                    type="text"
                    value={siteBanners.heroBannerBg || ''}
                    onChange={(e) => setSiteBanners(prev => ({ ...prev, heroBannerBg: e.target.value }))}
                    placeholder="Google Drive linki, YouTube linki, MP4/WebM URL'si veya dosya seçin..."
                    className="w-full sm:flex-1 bg-[#09090b] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 font-mono"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-zinc-200 border border-zinc-500/30 px-4 py-2.5 rounded-xl cursor-pointer text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <Upload className="w-4 h-4" />
                      <span>Video / Fotoğraf Seç</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,.mp4,.webm,.mov"
                        onChange={(e) => handleBannerMediaUpload(e, 'heroBannerBg')}
                      />
                    </label>
                    {siteBanners.heroBannerBg && (
                      <button
                        type="button"
                        onClick={() => {
                          setSiteBanners(prev => ({ ...prev, heroBannerBg: '' }));
                          onShowToast('Ana sayfa arka plan fotoğrafı/videosu kaldırıldı. "Arka Planı Kaydet" butonuna basarak fotoğrafsız kaydedebilirsiniz.');
                        }}
                        className="bg-red-500/15 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Fotoğrafı / Medyayı Kaldır"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Fotoğrafı / Medyayı Kaldır</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Helpful tips for Video & Photo Sources */}
                <div className="bg-[#18181b]/95 border border-[#27272a] rounded-xl p-3.5 text-[11px] text-slate-300 space-y-2">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hangi Medya Formatları Desteklenir ve Otomatik Oynatılır?</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li><strong className="text-red-400">YouTube (En Kolay & En Hızlı):</strong> YouTube linkini yapıştırmanız yeterlidir (örn: <code className="text-zinc-300">https://youtu.be/...</code>). Vercel ve tüm tarayıcılarda anında sessiz döngüde otomatik oynatılır.</li>
                    <li><strong className="text-emerald-400">Doğrudan Video Dosyası Yükleme:</strong> <span className="text-white font-semibold">&ldquo;Video / Fotoğraf Seç&rdquo;</span> butonuna basarak bilgisayarınızdan <code className="text-zinc-300">.mp4</code> videonuzu seçin. Video güvenli Firebase bulut sunucusuna yüklenir ve Vercel dahil her yerde 7/24 otomatik oynar.</li>
                    <li><strong className="text-amber-400">Google Drive Hakkında:</strong> Google, güvenlik kısıtlamaları nedeniyle Drive video önizleme oynatıcısının harici sitelerde otomatik başlamasını (autoplay) engellemektedir ve ziyaretçiye kapak resmi gösterir. Bu nedenle <strong>YouTube linki</strong> veya <strong>&ldquo;Video / Fotoğraf Seç&rdquo;</strong> ile doğrudan yükleme yapmanız tavsiye edilir.</li>
                  </ul>
                </div>

                {/* Upload progress indicator */}
                {uploadProgressText && (
                  <div className="bg-blue-500/15 border border-blue-500/40 rounded-xl p-3.5 flex items-center gap-3 text-xs text-blue-300 shadow-sm animate-pulse">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
                    <span className="font-semibold">{uploadProgressText}</span>
                  </div>
                )}

                {/* Quick Presets & Test Videos */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-400">Hızlı Seçimler:</span>
                  <button
                    type="button"
                    onClick={() => setSiteBanners(prev => ({ ...prev, heroBannerBg: '/hero-bg.mp4' }))}
                    className="text-[11px] bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-mono"
                    title="public/hero-bg.mp4 dosyasını kullanır"
                  >
                    public/hero-bg.mp4 (Yerel Proje Dosyası)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSiteBanners(prev => ({ ...prev, heroBannerBg: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' }))}
                    className="text-[11px] bg-[#18181b] hover:bg-[#27272a] text-blue-300 border border-blue-900/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Örnek MP4 Video
                  </button>
                </div>

                {/* Real-time Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-[#27272a] bg-[#09090b] h-48 sm:h-56 flex flex-col items-center justify-center text-center p-6 select-none shadow-inner">
                  {siteBanners.heroBannerBg ? (
                    <>
                      <BackgroundMedia url={siteBanners.heroBannerBg} alt="Hero Preview" />
                      
                      {/* Media type badge */}
                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur border border-white/10 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 z-20">
                        {(() => {
                          const media = parseBackgroundMedia(siteBanners.heroBannerBg);
                          if (media.type === 'drive') return <><Film className="w-3 h-3 text-amber-400" /> <span>Google Drive Video</span></>;
                          if (media.type === 'youtube') return <><Film className="w-3 h-3 text-red-400" /> <span>YouTube Video</span></>;
                          if (media.type === 'vimeo') return <><Film className="w-3 h-3 text-purple-400" /> <span>Vimeo Video</span></>;
                          if (media.type === 'video') return <><Film className="w-3 h-3 text-blue-400" /> <span>Döngüsel Video (Loop)</span></>;
                          return <><ImageIcon className="w-3 h-3 text-emerald-400" /> <span>Fotoğraf</span></>;
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-[#18181b]/70 flex flex-col items-center justify-center text-slate-500 text-xs">
                      <Film className="w-8 h-8 text-zinc-600 mb-1 opacity-50" />
                      <span>Şu an varsayılan koyu arka plan devrede (Video veya Fotoğraf seçilmedi)</span>
                    </div>
                  )}

                  <div className="relative z-10 space-y-2">
                    <span className="text-2xl sm:text-4xl font-black text-white tracking-tighter uppercase font-sans drop-shadow-md">
                      KTÜ SARGE
                    </span>
                    <p className="text-[11px] sm:text-xs text-[#94A3B8] font-medium max-w-md">
                      Geleceğin Savunma Teknolojileri • Canlı Önizleme
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ana Sayfa Vitrin Projeleri (Öne Çıkanlar) */}
            <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-[#27272a] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Ana Sayfa Vitrin Projeleri (Öne Çıkanlar)
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Ana sayfadaki vitrin bölümünde sergilenecek projeleri buradan seçip kaydedebilirsiniz.
                  </p>
                </div>
                <button 
                  onClick={handleSaveProjects} 
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shrink-0"
                >
                  <Check className="w-4 h-4" /> Vitrini Kaydet
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projectsData.map((proj, idx) => (
                  <div
                    key={proj.id || idx}
                    onClick={() => handleProjectChange(idx, 'isFeatured', !proj.isFeatured)}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all select-none ${
                      proj.isFeatured 
                        ? 'bg-zinc-800/80 border-zinc-400 text-white shadow-sm' 
                        : 'bg-[#09090b] border-[#27272a] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!proj.isFeatured}
                        onChange={() => {}} // handled by parent div
                        className="w-4 h-4 rounded text-white bg-[#18181b] cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-bold text-white block">{proj.name}</span>
                        <span className="text-xs text-[#94A3B8]">{proj.code || proj.categoryLabel || 'Proje'}</span>
                      </div>
                    </div>
                    {proj.isFeatured ? (
                      <span className="text-[11px] font-extrabold text-zinc-300 bg-white/10 px-2 py-0.5 rounded border border-zinc-500/30">
                        VİTRİNDE
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        Kapalı
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Vizyon / Misyon */}
            <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
              <div className="flex justify-between items-center mb-6 border-b border-[#27272a] pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Home className="w-5 h-5 text-zinc-300" />
                  Vizyon & Misyon
                </h2>
                <button onClick={handleSaveVisionMission} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors">
                  <Check className="w-4 h-4" /> Kaydet
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-2 font-bold">Vizyonumuz</label>
                  <textarea value={visionMission.vision} onChange={e => setVisionMission({...visionMission, vision: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-3 text-sm text-white focus:border-zinc-400 outline-none" rows={4}></textarea>
                </div>
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-2 font-bold">Misyonumuz</label>
                  <textarea value={visionMission.mission} onChange={e => setVisionMission({...visionMission, mission: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-3 text-sm text-white focus:border-zinc-400 outline-none" rows={4}></textarea>
                </div>
              </div>
            </div>

            {/* Dereceler ve Finalistlik */}
            <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
              <div className="flex justify-between items-center mb-6 border-b border-[#27272a] pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  Dereceler & Finalistlik
                </h2>
                <button onClick={handleSaveSpotlights} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors">
                  <Check className="w-4 h-4" /> Kaydet
                </button>
              </div>
              
              <button onClick={() => setSpotlights([{ year: 'Yeni Yıl', title: 'Yeni Başarı', rank: 'Derece', desc: 'Açıklama' }, ...spotlights])} className="mb-4 text-sm text-zinc-300 hover:text-zinc-200 font-bold">+ Yeni Derece Ekle</button>
              
              <div className="space-y-4">
                {spotlights.map((spot, index) => (
                  <div key={index} className="flex gap-4 items-start bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={spot.year} onChange={e => {
                          const ns = [...spotlights]; ns[index].year = e.target.value; setSpotlights(ns);
                        }} className="bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white" placeholder="Yıl (örn: 2024)" />
                        <input type="text" value={spot.rank} onChange={e => {
                          const ns = [...spotlights]; ns[index].rank = e.target.value; setSpotlights(ns);
                        }} className="bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white" placeholder="Derece (örn: 1.lik, Finalist)" />
                      </div>
                      <input type="text" value={spot.title} onChange={e => {
                        const ns = [...spotlights]; ns[index].title = e.target.value; setSpotlights(ns);
                      }} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white" placeholder="Yarışma Başlığı" />
                      <textarea value={spot.desc} onChange={e => {
                        const ns = [...spotlights]; ns[index].desc = e.target.value; setSpotlights(ns);
                      }} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white" rows={2} placeholder="Kısa Açıklama" />
                    </div>
                    <button onClick={() => {
                      const ns = [...spotlights]; ns.splice(index, 1); setSpotlights(ns);
                    }} className="bg-red-500/10 text-red-400 p-2 rounded-lg hover:bg-red-500/20"><X className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


{activeTab === 'sponsors' && (
          <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6 border-b border-[#27272a] pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-zinc-300" />
                Sponsorlar
              </h2>
              <button onClick={handleSaveSponsors} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors">
                <Check className="w-4 h-4" /> Kaydet
              </button>
            </div>
            
            <button onClick={() => setSponsorsData([{ id: Date.now().toString(), name: 'Yeni Sponsor', tier: 'destekci', tierLabel: 'Destekçi', logoUrl: '', website: '', description: '' }, ...sponsorsData])} className="mb-4 text-sm text-zinc-300 hover:text-zinc-200 font-bold">+ Sponsor Ekle</button>
            
            <div className="space-y-4">
              {sponsorsData.map((sponsor, index) => (
                <div key={sponsor.id || index} className="flex gap-4 items-start bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">Firma Adı</label>
                        <input type="text" value={sponsor.name} onChange={e => {
                          const ns = [...sponsorsData]; ns[index].name = e.target.value; setSponsorsData(ns);
                        }} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">Kategori (ana, platin, altin, gumus, destekci)</label>
                        <select value={sponsor.tier} onChange={e => {
                          const ns = [...sponsorsData]; 
                          ns[index].tier = e.target.value; 
                          const labels: any = { 'ana': 'Ana Sponsor', 'platin': 'Platin Sponsor', 'altin': 'Altın Sponsor', 'gumus': 'Gümüş Sponsor', 'destekci': 'Destekçi' };
                          ns[index].tierLabel = labels[e.target.value];
                          setSponsorsData(ns);
                        }} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white">
                          <option value="ana">Ana Sponsor</option>
                          <option value="platin">Platin Sponsor</option>
                          <option value="altin">Altın Sponsor</option>
                          <option value="gumus">Gümüş Sponsor</option>
                          <option value="destekci">Destekçi</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">Web Sitesi</label>
                        <input type="text" value={sponsor.website} onChange={e => {
                          const ns = [...sponsorsData]; ns[index].website = e.target.value; setSponsorsData(ns);
                        }} className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">Logo URL (Dosya Seç)</label>
                        <div className="flex flex-wrap gap-2 items-center">
                          <input type="text" value={sponsor.logoUrl || ''} onChange={e => {
                            const ns = [...sponsorsData]; ns[index].logoUrl = e.target.value; setSponsorsData(ns);
                          }} className="flex-1 min-w-[160px] bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white" placeholder="Logo URL veya Dosya Seçin" />
                          <label className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold whitespace-nowrap">
                            Seç
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageFileChange(e, (url) => {
                              const ns = [...sponsorsData]; ns[index].logoUrl = url; setSponsorsData(ns);
                            })} />
                          </label>
                          {sponsor.logoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                const ns = [...sponsorsData]; ns[index].logoUrl = ''; setSponsorsData(ns);
                                onShowToast('Sponsor logosu kaldırıldı. Kaydet butonuna basarak logosuz kaydedebilirsiniz.');
                              }}
                              className="bg-red-500/15 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                              title="Logoyu Kaldır"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Kaldır</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => {
                    const ns = [...sponsorsData]; ns.splice(index, 1); setSponsorsData(ns);
                  }} className="bg-red-500/10 text-red-400 p-2 rounded-lg hover:bg-red-500/20"><X className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'submissions' && (
          <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
            <h2 className="text-lg font-bold text-white mb-6 border-b border-[#27272a] pb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-zinc-300" />
              Siteden Gelen Başvuru ve Mesajlar
            </h2>
            <div className="space-y-4">
              {submissions.length === 0 && <div className="text-center py-12 text-[#64748B]">Henüz başvuru yok.</div>}
              {submissions.map(sub => (
                <div key={sub.id} className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${sub.type === 'join' ? 'bg-emerald-500/20 text-emerald-400' : sub.type === 'sponsor' ? 'bg-amber-500/20 text-amber-400' : sub.type?.includes('expo') ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-zinc-300'}`}>
                        {sub.type === 'join' ? 'Üyelik Başvurusu' : sub.type === 'contact' ? 'İletişim Mesajı' : sub.type === 'sponsor' ? 'Sponsorluk' : sub.type === 'expo_participate' ? 'Expo Katılım' : sub.type === 'expo_staff' ? 'Expo Gönüllü' : sub.type}
                      </span>
                      <span className="text-xs text-[#64748B]">{new Date(sub.timestamp).toLocaleString('tr-TR')}</span>
                    </div>
                    <h3 className="text-white font-bold text-lg">{sub.name || sub.Ad_Soyad || sub.Yetkili_Ad_Soyad || sub.Firma_Adi}</h3>
                    <p className="text-sm text-zinc-200 font-sans mb-2">{sub.email || sub.Email || "Email Yok"} • {sub.phone || sub.Telefon || sub.Iletisim_No || "Telefon Yok"}</p>
                    {sub.department && <p className="text-xs text-[#94A3B8] mb-2"><strong>Bölüm:</strong> {sub.department || sub.Bolum}</p>}
                    <p className="text-sm text-[#CBD5E1] bg-[#18181b] p-3 rounded-lg border border-[#27272a] mt-2 whitespace-pre-wrap">{sub.message || sub.Mesaj || sub.Motivasyon || sub.Notlar || sub.reason || sub.experience || "Ek bilgi girilmedi."}</p>
                  </div>
                  <div>
                    <button onClick={() => handleDeleteSubmission(sub.id)} className="bg-red-500/10 text-red-400 p-2 rounded-lg hover:bg-red-500/20"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        
        {activeTab === 'announcements' && (
          <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#27272a] pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-blue-400" />
                  Basında Biz &amp; Haber Yönetimi
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Buradan eklediğiniz haberler ve bültenler doğrudan sitedeki "Basında Biz" sekmesinde yayınlanır.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowAnnouncementForm(!showAnnouncementForm)} 
                className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors cursor-pointer shrink-0"
              >
                {showAnnouncementForm ? 'İptal' : '+ Yeni Haber Ekle'}
              </button>
            </div>
            
            {showAnnouncementForm && (
              <form onSubmit={handleAddAnnouncement} className="bg-[#09090b] p-5 sm:p-6 rounded-xl border border-[#27272a] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Haber Başlığı *</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="Örn: KTÜ SARGE TEKNOFEST'te Ödül Kazandı"
                      value={newAnnouncement.title} 
                      onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})} 
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" 
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Habere Gidecek Link (URL) * <span className="text-zinc-500 font-normal">(Karta tıklandığında bu link açılır)</span>
                    </label>
                    <input 
                      required
                      type="url" 
                      placeholder="https://www.aa.com.tr/tr/bilim-teknoloji/... veya haber adresi"
                      value={newAnnouncement.sourceUrl} 
                      onChange={e => setNewAnnouncement({...newAnnouncement, sourceUrl: e.target.value})} 
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" 
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Haber Fotoğrafı (URL)</label>
                    <input 
                      type="url" 
                      placeholder="https://... (Fotoğrafın internetteki adresi)"
                      value={newAnnouncement.imageUrl} 
                      onChange={e => setNewAnnouncement({...newAnnouncement, imageUrl: e.target.value})} 
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" 
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Kısa Açıklama *</label>
                    <textarea 
                      required 
                      rows={3}
                      placeholder="Kartın altında gözükecek 2-3 cümlelik kısa özet açıklama..."
                      value={newAnnouncement.summary} 
                      onChange={e => setNewAnnouncement({...newAnnouncement, summary: e.target.value, content: e.target.value})} 
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none resize-y" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Yayın Tarihi (İsteğe Bağlı)</label>
                    <input 
                      type="text" 
                      placeholder="Örn: 12 Ekim 2026"
                      value={newAnnouncement.date} 
                      onChange={e => setNewAnnouncement({...newAnnouncement, date: e.target.value})} 
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" 
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#27272a]">
                  <button 
                    type="button" 
                    onClick={() => setShowAnnouncementForm(false)} 
                    className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-blue-900/40 cursor-pointer"
                  >
                    <Newspaper className="w-3.5 h-3.5" />
                    <span>Haberi Kaydet ve Yayınla</span>
                  </button>
                </div>
              </form>
            )}
            
            <div className="space-y-3">
              <div className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider">
                Yayınlanan Haberler &amp; Bültenler ({announcements.length})
              </div>

              {announcements.length === 0 ? (
                <div className="text-center py-8 bg-[#09090b] rounded-xl border border-[#27272a] text-[#94A3B8] text-xs">
                  Henüz bir haber veya bülten eklenmedi.
                </div>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-zinc-700 transition-colors">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {ann.imageUrl ? (
                        <img src={ann.imageUrl} alt="" className="w-16 h-12 object-cover rounded-lg bg-zinc-900 shrink-0 border border-[#27272a]" />
                      ) : (
                        <div className="w-16 h-12 rounded-lg bg-zinc-900 border border-[#27272a] flex items-center justify-center shrink-0 text-zinc-600">
                          <Newspaper className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {ann.source || ann.category || 'Haber'}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {ann.date}
                          </span>
                        </div>
                        <h3 className="text-white font-bold text-sm truncate">{ann.title}</h3>
                        <p className="text-xs text-[#94A3B8] line-clamp-2 mt-0.5">{ann.summary || ann.content}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {ann.sourceUrl && (
                        <a 
                          href={ann.sourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs text-zinc-400 hover:text-white bg-zinc-800 p-2 rounded-lg transition-colors"
                          title="Orijinal Link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button 
                        onClick={() => handleDeleteAnnouncement(ann.id)} 
                        className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Sil</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'aboutFooter' && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* SARGE Ailesine Katılın Başlık Arka Plan Fotoğrafı */}
            <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#27272a] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-zinc-300" />
                    &ldquo;SARGE Ailesine Katılın!&rdquo; Başlık Arka Plan Fotoğrafı
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Bize Katılın & Takımlar sayfasının en üstündeki &ldquo;SARGE Ailesine Katılın!&rdquo; panosuna özel arka plan fotoğrafı ekleyin. Üzerindeki siyah gradyan ile yazılar daima net ve okunaklıdır. Fotoğraf yoksa veya yüklenemezse varsayılan koyu lacivert arka plan görünür.
                  </p>
                </div>
                <button 
                  onClick={handleSaveSiteBanners} 
                  disabled={isLoading}
                  className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-black/40 shrink-0 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Arka Planı Kaydet
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <input
                    type="text"
                    value={siteBanners.teamsBannerBg || ''}
                    onChange={(e) => setSiteBanners(prev => ({ ...prev, teamsBannerBg: e.target.value }))}
                    placeholder="Fotoğraf URL'si girin veya yandaki butondan dosya seçin..."
                    className="w-full sm:flex-1 bg-[#09090b] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 font-mono"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-zinc-200 border border-zinc-500/30 px-4 py-2.5 rounded-xl cursor-pointer text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <Upload className="w-4 h-4" />
                      <span>Video / Fotoğraf Seç</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,.mp4,.webm,.mov"
                        onChange={(e) => handleBannerMediaUpload(e, 'teamsBannerBg')}
                      />
                    </label>
                    {siteBanners.teamsBannerBg && (
                      <button
                        type="button"
                        onClick={() => {
                          setSiteBanners(prev => ({ ...prev, teamsBannerBg: '' }));
                          onShowToast('Bize Katılın arka plan fotoğrafı/videosu kaldırıldı. "Arka Planı Kaydet" veya "Değişiklikleri Kaydet" butonuna basarak fotoğrafsız kaydedebilirsiniz.');
                        }}
                        className="bg-red-500/15 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Fotoğrafı Kaldır"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Fotoğrafı / Medyayı Kaldır</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Helpful tips for Video & Photo Sources */}
                <div className="bg-[#18181b]/95 border border-[#27272a] rounded-xl p-3.5 text-[11px] text-slate-300 space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>İpucu: Otomatik Oynatma ve Medya Formatları</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li><strong className="text-red-400">YouTube Linki:</strong> YouTube video bağlantısı yapıştırdığınızda otomatik sessiz ve döngüde oynar.</li>
                    <li><strong className="text-emerald-400">Video Yükleme:</strong> <span className="text-white font-semibold">&ldquo;Video / Fotoğraf Seç&rdquo;</span> ile yüklenen <code className="text-zinc-300">.mp4</code> videoları buluta aktarılır ve Vercel'de otomatik oynatılır.</li>
                    <li><strong className="text-amber-400">Google Drive:</strong> Drive üçüncü taraf sitelerde video autoplay'e izin vermediğinden YouTube linki veya doğrudan dosya yükleme önerilir.</li>
                  </ul>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-400">Hızlı Seçim:</span>
                  <button
                    type="button"
                    onClick={() => setSiteBanners(prev => ({ ...prev, teamsBannerBg: '/teams-bg.mp4' }))}
                    className="text-[11px] bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-mono"
                    title="public/teams-bg.mp4 dosyasını kullanır"
                  >
                    public/teams-bg.mp4 (Yerel Proje Dosyası)
                  </button>
                </div>

                {/* Real-time Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-[#234580]/70 bg-gradient-to-br from-[#0e1e3d] via-[#091326] to-[#14264d] h-44 sm:h-52 flex flex-col items-center justify-center text-center p-6 select-none shadow-inner">
                  {siteBanners.teamsBannerBg ? (
                    <BackgroundMedia url={siteBanners.teamsBannerBg} alt="Teams Preview" />
                  ) : (
                    <div className="absolute inset-0 bg-[#0e1e3d]/40 flex flex-col items-center justify-center text-slate-400 text-xs">
                      <ImageIcon className="w-8 h-8 text-zinc-400 mb-1 opacity-50" />
                      <span>Şu an varsayılan koyu lacivert arka plan devrede (Medya seçilmedi)</span>
                    </div>
                  )}

                  <div className="relative z-10 space-y-2">
                    <span className="text-xl sm:text-3xl font-black text-white tracking-tight font-sans drop-shadow-md">
                      SARGE Ailesine Katılın!
                    </span>
                    <p className="text-[11px] sm:text-xs text-slate-300 font-normal max-w-md">
                      Mühendislik takımlarımızda veya sosyal birimimizde yerinizi alın • Canlı Önizleme
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272a] pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-zinc-300" />
                    Bize Katılın & Takımlar Yönetimi
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Takımların başvuru durumlarını (açık/kapalı), Google Forms linklerini ve takım açıklamalarını buradan düzenleyebilirsiniz.
                  </p>
                </div>
                <button onClick={handleSaveAboutTeams} className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-black/40 shrink-0 cursor-pointer">
                  <Check className="w-4 h-4" /> Değişiklikleri Kaydet
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setAboutTeams([
                    ...aboutTeams,
                    {
                      id: Date.now().toString(),
                      title: 'Yeni Takım',
                      desc: 'Bu takımın hedefleri ve yaptığı çalışmalar...',
                      activeProject: '',
                      isOpen: true,
                      applicationUrl: 'https://forms.google.com',
                      imageUrl: ''
                    }
                  ])}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 border border-zinc-500/30 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Yeni Takım Ekle
                </button>
                <span className="text-xs text-slate-400">Toplam {aboutTeams.length} Takım Kayıtlı</span>
              </div>

              <div className="space-y-6">
                {aboutTeams.map((team, index) => {
                  const isOpen = team.isOpen !== false;

                  return (
                    <div 
                      key={team.id || index} 
                      className={`p-5 sm:p-6 rounded-2xl border transition-colors space-y-5 ${
                        isOpen 
                          ? 'bg-[#0e0e11] border-zinc-500/30 shadow-md' 
                          : 'bg-[#09090b] border-[#27272a]'
                      }`}
                    >
                      {/* Top Header of Team Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-4">
                        <div className="flex-1">
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Takım Adı
                          </label>
                          <input 
                            type="text" 
                            value={team.title || ''} 
                            onChange={e => {
                              const nt = [...aboutTeams];
                              nt[index].title = e.target.value;
                              setAboutTeams(nt);
                            }} 
                            className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3.5 py-2 text-base font-bold text-white focus:outline-none focus:border-zinc-400" 
                            placeholder="Örn: ALACA Savaşan İHA Takımı" 
                          />
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {/* Application Open / Closed Switch */}
                          <button
                            type="button"
                            onClick={() => {
                              const nt = [...aboutTeams];
                              nt[index].isOpen = !isOpen;
                              setAboutTeams(nt);
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                              isOpen
                                ? 'bg-white/10 text-zinc-300 border-zinc-500/40 shadow-sm shadow-black/40'
                                : 'bg-zinc-800 text-slate-400 border-zinc-700 hover:text-white'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-white' : 'bg-slate-500'}`}></span>
                            <span>{isOpen ? 'Başvurular AÇIK' : 'Başvurular KAPALI'}</span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => {
                              if (confirm(`"${team.title}" takımını silmek istediğinize emin misiniz?`)) {
                                const nt = [...aboutTeams];
                                nt.splice(index, 1);
                                setAboutTeams(nt);
                              }
                            }} 
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 p-2 rounded-xl transition-colors cursor-pointer"
                            title="Takımı Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Application Link row */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                          <span>Google Forms / Başvuru Formu Linki</span>
                          {team.applicationUrl && (
                            <a
                              href={team.applicationUrl.startsWith('http') ? team.applicationUrl : `https://${team.applicationUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-zinc-300 hover:underline inline-flex items-center gap-1 font-semibold"
                            >
                              <span>Bağlantıyı Test Et</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </label>
                        <input 
                          type="text" 
                          value={team.applicationUrl || ''} 
                          onChange={e => {
                            const nt = [...aboutTeams];
                            nt[index].applicationUrl = e.target.value;
                            setAboutTeams(nt);
                          }} 
                          className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-400 font-mono" 
                          placeholder="https://docs.google.com/forms/d/e/... (Öğrenci 'Başvur'a bastığında buraya gider)" 
                        />
                      </div>

                      {/* Active project and Logo row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Aktif Proje Adı
                          </label>
                          <input 
                            type="text" 
                            value={team.activeProject || ''} 
                            onChange={e => {
                              const nt = [...aboutTeams];
                              nt[index].activeProject = e.target.value;
                              setAboutTeams(nt);
                            }} 
                            className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-400" 
                            placeholder="Örn: ALACA İHA" 
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Takım Logosu / Görseli
                          </label>
                          <div className="flex flex-wrap gap-2 items-center">
                            <input 
                              type="text" 
                              value={team.imageUrl || ''} 
                              onChange={e => {
                                const nt = [...aboutTeams];
                                nt[index].imageUrl = e.target.value;
                                setAboutTeams(nt);
                              }} 
                              className="flex-1 min-w-[180px] bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-400" 
                              placeholder="Logo URL veya Dosya Seçin" 
                            />
                            <label className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-3 py-2 rounded-xl cursor-pointer text-xs font-semibold whitespace-nowrap transition-colors">
                              Dosya Seç
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={(e) => handleImageFileChange(e, (url) => { 
                                  const nt = [...aboutTeams];
                                  nt[index].imageUrl = url;
                                  setAboutTeams(nt); 
                                })} 
                              />
                            </label>
                            {team.imageUrl && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nt = [...aboutTeams];
                                    nt[index].imageUrl = '';
                                    setAboutTeams(nt);
                                    onShowToast('Takım fotoğrafı kaldırıldı. "Değişiklikleri Kaydet" ile fotoğrafsız kaydedebilirsiniz.');
                                  }}
                                  className="bg-red-500/15 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Fotoğrafı Kaldır"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Kaldır</span>
                                </button>
                                <div className="w-10 h-10 rounded-xl bg-[#09090b] border border-[#27272a] flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                  <img src={team.imageUrl} alt="Team Logo" className="w-full h-full object-contain" />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Team Description (şunu bunu yapar) */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Takım Açıklaması (Bu takım ne yapar? Şunu bunu yapar diye genel açıklama)
                        </label>
                        <textarea 
                          value={team.desc || ''} 
                          onChange={e => {
                            const nt = [...aboutTeams];
                            nt[index].desc = e.target.value;
                            setAboutTeams(nt);
                          }} 
                          className="w-full bg-[#18181b] border border-[#27272a] rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-zinc-400 leading-relaxed" 
                          rows={2} 
                          placeholder="Örn: Otonom uçuş, yapay zeka hedef tespiti ve avcı/kaçan algoritmaları geliştirmektedir." 
                        />
                      </div>

                      {/* Team Story (Hikaye / Geçmiş) */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Detaylı Takım Hikayesi / Geçmişi (Tıklanınca Açılan Detay)
                        </label>
                        <textarea 
                          value={team.story || ''} 
                          onChange={e => {
                            const nt = [...aboutTeams];
                            nt[index].story = e.target.value;
                            setAboutTeams(nt);
                          }} 
                          className="w-full bg-[#18181b] border border-[#27272a] rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-zinc-400 leading-relaxed" 
                          rows={3} 
                          placeholder="Takımın yarışma geçmişi, dereceleri ve kuruluş amacı..." 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {aboutTeams.length > 2 && (
                <div className="pt-4 flex justify-end">
                  <button onClick={handleSaveAboutTeams} className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-6 py-3 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-black/40 cursor-pointer">
                    <Check className="w-4 h-4" /> Değişiklikleri Kaydet
                  </button>
                </div>
              )}
            </div>

            {/* SOSYAL BİRİM YÖNETİMİ */}
            <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272a] pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-zinc-300" />
                    Sosyal Birimler Yönetimi
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Sosyal birimlerin açıklamasını (&ldquo;şunu bunu yapar; sponsorluk, sosyal medya, etkinlik vb.&rdquo;), başvuru durumunu ve Google Forms linkini düzenleyin.
                  </p>
                </div>
                <button onClick={handleSaveAboutTeams} className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-black/40 shrink-0 cursor-pointer">
                  <Check className="w-4 h-4" /> Değişiklikleri Kaydet
                </button>
              </div>

              <div className="bg-[#09090b] p-5 sm:p-6 rounded-2xl border border-[#27272a] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Sosyal Birimler Başvuru Ayarları</h3>
                    <p className="text-xs text-slate-400">Tek bir başvuru butonu ile adayları yönlendirir.</p>
                  </div>
                  
                  {/* Başvuru Açık / Kapalı */}
                  <button
                    type="button"
                    onClick={() => setSocialUnit((prev: any) => ({ ...prev, isOpen: !(prev.isOpen !== false) }))}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                      socialUnit.isOpen !== false
                        ? 'bg-white/10 text-zinc-300 border-zinc-500/40 shadow-sm shadow-black/40'
                        : 'bg-zinc-800 text-slate-400 border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${socialUnit.isOpen !== false ? 'bg-white' : 'bg-slate-500'}`}></span>
                    <span>{socialUnit.isOpen !== false ? 'Başvurular AÇIK' : 'Başvurular KAPALI'}</span>
                  </button>
                </div>

                {/* Google Forms Link */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Sosyal Birim Google Forms Başvuru Linki</span>
                    {socialUnit.applicationUrl && (
                      <a
                        href={socialUnit.applicationUrl.startsWith('http') ? socialUnit.applicationUrl : `https://${socialUnit.applicationUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-zinc-300 hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        <span>Linki Test Et</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </label>
                  <input
                    type="text"
                    value={socialUnit.applicationUrl || ''}
                    onChange={e => setSocialUnit((prev: any) => ({ ...prev, applicationUrl: e.target.value }))}
                    placeholder="https://docs.google.com/forms/d/e/... (Sosyal birim başvurusu için Google Forms linki)"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-400 font-mono"
                  />
                </div>

                {/* Açıklama */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Sosyal Birim Açıklaması (Şunu bunu yapar; sponsorluk, sosyal medya, etkinlik vs.)
                  </label>
                  <textarea
                    rows={4}
                    value={socialUnit.desc || ''}
                    onChange={e => setSocialUnit((prev: any) => ({ ...prev, desc: e.target.value }))}
                    placeholder="Sosyal birim nedir ve ne iş yapar açıklaması..."
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-zinc-400 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* SARGE EXPO BAŞVURU YÖNETİMİ */}
            <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272a] pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-zinc-300" />
                    SARGE EXPO Başvuru Yönetimi
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    SARGE EXPO fuarı için görevli/gönüllü başvuru formunuzun linkini ve açıklamasını belirleyin. Expo sekmesindeki &ldquo;Bize Katılın&rdquo; butonu buradaki Google Forms linkine yönlendirir.
                  </p>
                </div>
                <button onClick={handleSaveAboutTeams} className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-black/40 shrink-0 cursor-pointer">
                  <Check className="w-4 h-4" /> Değişiklikleri Kaydet
                </button>
              </div>

              <div className="bg-[#09090b] p-5 sm:p-6 rounded-2xl border border-[#27272a] space-y-5">
                {/* Google Forms Link */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                    <span>SARGE EXPO Google Forms Başvuru Linki</span>
                    {expoUnit.applicationUrl && (
                      <a
                        href={expoUnit.applicationUrl.startsWith('http') ? expoUnit.applicationUrl : `https://${expoUnit.applicationUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-zinc-300 hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        <span>Linki Test Et</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </label>
                  <input
                    type="text"
                    value={expoUnit.applicationUrl || ''}
                    onChange={e => setExpoUnit((prev: any) => ({ ...prev, applicationUrl: e.target.value }))}
                    placeholder="https://docs.google.com/forms/d/e/... (SARGE EXPO başvurusu için Google Forms linki)"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-400 font-mono"
                  />
                </div>

                {/* Açıklama */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    SARGE EXPO Açıklaması (Bize Katılın sekmesinde görünen açıklama)
                  </label>
                  <textarea
                    rows={4}
                    value={expoUnit.desc || ''}
                    onChange={e => setExpoUnit((prev: any) => ({ ...prev, desc: e.target.value }))}
                    placeholder="SARGE EXPO fuarı açıklaması..."
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-zinc-400 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
              <div className="flex justify-between items-center mb-6 border-b border-[#27272a] pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-zinc-300" />
                  Footer (Sayfa Sonu) Takımlar
                </h2>
                <button onClick={handleSaveFooterSections} className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors">
                  <Check className="w-4 h-4" /> Kaydet
                </button>
              </div>
              <button onClick={() => setFooterSections([...footerSections, { title: 'Yeni Kategori', links: ['Link 1'] }])} className="mb-4 text-sm text-zinc-300 hover:text-zinc-200 font-bold">+ Kategori Ekle</button>
              <div className="space-y-4">
                {footerSections.map((sec, index) => (
                  <div key={index} className="bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                    <div className="flex justify-between items-center mb-2">
                      <input type="text" value={sec.title} onChange={e => {
                        const nfs = [...footerSections]; nfs[index].title = e.target.value; setFooterSections(nfs);
                      }} className="bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white font-bold" />
                      <button onClick={() => {
                        const nfs = [...footerSections]; nfs.splice(index, 1); setFooterSections(nfs);
                      }} className="text-red-400 hover:text-red-300">Kategoriyi Sil</button>
                    </div>
                    <button onClick={() => {
                      const nfs = [...footerSections];
                      if (!nfs[index].links) nfs[index].links = [];
                      nfs[index].links.push('Yeni Link');
                      setFooterSections(nfs);
                    }} className="text-xs text-zinc-300 mb-2">+ Link Ekle</button>
                    <div className="space-y-2">
                      {sec.links?.map((link: string, lIdx: number) => (
                        <div key={lIdx} className="flex gap-2">
                          <input type="text" value={link} onChange={e => {
                            const nfs = [...footerSections]; nfs[index].links[lIdx] = e.target.value; setFooterSections(nfs);
                          }} className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white" />
                          <button onClick={() => {
                            const nfs = [...footerSections]; nfs[index].links.splice(lIdx, 1); setFooterSections(nfs);
                          }} className="bg-red-500/10 text-red-400 p-2 rounded-lg hover:bg-red-500/20"><X className="w-4 h-4"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
{activeTab === 'settings' && (
          <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6 border-b border-[#27272a] pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-zinc-300" />
                Genel Site Ayarları
              </h2>
              <button onClick={handleSaveSettings} className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors">
                <Check className="w-4 h-4" /> Kaydet
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Başlık & Banner Arka Plan Medyaları (Fotoğraf veya Video) */}
              <div className="bg-[#09090b] p-5 rounded-2xl border border-[#27272a] space-y-5">
                <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-zinc-300" />
                      Başlık Arka Planları (Fotoğraf veya Video)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Ana sayfa ve Bize Katılın başlıkları arkasına loop döngüsel video (MP4/WebM) veya fotoğraf yükleyebilirsiniz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveSiteBanners}
                    className="bg-white hover:bg-zinc-200 text-zinc-950 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Arka Planları Kaydet
                  </button>
                </div>

                {/* 1. KTÜ SARGE Hero Banner */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    1. Ana Sayfa &ldquo;KTÜ SARGE&rdquo; Başlık Arka Planı (Fotoğraf / Video)
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={siteBanners.heroBannerBg || ''}
                      onChange={(e) => setSiteBanners(prev => ({ ...prev, heroBannerBg: e.target.value }))}
                      placeholder="Video (.mp4 / .webm) veya Fotoğraf URL'si ya da dosya seçin..."
                      className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white focus:border-zinc-400 outline-none font-mono"
                    />
                    <label className="bg-white/10 hover:bg-white/20 text-zinc-200 border border-zinc-500/30 px-3 py-2 rounded-lg cursor-pointer text-xs font-bold whitespace-nowrap transition-colors">
                      Dosya Seç
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,.mp4,.webm,.mov"
                        onChange={(e) => handleBannerMediaUpload(e, 'heroBannerBg')}
                      />
                    </label>
                    {siteBanners.heroBannerBg && (
                      <button
                        type="button"
                        onClick={() => setSiteBanners(prev => ({ ...prev, heroBannerBg: '' }))}
                        className="bg-red-500/10 text-red-400 p-2 rounded-lg hover:bg-red-500/20"
                        title="Medyayı Kaldır"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Teams / Join Banner */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    2. Bize Katılın &ldquo;SARGE Ailesine Katılın!&rdquo; Başlık Arka Planı (Fotoğraf / Video)
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={siteBanners.teamsBannerBg || ''}
                      onChange={(e) => setSiteBanners(prev => ({ ...prev, teamsBannerBg: e.target.value }))}
                      placeholder="Video (.mp4 / .webm) veya Fotoğraf URL'si ya da dosya seçin..."
                      className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white focus:border-zinc-400 outline-none font-mono"
                    />
                    <label className="bg-white/10 hover:bg-white/20 text-zinc-200 border border-zinc-500/30 px-3 py-2 rounded-lg cursor-pointer text-xs font-bold whitespace-nowrap transition-colors">
                      Dosya Seç
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,.mp4,.webm,.mov"
                        onChange={(e) => handleBannerMediaUpload(e, 'teamsBannerBg')}
                      />
                    </label>
                    {siteBanners.teamsBannerBg && (
                      <button
                        type="button"
                        onClick={() => setSiteBanners(prev => ({ ...prev, teamsBannerBg: '' }))}
                        className="bg-red-500/10 text-red-400 p-2 rounded-lg hover:bg-red-500/20"
                        title="Medyayı Kaldır"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#94A3B8] mb-2 font-bold">Özel Site Logosu (Sol Üst Köşe)</label>
                <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageFileChange(e, (url) => setSiteSettings({...siteSettings, logoUrl: url}))} 
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none mb-4" 
                  />
                  {siteSettings.logoUrl ? (
                    <div className="relative rounded bg-black/50 p-4 border border-[#27272a] flex items-center justify-center min-h-[100px]">
                       <img src={siteSettings.logoUrl} alt="Logo Preview" className="max-h-24 object-contain" />
                       <button onClick={() => setSiteSettings({...siteSettings, logoUrl: ''})} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[#64748B] text-sm">
                      Şu an varsayılan SARGE logosu kullanılıyor.<br/>Yeni bir logo seçerek değiştirebilirsiniz.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">E-Posta Adresi</label>
                  <input type="email" value={siteSettings.email} onChange={e => setSiteSettings({...siteSettings, email: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">Telefon Numarası</label>
                  <input type="text" value={siteSettings.phone} onChange={e => setSiteSettings({...siteSettings, phone: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Açık Adres</label>
                <textarea value={siteSettings.address} onChange={e => setSiteSettings({...siteSettings, address: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" rows={3} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">LinkedIn URL</label>
                  <input type="url" value={siteSettings.linkedin} onChange={e => setSiteSettings({...siteSettings, linkedin: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">Instagram URL</label>
                  <input type="url" value={siteSettings.instagram} onChange={e => setSiteSettings({...siteSettings, instagram: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                </div>
              </div>
              
              <div className="pt-6 border-t border-[#27272a] mt-6">
                <h3 className="text-lg font-bold text-white mb-4">İletişim Sayfası Yazıları</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1">Ana Başlık</label>
                      <input type="text" value={siteSettings.contactTitle || ''} onChange={e => setSiteSettings({...siteSettings, contactTitle: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1">Açıklama Yazısı</label>
                      <textarea value={siteSettings.contactDesc || ''} onChange={e => setSiteSettings({...siteSettings, contactDesc: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" rows={2} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1">Bilgiler Başlığı (Atölye & İletişim)</label>
                      <input type="text" value={siteSettings.contactDetailsTitle || ''} onChange={e => setSiteSettings({...siteSettings, contactDetailsTitle: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1">Form Başlığı (Bize Mesaj Gönderin)</label>
                      <input type="text" value={siteSettings.contactFormTitle || ''} onChange={e => setSiteSettings({...siteSettings, contactFormTitle: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">Çalışma Saatleri</label>
                    <input type="text" value={siteSettings.contactWorkingHours || ''} onChange={e => setSiteSettings({...siteSettings, contactWorkingHours: e.target.value})} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-sm text-white focus:border-zinc-400 outline-none" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" /> Giriş Güvenliği & Ban Günlüğü
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Brute-force saldırıları, hatalı şifre denemeleri ve 15 dakika kilitlenen IP adresleri anlık olarak burada listelenir.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => loadSecurityLogs()}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-white border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  Yenile
                </button>
                {securityLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Kayıtları Temizle
                  </button>
                )}
              </div>
            </div>

            {/* Active Lockouts Banner */}
            {activeLockouts.length > 0 && (
              <div className="bg-red-950/40 border border-red-500/40 p-5 rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-red-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                  Aktif Banlı / Kilitli IP Adresleri ({activeLockouts.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeLockouts.map(item => (
                    <div key={item.ip} className="bg-black/50 border border-red-500/30 p-3.5 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-sm font-mono font-bold text-white">{item.ip}</div>
                        <div className="text-[11px] text-red-400 mt-0.5">Kalan Kilit: ~{item.remainingMinutes} dakika</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnbanIp(item.ip)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Banı Kaldır
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security Logs Table */}
            <div className="bg-[#18181b] rounded-2xl border border-[#27272a] overflow-hidden">
              <div className="p-4 border-b border-[#27272a] flex justify-between items-center">
                <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                  Güvenlik Kayıtları ({securityLogs.length})
                </span>
                {isLoadingLogs && <span className="text-xs text-zinc-500 animate-pulse">Yükleniyor...</span>}
              </div>
              {securityLogs.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 text-sm">
                  Henüz kayıtlı bir güvenlik ihlali veya ban denemesi bulunmuyor. Sistem güvende!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-black/40 border-b border-[#27272a] text-[#94A3B8]">
                        <th className="p-3.5 font-semibold">Tarih & Saat</th>
                        <th className="p-3.5 font-semibold">IP Adresi</th>
                        <th className="p-3.5 font-semibold">Tahmini Konum</th>
                        <th className="p-3.5 font-semibold">Denenen Kullanıcı</th>
                        <th className="p-3.5 font-semibold">Durum</th>
                        <th className="p-3.5 font-semibold">Tarayıcı / Cihaz</th>
                        <th className="p-3.5 font-semibold text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]">
                      {securityLogs.map(log => {
                        const isBan = log.type === 'LOCKOUT';
                        const isCurrentlyLocked = activeLockouts.some(l => l.ip === log.ip);
                        return (
                          <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3.5 text-zinc-300 font-mono whitespace-nowrap">
                              {log.dateFormatted || new Date(log.timestamp).toLocaleString('tr-TR')}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-white whitespace-nowrap">
                              <span className="bg-zinc-900 border border-zinc-700/60 px-2 py-1 rounded text-zinc-200">
                                {log.ip}
                              </span>
                            </td>
                            <td className="p-3.5 text-zinc-200 font-medium min-w-[200px]" title={log.location}>
                              {log.location || 'Bilinmiyor'}
                            </td>
                            <td className="p-3.5 text-zinc-300 font-mono">
                              <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                {log.triedUsername || '-'}
                              </span>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              {isBan ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                  15 Dk Kilitlendi ({log.attempts}. deneme)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Hatalı Giriş ({log.attempts}/5)
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-zinc-400 max-w-[220px] truncate text-[11px]" title={log.userAgent}>
                              {log.userAgent || 'Bilinmiyor'}
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              {isCurrentlyLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleUnbanIp(log.ip)}
                                  className="text-xs text-red-400 hover:text-red-300 underline font-semibold cursor-pointer"
                                >
                                  Banı Kaldır
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
