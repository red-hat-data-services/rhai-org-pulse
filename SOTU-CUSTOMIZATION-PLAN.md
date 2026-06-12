# SOTU Customization — Widget Dashboard Plan

## 1. Overview

### What
Transform the central State of the Union page from a tab-per-module layout into
a **customizable two-column widget dashboard**. Modules register individual UI
widgets (not monolithic tabs) via a `sotuWidgets` array in `module.json`. Users
choose which widgets appear and drag-and-drop to reorder them on a personalized
grid layout.

### Why
The current `sotuComponent` contract gives each module exactly one tab. This
forces monolithic components (AISotuTab is 286 lines, TeamSotuTab is 245 lines)
and prevents users from mixing content across modules. A widget-based approach
lets users build a personalized landing page from focused, composable pieces.

### Key Decisions (from user requirements)
| Decision | Choice |
|----------|--------|
| Widget granularity | Small atomic widgets (~3-4 per current module) |
| Layout | Two-column CSS grid (full-width or half-width widgets) |
| Persistence | localStorage only |
| First visit | Default layout + first-visit customization banner |
| Widget sizing | Widgets declare `defaultSize: "half" | "full"`, user can override |
| AI Impact wizard | Stays inside AI widgets (not replaced by widget picker) |
| Migration | Clean break — `sotuComponent` replaced by `sotuWidgets` |

### Why now, not later?

The `sotuComponent` contract was added in the most recent commit and has zero
user feedback yet. Why replace it with a more complex widget system before
validating the simpler approach?

1. **No migration cost.** `sotuComponent` has exactly 2 consumers (AI Impact,
   Team Tracker) and hasn't shipped to users yet. Replacing now costs nothing;
   replacing after adoption means migrating external consumers.
2. **User request drives this.** The user explicitly asked for widget-level
   granularity, drag-and-drop, and pick-your-own-widgets. The tab-per-module
   approach can't deliver any of these — it would need a full rewrite anyway.
3. **Incremental delivery.** The phased plan allows shipping Phase 1
   (infrastructure) + Phase 2 (AI Impact widgets) first, deferring other
   modules. If the widget approach proves wrong, we've only committed 2 modules.
4. **Complexity is bounded.** The widget system adds ~4 new shell files
   (`useSotuLayout`, `SotuWidget`, `WidgetPicker`, SortableJS integration)
   and decomposes existing monoliths into smaller, simpler components. Net
   complexity may actually decrease per-component.

If the risk still feels high, a mitigation is to **ship Phase 1 + a single
"full-width-only" widget per module** (essentially the current sotuComponent
rendered as a widget). This validates the infrastructure without forcing
decomposition. Phases 2-3 decomposition can follow based on user feedback.

## 2. Architecture

### 2.1 The `sotuWidgets` Contract

Modules declare widgets in `module.json`:

```jsonc
// module.json
{
  "client": {
    "sotuWidgets": [
      {
        "id": "rfe-actions",
        "name": "RFE Action Items",
        "description": "RFEs needing your attention, filtered by your components",
        "component": "./client/widgets/RfeActionsWidget.vue",
        "defaultSize": "full",
        "icon": "ClipboardList",
        "category": "action-items"
      },
      {
        "id": "feature-board",
        "name": "Feature Board",
        "description": "Kanban view of features in your pipeline",
        "component": "./client/widgets/FeatureBoardWidget.vue",
        "defaultSize": "full",
        "icon": "Columns",
        "category": "boards"
      }
    ]
  }
}
```

**Widget manifest fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique within the module. Globally qualified as `{moduleSlug}:{id}` |
| `name` | string | yes | Display name in the widget picker |
| `description` | string | yes | Short description shown in the widget picker |
| `component` | string | yes | Path relative to module dir. Must match `*Widget.vue` glob |
| `defaultSize` | `"half"` or `"full"` | no | Default width. Defaults to `"half"` |
| `icon` | string | no | Lucide icon name for the widget picker |
| `category` | string | no | Grouping in the widget picker (e.g., `action-items`, `boards`, `metrics`, `teams`) |

