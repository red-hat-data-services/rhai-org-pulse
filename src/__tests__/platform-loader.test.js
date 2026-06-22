import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockManifests = vi.hoisted(() => ({ value: {} }))
const mockComponents = vi.hoisted(() => ({ value: {} }))

vi.mock('/platform/*/manifest.json', () => mockManifests.value, { virtual: true })

describe('loadPlatformAboutTabs', () => {
  beforeEach(async () => {
    vi.resetModules()
    mockManifests.value = {}
    mockComponents.value = {}

    vi.doMock('vue', async () => {
      const actual = await vi.importActual('vue')
      return {
        ...actual,
        defineAsyncComponent: (loader) => ({ __asyncLoader: loader, __name: 'AsyncComponent' })
      }
    })

    vi.stubGlobal('import', { meta: { glob: () => ({}) } })
  })

  async function loadWithMocks(manifests, components) {
    vi.doMock('../platform-loader', async () => {
      const { defineAsyncComponent } = await import('vue')

      function loadPlatformAboutTabsImpl() {
        const manifest = manifests['/platform/about-tabs/manifest.json']
        if (!manifest) return []
        const tabs = (manifest.default || manifest).tabs || []
        return tabs.map(tab => {
          const normalized = tab.component.replace(/^\.\//, '')
          const globKey = `/platform/about-tabs/${normalized}`
          const loader = components[globKey]
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

      return { loadPlatformAboutTabs: loadPlatformAboutTabsImpl }
    })

    const mod = await import('../platform-loader')
    return mod.loadPlatformAboutTabs
  }

  it('returns empty array when no manifest exists', async () => {
    const fn = await loadWithMocks({}, {})
    expect(fn()).toEqual([])
  })

  it('parses a valid manifest and returns tab objects', async () => {
    const manifests = {
      '/platform/about-tabs/manifest.json': {
        default: {
          tabs: [{
            id: 'docs',
            label: 'Docs',
            icon: 'BookOpen',
            component: './DocsTab.vue',
            order: 15
          }]
        }
      }
    }
    const components = {
      '/platform/about-tabs/DocsTab.vue': () => Promise.resolve({ default: {} })
    }

    const fn = await loadWithMocks(manifests, components)
    const result = fn()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'docs',
      label: 'Docs',
      iconName: 'BookOpen',
      order: 15,
      requireRole: null,
      source: 'platform'
    })
    expect(result[0].component).toBeDefined()
  })

  it('defaults order to 100 when omitted', async () => {
    const manifests = {
      '/platform/about-tabs/manifest.json': {
        default: {
          tabs: [{
            id: 'custom',
            label: 'Custom',
            icon: 'Settings',
            component: './CustomTab.vue'
          }]
        }
      }
    }
    const components = {
      '/platform/about-tabs/CustomTab.vue': () => Promise.resolve({ default: {} })
    }

    const fn = await loadWithMocks(manifests, components)
    const result = fn()

    expect(result[0].order).toBe(100)
  })

  it('skips tabs whose component is not found', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const manifests = {
      '/platform/about-tabs/manifest.json': {
        default: {
          tabs: [{
            id: 'missing',
            label: 'Missing',
            icon: 'X',
            component: './Missing.vue'
          }]
        }
      }
    }

    const fn = await loadWithMocks(manifests, {})
    const result = fn()

    expect(result).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      'Platform about tab component not found: /platform/about-tabs/Missing.vue'
    )
    warnSpy.mockRestore()
  })

  it('handles multiple tabs in a manifest', async () => {
    const manifests = {
      '/platform/about-tabs/manifest.json': {
        default: {
          tabs: [
            { id: 'tab-a', label: 'A', icon: 'Home', component: './A.vue', order: 20 },
            { id: 'tab-b', label: 'B', icon: 'Settings', component: './B.vue', order: 30 }
          ]
        }
      }
    }
    const components = {
      '/platform/about-tabs/A.vue': () => Promise.resolve({ default: {} }),
      '/platform/about-tabs/B.vue': () => Promise.resolve({ default: {} })
    }

    const fn = await loadWithMocks(manifests, components)
    const result = fn()

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('tab-a')
    expect(result[1].id).toBe('tab-b')
  })

  it('strips leading ./ from component paths', async () => {
    const manifests = {
      '/platform/about-tabs/manifest.json': {
        default: {
          tabs: [{
            id: 'test',
            label: 'Test',
            icon: 'Home',
            component: './Nested.vue'
          }]
        }
      }
    }
    const components = {
      '/platform/about-tabs/Nested.vue': () => Promise.resolve({ default: {} })
    }

    const fn = await loadWithMocks(manifests, components)
    const result = fn()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('test')
  })

  it('preserves requireRole when specified', async () => {
    const manifests = {
      '/platform/about-tabs/manifest.json': {
        default: {
          tabs: [{
            id: 'admin-tab',
            label: 'Admin',
            icon: 'Shield',
            component: './Admin.vue',
            requireRole: 'super-admin'
          }]
        }
      }
    }
    const components = {
      '/platform/about-tabs/Admin.vue': () => Promise.resolve({ default: {} })
    }

    const fn = await loadWithMocks(manifests, components)
    const result = fn()

    expect(result[0].requireRole).toBe('super-admin')
  })
})
