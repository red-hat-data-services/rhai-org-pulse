# Central State of the Union — Implementation Plan

## 1. Overview

### What
Move the "State of the Union" (SOTU) view from the AI Impact module to the
app shell, making it the platform-wide personalized landing page. Introduce a
generic `sotuComponent` contract so any module can contribute a tab to the
central SOTU page.

### Why
Today the SOTU view lives inside AI Impact and only surfaces RFE/Feature
pipeline data. As Org Pulse grows, every module has "state of the union"
information worth surfacing on login — release health, team metrics, upstream
status, etc. A central, personalized landing page gives users a single place
to see what needs attention across the platform.

### Scope (this PR)
- Define the `sotuComponent` contract in `module.json`.
- Build the central SOTU page in the app shell with tab-per-module rendering.
- Refactor AI Impact's ForYou content to follow the new contract.
- Remove the `state-of-the-union` nav item from AI Impact.
- Update all cross-view and cross-module `from` navigation references.
- Keep the module grid accessible via a "Browse Modules" link.
- Do NOT add SOTU content for other modules yet.

## 2. Architecture

### 2.1 The `sotuComponent` Contract

Modules opt in by declaring a `sotuComponent` path in `module.json`:

```jsonc
// module.json
{
  "client": {
    "entry": "./client/index.js",
    "sotuComponent": "./client/components/AISotuTab.vue",
    "navItems": [...]
  }
}
```

**Rules:**
- `sotuComponent` is optional. Modules without it simply don't appear on the
  SOTU page.
- The path is relative to the module directory (same convention as
  `settingsComponent`).
- The component file **must** be named `*SotuTab.vue` and live in
  `client/components/`. This matches the `import.meta.glob` pattern used for
  discovery (same constraint as `*Settings.vue` for settings components).
  **Why a glob instead of dynamic import?** Vite requires statically
  analyzable import patterns for code splitting. `import.meta.glob` with a
  fixed pattern is the only way to get async chunk generation without
  knowing the exact paths at build time. The `module.json` path is validated
  at CI time (via `validate-modules.js`) to ensure it matches the glob
  pattern, so drift between manifest and glob is caught before merge.
- The component receives no props from the shell. It is fully self-contained:
  it fetches its own data via existing module APIs and renders its own UI.
- The shell renders each module's component inside a tab panel, labeled with
  the module's `name` from its manifest.

### 2.2 Discovery

The existing `src/module-loader.js` uses `import.meta.glob` to discover
module assets. We add a new glob for SOTU components:

```js
// New glob in module-loader.js
const sotuComponents = import.meta.glob('/modules/*/client/components/*SotuTab.vue')
```

A new export function `loadModuleSotuComponent(slug, sotuPath)` resolves the
glob key and returns a `defineAsyncComponent` — identical to the existing
`loadModuleSettingsComponent` pattern.

### 2.3 Tab Rendering

The landing page (`LandingPage.vue`) renders:

1. **Tab bar** — one tab per module that declares `sotuComponent`, ordered by
   `module.order`. Shows module name + icon. **When only one module has a
   SOTU provider, the tab bar is hidden** — the single module's component
   renders directly with just a module name heading. This avoids the
   antipattern of a tab bar with a single tab.
2. **Tab panel** — the active module's SOTU component, loaded via
   `defineAsyncComponent`.
3. **"Browse Modules" link** — a button/link in the header that toggles to
   the module grid view. The module grid preserves all existing content:
   Built-in Modules cards, Utilities section (API Docs link), External
   Modules section, and the empty state for no-module deployments.

The active tab is persisted to `localStorage` so the user returns to the same
module tab across sessions.

### 2.4 Personalization

Personalization (component-based filtering, wizard, settings gear) stays
**inside** each module's SOTU component. The shell does not enforce or
coordinate personalization across modules — each module owns its own
filtering UX. This keeps the contract simple and avoids coupling the shell to
module-specific data models.

For AI Impact specifically, the existing `useForYouPreferences` composable
and wizard flow remain unchanged inside `AISotuTab.vue`.

### 2.5 Navigation from SOTU Tabs (Critical Design Decision)

