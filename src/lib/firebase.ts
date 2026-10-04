import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD1DNQM4WHvhi47CguiIK99Apaq7FYgbrM",
  authDomain: "torneos-6cd4b.firebaseapp.com",
  projectId: "torneos-6cd4b",
  storageBucket: "torneos-6cd4b.firebasestorage.app",
  messagingSenderId: "903696146795",
  appId: "1:903696146795:web:d36e00ef40ea865d4fec2e",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const fdb = getFirestore(app);
