/**
 * Report definitions for the releases module.
 * Each entry defines a report card that appears in the Reports hub.
 */
import { defineAsyncComponent } from 'vue'

export const reports = [
  {
    id: 'program-hygiene',
    label: 'Program Hygiene Report',
    description: 'Cross-version hygiene summary with violation breakdowns by rule, team, and version. Designed for program-level reporting.',
    component: defineAsyncComponent(() => import('../reports/ProgramHygieneReport.vue'))
  },
  {
    id: 'tv-fv-delta',
    label: 'TV vs FV Delta',
    description: 'Target Version (PM intent) vs Fix Version (engineering commitment) — alignment, mismatches, and component breakdown.',
    component: defineAsyncComponent(() => import('../views/TvFvDeltaView.vue'))
  }
]
