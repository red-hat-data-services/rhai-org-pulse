import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
}

const app = initializeApp(firebaseConfig, 'team-tracker')
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Force account selection on sign-in
googleProvider.setCustomParameters({
  prompt: 'select_account'
})
