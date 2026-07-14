import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import navDiscovery from '../vite-plugin-nav-discovery.js'

let tmpDir

function writeFixture(relativePath, content) {
  const fullPath = path.join(tmpDir, relativePath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content)
}

function createPlugin() {
  const plugin = navDiscovery()
  plugin.configResolved({ root: tmpDir })
  return plugin
}

function loadEntries(plugin) {
  const resolved = plugin.resolveId('virtual:nav-discovery')
  const code = plugin.load(resolved)
  const json = code.replace('export default ', '')
  return JSON.parse(json)
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-discovery-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Vite plugin hooks
// ---------------------------------------------------------------------------

describe('plugin hooks', () => {
  it('has the correct plugin name', () => {
    const plugin = navDiscovery()
    expect(plugin.name).toBe('nav-discovery')
  })

  it('resolves virtual:nav-discovery', () => {
    const plugin = navDiscovery()
    expect(plugin.resolveId('virtual:nav-discovery')).toBe('\0virtual:nav-discovery')
  })

  it('does not resolve other ids', () => {
    const plugin = navDiscovery()
    expect(plugin.resolveId('other-module')).toBeUndefined()
  })

  it('returns valid ESM from load()', () => {
    const plugin = createPlugin()
    const code = plugin.load('\0virtual:nav-discovery')
    expect(code).toMatch(/^export default \[/)
  })

  it('does not load non-matching ids', () => {
    const plugin = createPlugin()
    expect(plugin.load('other-id')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Module discovery (Phase A)
// ---------------------------------------------------------------------------

describe('module discovery', () => {
  it('returns empty array when no modules exist', () => {
    const plugin = createPlugin()
    expect(loadEntries(plugin)).toEqual([])
  })

  it('discovers a module from module.json', () => {
    writeFixture('modules/test-mod/module.json', JSON.stringify({
      name: 'Test Module',
      slug: 'test-mod',
      client: {
        navItems: [{ id: 'dashboard', label: 'Dashboard' }]
      }
    }))
    writeFixture('modules/test-mod/client/index.js', `
      import { defineAsyncComponent } from 'vue'
      export const routes = {
        'dashboard': defineAsyncComponent(() => import('./views/DashboardView.vue'))
      }
    `)
    writeFixture('modules/test-mod/client/views/DashboardView.vue', `
      <script setup>
      const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'details', label: 'Details' }
      ]
      </script>
      <template><div /></template>
    `)

    const entries = loadEntries(createPlugin())
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      slug: 'test-mod',
      viewId: 'dashboard',
      label: 'Overview',
      context: 'Test Module → Dashboard',
      params: { tab: 'overview' }
    })
    expect(entries[1]).toMatchObject({ label: 'Details', params: { tab: 'details' } })
  })

  it('uses directory name as slug when manifest omits slug', () => {
    writeFixture('modules/fallback-slug/module.json', JSON.stringify({
      name: 'Fallback',
      client: { navItems: [{ id: 'main', label: 'Main' }] }
    }))
    writeFixture('modules/fallback-slug/client/index.js', `
      import { defineAsyncComponent } from 'vue'
      export const routes = {
        'main': defineAsyncComponent(() => import('./views/MainView.vue'))
      }
    `)
    writeFixture('modules/fallback-slug/client/views/MainView.vue', `
      <script setup>
      const tabs = [{ id: 't1', label: 'Tab One' }]
      </script>
      <template><div /></template>
    `)

    const entries = loadEntries(createPlugin())
    expect(entries[0].slug).toBe('fallback-slug')
  })

  it('skips modules with malformed JSON', () => {
    writeFixture('modules/broken/module.json', '{invalid json}')
    const entries = loadEntries(createPlugin())
    expect(entries).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Route map (Phase B) — inline and hoisted patterns
// ---------------------------------------------------------------------------

describe('route map parsing', () => {
  function setupModule(clientIndexContent, viewContent) {
    writeFixture('modules/routes/module.json', JSON.stringify({
      name: 'Routes', slug: 'routes',
      client: { navItems: [{ id: 'page', label: 'Page' }] }
    }))
    writeFixture('modules/routes/client/index.js', clientIndexContent)
    writeFixture('modules/routes/client/views/TestView.vue', viewContent || `
      <script setup>
      const tabs = [{ id: 'a', label: 'Alpha' }]
      </script>
      <template><div /></template>
    `)
  }

  it('parses inline defineAsyncComponent routes', () => {
    setupModule(`
      import { defineAsyncComponent } from 'vue'
      export const routes = {
        'page': defineAsyncComponent(() => import('./views/TestView.vue'))
      }
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toHaveLength(1)
    expect(entries[0].viewId).toBe('page')
  })

  it('parses hoisted defineAsyncComponent routes', () => {
    setupModule(`
      import { defineAsyncComponent } from 'vue'
      const TestView = defineAsyncComponent(() => import('./views/TestView.vue'))
      export const routes = {
        'page': TestView
      }
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toHaveLength(1)
    expect(entries[0].viewId).toBe('page')
  })

  it('returns no entries when client/index.js is missing', () => {
    writeFixture('modules/noindex/module.json', JSON.stringify({
      name: 'No Index', slug: 'noindex',
      client: { navItems: [{ id: 'page', label: 'Page' }] }
    }))
    writeFixture('modules/noindex/client/views/TestView.vue', `
      <script setup>
      const tabs = [{ id: 'a', label: 'Alpha' }]
      </script>
      <template><div /></template>
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Tab extraction (Phase C)
// ---------------------------------------------------------------------------

describe('tab extraction', () => {
  function setupWithView(viewContent) {
    writeFixture('modules/tabs/module.json', JSON.stringify({
      name: 'Tabs Test', slug: 'tabs',
      client: { navItems: [{ id: 'view', label: 'View' }] }
    }))
    writeFixture('modules/tabs/client/index.js', `
      import { defineAsyncComponent } from 'vue'
      export const routes = {
        'view': defineAsyncComponent(() => import('./views/TabsView.vue'))
      }
    `)
    writeFixture('modules/tabs/client/views/TabsView.vue', viewContent)
  }

  it('extracts tabs from const tabs = [...]', () => {
    setupWithView(`
      <script setup>
      const tabs = [
        { id: 'one', label: 'Tab One' },
        { id: 'two', label: 'Tab Two' }
      ]
      </script>
      <template><div /></template>
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toHaveLength(2)
    expect(entries.map(e => e.label)).toEqual(['Tab One', 'Tab Two'])
  })

  it('extracts tabs from variables with Tab in the name', () => {
    setupWithView(`
      <script setup>
      const sidebarTabs = [
        { id: 'nav', label: 'Navigation' }
      ]
      </script>
      <template><div /></template>
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('Navigation')
  })

  it('returns no entries for views without script block', () => {
    setupWithView(`<template><div>No script</div></template>`)
    const entries = loadEntries(createPlugin())
    expect(entries).toEqual([])
  })

  it('returns no entries for views without tab variables', () => {
    setupWithView(`
      <script setup>
      const data = [{ id: 'x', label: 'X' }]
      </script>
      <template><div /></template>
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Report extraction (Phase D)
// ---------------------------------------------------------------------------

describe('report extraction', () => {
  function setupWithReports(registryContent) {
    writeFixture('modules/reps/module.json', JSON.stringify({
      name: 'Reports Test', slug: 'reps',
      client: { navItems: [{ id: 'reports', label: 'Reports' }] }
    }))
    writeFixture('modules/reps/client/index.js', `
      import { defineAsyncComponent } from 'vue'
      export const routes = {
        'reports': defineAsyncComponent(() => import('./views/ReportsView.vue'))
      }
    `)
    writeFixture('modules/reps/client/views/ReportsView.vue', `
      <template><div /></template>
    `)
    writeFixture('modules/reps/client/reports/registry.js', registryContent)
  }

  it('discovers report entries from registry.js', () => {
    setupWithReports(`
      export const reports = [
        { id: 'report-a', label: 'Report Alpha', component: null },
        { id: 'report-b', label: 'Report Beta', component: null }
      ]
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      slug: 'reps',
      viewId: 'reports',
      label: 'Report Alpha',
      context: 'Reports Test → Reports',
      params: { report: 'report-a' }
    })
  })

  it('extracts title as label fallback', () => {
    setupWithReports(`
      export const reports = [
        { id: 'titled', title: 'Titled Report', component: null }
      ]
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('Titled Report')
  })

  it('skips entries with externalUrl', () => {
    setupWithReports(`
      export const reports = [
        { id: 'internal', label: 'Internal Report', component: null },
        { id: 'external', label: 'External Report', externalUrl: 'https://example.com' }
      ]
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('Internal Report')
  })

  it('returns no entries when no registry exists', () => {
    writeFixture('modules/noreg/module.json', JSON.stringify({
      name: 'No Registry', slug: 'noreg',
      client: { navItems: [{ id: 'reports', label: 'Reports' }] }
    }))
    writeFixture('modules/noreg/client/index.js', `
      import { defineAsyncComponent } from 'vue'
      export const routes = {
        'reports': defineAsyncComponent(() => import('./views/ReportsView.vue'))
      }
    `)
    writeFixture('modules/noreg/client/views/ReportsView.vue', '<template><div /></template>')

    const entries = loadEntries(createPlugin())
    expect(entries).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Hidden routes filtering
// ---------------------------------------------------------------------------

describe('hidden routes', () => {
  it('excludes views listed in hiddenRoutes', () => {
    writeFixture('modules/hidden/module.json', JSON.stringify({
      name: 'Hidden Test', slug: 'hidden',
      client: { navItems: [
        { id: 'visible', label: 'Visible' },
        { id: 'secret', label: 'Secret' }
      ] },
      hiddenRoutes: { secret: { reason: 'WIP' } }
    }))
    writeFixture('modules/hidden/client/index.js', `
      import { defineAsyncComponent } from 'vue'
      export const routes = {
        'visible': defineAsyncComponent(() => import('./views/TestView.vue')),
        'secret': defineAsyncComponent(() => import('./views/TestView.vue'))
      }
    `)
    writeFixture('modules/hidden/client/views/TestView.vue', `
      <script setup>
      const tabs = [{ id: 't', label: 'Tab' }]
      </script>
      <template><div /></template>
    `)
    const entries = loadEntries(createPlugin())
    expect(entries).toHaveLength(1)
    expect(entries[0].viewId).toBe('visible')
  })
})

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

describe('caching', () => {
  it('returns cached results on subsequent calls', () => {
    writeFixture('modules/cached/module.json', JSON.stringify({
      name: 'Cached', slug: 'cached',
      client: { navItems: [{ id: 'page', label: 'Page' }] }
    }))
    writeFixture('modules/cached/client/index.js', `
      import { defineAsyncComponent } from 'vue'
      export const routes = {
        'page': defineAsyncComponent(() => import('./views/PageView.vue'))
      }
    `)
    writeFixture('modules/cached/client/views/PageView.vue', `
      <script setup>
      const tabs = [{ id: 't', label: 'Original' }]
      </script>
      <template><div /></template>
    `)

    const plugin = createPlugin()
    const first = loadEntries(plugin)
    expect(first).toHaveLength(1)

    // Modify fixture after first load — should still return cached
    writeFixture('modules/cached/client/views/PageView.vue', `
      <script setup>
      const tabs = [
        { id: 't1', label: 'Changed One' },
        { id: 't2', label: 'Changed Two' }
      ]
      </script>
      <template><div /></template>
    `)

    const second = loadEntries(plugin)
    expect(second).toHaveLength(1)
    expect(second[0].label).toBe('Original')
  })
})

// ---------------------------------------------------------------------------
// HMR relevance check
// ---------------------------------------------------------------------------

describe('handleHotUpdate', () => {
  it('triggers for view files in modules/', () => {
    const plugin = createPlugin()
    const invalidated = []
    const mockMod = {}
    const mockServer = {
      moduleGraph: {
        getModuleById: () => mockMod,
        invalidateModule: (m) => invalidated.push(m)
      },
      ws: { send: () => {} }
    }

    plugin.handleHotUpdate({ file: '/app/modules/foo/client/views/TestView.vue', server: mockServer })
    expect(invalidated).toHaveLength(1)
  })

  it('does not trigger for files outside modules/', () => {
    const plugin = createPlugin()
    const invalidated = []
    const mockServer = {
      moduleGraph: {
        getModuleById: () => ({}),
        invalidateModule: (m) => invalidated.push(m)
      },
      ws: { send: () => {} }
    }

    plugin.handleHotUpdate({ file: '/app/src/components/App.vue', server: mockServer })
    expect(invalidated).toHaveLength(0)
  })

  it('triggers for module.json changes', () => {
    const plugin = createPlugin()
    const invalidated = []
    const mockServer = {
      moduleGraph: {
        getModuleById: () => ({}),
        invalidateModule: (m) => invalidated.push(m)
      },
      ws: { send: () => {} }
    }

    plugin.handleHotUpdate({ file: '/app/modules/foo/module.json', server: mockServer })
    expect(invalidated).toHaveLength(1)
  })

  it('triggers for report registry changes', () => {
    const plugin = createPlugin()
    const invalidated = []
    const mockServer = {
      moduleGraph: {
        getModuleById: () => ({}),
        invalidateModule: (m) => invalidated.push(m)
      },
      ws: { send: () => {} }
    }

    plugin.handleHotUpdate({ file: '/app/modules/foo/client/reports/registry.js', server: mockServer })
    expect(invalidated).toHaveLength(1)
  })
})
