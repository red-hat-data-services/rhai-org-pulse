/**
 * Module configuration stored on PVC.
 * Manages registered modules (built-in and git-static).
 */

const path = require('path');
const fs = require('fs');

const CONFIG_KEY = 'modules-config.json';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_TYPES = ['built-in', 'git-static'];

const DEFAULT_CONFIG = {
  modules: [{
    name: 'People & Teams',
    slug: 'team-tracker',
    type: 'built-in',
    description: 'Delivery metrics, sprint tracking, and team insights',
    icon: 'bar-chart',
    order: 0
  }]
};

function loadModulesConfig(storage) {
  const config = storage.readFromStorage(CONFIG_KEY);
  if (config) return config;
  return null;
}

function saveModulesConfig(storage, config) {
  storage.writeToStorage(CONFIG_KEY, config);
}

function seedIfMissing(storage) {
  const existing = loadModulesConfig(storage);
  if (!existing) {
    saveModulesConfig(storage, DEFAULT_CONFIG);
    console.log('Modules config: seeded with People & Teams built-in module');
    return DEFAULT_CONFIG;
  }
  return existing;
}

function getModule(storage, slug) {
  const config = loadModulesConfig(storage);
  if (!config || !config.modules) return null;
  return config.modules.find(m => m.slug === slug) || null;
}

function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_PATTERN.test(slug) && slug.length <= 64;
}

function isValidGitUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateModule(mod, existingModules, excludeSlug) {
  const errors = [];

  if (!mod.name || typeof mod.name !== 'string' || !mod.name.trim()) {
    errors.push('name is required');
  }
  if (!mod.slug || !isValidSlug(mod.slug)) {
    errors.push('slug must be lowercase alphanumeric with hyphens (e.g., "my-module")');
  }
  if (!mod.type || !VALID_TYPES.includes(mod.type)) {
    errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  // Check slug uniqueness
  if (mod.slug && existingModules) {
    const conflict = existingModules.find(m => m.slug === mod.slug && m.slug !== excludeSlug);
    if (conflict) {
      errors.push(`slug "${mod.slug}" is already in use`);
    }
  }

  // Git-static specific validation
  if (mod.type === 'git-static') {
    if (!mod.gitUrl || !isValidGitUrl(mod.gitUrl)) {
      errors.push('gitUrl must be a valid HTTPS URL');
    }
    if (mod.gitSubdirectory && mod.gitSubdirectory.includes('..')) {
      errors.push('gitSubdirectory must not contain ".."');
    }
  }

  return errors;
}

function addModule(storage, mod) {
  const config = loadModulesConfig(storage) || { modules: [] };
  const errors = validateModule(mod, config.modules);
  if (errors.length > 0) {
    return { error: errors.join('; ') };
  }

  const newModule = {
    name: mod.name.trim(),
    slug: mod.slug,
    type: mod.type,
    description: (mod.description || '').trim(),
    icon: mod.icon || 'box',
    order: typeof mod.order === 'number' ? mod.order : config.modules.length
  };

  if (mod.type === 'git-static') {
    newModule.gitUrl = mod.gitUrl;
    newModule.gitBranch = mod.gitBranch || 'main';
    newModule.gitSubdirectory = mod.gitSubdirectory || '/';
    newModule.gitToken = mod.gitToken || null;
    newModule.lastSyncAt = null;
    newModule.lastSyncStatus = null;
    newModule.lastSyncError = null;
  }

  config.modules.push(newModule);
  saveModulesConfig(storage, config);
  return { module: newModule };
}

function updateModule(storage, slug, updates) {
  const config = loadModulesConfig(storage);
  if (!config) return { error: 'No modules config found' };

  const idx = config.modules.findIndex(m => m.slug === slug);
  if (idx === -1) return { error: `Module "${slug}" not found` };

  const existing = config.modules[idx];

  // Build merged module for validation
  const merged = { ...existing, ...updates };
  // Don't allow changing slug
  merged.slug = existing.slug;

  const errors = validateModule(merged, config.modules, slug);
  if (errors.length > 0) {
    return { error: errors.join('; ') };
  }

  // Apply safe updates
  const allowedFields = ['name', 'description', 'icon', 'order', 'gitUrl', 'gitBranch', 'gitSubdirectory', 'gitToken'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      existing[field] = updates[field];
    }
  }

  saveModulesConfig(storage, config);
  return { module: existing };
}

function removeModule(storage, slug) {
  const config = loadModulesConfig(storage);
  if (!config) return { error: 'No modules config found' };

  const idx = config.modules.findIndex(m => m.slug === slug);
  if (idx === -1) return { error: `Module "${slug}" not found` };

  const removed = config.modules.splice(idx, 1)[0];
  saveModulesConfig(storage, config);

  // Clean up module content directory
  if (removed.type === 'git-static' && storage.DATA_DIR) {
    const moduleDir = path.join(storage.DATA_DIR, 'modules', slug);
    const expectedPrefix = path.join(storage.DATA_DIR, 'modules');
    const resolved = path.resolve(moduleDir);
    if (resolved.startsWith(expectedPrefix + path.sep) && fs.existsSync(resolved)) {
      try {
        fs.rmSync(resolved, { recursive: true, force: true });
        console.log(`Removed module content directory: ${resolved}`);
      } catch (err) {
        console.error(`Failed to remove module directory ${resolved}:`, err.message);
      }
    }
  }

  return { removed };
}

/**
 * Strip sensitive fields for public API responses.
 * Returns only display fields.
 */
function sanitizeForPublic(mod) {
  return {
    name: mod.name,
    slug: mod.slug,
    type: mod.type,
    description: mod.description,
    icon: mod.icon,
    order: mod.order,
    lastSyncStatus: mod.lastSyncStatus || null
  };
}

/**
 * Mask sensitive fields for admin API responses.
 * Shows git fields but masks tokens.
 */
function sanitizeForAdmin(mod) {
  const result = { ...mod };
  if (result.gitToken) {
    result.gitToken = '••••••••';
  }
  return result;
}

function updateSyncStatus(storage, slug, status, error) {
  const config = loadModulesConfig(storage);
  if (!config) return;
  const mod = config.modules.find(m => m.slug === slug);
  if (!mod) return;
  mod.lastSyncAt = new Date().toISOString();
  mod.lastSyncStatus = status;
  mod.lastSyncError = error || null;
  saveModulesConfig(storage, config);
}

module.exports = {
  loadModulesConfig,
  saveModulesConfig,
  seedIfMissing,
  getModule,
  addModule,
  updateModule,
  removeModule,
  isValidSlug,
  isValidGitUrl,
  validateModule,
  sanitizeForPublic,
  sanitizeForAdmin,
  updateSyncStatus
};
