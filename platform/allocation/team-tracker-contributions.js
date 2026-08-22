/**
 * Allocation platform contribution — team-tracker discovery seam.
 *
 * Core team-tracker (v2.0.61+) no longer ships allocation. This consumer repo
 * re-homes it as a self-contained platform extension and registers it into
 * team-tracker's three contribution slots via the discovery seam:
 *
 *   platform/<name>/team-tracker-contributions.js -> export function register(api)
 *
 * The registrar API (`registerTeamDetailTab`, `registerReport`,
 * `registerSettingsTab`) is INJECTED by core (see core's
 * `contributions/apply-platform-contributions.js`); this file never imports
 * team-tracker internals. `render` is a descriptor
 * (`{ type: 'component', load: () => import(...) }`) so delivery stays
 * forward-compatible.
 *
 * The allocation strategy is bundled with this extension (see `manifest.json`
 * `strategy` + `classify.js`), so it is always "configured" when this file is
 * present. The strategy metadata is read locally via `useAllocationStrategy`.
 */
import { useAllocationStrategy } from './client/composables/useAllocationStrategy'

const ALLOCATION_TAB_ICON =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />'

/**
 * Register allocation's team-detail tab, report card, and settings tab.
 *
 * @param {object} api - injected registrar API
 * @param {function} api.registerTeamDetailTab
 * @param {function} api.registerReport
 * @param {function} api.registerSettingsTab
 */
export function register({ registerTeamDetailTab, registerReport, registerSettingsTab }) {
  const { configured, name } = useAllocationStrategy()

  // The extension bundles its strategy, so it is always configured when present.
  if (!configured.value) return

  // Team-detail tab — visibility now gates on the strategy being configured,
  // NOT on the team having boards. A boardless team still sees the tab with a
  // manager-facing "configure a board" empty state (handled inside the tab).
  registerTeamDetailTab({
    id: 'allocation',
    label: 'Allocation',
    order: 40,
    icon: ALLOCATION_TAB_ICON,
    isVisible: () => configured.value,
    render: {
      type: 'component',
      load: () => import('./client/TeamAllocationTab.vue')
    }
  })

  registerReport({
    id: 'allocation',
    title: 'Work Allocation',
    description: `${name.value || 'Allocation'} breakdown across teams.`,
    icon: 'PieChart',
    tags: ['Allocation'],
    filters: [],
    order: 30,
    isAvailable: () => configured.value,
    render: {
      type: 'component',
      load: () => import('./client/reports/AllocationReport.vue')
    }
  })

  registerSettingsTab({
    id: 'allocation',
    label: name.value || 'Allocation',
    order: 40,
    render: {
      type: 'component',
      load: () => import('./client/AllocationSettings.vue')
    }
  })
}