SOTU tab components render on the landing page where `activeModule === 'home'`
and `activeModuleSlugRef` is `null`. This means `moduleNav.navigateTo()` —
which reads `activeModuleSlugRef` to build the hash — would silently return
at the `if (!slug) return` guard, making every click on an RFE/Feature card
do absolutely nothing.

**Solution:** SOTU tab components must use `useModuleLink` (the cross-module
navigation utility) for **all** navigation, not `moduleNav`. `useModuleLink`
builds hash URLs directly via `window.location.hash` without depending on
`activeModuleSlugRef`. This is the correct pattern because the SOTU tab is
rendering outside its module's routing context — exactly like cross-module
navigation.

```js
// In AISotuTab.vue
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
const { navigateTo: crossNavigate } = useModuleLink()

function handleNavigate(item) {
  if (item.type === 'rfe') {
    crossNavigate('ai-impact', 'rfe-review', { select: item.key, from: 'sotu' })
  } else {
    crossNavigate('releases', 'feature-detail', { key: item.key, from: 'sotu' })
  }
}
```

### 2.6 The `from` Parameter Migration

Today, the SOTU view passes `from: 'state-of-the-union'` when navigating to
RFE Review, Feature Detail, and AI Factory Guide. Those views check this
parameter to show a "Back to State of the Union" button and navigate back.

After the migration:
- The `from` value changes to `'sotu'` (shorter, not route-specific).
- "Back" navigation uses `window.location.hash = '#/'` instead of
  `moduleNav.navigateTo('state-of-the-union')` or
  `crossNavigate('ai-impact', 'state-of-the-union')`, since the SOTU page
  now lives at the root hash.
- The back button label remains "Back to State of the Union".

All views that check `from === 'state-of-the-union'` must be updated:

| File | Current | New |
|------|---------|-----|
| `RFEReviewView.vue` | `params.from === 'state-of-the-union'` | `params.from === 'sotu'` |
| `RFEReviewView.vue` | `moduleNav.navigateTo('state-of-the-union')` | `window.location.hash = '#/'` |
| `AIFactoryGuideView.vue` | `params.from === 'state-of-the-union'` | `params.from === 'sotu'` |
| `AIFactoryGuideView.vue` | `moduleNav.navigateTo('state-of-the-union')` | `window.location.hash = '#/'` |
| `FeatureDetailView.vue` | `params.from === 'state-of-the-union'` | `params.from === 'sotu'` |
| `FeatureDetailView.vue` | `crossNavigate('ai-impact', 'state-of-the-union')` | `window.location.hash = '#/'` |
| `ForYouCard.vue` | `from=state-of-the-union` in hardcoded URL | `from=sotu` |
| `ForYouBoardTab.vue` | `from=state-of-the-union` in hardcoded URL | `from=sotu` |

### 2.7 CSS/Layout: Avoiding Double Padding

`App.vue` applies `px-6 lg:px-8 py-6` to `<main>` when
`activeModule === 'home'`. The current `ForYouView.vue` also applies its own
`px-6 py-6` and `max-w-[90rem]` on an inner wrapper.

To avoid double padding, `AISotuTab.vue` must **not** add horizontal padding
or vertical padding — it inherits the shell's `<main>` padding. The
component should:

1. Remove the outer `<div class="flex-1 overflow-y-auto bg-gray-50">` (page
   chrome).
2. Remove the inner `<div class="max-w-[90rem] mx-auto px-6 py-6 space-y-6">`
   wrapper's `px-6 py-6` classes. Keep `max-w-[90rem] mx-auto space-y-6`
   for content width constraint and vertical spacing.
3. The `bg-gray-50 dark:bg-gray-900` background is already provided by the
   shell's `#app` or `<main>`, so remove it from the component.

The `LandingPage.vue` component itself should also avoid adding padding since
`<main>` already provides it.

## 3. Phased Implementation

### Phase 1: Module Loader Extension

**Goal:** Add SOTU component discovery to the module loader.

**Files:**

| File | Change |
|------|--------|
| `src/module-loader.js` | Add `sotuComponents` glob and `loadModuleSotuComponent()` export |
| `scripts/validate-modules.js` | Validate `client.sotuComponent`: file must exist AND filename must match `*SotuTab.vue` glob pattern |

**Details:**

`loadModuleSotuComponent(slug, sotuPath)` follows the exact pattern of
`loadModuleSettingsComponent`:

