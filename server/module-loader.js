const fs = require('fs')
const path = require('path')
const express = require('express')

const MODULES_DIR = path.join(__dirname, '..', 'modules')

// Track which module slugs had routers created at startup
const _mountedAtStartup = new Set()

function discoverModules(modulesDir = MODULES_DIR) {
  const modules = []
  if (!fs.existsSync(modulesDir)) return modules
  for (const dir of fs.readdirSync(modulesDir)) {
    if (dir.startsWith('.') || dir.startsWith('_')) continue
    const manifestPath = path.join(modulesDir, dir, 'module.json')
    if (!fs.existsSync(manifestPath)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      modules.push({
        ...manifest,
        slug: dir,
        _dir: path.join(modulesDir, dir),
        requires: Array.isArray(manifest.requires) ? manifest.requires : [],
        defaultEnabled: manifest.defaultEnabled !== undefined ? manifest.defaultEnabled : true
      })
    } catch (err) {
      console.error(`[module-loader] Failed to load manifest for "${dir}":`, err.message)
    }
  }
  return modules
}

// ─── State Persistence ───

function loadModuleState(storage) {
  try {
    const data = storage.readFromStorage('modules-state.json')
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data
    }
    return {}
  } catch (err) {
    console.warn('[module-loader] Failed to read modules-state.json:', err.message)
    return {}
  }
}

function saveModuleState(storage, state) {
  storage.writeToStorage('modules-state.json', state)
}

function getEffectiveState(modules, persistedState) {
  const effective = {}
  for (const mod of modules) {
    if (Object.prototype.hasOwnProperty.call(persistedState, mod.slug)) {
      effective[mod.slug] = persistedState[mod.slug]
    } else {
      effective[mod.slug] = mod.defaultEnabled
    }
  }
  return effective
}

function reconcileStartupState(modules, effectiveState, storage) {
  let changed = false

  for (const mod of modules) {
    if (!effectiveState[mod.slug]) continue
    for (const reqSlug of mod.requires) {
      if (!effectiveState[reqSlug]) {
        effectiveState[reqSlug] = true
        changed = true
        console.log(`[module-loader] Auto-enabled "${reqSlug}" (required by enabled module "${mod.slug}")`)
      }
    }
  }

  if (changed) {
    saveModuleState(storage, effectiveState)
  }

  return effectiveState
}

// ─── Dependency Resolution ───

function resolveEnableOrder(slug, allModules, currentState) {
  const moduleMap = Object.fromEntries(allModules.map(m => [m.slug, m]))
  if (!moduleMap[slug]) {
    return { error: `Module "${slug}" not found` }
  }

  const toEnable = []
  const autoEnabled = []
  const visited = new Set()
  const queue = [slug]

  while (queue.length > 0) {
    const current = queue.shift()
    if (visited.has(current)) continue
    visited.add(current)

    const mod = moduleMap[current]
    if (!mod) {
      return { error: `Module "${slug}" requires non-existent module "${current}"` }
    }

    if (!currentState[current]) {
      toEnable.push(current)
      if (current !== slug) {
        autoEnabled.push(current)
      }
    }

    for (const req of mod.requires) {
      if (!visited.has(req)) {
        queue.push(req)
      }
    }
  }

  return { toEnable, autoEnabled }
}

function checkDisableAllowed(slug, allModules, currentState) {
  const moduleMap = Object.fromEntries(allModules.map(m => [m.slug, m]))
  const blockedBy = []

  for (const mod of allModules) {
    if (mod.slug === slug) continue
    if (!currentState[mod.slug]) continue

    // Compute transitive requires closure for this module
    const closure = new Set()
    const queue = [...mod.requires]
    while (queue.length > 0) {
      const dep = queue.shift()
      if (closure.has(dep)) continue
      closure.add(dep)
      const depMod = moduleMap[dep]
      if (depMod) {
        for (const r of depMod.requires) {
          if (!closure.has(r)) queue.push(r)
        }
      }
    }

    if (closure.has(slug)) {
      blockedBy.push(mod.slug)
    }
  }

  if (blockedBy.length > 0) {
    return { allowed: false, blockedBy }
  }
  return { allowed: true }
}

