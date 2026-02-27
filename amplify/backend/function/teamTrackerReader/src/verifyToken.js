let firebaseAdmin = null;

function getFirebaseAdmin() {
  if (!firebaseAdmin) {
    firebaseAdmin = require('firebase-admin');
    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
  }
  return firebaseAdmin;
}

/**
 * Verify a Firebase ID token.
 * @param {string} token - Firebase ID token
 * @returns {{ valid: boolean, email?: string, error?: string }}
 */
async function verifyToken(token) {
  try {
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);

    if (!decoded.email) {
      return { valid: false, error: 'No email in token' };
    }

    const email = decoded.email.toLowerCase();
    if (!email.endsWith('@redhat.com')) {
      return { valid: false, error: 'Only @redhat.com accounts are allowed' };
    }

    return { valid: true, email };
  } catch (error) {
    console.error('[verifyToken] Error:', error.message);
    return { valid: false, error: error.message };
  }
}

module.exports = { verifyToken };