```js
const sotuComponents = import.meta.glob('/modules/*/client/components/*SotuTab.vue')

export function loadModuleSotuComponent(slug, sotuPath) {
  if (sotuPath.includes('..')) {
    throw new Error(`Invalid SOTU component path for module "${slug}": path traversal not allowed`)
  }
  const normalized = sotuPath.replace(/^\.\//, '')
  const globKey = `/modules/${slug}/${normalized}`
  const loader = sotuComponents[globKey]
  if (!loader) {
    throw new Error(`SOTU component not found for module "${slug}": ${globKey}`)
  }
  return defineAsyncComponent(loader)
}
```

Validation script checks:
1. File exists on disk (same as `settingsComponent` validation).
2. Path matches `client/components/*SotuTab.vue` pattern (ensures the glob
   will find it at runtime).

### Phase 2: Central SOTU Page

**Goal:** Replace the landing page with the SOTU page + module grid fallback.

**Files:**

| File | Change |
|------|--------|
| `src/components/LandingPage.vue` | Rewrite: add SOTU view with conditional tab bar + "Browse Modules" toggle. Preserve existing module grid as the toggle target. When no modules have `sotuComponent`, render only the module grid (backward compat). |
| `src/components/App.vue` | Update `currentPageTitle`: return `'State of the Union'` instead of `'Home'` when `activeModule === 'home'` and SOTU modules exist. Pass `builtInManifests` (already done). |

**Details:**

`LandingPage.vue` gains:
- A computed `sotuModules` — filters `builtInManifests` to those with
  `client.sotuComponent`, resolves each via `loadModuleSotuComponent`.
- A `showModuleGrid` ref toggled by a "Browse Modules" / "Back to Overview"
  button.
- When `sotuModules` is empty, render the existing module grid (backward
  compat for deployments with no SOTU providers).
- **Single-tab behavior:** when `sotuModules.length === 1`, hide the tab bar
  and render the single module's component directly with a heading showing
  the module name.
- Tab state persisted to `localStorage` key `orgpulse_sotu_active_tab`.
- The module grid view preserves ALL existing LandingPage content: Built-in
  Modules cards, Utilities section (API Docs link), External Modules
  section, and the empty state.

**Layout (multiple tabs):**

```
+------------------------------------------------------+
| State of the Union                  [Browse Modules]  |
+------------------------------------------------------+
| [AI Impact]  [Releases]  [Team Tracker]  ...          |
+------------------------------------------------------+
|                                                       |
|   <AISotuTab />   (or whichever tab is active)        |
|                                                       |
+------------------------------------------------------+
```

**Layout (single tab — initial state of this PR):**

```
+------------------------------------------------------+
| State of the Union                  [Browse Modules]  |
+------------------------------------------------------+
|                                                       |
|   <AISotuTab />   (no tab bar shown)                  |
|                                                       |
+------------------------------------------------------+
```

When "Browse Modules" is clicked, the SOTU content is replaced with the
existing module grid cards. A "Back to Overview" button returns to SOTU.

### Phase 3: AI Impact SOTU Component + `from` Migration

**Goal:** Extract current ForYou content into a standalone SOTU tab component
and update all `from` navigation references.

**Files:**

| File | Change |
|------|--------|
| `modules/ai-impact/client/components/AISotuTab.vue` | **New file.** Wraps the existing ForYouView content as a self-contained component. |
| `modules/ai-impact/module.json` | Add `"sotuComponent": "./client/components/AISotuTab.vue"` to `client`. Remove the `state-of-the-union` nav item. |
| `modules/ai-impact/client/index.js` | Remove `'state-of-the-union'` route entry. |
| `modules/ai-impact/client/views/RFEReviewView.vue` | Update `from` check: `'state-of-the-union'` → `'sotu'`. Back navigation: `window.location.hash = '#/'` instead of `moduleNav.navigateTo('state-of-the-union')`. |
| `modules/ai-impact/client/views/AIFactoryGuideView.vue` | Same `from` + back navigation update. |
| `modules/ai-impact/client/components/ForYouCard.vue` | Update hardcoded `from=state-of-the-union` → `from=sotu` in guide URL. |
| `modules/ai-impact/client/components/ForYouBoardTab.vue` | Same hardcoded URL update. |
| `modules/releases/client/views/FeatureDetailView.vue` | Update `from` check: `'state-of-the-union'` → `'sotu'`. Back navigation: `window.location.hash = '#/'` instead of `crossNavigate('ai-impact', 'state-of-the-union')`. |
| `modules/ai-impact/client/views/ForYouView.vue` | **Delete.** Replaced by AISotuTab. |

