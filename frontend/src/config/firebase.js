import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// ponytail: env vars — set these in .env, Vercel dashboard, or similar
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;

let auth = null;
let googleProvider = null;

if (apiKey && authDomain && projectId && appId) {
  try {
    const firebaseConfig = {
      apiKey,
      authDomain,
      projectId,
      appId,
    };
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
  }
} else {
  console.warn("Firebase environment variables are missing. Google Sign-In will be disabled.");
}

export { auth, googleProvider };

