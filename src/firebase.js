import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAmn_6YEKTMGVg-DKxCe9JzrTQxtQVNRyU",
  authDomain: "ronds-871a2.firebaseapp.com",
  projectId: "ronds-871a2",
  storageBucket: "ronds-871a2.firebasestorage.app",
  messagingSenderId: "316509599906",
  appId: "1:316509599906:web:ab85272dfda121b9bdfffb",
  measurementId: "G-RCM2FNT4HH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
