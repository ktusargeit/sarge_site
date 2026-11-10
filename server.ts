import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { promisify } from 'util';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';

const app = express();
const PORT = 3000;
const pbkdf2Async = promisify(crypto.pbkdf2);

// ---- Reverse proxy / client IP trust (IP spoofing protection) ----
// TRUST_PROXY_HOPS: number of trusted proxies in front of this server (0 = none, 1 = Vercel/Nginx/Render...).
// BEHIND_CLOUDFLARE=true: trust the CF-Connecting-IP header (ONLY set this if ALL traffic really passes through Cloudflare).
const TRUST_PROXY_HOPS = Math.max(0, parseInt(process.env.TRUST_PROXY_HOPS || '1', 10) || 1);
const BEHIND_CLOUDFLARE = process.env.BEHIND_CLOUDFLARE === 'true';
if (TRUST_PROXY_HOPS > 0) {
  app.set('trust proxy', TRUST_PROXY_HOPS);
}

// Security constants (.env overrides safe built-in PBKDF2 defaults so git clones work out-of-the-box)
const SERVER_SECRET = process.env.FIREBASE_SERVER_SECRET || 'KTU_SARGE_SEC_TOKEN_9921';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PASSWORD_SALT = (process.env.PASSWORD_SALT || '0aa07ec91234eaf869fc1a46886dab147232fd63ab7d4981874ee3391c9b93f2').trim();

// Primary Root Admin Credentials (PBKDF2-SHA256 hash of sarge-2026)
const EXPECTED_USERNAME = (process.env.ADMIN_USERNAME || 'Sarge_it').trim();
const EXPECTED_PASSWORD_HASH = (
  process.env.ADMIN_PASSWORD_HASH ||
  (process.env.ADMIN_PASSWORD && PASSWORD_SALT
    ? crypto.pbkdf2Sync(process.env.ADMIN_PASSWORD, PASSWORD_SALT, 100000, 32, 'sha256').toString('hex')
    : 'c4935fb2a2471f721c62765037dbc30975f3a5fc97ff673b5168a045f6ec0a6d')
).trim().toLowerCase();

// Firebase initialization for Server
const FIRESTORE_DATABASE_ID = "ai-studio-ktsargesavunmave-7c8ef8da-dd5e-42e6-936e-e48551879efe";
const firebaseConfig = {
  projectId: "ringed-unfolding-d8chg",
  appId: "1:339579772484:web:f4941822dc9e20eface611",
  apiKey: "AIzaSyAk9_0E9JeZoMPFAywNOn1RJaipLamwKkY",
  authDomain: "ringed-unfolding-d8chg.firebaseapp.com",
  storageBucket: "ringed-unfolding-d8chg.firebasestorage.app",
  messagingSenderId: "339579772484"
};

const serverFbApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig, "server-app");
const db = getFirestore(serverFbApp, FIRESTORE_DATABASE_ID);

// ================= FIRESTORE DATA LAYER =================
let adminDb: any = null;

async function initAdminFirestore() {
  let account: any = null;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const accountPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (fs.existsSync(accountPath)) {
        account = JSON.parse(fs.readFileSync(accountPath, 'utf-8'));
      }
    }
  } catch {}

  if (!account) return;

  try {
    const adminAppMod: any = await import('firebase-admin/app');
    const adminFsMod: any = await import('firebase-admin/firestore');
    const existing = adminAppMod.getApps().find((a: any) => a.name === 'sarge-admin');
    const adminApp = existing || adminAppMod.initializeApp(
      { credential: adminAppMod.cert(account), projectId: account.project_id || firebaseConfig.projectId },
      'sarge-admin'
    );
    const instance = adminFsMod.getFirestore(adminApp, FIRESTORE_DATABASE_ID);
    try { instance.settings({ ignoreUndefinedProperties: true }); } catch {}
    adminDb = instance;
    console.log('[SECURITY] Firebase Admin SDK aktif.');
  } catch {}
}

async function dbGet(col: string, id: string): Promise<{ exists: boolean; data: any }> {
  if (adminDb) {
    const snap = await adminDb.collection(col).doc(id).get();
    return { exists: snap.exists, data: snap.exists ? snap.data() : null };
  }
  const snap = await getDoc(doc(db, col, id));
  return { exists: snap.exists(), data: snap.exists() ? snap.data() : null };
}

async function dbSet(col: string, id: string, data: any, merge = false): Promise<void> {
  if (adminDb) {
    await adminDb.collection(col).doc(id).set(data, { merge });
    return;
  }
  if (merge) {
    await setDoc(doc(db, col, id), data, { merge: true });
  } else {
    await setDoc(doc(db, col, id), data);
  }
}

async function dbAdd(col: string, data: any): Promise<string> {
  if (adminDb) {
    const ref = await adminDb.collection(col).add(data);
    return ref.id;
  }
  const ref = await addDoc(collection(db, col), data);
  return ref.id;
}

async function dbDelete(col: string, id: string): Promise<void> {
  if (adminDb) {
    await adminDb.collection(col).doc(id).delete();
    return;
  }
  await deleteDoc(doc(db, col, id));
}

async function dbList(col: string): Promise<Array<{ id: string; data: any }>> {
  if (adminDb) {
    const snap = await adminDb.collection(col).get();
    return snap.docs.map((d: any) => ({ id: d.id, data: d.data() }));
  }
  const snap = await getDocs(collection(db, col));
  return snap.docs.map(d => ({ id: d.id, data: d.data() }));
}

// Ensure uploads directory exists and is served statically
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => {
    // Uploaded files must never execute scripts (stored XSS via SVG/HTML)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  }
}));

