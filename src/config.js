import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- TMDB CONFIGURATION ---
export const TMDB_KEY = "693bb7c1cb06ae9e01982036e6898023";
export const TMDB_BASE = "https://api.themoviedb.org/3";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAWulgAc4SodSdQ_rbut9QoTFpP4Sek5HM",
  authDomain: "watchlist-2ce12.firebaseapp.com",
  projectId: "watchlist-2ce12",
  storageBucket: "watchlist-2ce12.firebasestorage.app",
  messagingSenderId: "278070870340",
  appId: "1:278070870340:web:338e4ee0ac37ea26ab1711"
};

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();