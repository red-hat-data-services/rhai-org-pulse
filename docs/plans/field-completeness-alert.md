# Lightweight App-Wide Message System

## Overview

A general-purpose message system that lets modules (and admins) surface contextual alerts to users across every page of the application. Messages appear as a stack of sticky banners below the top bar header. The field-completeness alert for managers is the first consumer.

This is intentionally lightweight: no read/unread tracking, no pagination, no database. Just a simple provider registry, a single aggregation endpoint, and client-side sessionStorage dismissal.

---

## Architecture

```
Module server entry                 Shared server
───────────────────                 ─────────────
context.registerMessageProvider     message-registry.js
  (id, async (user) => [...])       ├─ providers: Map<id, fn>
                                    └─ getMessages(user): Message[]
                                          │
                                    GET /api/messages (dev-server.js)
                                          │
Shared client                             │
───────────────                           ▼
useMessages() composable  ◄──── fetch('/api/messages')
      │
      ▼
AppMessages.vue component (in App.vue, inside sticky header)
      │
      ▼
sessionStorage dismissal (user-scoped key, try/catch wrapped)
```

---

## Message Shape

```js
{
  id: 'team-tracker:field-completeness',  // stable, unique across modules
  type: 'warning',                         // 'warning' | 'info' | 'error'
  text: '5 people and 2 teams have incomplete fields',
  link: {                                  // optional CTA
    label: 'Review',
    href: '#/team-tracker/manager-dashboard'
  }
}
```

**Constraints:**
- `id` must be globally unique. Convention: `<module-slug>:<message-name>`. Providers own their full IDs -- the registry does not auto-prefix.
- `type` determines banner color (see Visual Design below).
- `text` is plain text, not HTML.
- `link` is optional. When present, a clickable link is rendered on the right side of the banner.

---

## Server Side

### 1. Message Registry (`shared/server/message-registry.js`) -- NEW

A minimal in-memory registry. Modules register async provider functions at startup. The aggregation endpoint calls all providers, collects results, and merges with stored messages.

```js
// shared/server/message-registry.js

const providers = new Map()

function registerProvider(id, fn) {
  if (typeof fn !== 'function') {
    console.warn(`[message-registry] Provider "${id}" is not a function, skipping`)
    return
  }
  providers.set(id, fn)
}

async function getMessages(userContext) {
  const results = []
  const TIMEOUT_MS = 5000

  for (const [id, fn] of providers) {
    try {
      const messages = await Promise.race([
        fn(userContext),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Provider "${id}" timed out`)), TIMEOUT_MS)
        )
      ])
      if (Array.isArray(messages)) {
        results.push(...messages)
      }
    } catch (err) {
      console.warn(`[message-registry] Provider "${id}" failed:`, err.message)
    }
  }

  return results
}

module.exports = { registerProvider, getMessages }
```

**Design decisions:**
- Providers are called sequentially with per-provider timeouts. With the expected small number of providers (1-3), sequential execution is simple and avoids thundering-herd issues on shared data.
- Each provider returns an array (zero or more messages). This lets a single provider emit multiple messages or none.
- Failures are logged and swallowed -- one broken provider never takes down the endpoint.
- The registry key (`id`) is the raw value passed by the module. The registry does **not** auto-prefix with the module slug. This keeps the registry simple and avoids double-prefixing, since providers already namespace their message `id` fields by convention (e.g., `team-tracker:field-completeness`).

### 2. Stored Messages (`data/messages.json`) -- NEW

Admin-created announcements stored as a JSON file:

```json
[
  {
    "id": "admin:1717200000000",
    "type": "info",
    "text": "Scheduled maintenance on Saturday 10 AM - 12 PM UTC.",
    "link": null
  }
]
```

Read by the aggregation endpoint and merged with computed messages. Admin CRUD API is described below.

### 3. Aggregation Endpoint (`GET /api/messages`) -- NEW

Added to `server/dev-server.js` as an authenticated shell route (not a module route):

```js
const messageRegistry = require('../shared/server/message-registry')