// Body parsers: tiny limit for login, 2 MB for public routes, and the big 50 MB limit ONLY for
// requests that already carry a valid admin token (authentication happens BEFORE the body is parsed).
// (body-parser skips a request that was already parsed, so the more specific parsers must be registered first.)
app.use('/api/admin/login', express.json({ limit: '4kb' }));
app.use(
  '/api/admin',
  (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/login') return next();
    return requireAdminAuth(req, res, next);
  },
  express.json({ limit: '50mb' })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Security Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', "object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// 301 Permanent Redirects for legacy URLs and double-slash paths (e.g. //about, /about, /about/ -> /)
app.use((req: Request, res: Response, next: NextFunction) => {
  const originalUrl = req.originalUrl || req.url;

  // Do not redirect API requests, static assets or upload files
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.includes('.')) {
    return next();
  }

  const hasDoubleSlash = originalUrl.startsWith('//') || originalUrl.includes('//');
  const cleanPath = req.path.replace(/\/+/g, '/');

  // Handle about legacy paths, /admin traps, trailing slashes, or double-slashes
  if (
    hasDoubleSlash ||
    cleanPath === '/about' ||
    cleanPath.startsWith('/about/') ||
    cleanPath === '/hakkimizda' ||
    cleanPath.startsWith('/hakkimizda/') ||
    cleanPath === '/admin' ||
    cleanPath.startsWith('/admin/') ||
    cleanPath === '/yonetim' ||
    cleanPath.startsWith('/yonetim/') ||
    cleanPath === '/panel' ||
    cleanPath.startsWith('/panel/')
  ) {
    return res.redirect(301, '/');
  }

  // If path has duplicate slashes, normalize and redirect
  if (originalUrl !== cleanPath && cleanPath !== '/') {
    return res.redirect(301, cleanPath);
  }

  next();
});

// Google Search Console verification file route
app.get('/googlebf53843bbe2e61be.html', (req: Request, res: Response) => {
  res.type('text/html').send('google-site-verification: googlebf53843bbe2e61be.html');
});

