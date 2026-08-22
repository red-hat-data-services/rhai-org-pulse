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
  },
  {
    id: 'release-readiness',
    label: 'RHOAI Release Readiness',
    description: 'RHOAI Release Readiness and risk highlights.',
    icon: 'Shield',
    tags: ['Executive', 'Readiness', 'RAG'],
    component: defineAsyncComponent(() => import('./ReleaseReadinessDirector.vue'))
  },
  {
    id: 'cve-sustaining',
    label: 'RHAI Sustaining (CVEs)',
    description: 'Open CVE tracking across RHAI components and versions — due dates, assignee workload, VEX justifications, and trends.',
    icon: 'ShieldAlert',
    tags: ['Security', 'CVE', 'Sustaining'],
    component: defineAsyncComponent(() => import('./CveSustainingReport.vue'))
  },
  {
    id: 'capacity-commitment',
    label: 'Program Level Release Report',
    description: 'Key deadlines, team capacity, and commitment overview for a selected release.',
    component: defineAsyncComponent(() => import('./CapacityCommitmentReport.vue'))
  },
  {
    id: 'ai-adoption',
    label: 'AI Adoption Report',
    description: 'Scorecard tracking AI pipeline adoption across components, with release-over-release trends.',
    component: defineAsyncComponent(() => import('./AiAdoptionReport.vue'))
  },
  {
    id: 'rhoai-component-architectures',
    label: 'RHOAI Component Architectures (Multi-Arch)',
    description: 'Multi-architecture build support matrix for RHOAI components per release branch.',
    icon: 'Cpu',
    tags: ['Build', 'Architecture', 'Multi-Arch'],
    component: defineAsyncComponent(() => import('./RhoaiComponentArchitecturesReport.vue'))
  }
]