**Details:**

`AISotuTab.vue` is essentially the current `ForYouView.vue` content moved
into a component that can render inside a tab panel. The key differences:

1. **No outer page chrome or padding** — removes the
   `<div class="flex-1 overflow-y-auto bg-gray-50">` wrapper AND the inner
   `px-6 py-6` from the `max-w-[90rem]` div (see Section 2.7). Keeps
   `max-w-[90rem] mx-auto space-y-6` for content width and spacing.
2. **Self-contained data loading** — keeps all the same composable imports
   (`useForYou`, `useForYouPreferences`, `useAIImpact`, `useFeatures`,
   `useAssessments`, `useRoster`, `useAuth`, `useFieldDefinitions`).
3. **Wizard + settings** — preserved as-is. The wizard shows on first visit
   within the SOTU tab, settings gear stays in the header area.
4. **Navigation via `useModuleLink`** — replaces `moduleNav.navigateTo` with
   `crossNavigate` from `useModuleLink` for all outbound navigation, since
   `activeModuleSlugRef` is `null` on the landing page (see Section 2.5).
   Passes `from: 'sotu'` instead of `from: 'state-of-the-union'`.

### Phase 4: Hash Routing + Backward Compat

**Goal:** Handle bookmarks and deep links to the old SOTU location.

**Files:**

| File | Change |
|------|--------|
| `src/components/App.vue` | Add redirect: `#/ai-impact/state-of-the-union` → `#/` (home/SOTU page). Update `currentPageTitle` for home. |

**Details:**

In `restoreFromHash()`, the redirect must be placed **before** the built-in
module routing block at line 657 (`const manifest = this.builtInManifests.find(...)`)
and **after** the shell route checks (settings, about, api-tokens) that end
around line 638. Specifically, insert it immediately before the git-static
iframe module check at line 641 (`if (parts[0] === 'modules' && parts[1])`).
This ensures the `ai-impact` slug is intercepted before the generic built-in
module matcher handles it:

```js
// Line ~640, before git-static and built-in module routing
// Redirect legacy SOTU bookmarks to central landing page
if (parts[0] === 'ai-impact' && parts[1] === 'state-of-the-union') {
  window.location.replace('#/')
  return
}
```

Page title update in `currentPageTitle` computed:

```js
if (this.activeModule === 'home') {
  // Show "State of the Union" when SOTU modules exist, "Home" otherwise
  const hasSotu = this.builtInManifests.some(m => m.client?.sotuComponent)
  return hasSotu ? 'State of the Union' : 'Home'
}
```

### Phase 5: Tests + Documentation + Validation

**Goal:** Update tests, document the new contract, update CI validation.

**Files:**

| File | Change |
|------|--------|
| `tests/integration/ai-impact.spec.js` | Remove `state-of-the-union` nav item tests (lines 222-233). Add landing page SOTU tab tests. |
| `docs/MODULES.md` | Add "SOTU Provider" section documenting the `sotuComponent` contract |
| `scripts/validate-modules.js` | Add validation: if `client.sotuComponent` is set, the file must exist and match `*SotuTab.vue` naming |

## 4. Files Modified — Complete List

