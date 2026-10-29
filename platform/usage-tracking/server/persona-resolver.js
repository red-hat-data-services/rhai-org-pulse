let cachedRegistry = null
let cachedRegistryMtime = null
let cachedPersonaMap = null
let cachedPersonaMapMtime = null

async function loadRegistry(storage) {
  const mtime = await storage.getFileMtime('team-data/registry.json')
  if (cachedRegistry && mtime === cachedRegistryMtime) return cachedRegistry
  cachedRegistry = await storage.readFromStorage('team-data/registry.json')
  cachedRegistryMtime = mtime
  return cachedRegistry
}

async function loadPersonaMap(storage) {
  const mtime = await storage.getFileMtime('usage/persona-map.json')
  if (cachedPersonaMap && mtime === cachedPersonaMapMtime) return cachedPersonaMap
  cachedPersonaMap = await storage.readFromStorage('usage/persona-map.json')
  cachedPersonaMapMtime = mtime
  return cachedPersonaMap || {}
}

async function resolvePersona(req, storage) {
  const uid = req.userUid
  if (!uid) return null

  const registry = await loadRegistry(storage)
  if (!registry || !registry.people || !registry.people[uid]) return null

  const person = registry.people[uid]
  const title = person.title
  if (!title) return 'other'

  const personaMap = await loadPersonaMap(storage)
  return personaMap[title] || 'other'
}

function resolveUserEmail(req) {
  return req.userEmail || null
}

module.exports = { resolvePersona, resolveUserEmail, loadPersonaMap, loadRegistry }
