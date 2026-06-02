/**
 * Secret Registry — central registry for module secret declarations.
 *
 * Provides declaration, resolution, validation, and diagnostics for secrets
 * consumed by modules. Modules declare secrets in module.json and access them
 * via context.secrets (frozen object) or context.resolveSecret() (dynamic).
 *
 * @module shared/server/secret-registry
 */

class SecretRegistry {
  /**
   * @param {Array<{id: string, label: string, description: string, secrets: Array}>} platformSecretGroups
   */
  constructor(platformSecretGroups) {
    this._platformGroups = new Map()
    for (const group of platformSecretGroups) {
      this._platformGroups.set(group.id, group)
    }

    // Per-module declarations: slug -> { platform: string[], module: object[], dynamic: object }
    this._moduleDeclarations = new Map()

    // Resolved values: key -> value (populated by resolve())
    this._resolved = new Map()

    // Validators: key -> fn
    this._validators = new Map()

    // Dynamic access tracking: envVarName -> Set of caller descriptions
    this._dynamicAccess = new Map()

    this._isResolved = false
  }

  /**
   * Register a module's secret declarations from its module.json.
   * Called during module discovery, before module code runs.
   *
   * @param {string} slug - Module slug
   * @param {object} secretsDeclaration - The secrets field from module.json
   */
  registerModuleSecrets(slug, secretsDeclaration) {
    if (!secretsDeclaration || typeof secretsDeclaration !== 'object') return

    const declaration = {
      platform: Array.isArray(secretsDeclaration.platform) ? secretsDeclaration.platform : [],
      module: Array.isArray(secretsDeclaration.module) ? secretsDeclaration.module : [],
      dynamic: secretsDeclaration.dynamic || null
    }

    // Validate platform group references
    for (const groupId of declaration.platform) {
      if (!this._platformGroups.has(groupId)) {
        console.warn(`[secrets] Module "${slug}" references unknown platform group "${groupId}"`)
      }
    }

    this._moduleDeclarations.set(slug, declaration)
  }

  /**
   * Read all declared env vars from process.env and log warnings for missing required secrets.
   * Should be called once at startup after all modules are registered.
   */
  resolve() {
    this._resolved.clear()

    // Collect all unique keys from platform groups and module declarations
    const allKeys = new Map() // key -> { required, default, sources[] }

    // Platform group secrets
    for (const [groupId, group] of this._platformGroups) {
      for (const secret of group.secrets) {
        if (!allKeys.has(secret.key)) {
          allKeys.set(secret.key, { required: false, default: secret.default, sources: [] })
        }
        const entry = allKeys.get(secret.key)
        entry.sources.push(`platform:${groupId}`)
        if (secret.required) entry.required = true
      }
    }

    // Module-specific secrets
    for (const [slug, decl] of this._moduleDeclarations) {
      for (const secret of decl.module) {
        if (!allKeys.has(secret.key)) {
          allKeys.set(secret.key, { required: false, default: secret.default, sources: [] })
        }
        const entry = allKeys.get(secret.key)
        entry.sources.push(`module:${slug}`)
        if (secret.required) entry.required = true
      }
    }

    // Resolve from process.env
    for (const [key, meta] of allKeys) {
      const value = process.env[key] || meta.default || undefined
      if (value !== undefined) {
        this._resolved.set(key, value)
      }
    }

    // Log structured status
    this._logStatus(allKeys)

    this._isResolved = true
  }

  /**
   * Log structured startup status for all secrets.
   * @private
   */
  _logStatus(allKeys) {
    // Group by source for logging
    const platformStatus = new Map()
    for (const [groupId, group] of this._platformGroups) {
      const parts = []
      for (const secret of group.secrets) {
        const configured = this._resolved.has(secret.key)
        const status = configured ? 'configured' : (secret.required ? 'MISSING' : 'not-configured(optional)')
        parts.push(`${secret.key}=${status}`)
      }
      platformStatus.set(groupId, parts)
    }

    for (const [groupId, parts] of platformStatus) {
      console.log(`[secrets] platform:${groupId} ${parts.join(' ')}`)
    }

    for (const [slug, decl] of this._moduleDeclarations) {
      if (decl.module.length === 0) continue
      const parts = []
      for (const secret of decl.module) {
        const configured = this._resolved.has(secret.key)
        const status = configured ? 'configured' : (secret.required ? 'MISSING' : 'not-configured(optional)')
        parts.push(`${secret.key}=${status}`)
      }
      console.log(`[secrets] module:${slug} ${parts.join(' ')}`)
    }

    // Summary
    let requiredTotal = 0
    let requiredConfigured = 0
    let optionalTotal = 0
    let optionalConfigured = 0
    for (const [key, meta] of allKeys) {
      if (meta.required) {
        requiredTotal++
        if (this._resolved.has(key)) requiredConfigured++
      } else {
        optionalTotal++
        if (this._resolved.has(key)) optionalConfigured++
      }
    }
    console.log(`[secrets] summary: required=${requiredConfigured}/${requiredTotal} optional=${optionalConfigured}/${optionalTotal}`)
  }