| File | Action | Description |
|------|--------|-------------|
| `src/module-loader.js` | Modify | Add `sotuComponents` glob + `loadModuleSotuComponent()` |
| `src/components/LandingPage.vue` | Modify | Rewrite with SOTU view + module grid toggle (preserving all existing grid content) |
| `src/components/App.vue` | Modify | Add hash redirect + update `currentPageTitle` |
| `modules/ai-impact/module.json` | Modify | Add `sotuComponent`, remove `state-of-the-union` nav item |
| `modules/ai-impact/client/index.js` | Modify | Remove `state-of-the-union` route |
| `modules/ai-impact/client/components/AISotuTab.vue` | Create | SOTU tab component (extracted from ForYouView, no page chrome/padding) |
| `modules/ai-impact/client/views/ForYouView.vue` | Delete | Replaced by AISotuTab; no longer routed |
| `modules/ai-impact/client/views/RFEReviewView.vue` | Modify | Update `from` check + back navigation to `#/` |
| `modules/ai-impact/client/views/AIFactoryGuideView.vue` | Modify | Update `from` check + back navigation to `#/` |
| `modules/ai-impact/client/components/ForYouCard.vue` | Modify | Update hardcoded `from=state-of-the-union` → `from=sotu` |
| `modules/ai-impact/client/components/ForYouBoardTab.vue` | Modify | Update hardcoded `from=state-of-the-union` → `from=sotu` |
| `modules/releases/client/views/FeatureDetailView.vue` | Modify | Update `from` check + back navigation to `#/` |
| `tests/integration/ai-impact.spec.js` | Modify | Remove SOTU nav tests, add landing page SOTU tests |
| `scripts/validate-modules.js` | Modify | Validate `sotuComponent` path existence + naming pattern |
| `docs/MODULES.md` | Modify | Document SOTU provider contract |

## 5. Migration Path

### AI Impact's SOTU Content

1. Create `AISotuTab.vue` by extracting the template + script from
   `ForYouView.vue`. Remove the outer page wrapper div and inner `px-6 py-6`
   padding (shell provides padding). Replace `moduleNav.navigateTo` with
   `useModuleLink.navigateTo` (cross-module style). Change
   `from: 'state-of-the-union'` to `from: 'sotu'`.
2. Add `"sotuComponent": "./client/components/AISotuTab.vue"` to
   `modules/ai-impact/module.json` under `client`.
3. Remove `{ "id": "state-of-the-union", ... }` from `navItems` in
   `module.json`.
4. Remove `'state-of-the-union': defineAsyncComponent(...)` from
   `client/index.js`.
5. Delete `ForYouView.vue`.
6. Update all `from` parameter consumers:
   - `RFEReviewView.vue`: `from === 'sotu'`, back via `window.location.hash = '#/'`
   - `AIFactoryGuideView.vue`: same pattern
   - `FeatureDetailView.vue` (releases module): same pattern
   - `ForYouCard.vue`, `ForYouBoardTab.vue`: update hardcoded `from=` in URLs
7. Add hash redirect in `App.vue` for backward compat.

### Future Modules

When another module wants to contribute to the SOTU page:

1. Create a `<ModuleName>SotuTab.vue` component in
   `modules/<slug>/client/components/`.
2. Do NOT add padding — the shell's `<main>` provides `px-6 lg:px-8 py-6`.
3. Use `useModuleLink` for all outbound navigation (not `moduleNav`).
4. Add `"sotuComponent": "./client/components/<ModuleName>SotuTab.vue"` to
   its `module.json`.
5. The tab automatically appears on the landing page. The tab bar appears
   once two or more modules register SOTU providers. No shell changes needed.

## 6. Backward Compatibility

| Interface | Impact | Mitigation |
|-----------|--------|------------|
| `#/ai-impact/state-of-the-union` hash route | Broken (nav item removed) | Redirect to `#/` in `restoreFromHash()`, placed before built-in module matcher (line ~640) |
| `from=state-of-the-union` query param | Old bookmarks with this param | Views check both `'sotu'` and `'state-of-the-union'` for one release cycle, then drop the old value |
| AI Impact sidebar nav | One fewer item | No user impact — content is now more prominent on the landing page |
| `module.json` schema | New optional field | Fully backward compatible — modules without `sotuComponent` are unaffected |
| `LandingPage.vue` props | Unchanged | Same props from `App.vue` (`modules`, `builtInManifests`, `isAdmin`). SOTU tabs derive from `builtInManifests`. The module grid view (toggled via "Browse Modules") renders all existing content: Built-in Modules, Utilities (API Docs), External Modules, empty state. |
| ForYou composables | Unchanged | `useForYou`, `useForYouPreferences` stay in `modules/ai-impact/client/composables/` |
| ForYou sub-components | Unchanged | `ForYouActionsTab`, `ForYouBoardTab`, `ForYouCard`, etc. stay in place, imported by `AISotuTab.vue` |
| API endpoints | No changes | No server-side changes in this PR |
| Page title | Changes from "Home" to "State of the Union" | Deliberate improvement; falls back to "Home" when no SOTU providers exist |
| Demo mode | No changes | SOTU components use the same composables that already work in demo mode via fixture-backed storage. Verified: `useAIImpact`, `useFeatures`, `useAssessments` all go through `api.js` which respects `VITE_DEMO_MODE`. |

