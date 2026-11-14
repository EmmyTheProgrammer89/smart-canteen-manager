
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBd5FqfIKxm_-mXpZa5ZPd-__u1kzanusc",
    authDomain: "smart-canteen-manager.firebaseapp.com",
    projectId: "smart-canteen-manager",
    storageBucket: "smart-canteen-manager.firebasestorage.app",
    messagingSenderId: "639904813063",
    appId: "1:639904813063:web:a98fe351e257e8732f1aa2",
    measurementId: "G-R5XRJBJJDM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
const auth = getAuth(app);

// Initialize Firestore Database
const db = getFirestore(app);

export { app, auth, db };

