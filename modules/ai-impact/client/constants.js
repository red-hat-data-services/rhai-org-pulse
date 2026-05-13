/**
 * Delivery pipeline phases — shared between views and detail panel components.
 */
export const PHASES = [
  { id: 'rfe-review', name: 'RFE Review', order: 1, status: 'active' },
  { id: 'feature-review', name: 'Feature Review', order: 2, status: 'active' },
  { id: 'implementation', name: 'Implementation', order: 3, status: 'coming-soon' },
  { id: 'test-plan-review', name: 'Test Plan Review', order: 4, status: 'active' },
  { id: 'security', name: 'Security Review', order: 5, status: 'coming-soon' },
  { id: 'documentation', name: 'Documentation', order: 6, status: 'active' },
  { id: 'build-release', name: 'Build & Release', order: 7, status: 'coming-soon' },
]