**Rules:**
- `sotuWidgets` is optional. Modules without it don't appear in the widget picker.
- Component files must be named `*Widget.vue` and live in `client/widgets/`.
- Widgets are self-contained: they fetch their own data, manage their own state.
- Widgets receive a single prop: `size` (`"half"` or `"full"`) so they can
  adapt their layout (e.g., hide a column in half-width mode).
- Widgets use `useModuleLink` for navigation (same constraint as current SOTU tabs).
- The `sotuComponent` field is removed. Modules must migrate to `sotuWidgets`.

### 2.2 Widget Component Contract

```vue
<!-- Example: RfeActionsWidget.vue -->
<script setup>
defineProps({
  size: { type: String, default: 'full' } // 'half' or 'full'
})

// Widget is fully self-contained — fetches its own data
import { useAIImpact } from '../composables/useAIImpact.js'
// ...
</script>

<template>
  <!-- Widget provides its own card chrome (border, padding, header) -->
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">RFE Action Items</h3>
    <!-- content -->
  </div>
</template>
```

**Key conventions:**
- Each widget renders its own card wrapper (bg, border, rounded, padding).
  The dashboard grid provides only gap spacing between widgets.
- Widgets should be responsive within their column. In `half` mode the widget
  gets ~50% viewport width minus gaps. In `full` mode it spans the full width.
- Widgets may use the `size` prop to adjust layout (e.g., stack vs. side-by-side).
- No `max-w-[90rem]` — the dashboard grid handles overall width constraints.

### 2.3 Discovery

New glob pattern in `src/module-loader.js`:

```js
const widgetComponents = import.meta.glob('/modules/*/client/widgets/*Widget.vue')
```

New export function:

```js
export function loadModuleWidget(slug, widgetPath) {
  if (widgetPath.includes('..')) {
    throw new Error(`Invalid widget path for module "${slug}": path traversal not allowed`)
  }
  const normalized = widgetPath.replace(/^\.\//, '')
  const globKey = `/modules/${slug}/${normalized}`
  const loader = widgetComponents[globKey]
  if (!loader) {
    throw new Error(`Widget component not found for module "${slug}": ${globKey}`)
  }
  return defineAsyncComponent(loader)
}
```

### 2.4 Dashboard Layout

The landing page renders a CSS grid dashboard:

```
+------------------------------------------------------+
| State of the Union          [Add Widgets] [Browse...] |
+------------------------------------------------------+
| +-------------------------+-------------------------+ |
| | Half-width widget       | Half-width widget       | |
| +-------------------------+-------------------------+ |
| +---------------------------------------------------+ |
| | Full-width widget                                 | |
| +---------------------------------------------------+ |
| +-------------------------+-------------------------+ |
| | Half-width widget       | Half-width widget       | |
| +-------------------------+-------------------------+ |
+------------------------------------------------------+
```

**Hero section:** The current gradient hero section (`LandingPage.vue` lines
57-78) is **replaced** by a compact dashboard header bar with:
- Page title ("State of the Union")
- Brief subtitle: "Your personalized overview across the platform"
- "Add Widgets" and "Browse Modules" buttons

The gradient and Activity icon are removed to save vertical space, but the
subtitle retains the descriptive/onboarding purpose. On first visit, an
additional dismissible banner below the header explains customization options
(Section 2.13).

**CSS Grid implementation:**

```css
.sotu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.sotu-widget-full {
  grid-column: span 2;
}

/* Mobile: single column */
@media (max-width: 768px) {
  .sotu-grid {
    grid-template-columns: 1fr;
  }
  .sotu-widget-full {
    grid-column: span 1;
  }
}
```

### 2.5 Widget Picker

A slide-over panel (or modal) that shows all available widgets grouped by
module, with optional category sub-groups. Each widget shows:

- Module name (badge)
- Widget name
- Description
- Icon
- "Add" button (or checkmark if already on dashboard)

The picker opens via an "Add Widgets" button in the dashboard header. Users
toggle widgets on/off. Adding a widget appends it to the end of the layout.

### 2.6 Drag-and-Drop Reordering

Use **SortableJS** (`sortablejs` npm package, ~14KB gzipped) for drag-and-drop.
Attach via `onMounted` with `Sortable.create(el, options)`.

