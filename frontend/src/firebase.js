// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD7K8ZdTY3V2_gUZO-3JkAkS7wFSbc1JWg",
  authDomain: "abcd-b6381.firebaseapp.com",
  projectId: "abcd-b6381",
  storageBucket: "abcd-b6381.firebasestorage.app",
  messagingSenderId: "207191904504",
  appId: "1:207191904504:web:434f6b0bea51491e076b0d",
  measurementId: "G-0DSE7P7DN0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;