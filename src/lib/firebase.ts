import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseEnabled(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseEnabled()) return null;
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
}

export async function firebaseLogin(email: string, password: string): Promise<string> {
  const a = getFirebaseAuth();
  if (!a) throw new Error("Firebase is not configured");
  const cred = await signInWithEmailAndPassword(a, email, password);
  return cred.user.getIdToken();
}

export async function firebaseLogout(): Promise<void> {
  const a = getFirebaseAuth();
  if (a) await signOut(a);
}

export async function getFirebaseIdToken(): Promise<string | null> {
  const a = getFirebaseAuth();
  if (!a?.currentUser) return null;
  return a.currentUser.getIdToken();
}

export function subscribeToAuthToken(onToken: (token: string | null) => void): () => void {
  const a = getFirebaseAuth();
  if (!a) return () => {};
  return onIdTokenChanged(a, async (user) => {
    if (!user) {
      onToken(null);
      return;
    }
    onToken(await user.getIdToken());
  });
}