## 7. Testability

### Local Testing

```bash
npm run dev:full   # Start dev server
# Navigate to http://localhost:5173
# Should see SOTU page with AI Impact content (no tab bar — single provider)
# Click "Browse Modules" to see the full module grid (API Docs link, etc.)
# Old bookmark #/ai-impact/state-of-the-union should redirect to #/
# Click an item in SOTU → navigates into RFE Review / Feature Detail
# "Back to State of the Union" button returns to #/ (home)
# Verify no double padding (inspect element — should see shell's px-6 only)
```

### Demo Mode Testing

```bash
DEMO_MODE=true VITE_DEMO_MODE=true npm run dev:full
# Verify SOTU tab renders with fixture data
# Verify wizard, actions tab, board tab all work
```

### Unit Tests

| Test | Location | What it covers |
|------|----------|----------------|
| `loadModuleSotuComponent` | `src/__tests__/module-loader.test.js` | Glob resolution, path traversal rejection, missing component error |
| `AISotuTab` rendering | `modules/ai-impact/__tests__/client/AISotuTab.test.js` | Component mounts, loads data, renders actions/board tabs, uses `useModuleLink` (not `moduleNav`) for navigation |
| SOTU tab discovery | `src/__tests__/LandingPage.test.js` | Filters manifests to those with `sotuComponent`, renders tabs. Single-provider case hides tab bar. Falls back to module grid when none. |

### Integration Tests

The existing AI Impact integration tests (`tests/integration/ai-impact.spec.js`)
need updating:
- **Remove:** tests at lines 222-233 that click on the `state-of-the-union`
  nav item and navigate to `/#/ai-impact/state-of-the-union`.
- **Add:** Landing page SOTU tab tests — verify the AI Impact content loads
  on the home page (no tab bar in single-provider mode), Actions/Board
  sub-tabs work, item click navigates into module views, back button returns
  to home.

### Validation

```bash
npm run validate:modules   # Validates sotuComponent path exists + naming
npm run lint               # No new lint issues
npm test                   # All unit tests pass
```

## 8. Deployability

### CI/CD Impact

- **No new environment variables** — purely frontend changes.
- **No new API endpoints** — SOTU components fetch from existing module APIs.
- **No data migration** — localStorage preferences (`ai_impact_foryou_prefs`)
  remain valid; the same composable reads them.
- **No Dockerfile changes** — same build process. The built frontend image
  will naturally contain different Vite output chunks (new/modified/removed
  components), but no changes to the Dockerfile or build pipeline itself.
- **Change detection** — `ci.yml` already triggers on `src/`, `modules/`,
  `scripts/` changes. No CI config changes needed.
- **Integration test trigger** — changes to `modules/ai-impact/` and
  `modules/releases/` will trigger `integration-tests.yml` for both modules
  via `dorny/paths-filter`. The existing ai-impact integration test file
  (`tests/integration/ai-impact.spec.js`) is updated to test the new
  behavior, so no matrix changes needed.

### Rollout

- This is a frontend-only change. Deploying the new frontend image is
  sufficient.
- Users with `#/ai-impact/state-of-the-union` bookmarks are redirected
  seamlessly.
- The module grid is still accessible, so no functionality is lost.

### Rollback

- Revert the frontend image to the previous version. The old SOTU nav item
  and ForYouView are restored. No data corruption risk.

## 9. UX Recommendation

The core layout (single module renders directly, tab bar appears when 2+
modules register) is straightforward and follows existing patterns in the app
(the Execute view uses tabs, Settings uses tabs). A UX teammate is **not
required** for this step.

However, if we later want to add:
- A summary/overview tab that aggregates stats from all modules
- Dashboard-style widget layout instead of full-page tabs
- Cross-module action prioritization

...then a UX review would be valuable. For now, the tab-per-module pattern is
the right level of complexity.
