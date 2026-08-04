// ទាញយកមុខងារពី Firebase
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// កូដសោរផ្ទាល់ខ្លួនរបស់អ្នក (Firebase Configuration)
const firebaseConfig = {
  apiKey: "AIzaSyDB9bMfh9SbeaTkofP2md_VYY6aA8wNSsg",
  authDomain: "expensetracker-bee52.firebaseapp.com",
  projectId: "expensetracker-bee52",
  storageBucket: "expensetracker-bee52.firebasestorage.app",
  messagingSenderId: "51112265374",
  appId: "1:51112265374:web:5a3f604fc465f69240dd8f",
};

// ដំណើរការ Firebase និង Database
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
