export const KNOWN_PRODUCTS = ['base-images', 'rhel-ai', 'rhoai', 'rhaii']

export function extractProduct(releaseNumber) {
  const s = (releaseNumber || '').toLowerCase()
  for (const p of KNOWN_PRODUCTS) {
    if (s.startsWith(p + '-') && /\d/.test(s[p.length + 1])) return p
  }
  const m = s.match(/^(.+?)-(\d.*)$/)
  return m ? m[1] : ''
}