**Why SortableJS:** Mature, actively maintained, touch-friendly. The alternatives
(`vue-draggable-plus`, `@dnd-kit`) add more complexity for the same result.

**SortableJS + CSS Grid with mixed column spans — technical risk:**
SortableJS calculates drop positions using element bounding boxes and DOM order.
CSS Grid with mixed `span 1` and `span 2` items creates layout ambiguity during
drag because visual position can diverge from DOM order. This is the highest-risk
technical bet in the plan. Mitigation strategy:

1. **Flatten to single-column during drag.** On `onStart`, temporarily switch
   all widgets to `grid-column: span 1` (single-column layout). This eliminates
   visual-to-DOM-order mismatch. On `onEnd`, restore the configured column spans.
   The brief layout shift during drag is acceptable — Grafana and Notion use
   similar approaches.

2. **Fallback: Flexbox layout.** If the CSS Grid approach proves too brittle
   during implementation, switch to a `flex-wrap` container where full-width
   items have `width: 100%` and half-width items have `width: calc(50% - gap)`.
   SortableJS works cleanly with flex layouts since DOM order matches visual
   order. This sacrifices some CSS Grid elegance but eliminates the ambiguity
   entirely.

3. **Custom `onMove` handler.** If neither approach is clean enough, implement
   a custom `onMove` callback that calculates the correct insertion index by
   inspecting widget sizes and maintaining a logical ordering model separate
   from DOM order. The `useSotuLayout` composable's `moveWidget(from, to)`
   already provides this logical model.

**Implementation note:** Approach #1 should be tried first. If it doesn't feel
right during implementation, fall back to #2. Approach #3 is a last resort.

### 2.7 Layout Persistence (localStorage)

```js
// Key: 'orgpulse_sotu_layout'
// Value: JSON array of widget placement objects
[
  { "widgetId": "team-tracker:managed-teams", "size": "half" },
  { "widgetId": "team-tracker:quick-links", "size": "half" },
  { "widgetId": "ai-impact:rfe-actions", "size": "full" },
  { "widgetId": "ai-impact:feature-board", "size": "full" }
]
```