app.get('/api/messages', async function(req, res) {
  const userContext = {
    email: req.userEmail,
    uid: req.userUid,
    isAdmin: req.isAdmin,
    isTeamAdmin: req.isTeamAdmin,
    permissionTier: req.permissionTier
  }

  try {
    const computed = await messageRegistry.getMessages(userContext)

    // Merge stored messages
    const stored = readFromStorage('messages.json') || []
    const all = [...computed, ...stored]

    res.json({ messages: all })
  } catch (err) {
    console.error('[messages] Aggregation failed:', err.message)
    res.json({ messages: [] })
  }
})
```

**Note:** This route sits behind the existing auth middleware (like `/api/whoami`), so `req.userEmail`, `req.userUid`, `req.isAdmin`, etc. are already populated.

### 4. Admin Stored Messages API -- NEW

Two routes in `server/dev-server.js` for managing stored announcements. Both require `requireAdmin`.

**POST /api/admin/messages** -- create a stored message:

```js
app.post('/api/admin/messages', requireAdmin, function(req, res) {
  const { type, text, link } = req.body || {}

  // Validate required fields
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required and must be a non-empty string' })
  }

  const allowedTypes = ['warning', 'info', 'error']
  if (!type || !allowedTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${allowedTypes.join(', ')}` })
  }

  // Validate link shape if present
  if (link != null) {
    if (typeof link !== 'object' || typeof link.label !== 'string' || !link.label.trim()
        || typeof link.href !== 'string' || !link.href.trim()) {
      return res.status(400).json({ error: 'link must have non-empty string "label" and "href" properties' })
    }
  }

  const id = `admin:${Date.now()}`
  const message = {
    id,
    type,
    text: text.trim(),
    link: link ? { label: link.label.trim(), href: link.href.trim() } : null
  }

  const stored = readFromStorage('messages.json') || []
  stored.push(message)
  writeToStorage('messages.json', stored)

  res.status(201).json(message)
})
```

**DELETE /api/admin/messages/:id** -- remove a stored message:

```js
app.delete('/api/admin/messages/:id', requireAdmin, function(req, res) {
  const stored = readFromStorage('messages.json') || []
  const index = stored.findIndex(m => m.id === req.params.id)

  if (index === -1) {
    return res.status(404).json({ error: 'Message not found' })
  }

  stored.splice(index, 1)
  writeToStorage('messages.json', stored)

  res.status(204).end()
})
```

This is a minimal API -- no update/edit. To change a message, delete and re-create. A Settings UI can be added later.

### 5. Module Registration Pattern

In `server/module-loader.js`, `createModuleRouters()` already sets per-module context properties (like `registerDiagnostics` at lines 204-208) before calling `require(entryPath)(router, context)`. The message provider registration follows the exact same pattern.

**Changes to `server/module-loader.js` (`createModuleRouters` function):**

Accept a new `messageRegistry` parameter. Inside the per-module loop, before `require(entryPath)`, set:

```js
if (messageRegistry) {
  context.registerMessageProvider = function(id, fn) {
    messageRegistry.registerProvider(id, fn)
  }
}
```

After the loop, clean up: `context.registerMessageProvider = null` (mirrors the `registerDiagnostics` cleanup on line 218).

**Important constraint:** Like `registerDiagnostics`, `registerMessageProvider` relies on modules registering their providers **synchronously** during `require(entryPath)`. The closure captures the current module context at call time. If a module deferred registration (e.g., in a `setTimeout`), the context would be stale or null. This is the same constraint that applies to `registerDiagnostics` and is inherent to the per-module setup pattern in `createModuleRouters`.

**Changes to `server/dev-server.js`:**

```js
const messageRegistry = require('../shared/server/message-registry')

// Pass messageRegistry as the 5th argument to createModuleRouters
const moduleRouters = createModuleRouters(
  builtInModules, moduleContext, enabledSlugs,
  diagnosticsRegistry, messageRegistry
)
```

**Module usage pattern (e.g., in team-tracker `server/index.js`):**

```js
if (context.registerMessageProvider) {
  context.registerMessageProvider('team-tracker:field-completeness', async (user) => {
    // ... compute and return messages ...
  })
}
```

This follows the existing `registerDiagnostics` guard pattern used by all modules.

### 6. Field-Completeness Provider (First Consumer)

Registered in `modules/team-tracker/server/index.js` alongside the existing diagnostics registration (near line 3269). The provider reuses the same data-loading pattern as the `/manager/dashboard` endpoint (lines 533-707).

**Dependencies:** `getManagerPurview` is `require`'d inside the manager dashboard route section (line 519), not at module top-level. The provider must explicitly require it:

```js
const { getManagerPurview } = require('./manager-purview')
```

This can be placed either at the module's top-level scope or inside the provider function. Placing it at the top level alongside the other `require` calls is preferred for consistency with the codebase style.

**Server-side `isFieldEmpty` helper:** This function currently exists only client-side in `ManagerDashboardView.vue` (line 645). We need a server-side equivalent. Since it is trivial (5 lines), define it as a local function in the team-tracker server entry:

```js
function isFieldEmpty(value, field) {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (field.multiValue && Array.isArray(value) && value.every(v => !v)) return true
  return false
}
```

**Provider implementation:**

```js
if (context.registerMessageProvider) {
  const { getManagerPurview } = require('./manager-purview')

  context.registerMessageProvider('team-tracker:field-completeness', async function(user) {
    // Early bailout: skip all disk I/O for non-managers.
    // permissionTier is already computed by auth middleware and passed in userContext.
    // Regular users can never have direct reports, so there's nothing to alert on.
    if (!user.uid) return []
    if (user.permissionTier === 'user') return []

    const registry = readFromStorage('team-data/registry.json')
    if (!registry || !registry.people) return []

    // Verify this user actually has direct reports (admins/team-admins may not)
    const directReportSet = permissions.getDirectReports(user.uid, registry)
    if (directReportSet.size === 0) return []

    const fieldStore = require('../../../shared/server/field-store')
    const teamStore = require('../../../shared/server/team-store')
    const fieldDefs = fieldStore.readFieldDefinitions(storage)
    if (!fieldDefs) return []

    const personFields = fieldDefs.personFields.filter(f => !f.deleted && f.visible)
    const teamFields = fieldDefs.teamFields.filter(f => !f.deleted && f.visible)

    // If no visible fields are defined, nothing to alert on
    if (personFields.length === 0 && teamFields.length === 0) return []

    // Count incomplete direct reports
    let incompletePersonCount = 0
    for (const uid of directReportSet) {
      const person = registry.people[uid]
      if (!person || person.status !== 'active') continue
      const hasEmpty = personFields.some(f => isFieldEmpty(person._appFields?.[f.id], f))
      if (hasEmpty) incompletePersonCount++
    }

    // Count incomplete teams
    const teamsData = teamStore.readTeams(storage)
    const purview = getManagerPurview(user.uid, registry, teamsData, { includeIndirect: false })
    let incompleteTeamCount = 0
    for (const team of purview.teams) {
      const hasEmpty = teamFields.some(f => isFieldEmpty(team.metadata?.[f.id], f))
      if (hasEmpty) incompleteTeamCount++
    }

    if (incompletePersonCount === 0 && incompleteTeamCount === 0) return []

    // Build message text
    const parts = []
    if (incompletePersonCount > 0) {
      const noun = incompletePersonCount === 1 ? 'person' : 'people'
      parts.push(`${incompletePersonCount} ${noun}`)
    }
    if (incompleteTeamCount > 0) {
      const noun = incompleteTeamCount === 1 ? 'team' : 'teams'
      parts.push(`${incompleteTeamCount} ${noun}`)
    }
    const subject = parts.join(' and ')
    const verb = (incompletePersonCount + incompleteTeamCount) === 1 ? 'has' : 'have'

    return [{
      id: 'team-tracker:field-completeness',
      type: 'warning',
      text: `${subject} ${verb} incomplete fields.`,
      link: {
        label: 'Review',
        href: '#/team-tracker/manager-dashboard'
      }
    }]
  })
}
```

**Performance:** The early bailout on `user.permissionTier === 'user'` avoids all disk I/O for regular (non-manager) users. For managers, the provider reads `registry.json`, `field-definitions.json`, and `teams.json` -- the same files already read by many other endpoints. These are small JSON files; no caching layer is needed.

---

## Client Side

### 1. Composable: `useMessages()` (`shared/client/composables/useMessages.js`) -- NEW

Fetches messages from `/api/messages` on app load. Manages dismissal state in sessionStorage with user-scoped keys and try/catch guards.

**Why sessionStorage (not localStorage):** The user's requirement is "dismissible per session." `sessionStorage` is scoped to the browser tab's lifetime -- closing the tab clears it, so the alert reappears next visit. `localStorage` would persist across sessions, which would defeat the "come back next time" behavior.

```js
import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useAuth } from './useAuth'

const allMessages = ref([])
const dismissedIds = ref(new Set())

function storageKey(email) {
  return `app_messages_dismissed:${email || 'anonymous'}`
}

function loadDismissed(email) {
  try {
    const raw = sessionStorage.getItem(storageKey(email))
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissed(email, ids) {
  try {
    sessionStorage.setItem(storageKey(email), JSON.stringify([...ids]))
  } catch {
    // Silently ignore -- alert will reappear but app won't crash
  }
}

export function useMessages() {
  const { user } = useAuth()

  async function fetchMessages() {
    try {
      const data = await apiRequest('/messages')
      allMessages.value = data.messages || []
    } catch {
      allMessages.value = []
    }
    dismissedIds.value = loadDismissed(user.value?.email)
  }

  function dismiss(id) {
    dismissedIds.value.add(id)
    dismissedIds.value = new Set(dismissedIds.value) // trigger Vue reactivity
    saveDismissed(user.value?.email, dismissedIds.value)
  }

  const messages = computed(() =>
    allMessages.value.filter(m => !dismissedIds.value.has(m.id))
  )

  return { messages, fetchMessages, dismiss }
}
```

**Design decisions:**
- Module-level singleton state (like `useAuth`, `useRoster`) -- all consumers share the same data.
- `fetchMessages()` is called explicitly by `App.vue`, **not** inside the `Promise.all` that blocks initial page render. Instead, it is called after `Promise.all` completes (see App.vue integration below). This ensures a slow `/api/messages` response never delays the initial app load.
- Dismissed IDs stored as JSON array in sessionStorage, parsed back into a Set.
- User-scoped storage key using email from `useAuth`.

### 2. Component: `AppMessages.vue` (`shared/client/components/AppMessages.vue`) -- NEW

Renders the message stack. Purely presentational -- parent controls data and handles dismiss events.

```vue
<template>
  <div v-if="messages.length > 0" class="space-y-2 pb-2">
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="flex items-center gap-3 px-5 py-3 rounded-lg shadow-sm border-l-4 text-sm font-medium"
      :class="bannerClasses[msg.type] || bannerClasses.info"
    >
      <component :is="iconForType(msg.type)" class="w-5 h-5 flex-shrink-0" />
      <span class="flex-1">{{ msg.text }}</span>
      <a
        v-if="msg.link"
        :href="msg.link.href"
        class="text-xs font-semibold underline underline-offset-2 hover:no-underline whitespace-nowrap"
      >{{ msg.link.label }}</a>
      <button
        @click="$emit('dismiss', msg.id)"
        class="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { AlertTriangle, Info, AlertCircle, X } from 'lucide-vue-next'

defineProps({
  messages: { type: Array, default: () => [] }
})

defineEmits(['dismiss'])

const bannerClasses = {
  warning: 'bg-amber-900 dark:bg-amber-950 text-white border-amber-400',
  info:    'bg-blue-900 dark:bg-blue-950 text-white border-blue-400',
  error:   'bg-red-900 dark:bg-red-950 text-white border-red-400'
}

function iconForType(type) {
  if (type === 'warning') return AlertTriangle
  if (type === 'error') return AlertCircle
  return Info
}
</script>
```

**WCAG contrast:** All three color schemes use `-900` backgrounds with white text, providing contrast ratios above 7:1 (WCAG AAA).

### 3. Integration into App.vue (`src/components/App.vue`)

`App.vue` uses Options API with a Composition API `setup()` function. Integration follows the existing patterns.

#### Placement: Sticky, Inside the Header

The current layout (simplified):

```
<div class="min-h-screen ...">  <!-- main content area -->
  <div v-if="isImpersonating" class="sticky top-0 z-20 ...">  <!-- impersonation -->
  <header class="sticky top-0 z-10 ...">  <!-- top bar -->
  <main>  <!-- scrollable page content -->
</div>
```

If `AppMessages` is placed between `</header>` and `<main>`, the banners scroll away with the page content. This undermines the "very noticeable" requirement for an app-wide alert.

**Solution:** Place `AppMessages` **inside** the `<header>` element, after the existing header content `<div>`. This makes the messages part of the sticky header block, so they stay visible while scrolling.

```html
<header class="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-700/60">
  <div class="flex items-center justify-between px-6 lg:px-8 h-16">
    <!-- ... existing header bar content ... -->
  </div>

  <!-- App-wide messages (sticky with header) -->
  <AppMessages
    :messages="appMessages"
    @dismiss="dismissMessage"
  />
</header>
```

**Interaction with impersonation banner:** The impersonation banner (lines 28-45) is a separate `sticky top-0 z-20` div that sits above the header (`z-20 > z-10`). It is independent and unaffected by this change. When both are active, the impersonation banner sticks at the very top, and the header (including app messages) sticks below it. The `AppMessages` component adds `pb-2` spacing and uses `rounded-lg` (not `rounded-xl`) to fit naturally within the header's visual boundary.

**Note:** When messages are present, the header grows taller to accommodate them. The `<main>` content below shifts down accordingly. When all messages are dismissed, the header collapses back to its normal 64px height. This is the expected behavior -- the header dynamically sizes to its content.

#### Script changes

1. Import the component and register it:
```js
import AppMessages from '@shared/client/components/AppMessages.vue'
// Add to components: { ..., AppMessages }
```

2. In `setup()`, call the composable and return its values:
```js
const { messages: appMessages, fetchMessages, dismiss: dismissMessage } = useMessages()

return {
  // ... existing returns ...
  appMessages,
  fetchMessages,
  dismissMessage
}
```

3. In `loadInitialData()`, call `fetchMessages` **after** the main `Promise.all` completes, so it never blocks initial page render:
```js
async loadInitialData() {
  this.isLoading = true
  try {
    const allSlugs = this.allBuiltInManifests.map(m => m.slug)
    await Promise.all([
      this.loadRoster(),
      this.loadGithubStats(),
      this.loadGitlabStats(),
      this.loadModules(),
      this.fetchLastRefreshed(),
      this.loadEnabledBuiltInSlugs(allSlugs),
      this.fetchSiteConfig()
    ])
    this.restoreFromHash()
  } catch (error) {
    console.error('Failed to load initial data:', error)
  } finally {
    this.isLoading = false
  }
  // Fetch messages independently -- non-blocking, never delays initial render
  this.fetchMessages()
}
```

---

## Files Summary

### New Files

| File | Description |
|------|-------------|
| `shared/server/message-registry.js` | Provider registry + aggregation logic (`registerProvider`, `getMessages`) |
| `shared/client/composables/useMessages.js` | Fetch, dismiss, reactive filtered message list |
| `shared/client/components/AppMessages.vue` | Presentational: renders stacked banners with type-based styling |

### Modified Files

| File | Change |
|------|--------|
| `server/module-loader.js` | `createModuleRouters()` accepts `messageRegistry` param; sets `context.registerMessageProvider` per module (no auto-prefixing) |
| `server/dev-server.js` | Import message-registry; pass to `createModuleRouters()`; add `GET /api/messages`, `POST /api/admin/messages` (with validation), `DELETE /api/admin/messages/:id` (404 on missing) |
| `modules/team-tracker/server/index.js` | Add `isFieldEmpty` helper; require `./manager-purview`; register field-completeness message provider via `context.registerMessageProvider` |
| `src/components/App.vue` | Import `AppMessages` + `useMessages`; render inside `<header>` below the toolbar; call `fetchMessages()` after `Promise.all` (non-blocking) |
| `shared/client/index.js` | Export `useMessages` from barrel |

### Not Modified

| File | Reason |
|------|--------|
| `shared/server/index.js` | Barrel export not needed. `dev-server.js` and `module-loader.js` require `message-registry.js` directly, keeping the dependency graph explicit. |
| `modules/team-tracker/client/views/ManagerDashboardView.vue` | Per-tab inline banners are preserved as-is. The app-wide alert is handled at the shell level. |

---

## Testing Strategy

### Unit Tests

**`shared/server/__tests__/message-registry.test.js`** (new):
- `registerProvider` stores a provider function
- `registerProvider` with non-function logs warning and skips
- `getMessages` calls all providers with user context
- Provider returning empty array produces no messages
- Provider throwing error is caught, skipped; other providers still run
- Provider exceeding timeout is skipped with warning
- Multiple providers' results are concatenated in registration order

**`shared/client/__tests__/useMessages.test.js`** (new):
- `fetchMessages` populates reactive message list from API
- `dismiss(id)` removes message from computed `messages`
- Dismissed IDs persist to sessionStorage as JSON array
- Dismissed IDs reload from sessionStorage on `fetchMessages`
- sessionStorage read/write failure does not throw
- Storage key is scoped to user email

**`shared/client/__tests__/AppMessages.test.js`** (new):
- Renders nothing when messages array is empty
- Renders one banner per message
- Correct CSS classes for warning/info/error types
- Correct icon for each type (AlertTriangle, Info, AlertCircle)
- Dismiss button emits `dismiss` event with message ID
- Link renders as `<a>` when present; absent when `link` is null

**`modules/team-tracker/__tests__/server/field-completeness-provider.test.js`** (new):
- Returns empty array when `user.uid` is null
- Returns empty array when `user.permissionTier` is `'user'` (early bailout, no disk I/O)
- Returns empty array for non-managers (no direct reports, even if admin/team-admin tier)
- Returns empty array when all visible fields are populated
- Returns warning message with correct person count
- Returns warning message with correct team count
- Returns combined message when both people and teams are incomplete
- Correct singular/plural: "1 person has" vs "3 people have"
- Correct combined verb: "1 person and 1 team have" (not "has")
- Skips deleted and non-visible fields
- Message includes link to manager dashboard

### Manual QA Checklist

- [ ] Banner appears on every page when user is a manager with incomplete fields
- [ ] Banner sticks with the header while scrolling (does not scroll away)
- [ ] Banner does not appear for non-managers
- [ ] Banner does not appear when all fields are complete
- [ ] Dismiss works; banner stays hidden for the session
- [ ] Banner reappears after closing and reopening the browser tab
- [ ] "Review" link navigates to `#/team-tracker/manager-dashboard`
- [ ] Multiple messages from different sources stack with spacing
- [ ] Admin can add stored messages via POST and they appear for all users
- [ ] Admin can delete stored messages via DELETE; returns 404 for missing IDs
- [ ] POST rejects invalid input (missing text, bad type, malformed link)
- [ ] Existing per-tab inline banners in ManagerDashboardView are unaffected
- [ ] Dark mode renders correctly for all three banner types
- [ ] Banner shows on landing page, settings page, and module views (not just team-tracker)
- [ ] Impersonation banner and app messages coexist correctly (impersonation on top, messages below in header)
- [ ] Messages never delay initial page load (non-blocking fetch)

---

## Backward Compatibility

- **No breaking changes.** All new code is additive.
- **Existing banners preserved.** The per-tab inline banners in `ManagerDashboardView.vue` are untouched.
- **Module contract extended, not changed.** `context.registerMessageProvider` is optional (guarded with `if (context.registerMessageProvider)`), following the same pattern as `registerDiagnostics`. Existing modules that don't use it are unaffected.
- **`createModuleRouters` signature extended.** New 5th parameter `messageRegistry` is optional; omitting it preserves current behavior. Existing tests that call `createModuleRouters` without it will continue to work.
- **No new required environment variables.**
- **`/api/messages` returns empty on error.** The app never crashes if messages fail to load.
- **Demo mode.** Providers can check `process.env.DEMO_MODE` and return empty arrays. The field-completeness provider naturally returns `[]` in demo mode if no registry data exists.

---

## Deployability

### Local Dev

- Works with `npm run dev:full`. No new env vars required.
- **Field-completeness limitation:** Without VPN/LDAP, `req.userUid` is typically null in local dev because the developer's email does not match any person in the registry. In this case, the field-completeness provider silently returns `[]` and no banner is shown. To see the banner in local dev, developers need:
  1. Roster data that includes a person whose email matches the local dev email (usually `local-dev@redhat.com` or the first entry in `ADMIN_EMAILS`), AND
  2. That person must have direct reports in the registry.
- Alternatively, the **admin stored messages API** can be used to test the banner rendering without any roster data: `curl -X POST http://localhost:3001/api/admin/messages -H 'Content-Type: application/json' -d '{"type":"warning","text":"Test message"}'`

### Preprod / Prod

- No infrastructure changes. No new secrets, configmaps, or PVC mounts.
- `data/messages.json` is created on first admin POST. Lives in the existing PVC-mounted `data/` directory.
- The `/api/messages` route sits behind the same auth middleware as all other routes.
- No new container images or build steps -- just code changes to existing backend and frontend images.

---

## What This Plan Does NOT Include

To keep this lightweight, the following are explicitly out of scope:

- **No admin UI for stored messages.** Admins manage messages via API only. A Settings tab can be added later.
- **No read/unread tracking.** Dismissal is client-side sessionStorage only.
- **No message expiry.** Stored messages persist until manually deleted. Computed messages are recalculated on each request.
- **No message priority or ordering.** Messages render in provider registration order, then stored messages.
- **No rich text or markdown.** `text` is plain text only.
- **No WebSocket/SSE push.** Messages are fetched once on page load. Updates require page reload.
- **No pagination.** The message count is expected to be small (single digits).
