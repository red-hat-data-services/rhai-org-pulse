/**
 * Report definitions for the releases module.
 * Each entry defines a report card that appears in the Reports hub.
 *
 * Future reports:
 * - Release health trending
 * - Feature completion velocity
 * - Cross-release comparison
 * - Blocker analysis
 */
export const reports = [
  {
    id: 'commitment-tracking',
    label: 'Commitment Tracking',
    description: 'Track committed vs. delivered features per release phase. Monitor >90% delivery OKR.',
    icon: 'Target',
    tags: ['Planning', 'OKR'],
    component: () => import('./CommitmentTrackingReport.vue')
  }
]