// Direct SEO route for robots.txt
app.get('/robots.txt', (req: Request, res: Response) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.sarge-ktu.com/sitemap.xml
`);
});

// Direct SEO route for sitemap.xml
app.get('/sitemap.xml', (req: Request, res: Response) => {
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.sarge-ktu.com/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
});

// In-Memory Rate Limiting
interface RateLimitRecord {
  attempts: number;
  lockedUntil: number;
  lastAttempt?: number;
}
const loginRateLimitMap = new Map<string, RateLimitRecord>();

interface SubmissionLimitRecord {
  count: number;
  resetTime: number;
}
const formRateLimitMap = new Map<string, SubmissionLimitRecord>();

function normalizeIp(raw: string): string {
  let ip = (raw || '').trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

// Client IP: client-supplied headers are NEVER trusted unless explicitly configured via env
// (otherwise anybody could send "X-Forwarded-For: <random>" to dodge the brute-force lock and poison the logs).
function getClientIp(req: Request): string {
  if (BEHIND_CLOUDFLARE) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && net.isIP(cfIp.trim())) return normalizeIp(cfIp);
  }
  // req.ip honours "trust proxy" (TRUST_PROXY_HOPS) and falls back to the real socket address.
  const ip = normalizeIp(req.ip || req.socket.remoteAddress || '');
  return net.isIP(ip) ? ip : 'unknown';
}

// Token management (HMAC-SHA256)
function generateSessionToken(username = EXPECTED_USERNAME): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 hours
  const payload = {
    role: 'admin',
    user: username,
    exp: expiresAt,
    iat: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');
  return { token: `${encodedPayload}.${signature}`, expiresAt };
}

// Revoked (logged-out) tokens: sha256(token) -> expiry timestamp
const revokedTokens = new Map<string, number>();
function tokenFingerprint(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
function revokeSessionToken(token: string) {
  try {
    const [encodedPayload] = token.split('.');
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    const now = Date.now();
    for (const [fp, exp] of revokedTokens) {
      if (exp < now) revokedTokens.delete(fp);
    }
    revokedTokens.set(tokenFingerprint(token), Number(payload?.exp) || now + 4 * 60 * 60 * 1000);
  } catch {}
}

function verifySessionToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [encodedPayload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');

  try {
    const sigBuf = Buffer.from(signature, 'utf-8');
    const expectedBuf = Buffer.from(expectedSig, 'utf-8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

    const payloadStr = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr);
    if (!payload || payload.role !== 'admin' || !payload.exp || Date.now() > payload.exp) {
      return false;
    }
    if (revokedTokens.has(tokenFingerprint(token))) return false;
    return true;
  } catch {
    return false;
  }
}

// Admin Auth Guard Middleware
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme başlığı (Authorization) eksik veya geçersiz.' });
  }

  const token = authHeader.split(' ')[1];
  if (!verifySessionToken(token)) {
    return res.status(401).json({ error: 'Oturum süresi dolmuş veya geçersiz token. Lütfen tekrar giriş yapın.' });
  }

  next();
}

// ================= ADMIN USER MANAGEMENT (FIRESTORE + LOCAL SYNC) =================
// Stored in Firestore at doc(db, 'content', 'admin_users') so it works out-of-the-box with the existing
// Firebase rules without requiring any Firebase Console configuration changes from the team Captain.
export interface AdminUserRecord {
  id: string;
  username: string;
  role: string;
  salt: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
}

const adminsLocalFile = path.join(process.cwd(), 'db_admins.json');
const FIRESTORE_ADMIN_NOTE =
  "Firestore uzerinden yeni yonetici eklemek icin 'admins' dizisine { username: 'kullanici_adi', password: 'sifre', role: 'Yonetici', active: true } ekleyin. Sunucu duz metin sifreyi otomatik olarak PBKDF2-SHA256 ile sifreleyip kaydeder. Yonetici silmek icin diziden cikarabilir veya active: false yapabilirsiniz.";

function getDefaultRootAdmin(): AdminUserRecord {
  return {
    id: 'root-admin',
    username: EXPECTED_USERNAME,
    role: 'Ana Sistem Yöneticisi (IT)',
    salt: PASSWORD_SALT,
    passwordHash: EXPECTED_PASSWORD_HASH,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  };
}

function readLocalAdmins(): AdminUserRecord[] {
  try {
    if (fs.existsSync(adminsLocalFile)) {
      const parsed = JSON.parse(fs.readFileSync(adminsLocalFile, 'utf-8'));
      const list = Array.isArray(parsed) ? parsed : parsed?.admins;
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch {}
  return [getDefaultRootAdmin()];
}

function writeLocalAdmins(admins: AdminUserRecord[]) {
  try {
    fs.writeFileSync(
      adminsLocalFile,
      JSON.stringify({ _Kullanim_Notu: FIRESTORE_ADMIN_NOTE, admins }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn('Could not write db_admins.json:', err);
  }
}

async function normalizeAndHashAdminList(rawList: any[]): Promise<{ admins: AdminUserRecord[]; changed: boolean }> {
  const result: AdminUserRecord[] = [];
  let changed = false;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    let username = String(item.username || item.user || '').trim();
    if (!username) continue;

    let salt = String(item.salt || '').trim();
    let passwordHash = String(item.passwordHash || item.hash || '').trim().toLowerCase();
    const plainPassword = typeof item.password === 'string' ? item.password.trim() : '';

    // Migrate legacy root-admin username/hash if present
    if (username.toLowerCase() === 'sarge-admin-it') {
      username = EXPECTED_USERNAME;
      salt = PASSWORD_SALT;
      passwordHash = EXPECTED_PASSWORD_HASH;
      changed = true;
    }

    // If someone added/edited a plain 'password' field directly in Firestore Console, hash it automatically!
    if (plainPassword) {
      salt = crypto.randomBytes(32).toString('hex');
      passwordHash = (await pbkdf2Async(plainPassword, salt, 100000, 32, 'sha256')).toString('hex').toLowerCase();
      changed = true;
    }

    if (!salt || !passwordHash) {
      if (username.toLowerCase() === EXPECTED_USERNAME.toLowerCase()) {
        salt = PASSWORD_SALT;
        passwordHash = EXPECTED_PASSWORD_HASH;
        changed = true;
      } else {
        continue;
      }
    }

    result.push({
      id: String(item.id || `adm_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`),
      username,
      role: String(item.role || 'Yönetici').trim(),
      salt,
      passwordHash,
      active: item.active !== false,
      createdAt: String(item.createdAt || new Date().toISOString())
    });
  }

  if (!result.some((a) => a.username.toLowerCase() === EXPECTED_USERNAME.toLowerCase())) {
    result.unshift(getDefaultRootAdmin());
    changed = true;
  }

  return { admins: result, changed };
}

async function saveAdminsToEverywhere(admins: AdminUserRecord[]) {
  writeLocalAdmins(admins);
  try {
    await dbSet('content', 'admin_users', {
      _Kullanim_Notu: FIRESTORE_ADMIN_NOTE,
      admins,
      _srvSecret: SERVER_SECRET,
      _lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Firestore admin_users sync warning:', (err as any)?.message || err);
  }
}

async function syncAndGetAdminUsers(): Promise<AdminUserRecord[]> {
  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const snap = await Promise.race([dbGet('content', 'admin_users'), timeoutPromise]);

    if (snap && snap.exists && snap.data) {
      const rawList = Array.isArray(snap.data.admins)
        ? snap.data.admins
        : Array.isArray(snap.data.data)
        ? snap.data.data
        : [];

      // Also support single user fields placed directly on content/admin_users document in Firestore Console
      if (rawList.length === 0 && snap.data.username) {
        rawList.push(snap.data);
      }

      if (rawList.length > 0) {
        const { admins, changed } = await normalizeAndHashAdminList(rawList);
        if (admins.length > 0) {
          writeLocalAdmins(admins);
          if (changed) {
            await saveAdminsToEverywhere(admins);
          }
          return admins;
        }
      }
    } else if (snap && !snap.exists) {
      // Initialize Firestore content/admin_users document so it is visible in Firebase Console right away
      const initialAdmins = readLocalAdmins();
      await saveAdminsToEverywhere(initialAdmins);
      return initialAdmins;
    }
  } catch {}

  const localAdmins = readLocalAdmins();
  return localAdmins.length > 0 ? localAdmins : [getDefaultRootAdmin()];
}

// ================= SECURITY LOGGING & AUDIT SYSTEM =================
const securityLogsFile = path.join(process.cwd(), 'security_logs.json');

function readLocalSecurityLogs(): any[] {
  try {
    if (fs.existsSync(securityLogsFile)) {
      const data = fs.readFileSync(securityLogsFile, 'utf-8');
      return JSON.parse(data) || [];
    }
  } catch {}
  return [];
}

function writeLocalSecurityLogs(logs: any[]) {
  try {
    fs.writeFileSync(securityLogsFile, JSON.stringify(logs.slice(0, 150), null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save local security logs:', err);
  }
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip || !net.isIP(ip)) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'unknown') return true;
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  const lower = ip.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
  return false;
}

async function getGeoLocation(ip: string): Promise<string> {
  if (isPrivateOrLocalIp(ip)) {
    return 'Yerel Ağ / Test (Localhost)';
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.status === 'success') {
        const country = data.country || '';
        const city = data.city || '';
        const region = data.regionName && data.regionName !== city ? ` (${data.regionName})` : '';
        const provider = data.isp || data.org || '';
        const loc = [country, city].filter(Boolean).join(' / ') + region;
        return provider ? `${loc} - [${provider}]` : loc || 'Bilinmeyen Konum';
      }
    }
  } catch {}
  return 'İnternet Konumu (Detay Alınamadı)';
}

async function logSecurityEvent(event: {
  ip: string;
  type: 'LOCKOUT' | 'FAILED_ATTEMPT';
  attempts: number;
  triedUsername: string;
  userAgent: string;
}) {
  try {
    const location = await getGeoLocation(event.ip);
    const now = new Date();
    const dateFormatted = now.toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const logEntry = {
      id: `sec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      ip: event.ip,
      type: event.type,
      attempts: event.attempts,
      triedUsername: String(event.triedUsername || '').slice(0, 64),
      userAgent: String(event.userAgent || 'Bilinmiyor').slice(0, 250),
      location,
      timestamp: now.toISOString(),
      dateFormatted,
      isLocked: event.type === 'LOCKOUT'
    };

    // 1. Write to local JSON file
    const localLogs = readLocalSecurityLogs();
    localLogs.unshift(logEntry);
    const trimmedLogs = localLogs.slice(0, 100);
    writeLocalSecurityLogs(trimmedLogs);

    // 2. Sync to Firebase Firestore under content/security_logs (works with existing Firestore rules)
    try {
      await dbSet('content', 'security_logs', {
        logs: trimmedLogs,
        _srvSecret: SERVER_SECRET,
        _lastUpdated: now.toISOString()
      });
    } catch (fbErr) {
      console.warn('Firestore security log sync warning (using local backup):', (fbErr as any)?.message || fbErr);
    }

    console.log(`[SECURITY ALERT] ${event.type}: IP ${event.ip} (${location}) - User: "${event.triedUsername}"`);
  } catch (err) {
    console.error('Failed to log security event:', err);
  }
}

