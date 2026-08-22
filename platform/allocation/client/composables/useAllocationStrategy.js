import { computed } from 'vue'
import manifest from '../../manifest.json'

/**
 * Allocation strategy metadata, self-loaded from this extension's manifest.
 *
 * Core removed `loadAllocationStrategy` / `context.allocationStrategy` in
 * v2.0.61. The strategy now lives inside this extension: its metadata
 * (id/name/description/categories) is declared under `manifest.strategy` and the
 * classification logic in `../../classify.js` (server-side). Because the
 * strategy ships with the extension, it is always "configured" when this
 * composable is importable — no core loader required.
 *
 * The backend also exposes the same metadata via
 * `GET /api/modules/team-tracker/allocation/strategy` (see allocation-api's
 * `getAllocationStrategy`) for consumers that need a runtime source of truth.
 */
const strategy = manifest.strategy || null

export function useAllocationStrategy() {
  return {
    configured: computed(() => strategy !== null),
    strategyId: computed(() => strategy?.id ?? null),
    name: computed(() => strategy?.name ?? null),
    description: computed(() => strategy?.description ?? null),
    categories: computed(() => strategy?.categories ?? []),
    // Settings are surfaced as a registered settings tab (see
    // team-tracker-contributions.js), so no standalone settingsComponent is
    // needed. Kept for backward-compatible shape.
    settingsComponent: computed(() => null)
  }
}
