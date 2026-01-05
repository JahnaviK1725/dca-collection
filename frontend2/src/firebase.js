import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  connectFirestoreEmulator
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDx12Qx1VeTXMW5j9qm4O8p7LHzEzWHL8w",
  authDomain: "fedex-dca.firebaseapp.com",
  projectId: "fedex-dca",
  storageBucket: "fedex-dca.appspot.com",
  messagingSenderId: "1023428629114",
  appId: "1:1023428629114:web:6309eba3af4c8c0dbb61c3",
};

const app = initializeApp(firebaseConfig);

/**
 * 🚨 Firestore ONLY - Long polling + no streams = NO WebSocket errors
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

if (window.location.hostname === "localhost") {
  connectFirestoreEmulator(db, "localhost", 8085);
  console.log("🔥 Firestore Emulator connected (long polling)");
}