// ================= API ROUTES =================

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

// 1. Admin Login (Brute-force protected, Timing-safe, Firestore + .env synced)
app.post('/api/admin/login', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const now = Date.now();

    // 1. Check Brute-Force Rate Limiting
    const ipRecord = loginRateLimitMap.get(ip);
    if (ipRecord && ipRecord.lockedUntil > now) {
      const waitMinutes = Math.ceil((ipRecord.lockedUntil - now) / 60000);
      return res.status(429).json({
        error: `Çok fazla hatalı giriş denemesi yapıldı. Güvenlik nedeniyle erişiminiz ${waitMinutes} dakika boyunca askıya alınmıştır.`
      });
    }

    const rawUser = req.body?.username;
    const rawPass = req.body?.password;

    if (!rawUser || !rawPass || typeof rawUser !== 'string' || typeof rawPass !== 'string') {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
    }

    const cleanUser = rawUser.trim().slice(0, 128);
    const cleanPass = rawPass.trim().slice(0, 256);

    // 2. Load active admin users from Firestore (content/admin_users) + local backup
    const admins = await syncAndGetAdminUsers();
    const matchedAdmin = admins.find(
      (a) => a.active !== false && a.username.toLowerCase() === cleanUser.toLowerCase()
    );

    let isAuthValid = false;
    let resolvedUsername = EXPECTED_USERNAME;

    if (matchedAdmin) {
      const computedHash = (await pbkdf2Async(cleanPass, matchedAdmin.salt, 100000, 32, 'sha256'))
        .toString('hex')
        .toLowerCase();
      try {
        const a = Buffer.from(computedHash, 'utf-8');
        const b = Buffer.from(matchedAdmin.passwordHash.toLowerCase(), 'utf-8');
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          isAuthValid = true;
          resolvedUsername = matchedAdmin.username;
        }
      } catch {
        isAuthValid = false;
      }
    } else {
      // Perform dummy PBKDF2 work so timing is identical even when username is unknown
      const dummyHash = (await pbkdf2Async(cleanPass, PASSWORD_SALT, 100000, 32, 'sha256'))
        .toString('hex')
        .toLowerCase();
      // Fallback check against root EXPECTED_USERNAME if it wasn't explicitly disabled in Firestore
      const rootInList = admins.find((a) => a.username.toLowerCase() === EXPECTED_USERNAME.toLowerCase());
      if (!rootInList && cleanUser.toLowerCase() === EXPECTED_USERNAME.toLowerCase()) {
        try {
          const a = Buffer.from(dummyHash, 'utf-8');
          const b = Buffer.from(EXPECTED_PASSWORD_HASH, 'utf-8');
          if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
            isAuthValid = true;
            resolvedUsername = EXPECTED_USERNAME;
          }
        } catch {}
      }
    }

    if (!isAuthValid) {
      let currentAttempts = ipRecord?.attempts || 0;
      if (ipRecord && ipRecord.lockedUntil > 0 && ipRecord.lockedUntil <= now) {
        currentAttempts = 0;
      }
      if (ipRecord && ipRecord.lastAttempt && now - ipRecord.lastAttempt > LOGIN_LOCKOUT_MS) {
        currentAttempts = 0;
      }
      currentAttempts += 1;

      const isLocked = currentAttempts >= MAX_LOGIN_ATTEMPTS;
      const lockedUntil = isLocked ? now + LOGIN_LOCKOUT_MS : 0;
      loginRateLimitMap.set(ip, { attempts: currentAttempts, lockedUntil, lastAttempt: now });

      logSecurityEvent({
        ip,
        type: isLocked ? 'LOCKOUT' : 'FAILED_ATTEMPT',
        attempts: currentAttempts,
        triedUsername: cleanUser,
        userAgent: (req.headers['user-agent'] as string) || 'Bilinmiyor'
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - currentAttempts);
      const errorMsg = isLocked
        ? 'Çok fazla hatalı deneme! Güvenlik nedeniyle erişiminiz 15 dakika boyunca kilitlenmiştir.'
        : `Hatalı kullanıcı adı veya şifre. Kalan deneme hakkı: ${remaining}`;

      return res.status(isLocked ? 429 : 401).json({ error: errorMsg });
    }

    // Success: Reset rate limit record
    loginRateLimitMap.delete(ip);
    const { token, expiresAt } = generateSessionToken(resolvedUsername);

    return res.json({
      success: true,
      message: 'Giriş başarılı.',
      token,
      expiresAt,
      user: resolvedUsername
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Giriş işlemi sırasında sunucu hatası oluştu.' });
  }
});

// 2. Admin Verify Session
app.get('/api/admin/verify', requireAdminAuth, (req: Request, res: Response) => {
  return res.json({ success: true, valid: true });
});

// 3. Admin Logout (revokes the token server-side so a stolen copy stops working immediately)
app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (verifySessionToken(token)) {
      revokeSessionToken(token);
    }
  }
  return res.json({ success: true, message: 'Çıkış yapıldı.' });
});

// 3.1 Security Logs API (Protected by requireAdminAuth)
app.get('/api/admin/security-logs', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    let logs: any[] = [];
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
      const snap = await Promise.race([dbGet('content', 'security_logs'), timeoutPromise]);
      if (snap && snap.exists && Array.isArray(snap.data?.logs)) {
        logs = snap.data.logs;
      }
    } catch {}

    const localLogs = readLocalSecurityLogs();
    if (localLogs.length > logs.length) {
      logs = localLogs;
    }

    const activeLockouts = Array.from(loginRateLimitMap.entries())
      .filter(([_, rec]) => rec.lockedUntil > Date.now())
      .map(([ip, rec]) => ({
        ip,
        lockedUntil: rec.lockedUntil,
        remainingMinutes: Math.ceil((rec.lockedUntil - Date.now()) / 60000)
      }));

    return res.json({ success: true, logs, activeLockouts });
  } catch (err: any) {
    return res.status(500).json({ error: 'Güvenlik kayıtları alınamadı: ' + err.message });
  }
});

