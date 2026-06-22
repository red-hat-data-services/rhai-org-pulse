import { defineAsyncComponent } from 'vue'

const aboutTabManifests = import.meta.glob('/platform/*/manifest.json', { eager: true })
const aboutTabComponents = import.meta.glob('/platform/about-tabs/*.vue')

export function loadPlatformAboutTabs() {
  const manifest = aboutTabManifests['/platform/about-tabs/manifest.json']
  if (!manifest) return []
  const tabs = (manifest.default || manifest).tabs || []
  return tabs.map(tab => {
    const normalized = tab.component.replace(/^\.\//, '')
    const globKey = `/platform/about-tabs/${normalized}`
    const loader = aboutTabComponents[globKey]
    if (!loader) {
      console.warn(`Platform about tab component not found: ${globKey}`)
      return null
    }
    return {
      id: tab.id,
      label: tab.label,
      iconName: tab.icon,
      order: tab.order ?? 100,
      requireRole: tab.requireRole || null,
      component: defineAsyncComponent(loader),
      source: 'platform'
    }
  }).filter(Boolean)
}
