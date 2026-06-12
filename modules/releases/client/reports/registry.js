/**
 * Report definitions for the releases module.
 * Each entry defines a report card that appears in the Reports hub.
 */
import { defineAsyncComponent } from 'vue'

export const reports = [
  {
    id: 'commitment-tracking',
    label: 'Commitment Tracking',
    description: 'Track committed vs. delivered features per release phase. Monitor >90% delivery OKR.',
    icon: 'Target',
    tags: ['Planning', 'OKR'],
    component: defineAsyncComponent(() => import('./CommitmentTrackingReport.vue'))
  },
  {
    id: 'program-hygiene',
    label: 'Program Hygiene Report',
    description: 'Cross-version hygiene summary with violation breakdowns by rule, team, and version. Designed for program-level reporting.',
    component: defineAsyncComponent(() => import('./ProgramHygieneReport.vue'))
  },
  {
    id: 'tv-fv-delta',
    label: 'TV vs FV Delta',
    description: 'Target Version (PM intent) vs Fix Version (engineering commitment) — alignment, mismatches, and component breakdown.',
    component: defineAsyncComponent(() => import('../views/TvFvDeltaView.vue'))
  },
  {
    id: 'feature-pressure',
    label: 'Feature Pressure',
    description: 'Where feature inflow exceeds capacity to burn down — RHAI-wide pressure by component, with RFE pipeline and risk scorecard.',
    component: defineAsyncComponent(() => import('../views/FeaturePressureView.vue'))
  },
  {
    id: 'release-performance',
    label: 'Release Performance',
    description: 'Cross-releases, and competitive comparisons performance dashboard',
    externalUrl: 'https://aidash.app.intlab.redhat.com/'
  }
]
