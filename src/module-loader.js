import { defineAsyncComponent } from 'vue'

const manifestModules = import.meta.glob('/modules/*/module.json', { eager: true })
const clientEntries = import.meta.glob('/modules/*/client/index.js')
const settingsComponents = import.meta.glob('/modules/*/client/components/*Settings.vue')
const widgetComponents = import.meta.glob('/modules/*/client/components/*Widget.vue')

export function loadModuleManifests() {
  const modules = []
  for (const [path, manifest] of Object.entries(manifestModules)) {
    const slug = path.split('/')[2]
    modules.push({ ...manifest.default || manifest, slug })
  }
  return modules.sort((a, b) => (a.order || 100) - (b.order || 100))
}

export async function loadModuleClient(slug) {
  if (slug.includes('..') || slug.includes('/')) return null
  const loader = clientEntries[`/modules/${slug}/client/index.js`]
  if (!loader) return null
  return loader()
}

const _widgetCache = new Map()

export function loadModuleWidgetComponent(slug, widgetPath) {
  if (!widgetPath || widgetPath.includes('..')) return null
  const cacheKey = `${slug}:${widgetPath}`
  if (_widgetCache.has(cacheKey)) return _widgetCache.get(cacheKey)
  const normalized = widgetPath.replace(/^\.\//, '')
  const globKey = `/modules/${slug}/${normalized}`
  const loader = widgetComponents[globKey]
  if (!loader) return null
  const component = defineAsyncComponent(loader)
  _widgetCache.set(cacheKey, component)
  return component
}

export function loadModuleSettingsComponent(slug, settingsPath) {
  // Prevent path traversal in settings component path
  if (settingsPath.includes('..')) {
    throw new Error(`Invalid settings path for module "${slug}": path traversal not allowed`)
  }
  // Normalize ./client/... to client/...
  const normalized = settingsPath.replace(/^\.\//, '')
  const globKey = `/modules/${slug}/${normalized}`
  const loader = settingsComponents[globKey]
  if (!loader) {
    throw new Error(`Settings component not found for module "${slug}": ${globKey}`)
  }
  return defineAsyncComponent(loader)
}