// 3.2 Security Unban IP API (Protected by requireAdminAuth)
app.post('/api/admin/security-unban', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'IP adresi zorunludur.' });
    }
    loginRateLimitMap.delete(ip);
    return res.json({ success: true, message: `${ip} adresinin ban kilidi başarıyla kaldırıldı.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Ban kaldırma hatası: ' + err.message });
  }
});

// 3.3 Security Clear Logs API (Protected by requireAdminAuth)
app.delete('/api/admin/security-logs', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    writeLocalSecurityLogs([]);
    try {
      await dbSet('content', 'security_logs', {
        logs: [],
        _srvSecret: SERVER_SECRET,
        _lastUpdated: new Date().toISOString()
      });
    } catch {}
    return res.json({ success: true, message: 'Tüm güvenlik kayıtları temizlendi.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Kayıt temizleme hatası: ' + err.message });
  }
});

// 4. Secure Public Form Submission (Anti-spam, Honeypot, Input sanitization)
app.post('/api/submit-form', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const now = Date.now();

  // Rate Limiting (max 5 submissions per IP in 10 minutes)
  const rateRecord = formRateLimitMap.get(ip) || { count: 0, resetTime: now + 10 * 60 * 1000 };
  if (now > rateRecord.resetTime) {
    rateRecord.count = 0;
    rateRecord.resetTime = now + 10 * 60 * 1000;
  }
  if (rateRecord.count >= 5) {
    return res.status(429).json({ error: 'Çok fazla form gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.' });
  }
  rateRecord.count += 1;
  formRateLimitMap.set(ip, rateRecord);

  // Honeypot bot trap
  const bodyData = (req.body && req.body.data && typeof req.body.data === 'object') ? req.body.data : req.body;
  if (bodyData._gotcha || bodyData._bot_trap || req.body._gotcha || req.body._bot_trap) {
    // Silently return success to waste bot's time without storing junk
    return res.json({ success: true, message: 'İşlem tamamlandı.' });
  }

  const {
    type,
    name,
    Ad_Soyad,
    email,
    Email,
    phone,
    Telefon,
    message,
    Mesaj,
    subject,
    Konu,
    ...extraFields
  } = bodyData;

  const resolvedName = (name || Ad_Soyad || '').toString().trim().slice(0, 100);
  const resolvedEmail = (email || Email || '').toString().trim().slice(0, 150);
  const resolvedPhone = (phone || Telefon || '').toString().trim().slice(0, 40);
  const resolvedMessage = (message || Mesaj || '').toString().trim().slice(0, 3000);
  const resolvedSubject = (subject || Konu || '').toString().trim().slice(0, 150);

  // Basic validation
  if (!resolvedName || !resolvedEmail) {
    return res.status(400).json({ error: 'İsim ve E-posta alanları zorunludur.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(resolvedEmail)) {
    return res.status(400).json({ error: 'Geçersiz e-posta adresi formatı.' });
  }

  const sanitizedData: Record<string, any> = {
    type: (typeof type === 'string' && type.trim() ? type.trim() : 'contact').slice(0, 50),
    name: resolvedName,
    Ad_Soyad: resolvedName,
    email: resolvedEmail,
    Email: resolvedEmail,
    phone: resolvedPhone,
    Telefon: resolvedPhone,
    message: resolvedMessage,
    Mesaj: resolvedMessage,
    subject: resolvedSubject,
    Konu: resolvedSubject,
    timestamp: new Date().toISOString()
  };

  // Sanitize extra fields (e.g. from expo application)
  for (const [k, v] of Object.entries(extraFields)) {
    if (k.startsWith('_') || typeof v === 'function') continue;
    if (typeof v === 'string') {
      sanitizedData[k] = v.trim().slice(0, 1000);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      sanitizedData[k] = v;
    }
  }

  try {
    await dbAdd('form_submissions', sanitizedData);

    // Forward notification asynchronously
    try {
      fetch('https://formsubmit.co/ajax/sarge.iha.2025.2026@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          Ad_Soyad: resolvedName,
          Email: resolvedEmail,
          Telefon: resolvedPhone,
          Mesaj: resolvedMessage,
          Konu: resolvedSubject,
          type: sanitizedData.type
        })
      }).catch((err) => console.warn('Notification webhook error:', err));
    } catch {
      // Ignored non-blocking error
    }

    return res.json({ success: true, message: 'Mesajınız başarıyla iletildi. En kısa sürede dönüş yapılacaktır.' });
  } catch (err: any) {
    console.error('Firestore submission write error:', err);
    return res.status(500).json({ error: 'Form kaydedilirken sunucu hatası oluştu.' });
  }
});

// 5. Admin: Get Submissions (Protected by requireAdminAuth)
app.get('/api/admin/submissions', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const rows = await dbList('form_submissions');
    const submissions = rows.map(r => {
      const data = { ...r.data };
      delete data._srvSecret; // legacy field from older versions
      return { id: r.id, ...data };
    });

    // Sort by timestamp desc in memory
    submissions.sort((a: any, b: any) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    return res.json({ success: true, data: submissions });
  } catch (err: any) {
    console.error('Fetch submissions error:', err);
    return res.status(500).json({ error: 'Başvurular alınırken hata oluştu.' });
  }
});

// 6. Admin: Delete Submission (Protected by requireAdminAuth)
app.delete('/api/admin/submissions/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Geçersiz başvuru ID.' });
  }

  try {
    await dbDelete('form_submissions', id);
    return res.json({ success: true, message: 'Başvuru silindi.' });
  } catch (err: any) {
    console.error('Delete submission error:', err);
    return res.status(500).json({ error: 'Başvuru silinirken hata oluştu.' });
  }
});

// 7. Admin: Save Content Document (Protected by requireAdminAuth)
const ALLOWED_CONTENT_DOCS = [
  'site_settings',
  'site_banners',
  'projects_data',
  'spotlights',
  'about_teams',
  'footer_sections',
  'homepage_vision_mission',
  'homepage_stats',
  'sponsors'
];

// 7. Public: Get Content Document (with Firestore + local fallback)
app.get('/api/content/:docId', async (req: Request, res: Response) => {
  const { docId } = req.params;
  if (!ALLOWED_CONTENT_DOCS.includes(docId)) {
    return res.status(400).json({ error: 'Geçersiz içerik dokümanı.' });
  }

  // Fast-track projects_data & about_teams from local storage (eliminates Firestore latency/timeout)
  if (docId === 'projects_data') {
    try {
      const filePath = path.join(process.cwd(), 'db_projects.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
          return res.json(parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading db_projects.json:', e);
    }
  }

  if (docId === 'about_teams') {
    try {
      const filePath = path.join(process.cwd(), 'db_teams.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
          return res.json({ 
            data: parsed.data, 
            teams: parsed.data, 
            socialUnit: parsed.socialUnit || null,
            socialUnits: parsed.socialUnits || [] 
          });
        }
      }
    } catch (e) {
      console.warn('Error reading db_teams.json:', e);
    }
  }

  if (docId === 'site_banners') {
    try {
      const filePath = path.join(process.cwd(), 'db_banners.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return res.json({
            heroBannerBg: parsed.heroBannerBg ?? '',
            teamsBannerBg: parsed.teamsBannerBg ?? ''
          });
        }
      }
    } catch (e) {
      console.warn('Error reading db_banners.json:', e);
    }
  }

  if (docId === 'site_settings') {
    try {
      const filePath = path.join(process.cwd(), 'db_settings.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return res.json(parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading db_settings.json:', e);
    }
  }

  try {
    // Attempt Firestore with strict 2000ms timeout
    const firestorePromise = dbGet('content', docId);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const snap = await Promise.race([firestorePromise, timeoutPromise]);

    if (snap && snap.exists) {
      const data = { ...snap.data };
      delete data._srvSecret;
      if (docId === 'footer_sections') {
        const list = data.data || data.sections;
        data.data = list;
        data.sections = list;
      }
      if (docId === 'about_teams') {
        const list = data.data || data.teams;
        data.data = list;
        data.teams = list;
      }
      if (docId === 'site_banners') {
        return res.json({
          heroBannerBg: data.heroBannerBg ?? '',
          teamsBannerBg: data.teamsBannerBg ?? ''
        });
      }
      return res.json(data);
    }

    if (docId === 'projects_data') {
      try {
        const filePath = path.join(process.cwd(), 'db_projects.json');
        if (fs.existsSync(filePath)) {
          return res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
        }
      } catch {}
    }

    if (docId === 'about_teams') {
      try {
        const filePath = path.join(process.cwd(), 'db_teams.json');
        if (fs.existsSync(filePath)) {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          return res.json({ data: parsed.data, teams: parsed.data });
        }
      } catch {}
    }

    if (docId === 'site_banners') {
      return res.json({ heroBannerBg: '', teamsBannerBg: '' });
    }

    return res.status(404).json({ error: 'Doküman bulunamadı.' });
  } catch (err) {
    if (docId === 'projects_data') {
      try {
        const filePath = path.join(process.cwd(), 'db_projects.json');
        if (fs.existsSync(filePath)) {
          return res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
        }
      } catch {}
    }
    if (docId === 'about_teams') {
      try {
        const filePath = path.join(process.cwd(), 'db_teams.json');
        if (fs.existsSync(filePath)) {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          return res.json({ data: parsed.data, teams: parsed.data });
        }
      } catch {}
    }
    if (docId === 'site_banners') {
      return res.json({ heroBannerBg: '', teamsBannerBg: '' });
    }
    return res.status(500).json({ error: 'İçerik yüklenirken hata oluştu.' });
  }
});

app.post('/api/admin/content/:docId', requireAdminAuth, async (req: Request, res: Response) => {
  const { docId } = req.params;
  if (!ALLOWED_CONTENT_DOCS.includes(docId)) {
    return res.status(400).json({ error: 'Geçersiz içerik dokümanı.' });
  }

  try {
    const payload = req.body;

    if (docId === 'footer_sections') {
      const list = payload.data || payload.sections;
      payload.data = list;
      payload.sections = list;
    }
    if (docId === 'about_teams') {
      const list = payload.data || payload.teams;
      payload.data = list;
      payload.teams = list;
    }

    // 1. If saving projects_data, update local db_projects.json immediately
    if (docId === 'projects_data' && payload && payload.data) {
      try {
        const filePath = path.join(process.cwd(), 'db_projects.json');
        fs.writeFileSync(filePath, JSON.stringify({ data: payload.data }, null, 2), 'utf-8');
        console.log(`[Content] db_projects.json successfully updated with ${payload.data.length} projects.`);
      } catch (e) {
        console.error('Could not sync db_projects.json:', e);
      }
    }

    // If saving about_teams, update local db_teams.json immediately
    if (docId === 'about_teams' && payload && (payload.data || payload.teams)) {
      try {
        const filePath = path.join(process.cwd(), 'db_teams.json');
        const teamsList = payload.data || payload.teams;
        fs.writeFileSync(filePath, JSON.stringify({ 
          data: teamsList, 
          teams: teamsList,
          socialUnit: payload.socialUnit || null,
          expoUnit: payload.expoUnit || null,
          socialUnits: payload.socialUnits || [] 
        }, null, 2), 'utf-8');
        console.log(`[Content] db_teams.json successfully updated with ${teamsList.length} teams.`);
      } catch (e) {
        console.error('Could not sync db_teams.json:', e);
      }
    }

    // If saving site_banners, update local db_banners.json immediately
    if (docId === 'site_banners' && payload) {
      try {
        const filePath = path.join(process.cwd(), 'db_banners.json');
        const bannerPayload = {
          heroBannerBg: payload.heroBannerBg !== undefined ? payload.heroBannerBg : '',
          teamsBannerBg: payload.teamsBannerBg !== undefined ? payload.teamsBannerBg : ''
        };
        fs.writeFileSync(filePath, JSON.stringify(bannerPayload, null, 2), 'utf-8');
        console.log(`[Content] db_banners.json successfully updated:`, bannerPayload);
      } catch (e) {
        console.error('Could not sync db_banners.json:', e);
      }
    }

    // If saving site_settings, update local db_settings.json immediately
    if (docId === 'site_settings' && payload) {
      try {
        const filePath = path.join(process.cwd(), 'db_settings.json');
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      } catch (e) {
        console.error('Could not sync db_settings.json:', e);
      }
    }

    // 2. Sync directly to Firestore
    const documentData = {
      ...payload,
      _srvSecret: SERVER_SECRET,
      _lastUpdated: new Date().toISOString()
    };

    try {
      await dbSet('content', docId, documentData);
      console.log(`[Content] Firestore doc content/${docId} successfully updated.`);
    } catch (fsErr: any) {
      console.warn(`[Content] Firestore setDoc for ${docId} warning (using local backup):`, fsErr?.message || fsErr);
      return res.json({
        success: true,
        message: `${docId} başarıyla kaydedildi.`,
        data: payload.data || payload.teams || payload
      });
    }

    return res.json({ success: true, message: `${docId} başarıyla kaydedildi.`, data: payload.data || payload });
  } catch (err: any) {
    console.error('Save content error:', err);
    return res.status(500).json({ error: 'İçerik kaydedilirken hata oluştu: ' + (err?.message || 'Bilinmeyen hata') });
  }
});

// 8. Admin: Save Gallery Image (Protected by requireAdminAuth)
app.post('/api/admin/gallery', requireAdminAuth, async (req: Request, res: Response) => {
  const { id, title, category, imageUrl, date, location, description } = req.body;
  
  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ error: 'Görsel URL zorunludur.' });
  }

  // Prevent XSS in URLs
  if (imageUrl.startsWith('javascript:') || imageUrl.startsWith('data:text/html')) {
    return res.status(400).json({ error: 'Güvenlik hatası: Geçersiz görsel bağlantısı.' });
  }

  const imgData = {
    title: (title || '').toString().slice(0, 200),
    category: (category || 'atolye').toString().slice(0, 50),
    imageUrl: imageUrl.slice(0, 800000),
    date: (date || new Date().toISOString().split('T')[0]).toString().slice(0, 50),
    location: (location || '').toString().slice(0, 100),
    description: (description || '').toString().slice(0, 1000),
    timestamp: new Date().toISOString()
  };

  try {
    if (id) {
      await dbSet('gallery', String(id), imgData, true);
      return res.json({ success: true, message: 'Fotoğraf güncellendi.' });
    } else {
      const newId = await dbAdd('gallery', imgData);
      return res.json({ success: true, id: newId, message: 'Fotoğraf eklendi.' });
    }
  } catch (err: any) {
    console.error('Save gallery error:', err);
    return res.status(500).json({ error: 'Galeri kaydedilirken hata oluştu.' });
  }
});

// 9. Admin: Delete Gallery Image (Protected by requireAdminAuth)
app.delete('/api/admin/gallery/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await dbDelete('gallery', id);
    return res.json({ success: true, message: 'Fotoğraf silindi.' });
  } catch (err: any) {
    console.error('Delete gallery error:', err);
    return res.status(500).json({ error: 'Fotoğraf silinirken hata oluştu.' });
  }
});

// 10. Admin: Save Announcement / Press News (Protected by requireAdminAuth)
app.post('/api/admin/announcements', requireAdminAuth, async (req: Request, res: Response) => {
  const { id, title, content, summary, source, sourceUrl, imageUrl, category, date } = req.body;
  if (!title || (!content && !summary)) {
    return res.status(400).json({ error: 'Başlık ve içerik / özet alanları zorunludur.' });
  }

  const annData = {
    title: (title || '').toString().slice(0, 300),
    content: (content || summary || '').toString().slice(0, 20000),
    summary: (summary || content || '').toString().slice(0, 2000),
    source: (source || 'Basın Bülteni').toString().slice(0, 100),
    sourceUrl: (sourceUrl || '').toString().slice(0, 1000),
    imageUrl: (imageUrl || '').toString().slice(0, 1000),
    category: (category || 'Ulusal Basın').toString().slice(0, 100),
    date: (date || new Date().toISOString().split('T')[0]).toString().slice(0, 50),
    timestamp: new Date().toISOString()
  };

  try {
    if (id) {
      await dbSet('announcements', String(id), annData, true);
      return res.json({ success: true, message: 'Haber / duyuru güncellendi.' });
    } else {
      const newId = await dbAdd('announcements', annData);
      return res.json({ success: true, id: newId, message: 'Haber / duyuru başarıyla eklendi.' });
    }
  } catch (err: any) {
    console.error('Save announcement error:', err);
    return res.status(500).json({ error: 'Haber kaydedilirken hata oluştu.' });
  }
});

// 11. Admin: Delete Announcement (Protected by requireAdminAuth)
app.delete('/api/admin/announcements/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await dbDelete('announcements', id);
    return res.json({ success: true, message: 'Duyuru silindi.' });
  } catch (err: any) {
    console.error('Delete announcement error:', err);
    return res.status(500).json({ error: 'Duyuru silinirken hata oluştu.' });
  }
});

// 12. Media Upload Endpoint (Video & Photo upload) - admin only; SVG/HTML are intentionally NOT allowed (stored XSS)
const ALLOWED_UPLOAD_EXTENSIONS = ['.mp4', '.webm', '.mov', '.ogg', '.jpg', '.jpeg', '.png', '.webp'];
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
const handleUploadMediaRequest = (req: Request, res: Response) => {
  try {
    const { fileName, fileData } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: 'Dosya verisi eksik.' });
    }

    let buffer: Buffer;
    let ext = '.mp4';
    if (typeof fileData === 'string' && fileData.includes('base64,')) {
      const parts = fileData.split('base64,');
      const mimeMatch = parts[0].match(/data:(.*?);/);
      if (mimeMatch) {
        const mime = mimeMatch[1];
        if (mime.includes('webm')) ext = '.webm';
        else if (mime.includes('mov') || mime.includes('quicktime')) ext = '.mov';
        else if (mime.includes('ogg')) ext = '.ogg';
        else if (mime.includes('png')) ext = '.png';
        else if (mime.includes('webp')) ext = '.webp';
        else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
        else if (mime.includes('mp4')) ext = '.mp4';
      }
      buffer = Buffer.from(parts[1], 'base64');
    } else if (typeof fileData === 'string') {
      buffer = Buffer.from(fileData, 'base64');
    } else {
      return res.status(400).json({ error: 'Geçersiz dosya formatı.' });
    }

    if (fileName && path.extname(fileName)) {
      const requestedExt = path.extname(fileName).toLowerCase();
      if (ALLOWED_UPLOAD_EXTENSIONS.includes(requestedExt)) {
        ext = requestedExt;
      }
    }
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: 'Desteklenmeyen dosya türü.' });
    }

    const safeName = `media_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${safeName}`;
    console.log(`[Upload] File saved successfully: ${publicUrl} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    return res.json({ success: true, url: publicUrl, message: 'Dosya başarıyla yüklendi.' });
  } catch (err: any) {
    console.error('Media upload error:', err);
    return res.status(500).json({ error: 'Medya sunucuya kaydedilirken hata oluştu: ' + (err?.message || err) });
  }
};

