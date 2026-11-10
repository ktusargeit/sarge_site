import { doc, getDoc, DocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const cache: Record<string, any> = {};
const fetchPromises: Record<string, Promise<any>> = {};

// Helper to fetch with timeout and fallback
async function fetchDocumentData(collectionName: string, docId: string): Promise<any> {
  // 1. If it's a content document, try our local server endpoint first (fast, reliable, no gRPC/CORS)
  if (collectionName === 'content') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`/api/content/${docId}`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (json && (json.data || Object.keys(json).length > 0)) {
          return json;
        }
      }
    } catch {
      // Local endpoint failed or timed out, fall through to Firestore
    }
  }

  // 2. Try Firestore SDK with 2000ms timeout guard
  try {
    const firestorePromise = getDoc(doc(db, collectionName, docId));
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const snap = await Promise.race([firestorePromise, timeoutPromise]) as DocumentSnapshot | null;

    if (snap && snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn(`Firestore read failed for ${collectionName}/${docId}:`, err);
  }

  return null;
}

// Returns a mock snapshot to keep compatibility with existing code
export const getCachedDoc = async (collectionName: string, docId: string): Promise<{ exists: () => boolean, data: () => any }> => {
  const cacheKey = `${collectionName}_${docId}`;
  
  if (cache[cacheKey] !== undefined) {
    return {
      exists: () => cache[cacheKey] !== null,
      data: () => cache[cacheKey]
    };
  }
  
  if (!fetchPromises[cacheKey]) {
    fetchPromises[cacheKey] = fetchDocumentData(collectionName, docId).then((data) => {
      cache[cacheKey] = data;
      return {
        exists: () => cache[cacheKey] !== null,
        data: () => cache[cacheKey]
      };
    }).catch(() => {
      delete fetchPromises[cacheKey];
      return {
        exists: () => false,
        data: () => null
      };
    });
  }
  
  return fetchPromises[cacheKey];
};

export const clearCache = (collectionName?: string, docId?: string) => {
  if (collectionName && docId) {
    const key = `${collectionName}_${docId}`;
    delete cache[key];
    delete fetchPromises[key];
  } else {
    for (const key in cache) delete cache[key];
    for (const key in fetchPromises) delete fetchPromises[key];
  }
};