  /**
   * Returns a frozen object containing only the secrets that the given module
   * declared (both platform group secrets and module-specific secrets).
   *
   * @param {string} slug - Module slug
   * @returns {object} Frozen key-value object of resolved secrets
   */
  getModuleSecrets(slug) {
    const decl = this._moduleDeclarations.get(slug)
    if (!decl) return Object.freeze({})

    const secrets = {}

    // Platform group secrets
    for (const groupId of decl.platform) {
      const group = this._platformGroups.get(groupId)
      if (!group) continue
      for (const secret of group.secrets) {
        if (this._resolved.has(secret.key)) {
          secrets[secret.key] = this._resolved.get(secret.key)
        }
      }
    }

    // Module-specific secrets
    for (const secret of decl.module) {
      if (this._resolved.has(secret.key)) {
        secrets[secret.key] = this._resolved.get(secret.key)
      }
    }

    return Object.freeze(secrets)
  }

  /**
   * Dynamic secret lookup — reads process.env at call time (not cached).
   * Used for dynamic lookups where the env var name is user-configured
   * (e.g., per-instance GitLab tokens like GITLAB_INTERNAL_TOKEN).
   *
   * **Known limitation (v1):** resolveSecret() does not enforce module isolation.
   * Any module can resolve any env var, bypassing the scoping that getModuleSecrets()
   * provides. Pattern-based validation against the module's `dynamic.pattern` declaration
   * is a Phase 2 enhancement opportunity.
   *
   * @param {string} envVarName - Environment variable name to look up
   * @param {string} [_callerSlug] - Module slug for access tracking (set by module-context wrapper)
   * @returns {string|undefined}
   */
  resolveSecret(envVarName, _callerSlug) {
    const value = process.env[envVarName] || undefined

    // Track access for diagnostics
    if (!this._dynamicAccess.has(envVarName)) {
      this._dynamicAccess.set(envVarName, 0)
    }
    this._dynamicAccess.set(envVarName, this._dynamicAccess.get(envVarName) + 1)

    // Warn if the calling module didn't declare this key in its secrets
    if (_callerSlug && value !== undefined) {
      const decl = this._moduleDeclarations.get(_callerSlug)
      if (decl && !this._isKeyDeclaredByModule(_callerSlug, envVarName)) {
        console.warn(`[secrets] Module "${_callerSlug}" resolved undeclared secret "${envVarName}" via resolveSecret()`)
      }
    }

    return value
  }

  /**
   * Check if a key is covered by a module's declarations (platform groups, module secrets, or dynamic pattern).
   * @private
   */
  _isKeyDeclaredByModule(slug, key) {
    const decl = this._moduleDeclarations.get(slug)
    if (!decl) return false

    // Check platform group secrets
    for (const groupId of decl.platform) {
      const group = this._platformGroups.get(groupId)
      if (group && group.secrets.some(function (s) { return s.key === key })) return true
    }

    // Check module-specific secrets
    if (decl.module.some(function (s) { return s.key === key })) return true

    // Check dynamic pattern (glob-style: GITLAB_*_TOKEN matches GITLAB_INTERNAL_TOKEN)
    if (decl.dynamic && decl.dynamic.pattern) {
      const re = new RegExp('^' + decl.dynamic.pattern.replace(/\*/g, '.*') + '$')
      if (re.test(key)) return true
    }

    return false
  }

  /**
   * Register an async validator for a secret key.
   * Called by module code at runtime via context.registerSecretValidator.
   *
   * @param {string} key - Secret key to validate
   * @param {Function} fn - Async function returning { valid: boolean, message: string }
   */
  registerValidator(key, fn) {
    if (typeof fn !== 'function') {
      throw new Error(`registerValidator: expected a function for key "${key}", got ${typeof fn}`)
    }
    this._validators.set(key, fn)
  }

  /**
   * Run all registered validators. Returns results keyed by secret key.
   * Never includes actual secret values in the response.
   *
   * @returns {Promise<object>} { key: { valid: boolean, message: string } }
   */
  async validateAll() {
    const results = {}
    for (const [key, fn] of this._validators) {
      try {
        const result = await fn()
        results[key] = { valid: !!result.valid, message: truncateMessage(result.message || '') }
      } catch (err) {
        // Truncate error messages to avoid leaking secret values in thrown errors
        results[key] = { valid: false, message: truncateMessage(`Validator error: ${err.message}`) }
      }
    }
    return results
  }