app.post('/api/admin/upload-media', requireAdminAuth, handleUploadMediaRequest);

// 12. Direct Streaming Binary Upload (Protected by requireAdminAuth, whitelisted types, size capped)
app.post('/api/admin/upload-binary', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const rawFileName = (req.query.fileName as string) || 'media.mp4';
    let ext = path.extname(String(rawFileName)).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      ext = '.mp4';
    }

    const safeName = `media_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    const writeStream = fs.createWriteStream(filePath);

    let receivedBytes = 0;
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_UPLOAD_BYTES && !aborted) {
        aborted = true;
        req.unpipe(writeStream);
        writeStream.destroy();
        fs.unlink(filePath, () => {});
        res.status(413).json({ error: 'Dosya çok büyük (en fazla 200 MB).' });
        req.destroy();
      }
    });

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      if (aborted) return;
      console.log(`[Upload Binary] File streamed to disk: /uploads/${safeName}`);
      return res.json({ success: true, url: `/uploads/${safeName}` });
    });

    writeStream.on('error', (err) => {
      if (aborted) return;
      console.error('[Upload Binary] Write stream error:', err);
      return res.status(500).json({ error: 'Dosya diske yazılamadı: ' + err.message });
    });
  } catch (err: any) {
    console.error('[Upload Binary] Error:', err);
    return res.status(500).json({ error: err?.message || 'Yükleme hatası' });
  }
});

// 13. Google Drive Video Stream Proxy (Supports HTML5 video byte-range streaming, loops, and no UI overlays)
app.get('/api/stream-drive/:driveId', async (req: Request, res: Response) => {
  const { driveId } = req.params;
  if (!driveId || !/^[a-zA-Z0-9_-]{15,}$/.test(driveId)) {
    return res.status(400).send('Geçersiz Google Drive dosya kimliği.');
  }

  try {
    const rangeHeader = req.headers.range;
    const directUrl = `https://drive.usercontent.google.com/download?id=${driveId}&export=download&authuser=0`;
    const ucUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    let driveResponse = await fetch(directUrl, {
      headers,
      redirect: 'follow'
    });

    // Check if Google returned a virus scan confirmation HTML page for large files
    const cType = driveResponse.headers.get('content-type') || '';
    if (cType.includes('text/html')) {
      const htmlText = await driveResponse.text();
      const confirmMatch = htmlText.match(/confirm=([0-9a-zA-Z_-]+)/) || htmlText.match(/name="confirm"\s+value="([^"]+)"/);
      const confirmCode = confirmMatch ? confirmMatch[1] : 't';
      const confirmedUrl = `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=${confirmCode}&authuser=0`;

      driveResponse = await fetch(confirmedUrl, {
        headers,
        redirect: 'follow'
      });
    }

    // If still not ok, fallback to uc URL
    if (!driveResponse.ok && driveResponse.status !== 206) {
      driveResponse = await fetch(ucUrl, {
        headers,
        redirect: 'follow'
      });
    }

    if (!driveResponse.ok && driveResponse.status !== 206) {
      console.warn(`[Drive Stream] Fetch failed for ${driveId}: status ${driveResponse.status}`);
      return res.status(driveResponse.status).send('Google Drive video akışı alınamadı. Lütfen dosyanın "Bağlantıya sahip herkes" olarak paylaşıldığından emin olun.');
    }

    // Forward status code (200 or 206 Partial Content)
    res.status(driveResponse.status);

    // Forward streaming headers
    const headersToForward = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    headersToForward.forEach((h) => {
      const val = driveResponse.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    });

    if (!res.getHeader('content-type')) {
      res.setHeader('Content-Type', 'video/mp4');
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Stream chunks directly to response
    if (driveResponse.body) {
      // @ts-ignore
      for await (const chunk of driveResponse.body as any) {
        res.write(chunk);
      }
      res.end();
    } else {
      const buf = Buffer.from(await driveResponse.arrayBuffer());
      res.send(buf);
    }
  } catch (err: any) {
    console.error(`[Drive Stream Error] For ${driveId}:`, err?.message || err);
    if (!res.headersSent) {
      res.status(500).send('Google Drive video akışı hatası.');
    }
  }
});

