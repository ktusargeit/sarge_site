import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  projectId: "ringed-unfolding-d8chg",
  appId: "1:339579772484:web:f4941822dc9e20eface611",
  apiKey: "AIzaSyAk9_0E9JeZoMPFAywNOn1RJaipLamwKkY",
  authDomain: "ringed-unfolding-d8chg.firebaseapp.com",
  storageBucket: "ringed-unfolding-d8chg.firebasestorage.app",
  messagingSenderId: "339579772484",
  measurementId: ""
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-ktsargesavunmave-7c8ef8da-dd5e-42e6-936e-e48551879efe");
export const auth = getAuth(app);

export const storage = getStorage(app);