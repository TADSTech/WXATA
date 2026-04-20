import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjRqkUqaar8h9_20Kf3LV7adnOC8-nYNU",
  authDomain: "wxata-78dba.firebaseapp.com",
  projectId: "wxata-78dba",
  storageBucket: "wxata-78dba.firebasestorage.app",
  messagingSenderId: "416769061296",
  appId: "1:416769061296:web:942fe5c4771f4927576675"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