// 14. Google Drive Image Proxy (Fetches public drive file and serves as cached image)
app.get('/api/drive-image/:driveId', async (req: Request, res: Response) => {
  const { driveId } = req.params;
  if (!driveId || !/^[a-zA-Z0-9_-]{15,}$/.test(driveId)) {
    return res.status(400).send('Geçersiz Drive ID.');
  }

  try {
    const urls = [
      `https://lh3.googleusercontent.com/d/${driveId}=s1600`,
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`,
      `https://drive.usercontent.google.com/download?id=${driveId}&export=download&authuser=0`,
      `https://drive.google.com/uc?export=download&id=${driveId}`
    ];

    for (const u of urls) {
      try {
        const response = await fetch(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
        });
        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          if (!contentType.includes('text/html')) {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
            const buffer = Buffer.from(await response.arrayBuffer());
            return res.send(buffer);
          }
        }
      } catch {}
    }

    return res.status(404).send('Görsel bulunamadı veya erişim izni yok.');
  } catch (err) {
    return res.status(500).send('Görsel sunucu hatası.');
  }
});

// (The old public /api/security-audit endpoint was removed: it advertised protections - some of them untrue - to attackers.)

// ================= VITE / FRONTEND SERVING =================
async function startServer() {
  await initAdminFirestore();
  // Ensure Firestore content/admin_users document exists and is synced on startup
  syncAndGetAdminUsers().catch(() => {});

  // Periodically drop stale brute-force / form-rate-limit records so the maps cannot grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of loginRateLimitMap) {
      const lockExpired = rec.lockedUntil <= now;
      const attemptsStale = !rec.lastAttempt || now - rec.lastAttempt > LOGIN_LOCKOUT_MS;
      if (lockExpired && attemptsStale) loginRateLimitMap.delete(ip);
    }
    for (const [ip, rec] of formRateLimitMap) {
      if (now > rec.resetTime) formRateLimitMap.delete(ip);
    }
  }, 10 * 60 * 1000).unref();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SARGE Security Server] Running on port ${PORT}`);
  });
}

startServer();
