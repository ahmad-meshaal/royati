import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings to handle potential connection issues in restricted environments
// experimentalForceLongPolling is often required in cloud/proxy environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);
export const storage = getStorage(app);

// Increase retry times to handle potential network delays
(storage as any).maxRetryTime = 60000;
(storage as any).maxOperationRetryTime = 120000;

// Test connection on startup
async function testConnection() {
  try {
    // Try to fetch the test connection document defined in firestore.rules
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful.");
  } catch (error: any) {
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      console.error("Firestore is unavailable. This may be due to an incorrect configuration or a network issue.", error);
    } else {
      // Other errors (like permission denied) still mean we reached the server
      console.log("Firestore reached, but with error:", error.code);
    }
  }
}

testConnection();