- `widgetId` is `{moduleSlug}:{widgetId}` — globally unique.
- `size` can be overridden by the user (defaults to widget's `defaultSize`).
- Order in the array = order on the dashboard.
- On load, prune any `widgetId` values that no longer exist in manifests.
- Missing key = first-visit state, seed with default layout (Section 2.13).
- Empty array = user intentionally removed all widgets, show empty state
  with "Add Widgets" button.

### 2.8 Widget Wrapper Component

A `SotuWidget.vue` shell component wraps each widget with:
- Drag handle (grip icon, cursor: grab)
- Widget resize toggle (half/full toggle button)
- Remove button (X icon)
- Module attribution badge (small pill showing module name)
- **Error boundary** via `onErrorCaptured`

```
+------------------------------------------------------+
| ⠿ RFE Action Items               [AI Impact] ⟷ ✕   |
+------------------------------------------------------+
|                                                       |
|   (widget content rendered via <component :is>)       |
|                                                       |
+------------------------------------------------------+
```

The drag handle, resize, and remove controls are only visible in an "edit mode"
or on hover, to keep the default view clean.

**Error isolation:** `SotuWidget.vue` uses `onErrorCaptured` to catch render
errors from the child widget component. On error, the widget displays a
fallback state ("This widget encountered an error. Click to retry.") with a
retry button that re-mounts the component. This prevents a broken widget from
blanking the entire dashboard — other widgets continue rendering normally.

```js
const widgetError = ref(null)
onErrorCaptured((err) => {
  widgetError.value = err
  return false // prevent propagation
})
```

### 2.9 Responsive Behavior

| Breakpoint | Columns | Behavior |
|------------|---------|----------|
| `>= 768px` (md) | 2 | Full two-column grid. Half widgets share a row. |
| `< 768px` | 1 | Single column. All widgets stack. `full` and `half` both span 1 column. |

### 2.10 Dashboard Width Constraint

The `.sotu-grid` container uses `max-w-[90rem] mx-auto` to prevent widgets
from stretching edge-to-edge on ultrawide monitors. This matches the existing
constraint used by `AISotuTab.vue` and `TeamSotuTab.vue`. Individual widgets
do NOT set their own max-width — the grid container handles it.

### 2.11 Odd Widget Count Behavior

An odd number of half-width widgets leaves the final grid cell empty (the last
half-width widget occupies only column 1). This is natural CSS Grid behavior
and is acceptable — no special handling needed.

### 2.12 First-Visit Experience

1. User lands on the SOTU page for the first time (no localStorage layout).
2. The dashboard renders a **default layout** seeded from available widgets:
   ```json
   [
     { "widgetId": "team-tracker:my-teams", "size": "half" },
     { "widgetId": "team-tracker:quick-links", "size": "half" },
     { "widgetId": "ai-impact:rfe-actions", "size": "full" },
     { "widgetId": "ai-impact:feature-board", "size": "full" }
   ]
   ```
3. A first-visit banner explains that the dashboard is customizable:
   "This is your personalized dashboard. Use **Add Widgets** to add more,
   or drag to reorder."
4. The default layout is derived from available widgets at runtime (only
   includes widgets whose modules are actually present), so it works for
   any deployment configuration.
5. On first interaction (add, remove, reorder, resize), the layout is saved
   to localStorage and the first-visit banner is dismissed.

This gives users immediate value without requiring configuration, while
making customization discoverable. The previous welcome modal is removed.

**Future:** The default layout could come from an admin-configurable API
endpoint, seeding localStorage on first visit. This is not in scope for
this PR but the architecture supports it.

## 3. Widget Decomposition

### 3.1 AI Impact Module (currently AISotuTab.vue)

Break into 3 widgets:

| Widget ID | Name | Default Size | Description |
|-----------|------|-------------|-------------|
| `rfe-actions` | RFE Action Items | full | Filterable list of RFEs needing attention, with stage/priority/component filters. Contains the ForYouActionsTab content. |
| `feature-board` | Feature Board | full | Kanban board of features in the pipeline. Contains the ForYouBoardTab content. |
| `pipeline-stats` | Pipeline Stats | half | Summary stats cards (total RFEs, needs action, features tracked, etc.). Extracted from ForYouActionsTab header stats. |

**Shared state — singleton composable pattern:** The current `AISotuTab.vue`
creates a single `useForYou()` instance that feeds both sub-tabs with shared
reactive state (filters, computed data, stats). Splitting into independent
widgets would break this: duplicate API calls, divergent filter state, and
non-reactive preference updates.

**Solution:** Refactor `useForYou`, `useForYouPreferences`, and the underlying
data composables (`useAIImpact`, `useFeatures`, `useAssessments`) to use the
**singleton composable pattern** — module-level refs returned by reference,
identical to how `useAuth` and `useRoster` work in `shared/`. This means:

1. `useForYouPreferences()` returns the same reactive refs on every call.
   When the user changes component settings in any widget, all widgets
   update reactively.
2. `useForYou()` returns the same computed chains (filters, classifications,
   stats, board columns) on every call. **Only one set of API fetches occurs**
   regardless of how many AI Impact widgets are on the dashboard. The first
   widget to call `useForYou()` triggers the fetches; subsequent calls return
   the same refs. This eliminates the API burst concern — 3 widgets = 1 set
   of API calls, not 3x.
3. Filter state (`stageFilter`, `priorityFilter`, `componentFilter`) is
   shared across all AI Impact widgets — filtering in `rfe-actions` is
   reflected in `feature-board`, matching current UX behavior.

This is a prerequisite refactor in Phase 2 before creating the widgets.

**Wizard placement:** The wizard is rendered exclusively by `RfeActionsWidget`
(the only full-width widget designed to contain it). The wizard was designed
for a full-width container and would be unusable in a half-width stats card.
Other AI Impact widgets check `wizardSeen` and show a minimal "Complete setup
in RFE Action Items" link if the wizard hasn't been completed yet. Since
`useForYouPreferences` is a singleton, `markWizardSeen()` propagates to all
widgets immediately.

If `RfeActionsWidget` is not on the dashboard, the wizard doesn't show — the
other widgets work in "all items" mode (same as skipping the wizard today).
This is acceptable because the wizard is optional guidance, not a gate.

**ForYouSettings gear:** Each widget has its own settings gear icon. They all
open the same `ForYouSettings` panel and write to the same singleton refs.

### 3.2 Team Tracker Module (currently TeamSotuTab.vue)

Break into 2-3 widgets:

| Widget ID | Name | Default Size | Description |
|-----------|------|-------------|-------------|
| `managed-teams` | Managed Teams | full | Team cards for managers showing direct reports, member counts, components. Only renders content for managers (shows empty/hidden for ICs). |
| `my-teams` | My Teams | half | Team cards showing the user's own team memberships with speciality and components. Useful for both managers and ICs. |
| `quick-links` | Quick Links | half | Navigation shortcuts to Manager Dashboard, Team Directory, etc. |

**Role-aware rendering:** `managed-teams` uses `useAuth().isManager` internally.
For non-managers, it renders a minimal "Not applicable" state or is simply not
shown by default (the widget picker can note "For managers" in the description).

### 3.3 Future Module Widgets

Other modules can register widgets as they see fit:

- **Releases:** `release-countdown` (half), `feature-hygiene-summary` (half),
  `execution-board` (full)
- **System Health:** `health-summary` (half)
- **Upstream Pulse:** `upstream-activity` (half)

These are not in scope for this PR but demonstrate the extensibility.

## 4. Phased Implementation

### Phase 1: Widget Infrastructure

**Goal:** Build the widget registration, discovery, and rendering infrastructure.

| File | Action | Description |
|------|--------|-------------|
| `src/module-loader.js` | Modify | Add `widgetComponents` glob + `loadModuleWidget()`. Remove `sotuComponents` glob and `loadModuleSotuComponent()`. |
| `src/composables/useSotuLayout.js` | Create | Composable for layout persistence: `loadLayout()`, `saveLayout()`, `addWidget()`, `removeWidget()`, `moveWidget()`, `resizeWidget()`. Uses localStorage key `orgpulse_sotu_layout`. |
| `src/components/SotuWidget.vue` | Create | Wrapper component: drag handle, resize toggle, remove button, module badge. Renders widget via `<component :is>`. |
| `src/components/WidgetPicker.vue` | Create | Slide-over panel listing available widgets grouped by module. Toggle on/off. |
| `src/components/LandingPage.vue` | Modify | Replace tab-per-module rendering with CSS grid dashboard. Integrate `useSotuLayout`, `SotuWidget`, `WidgetPicker`. |
| `scripts/validate-modules.js` | Modify | Replace `sotuComponent` validation with `sotuWidgets` validation: each entry must have required fields, component file must exist, filename must match `*Widget.vue`, widget IDs must be unique within the module's `sotuWidgets` array, and globally-qualified IDs (`{slug}:{id}`) must be unique across all modules. |
| `package.json` | Modify | Add `sortablejs` dependency. |

### Phase 2: AI Impact Widgets

**Goal:** Refactor shared state to singleton pattern, then decompose AISotuTab
into atomic widgets.

| File | Action | Description |
|------|--------|-------------|
| `modules/ai-impact/client/composables/useForYouPreferences.js` | Modify | Refactor to singleton pattern (module-level refs, returned by reference). |
| `modules/ai-impact/client/composables/useForYou.js` | Modify | Refactor to singleton pattern. Filters, computed chains, stats shared across all callers. |
| `modules/ai-impact/client/composables/useAIImpact.js` | Modify | Refactor to singleton pattern (fetch once, share refs). |
| `modules/ai-impact/client/composables/useFeatures.js` | Modify | Refactor to singleton pattern. |
| `modules/ai-impact/client/composables/useAssessments.js` | Modify | Refactor to singleton pattern. |
| `modules/ai-impact/client/widgets/RfeActionsWidget.vue` | Create | RFE action items with filters. Extracted from ForYouActionsTab integration in AISotuTab. |
| `modules/ai-impact/client/widgets/FeatureBoardWidget.vue` | Create | Feature kanban board. Extracted from ForYouBoardTab integration in AISotuTab. |
| `modules/ai-impact/client/widgets/PipelineStatsWidget.vue` | Create | Summary stat cards. Extracted from stats in AISotuTab. |
| `modules/ai-impact/module.json` | Modify | Replace `sotuComponent` with `sotuWidgets` array. |
| `modules/ai-impact/client/components/AISotuTab.vue` | Delete | Replaced by individual widgets. |

### Phase 3: Team Tracker Widgets

**Goal:** Decompose TeamSotuTab into atomic widgets.

| File | Action | Description |
|------|--------|-------------|
| `modules/team-tracker/client/widgets/ManagedTeamsWidget.vue` | Create | Manager's team cards. Extracted from TeamSotuTab manager view. |
| `modules/team-tracker/client/widgets/MyTeamsWidget.vue` | Create | User's own team memberships. Extracted from TeamSotuTab member view. |
| `modules/team-tracker/client/widgets/QuickLinksWidget.vue` | Create | Navigation shortcuts. Extracted from TeamSotuTab quick links. |
| `modules/team-tracker/module.json` | Modify | Replace `sotuComponent` with `sotuWidgets` array. |
| `modules/team-tracker/client/components/TeamSotuTab.vue` | Delete | Replaced by individual widgets. |

### Phase 4: Polish and Migration Cleanup

**Goal:** Clean up old contract, update docs, handle edge cases.

| File | Action | Description |
|------|--------|-------------|
| `src/components/App.vue` | Modify | Update `currentPageTitle` logic: show "State of the Union" when `activeModule === 'home'` AND at least one module has a non-empty `sotuWidgets` array (`m.client?.sotuWidgets?.length > 0`), otherwise "Home". An empty `sotuWidgets: []` is treated as no widgets. Keep hash redirect for `#/ai-impact/state-of-the-union` → `#/`. |
| `docs/MODULES.md` | Modify | Replace "SOTU Provider" section with "SOTU Widgets" documentation. |
| `CENTRAL-SOTU-PLAN.md` | Modify | Mark as superseded by this plan, or delete. |

### Phase 5: Tests

**Goal:** Unit tests for widget infrastructure and integration tests for the
dashboard.

| Test | Location | What it covers |
|------|----------|----------------|
| `loadModuleWidget` | `src/__tests__/module-loader.test.js` | Glob resolution, path traversal, missing component |
| `useSotuLayout` | `src/__tests__/useSotuLayout.test.js` | Add/remove/move/resize, localStorage round-trip, stale widget pruning |
| `LandingPage` widget rendering | `src/__tests__/LandingPage.test.js` | Empty state, widget picker, grid rendering, drag-and-drop |
| AI Impact widgets | `modules/ai-impact/__tests__/client/widgets/` | Each widget mounts, loads data, renders correctly in half/full sizes |
| Team Tracker widgets | `modules/team-tracker/__tests__/client/widgets/` | Each widget mounts, role-aware rendering |
| Integration: dashboard | `tests/integration/sotu-dashboard.spec.js` | End-to-end: widget picker, add/remove, reorder, persistence, navigation |
| Validation | `npm run validate:modules` | `sotuWidgets` schema validation |

**CI integration test filter:** The SOTU dashboard is a shell-level feature
(lives in `src/`, not `modules/`), so it needs its own filter entry in
`integration-tests.yml`:

```yaml
sotu-dashboard:
  - 'src/components/LandingPage.vue'
  - 'src/components/SotuWidget.vue'
  - 'src/components/WidgetPicker.vue'
  - 'src/composables/useSotuLayout.js'
  - 'src/module-loader.js'
  - 'modules/*/client/widgets/**'
  - 'modules/*/module.json'
  - 'tests/integration/sotu-dashboard.spec.js'
```

This must also be mirrored in the `merge_group` filter section and `ALL_MODULES`
array.

## 5. Files Modified — Complete List

| File | Action | Phase |
|------|--------|-------|
| `src/module-loader.js` | Modify | 1 |
| `src/composables/useSotuLayout.js` | Create | 1 |
| `src/components/SotuWidget.vue` | Create | 1 |
| `src/components/WidgetPicker.vue` | Create | 1 |
| `src/components/LandingPage.vue` | Modify | 1 |
| `scripts/validate-modules.js` | Modify | 1 |
| `package.json` | Modify | 1 |
| `modules/ai-impact/client/composables/useForYouPreferences.js` | Modify | 2 |
| `modules/ai-impact/client/composables/useForYou.js` | Modify | 2 |
| `modules/ai-impact/client/composables/useAIImpact.js` | Modify | 2 |
| `modules/ai-impact/client/composables/useFeatures.js` | Modify | 2 |
| `modules/ai-impact/client/composables/useAssessments.js` | Modify | 2 |
| `modules/ai-impact/client/widgets/RfeActionsWidget.vue` | Create | 2 |
| `modules/ai-impact/client/widgets/FeatureBoardWidget.vue` | Create | 2 |
| `modules/ai-impact/client/widgets/PipelineStatsWidget.vue` | Create | 2 |
| `modules/ai-impact/module.json` | Modify | 2 |
| `modules/ai-impact/client/components/AISotuTab.vue` | Delete | 2 |
| `modules/team-tracker/client/widgets/ManagedTeamsWidget.vue` | Create | 3 |
| `modules/team-tracker/client/widgets/MyTeamsWidget.vue` | Create | 3 |
| `modules/team-tracker/client/widgets/QuickLinksWidget.vue` | Create | 3 |
| `modules/team-tracker/module.json` | Modify | 3 |
| `modules/team-tracker/client/components/TeamSotuTab.vue` | Delete | 3 |
| `src/components/App.vue` | Modify | 4 |
| `docs/MODULES.md` | Modify | 4 |
| `CENTRAL-SOTU-PLAN.md` | Modify | 4 |
| `src/__tests__/module-loader.test.js` | Create | 5 |
| `src/__tests__/useSotuLayout.test.js` | Create | 5 |
| `src/__tests__/LandingPage.test.js` | Create | 5 |
| `modules/ai-impact/__tests__/client/widgets/*.test.js` | Create | 5 |
| `modules/team-tracker/__tests__/client/widgets/*.test.js` | Create | 5 |
| `tests/integration/sotu-dashboard.spec.js` | Create | 5 |
| `.github/workflows/integration-tests.yml` | Modify | 5 |

## 6. Backward Compatibility

| Interface | Impact | Mitigation |
|-----------|--------|------------|
| `sotuComponent` in module.json | Removed | Clean break. Both AI Impact and Team Tracker are migrated in the same PR. No third-party modules use this yet (it was added in the previous commit). |
| `loadModuleSotuComponent()` | Removed | Replaced by `loadModuleWidget()`. Only used in `LandingPage.vue`. |
| `#/ai-impact/state-of-the-union` hash | Already redirected | Redirect to `#/` stays in `App.vue` (from previous work). |
| `from=sotu` navigation param | Unchanged | Widgets use the same `useModuleLink` + `from: 'sotu'` pattern. |
| Tab persistence (`orgpulse_sotu_active_tab`) | Obsolete | New key is `orgpulse_sotu_layout`. Old key is harmlessly ignored. |
| Welcome modal (`orgpulse_sotu_welcome_dismissed`) | Replaced | Welcome modal replaced by default-layout + first-visit banner. Old key is ignored. |
| ForYou preferences (`ai_impact_foryou_prefs`) | Unchanged | AI Impact widgets still read this via `useForYouPreferences`. |
| `sotuComponents` glob in module-loader | Removed | Replaced by `widgetComponents` glob. |
| Module grid ("Browse Modules") | Unchanged | Still accessible via the "Browse Modules" button. |
| Demo mode | Unchanged | Widgets use the same composables that work with fixture data. |

## 7. Testability

### Local Testing

```bash
npm run dev:full
# Navigate to http://localhost:5173
# Should see default dashboard with My Teams, Quick Links, RFE Actions, Feature Board
# First-visit banner should explain customization options
# Click "Add Widgets" to open widget picker — see all widgets from AI Impact + Team Tracker
# Add/remove widgets, verify they render in the grid
# Drag to reorder — verify order persists on page reload
# Toggle widget size (half/full) — verify grid reflows
# Remove a widget — verify it's gone and re-addable from picker
# Click items in widgets — verify navigation works (from=sotu)
# "Back to State of the Union" buttons still work
# "Browse Modules" still shows the module grid
# Responsive: resize to mobile — verify single-column layout
```

### Demo Mode

```bash
DEMO_MODE=true VITE_DEMO_MODE=true npm run dev:full
# Verify widgets render with fixture data
# Verify AI Impact wizard still works inside RFE Actions widget
```

### Validation

```bash
npm run validate:modules   # Validates sotuWidgets entries
npm run lint               # No new lint issues
npm test                   # All unit tests pass
```

## 8. Deployability

### CI/CD Impact
- **New dependency:** `sortablejs` added to `package.json`. No native addons.
- **No new environment variables.**
- **No new API endpoints** — widgets use existing module APIs.
- **No data migration** — localStorage layout is new; old keys are ignored.
- **No Dockerfile changes** — same build process.
- **Change detection** — `ci.yml` already triggers on `src/`, `modules/`,
  `scripts/` changes.
- **Integration tests** — new `sotu-dashboard.spec.js` should be added to
  CI matrix. AI Impact and Team Tracker integration tests need updating.

### Rollout
- Frontend-only change. Deploy the new frontend image.
- Users see a sensible default layout on first visit with a customization banner.
- No data loss — existing ForYou preferences and Jira data are untouched.

### Rollback
- Revert the frontend image. The old tab-per-module LandingPage is restored.
- localStorage `orgpulse_sotu_layout` key is harmlessly ignored by the old code.

## 9. API / Interface Impact

### module.json Schema Change

**Removed:**
```jsonc
"client": {
  "sotuComponent": "./client/components/AISotuTab.vue"  // REMOVED
}
```

**Added:**
```jsonc
"client": {
  "sotuWidgets": [  // NEW — array of widget declarations
    {
      "id": "rfe-actions",           // required, unique within module
      "name": "RFE Action Items",    // required, display name
      "description": "RFEs needing your attention",  // required
      "component": "./client/widgets/RfeActionsWidget.vue",  // required
      "defaultSize": "full",         // optional, "half" | "full", default "half"
      "icon": "ClipboardList",       // optional, Lucide icon name
      "category": "action-items"     // optional, for widget picker grouping
    }
  ]
}
```

### Module Loader Exports

**Removed:** `loadModuleSotuComponent(slug, sotuPath)`
**Added:** `loadModuleWidget(slug, widgetPath)`

### Widget Component Props

All widgets receive:
```js
defineProps({
  size: { type: String, default: 'half' }  // 'half' or 'full'
})
```

### New Composable: `useSotuLayout`

```js
import { useSotuLayout } from '../composables/useSotuLayout.js'

const {
  layout,           // ref<Array<{widgetId, size}>>
  addWidget,        // (widgetId: string, defaultSize?: string) => void
  removeWidget,     // (widgetId: string) => void
  moveWidget,       // (fromIndex: number, toIndex: number) => void
  resizeWidget,     // (widgetId: string, newSize: 'half'|'full') => void
  isFirstVisit,     // computed<boolean> — true when no layout saved
  hasWidget,        // (widgetId: string) => boolean
} = useSotuLayout()
```

## 10. UX Recommendation

The widget picker, drag-and-drop reordering, and two-column grid introduce
meaningful interaction design complexity. **A UX teammate review is recommended**
for:

1. **Widget picker design** — slide-over vs. modal, grouping, add/remove UX
2. **Empty state** — the "Build Your Dashboard" first-visit experience
3. **Edit mode** — when to show drag handles, resize controls, remove buttons
   (always visible? hover? dedicated edit mode toggle?)
4. **Visual consistency** — ensuring widgets from different modules feel
   cohesive when placed side-by-side
5. **Mobile drag-and-drop** — touch interactions for reordering on small screens

## 11. Open Questions

1. **Widget resize persistence:** Should the user's size override persist, or
   should widgets always use their `defaultSize`? Current plan: persist size
   overrides in the layout array. This is simple and gives users full control.

2. **Admin default layouts:** Should admins be able to set a "recommended"
   default layout for first-time users? Not in scope for this PR, but the
   architecture supports it — the hardcoded default layout (Section 2.12) could
   later come from an admin-configurable API endpoint that seeds localStorage
   on first visit.
