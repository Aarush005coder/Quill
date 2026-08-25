// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD7*********3JkAkS7wFSbc1JWg",
  authDomain: "abcd-b6381.firebaseapp.com",
  projectId: "ab****81",
  storageBucket: "abcd-b6381.firebasestorage.app",
  messagingSenderId: "20******4504",
  appId: "1:207191904504:web:434f6*****91e076b0d",
  measurementId: "G-0D****7DN0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;