function computeRequiredBy(allModules) {
  const requiredBy = {}
  for (const mod of allModules) {
    requiredBy[mod.slug] = []
  }
  for (const mod of allModules) {
    for (const req of mod.requires) {
      if (requiredBy[req]) {
        requiredBy[req].push(mod.slug)
      }
    }
  }
  return requiredBy
}

// ─── Router Creation ───

function createModuleRouters(modules, context, enabledSlugs, diagnosticsRegistry) {
  const routers = {}
  for (const mod of modules) {
    if (!mod.server?.entry) continue
    // Skip disabled modules if enabledSlugs is provided
    if (enabledSlugs && !enabledSlugs.has(mod.slug)) continue
    // Validate entry path does not escape module directory
    const entryPath = path.join(mod._dir, mod.server.entry)
    if (!entryPath.startsWith(mod._dir + path.sep) && entryPath !== mod._dir) {
      console.error(`[module-loader] Refusing to load "${mod.slug}": server entry escapes module directory`)
      continue
    }
    const router = express.Router()
    try {
      // Set up per-module diagnostics registration
      if (diagnosticsRegistry) {
        context.registerDiagnostics = function(fn) {
          diagnosticsRegistry[mod.slug] = fn
        }
      }
      require(entryPath)(router, context)
      routers[mod.slug] = router
      _mountedAtStartup.add(mod.slug)
      console.log(`[module-loader] Created router for "${mod.slug}"`)
    } catch (err) {
      console.error(`[module-loader] Failed to create router for "${mod.slug}":`, err.message)
    }
  }
  // Clean up — don't leave a stale registerDiagnostics on the context
  context.registerDiagnostics = null
  return routers
}

// ─── Module Diagnostics ───

async function collectModuleDiagnostics(modules, diagnosticsRegistry, enabledSlugs) {
  const TIMEOUT_MS = 10000
  const results = {}

  const tasks = modules.map(function(mod) {
    if (enabledSlugs && !enabledSlugs.has(mod.slug)) {
      return { slug: mod.slug, promise: Promise.resolve({ enabled: false }) }
    }
    const fn = diagnosticsRegistry[mod.slug]
    if (typeof fn !== 'function') {
      return { slug: mod.slug, promise: Promise.resolve({ enabled: true, diagnostics: 'not implemented' }) }
    }
    const withTimeout = Promise.race([
      fn(),
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('diagnostics timed out after 10s')) }, TIMEOUT_MS)
      })
    ]).catch(function(err) {
      return { error: err.message }
    })
    return { slug: mod.slug, promise: withTimeout }
  })

  const settled = await Promise.all(tasks.map(function(t) { return t.promise }))
  for (let i = 0; i < tasks.length; i++) {
    results[tasks[i].slug] = settled[i]
  }

  return results
}

function wasMountedAtStartup(slug) {
  return _mountedAtStartup.has(slug)
}

function mountModuleRouters(app, modules, routers) {
  for (const mod of modules) {
    if (!routers[mod.slug]) continue
    app.use(`/api/modules/${mod.slug}`, routers[mod.slug])
    console.log(`[module-loader] Mounted routes for "${mod.slug}" at /api/modules/${mod.slug}`)
  }
}

module.exports = {
  discoverModules,
  createModuleRouters,
  mountModuleRouters,
  collectModuleDiagnostics,
  loadModuleState,
  saveModuleState,
  getEffectiveState,
  reconcileStartupState,
  resolveEnableOrder,
  checkDisableAllowed,
  computeRequiredBy,
  wasMountedAtStartup,
  MODULES_DIR
}
