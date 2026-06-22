import { ref } from 'vue'

// Module-level reactive state (singleton across all consumers)
// Extracted to its own module to avoid circular imports between
// useImpersonation.js and api.js (which imports impersonatingUid).
export const impersonatingUid = ref(null)
export const impersonatingName = ref(null)