  /**
   * Run validators for specific keys only.
   * @param {string[]} keys - Secret keys to validate
   * @returns {Promise<object>} { key: { valid: boolean, message: string } }
   */
  async validateKeys(keys) {
    const results = {}
    for (const [key, fn] of this._validators) {
      if (!keys.includes(key)) continue
      try {
        const result = await fn()
        results[key] = { valid: !!result.valid, message: truncateMessage(result.message || '') }
      } catch (err) {
        results[key] = { valid: false, message: truncateMessage(`Validator error: ${err.message}`) }
      }
    }
    return results
  }

  /**
   * Full status report for diagnostics. Never includes actual secret values.
   *
   * @returns {object} Structured status report
   */
  getStatus() {
    const platform = {}
    for (const [groupId, group] of this._platformGroups) {
      platform[groupId] = {
        label: group.label,
        description: group.description,
        secrets: group.secrets.map(function (s) {
          return {
            key: s.key,
            description: s.description,
            required: !!s.required,
            configured: !!(process.env[s.key] || s.default)
          }
        })
      }
    }

    const modules = {}
    for (const [slug, decl] of this._moduleDeclarations) {
      const moduleSecrets = decl.module.map(function (s) {
        return {
          key: s.key,
          description: s.description,
          required: !!s.required,
          configured: !!process.env[s.key],
          group: s.group || null,
          exclusive: !!s.exclusive
        }
      })

      // Handle exclusive groups
      const groups = {}
      for (const s of moduleSecrets) {
        if (s.group) {
          if (!groups[s.group]) groups[s.group] = { members: [], anyConfigured: false }
          groups[s.group].members.push(s.key)
          if (s.configured) groups[s.group].anyConfigured = true
        }
      }

      modules[slug] = {
        platform: decl.platform,
        secrets: moduleSecrets,
        exclusiveGroups: groups,
        dynamic: decl.dynamic
      }
    }

    // Summary counts
    const allSecrets = []
    for (const group of this._platformGroups.values()) {
      for (const s of group.secrets) allSecrets.push(s)
    }
    for (const decl of this._moduleDeclarations.values()) {
      for (const s of decl.module) allSecrets.push(s)
    }

    // Deduplicate by key for counting
    const seen = new Set()
    let requiredTotal = 0, requiredConfigured = 0, optionalTotal = 0, optionalConfigured = 0
    for (const s of allSecrets) {
      if (seen.has(s.key)) continue
      seen.add(s.key)
      const configured = !!(process.env[s.key] || s.default)
      if (s.required) {
        requiredTotal++
        if (configured) requiredConfigured++
      } else {
        optionalTotal++
        if (configured) optionalConfigured++
      }
    }

    return {
      platform,
      modules,
      validators: Array.from(this._validators.keys()),
      dynamicAccess: Object.fromEntries(this._dynamicAccess),
      summary: {
        required: { configured: requiredConfigured, total: requiredTotal },
        optional: { configured: optionalConfigured, total: optionalTotal }
      }
    }
  }

  /**
   * Per-module status for module diagnostics injection.
   *
   * @param {string} slug - Module slug
   * @returns {object} Module-specific secret status
   */
  getModuleStatus(slug) {
    const decl = this._moduleDeclarations.get(slug)
    if (!decl) return { declared: false }

    const platformStatus = {}
    for (const groupId of decl.platform) {
      const group = this._platformGroups.get(groupId)
      if (!group) continue
      platformStatus[groupId] = group.secrets.map(function (s) {
        return {
          key: s.key,
          required: !!s.required,
          configured: !!(process.env[s.key] || s.default)
        }
      })
    }

    const moduleStatus = decl.module.map(function (s) {
      return {
        key: s.key,
        required: !!s.required,
        configured: !!process.env[s.key],
        group: s.group || null
      }
    })

    return {
      declared: true,
      platform: platformStatus,
      module: moduleStatus,
      dynamic: decl.dynamic
    }
  }

  /**
   * Get the list of known platform group IDs.
   * @returns {string[]}
   */
  getPlatformGroupIds() {
    return Array.from(this._platformGroups.keys())
  }
}

/**
 * Truncate a message to avoid leaking sensitive data.
 * Validator implementations should not include secret values in errors,
 * but this provides a safety net.
 */
function truncateMessage(msg) {
  if (typeof msg !== 'string') return ''
  return msg.length > 200 ? msg.substring(0, 200) + '...(truncated)' : msg
}

module.exports = { SecretRegistry }
