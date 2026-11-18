import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'fake-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    (isLocalhost ? 'dailycheckin-local' : 'dailycheckin-dev'),
};

const app: FirebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

let emulatorConnected = false;

const emulatorUrl =
  import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ||
  (isLocalhost ? 'http://localhost:9099' : '');

if (emulatorUrl && !emulatorConnected && import.meta.env.MODE !== 'test') {
  connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
  emulatorConnected = true;
}

export default app;
