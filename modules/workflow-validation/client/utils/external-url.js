export function safeExternalUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(String(value))
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}
