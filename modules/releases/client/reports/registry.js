/**
 * Report definitions for the releases module.
 * Each entry defines a report card that appears in the Reports hub.
 */
import { defineAsyncComponent } from 'vue'

export const reports = [
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
