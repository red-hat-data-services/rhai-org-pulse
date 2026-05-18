/**
 * Static quality report registry. Each `reportUrl` is resolved by Vite (`?url`) so the
 * browser loads a full HTML document (with its own styles) inside an iframe — no v-html.
 */
import reportArgo from './generated-reports/quality-report-opendatahub-io-argo-workflows.html?url'
import reportAutogluon from './generated-reports/quality-report-opendatahub-io-autogluon.html?url'
import reportAiHelpers from './generated-reports/quality-report-opendatahub-io-ai-helpers.html?url'
import reportAgents from './generated-reports/quality-report-opendatahub-io-agents.html?url'
import reportAgentOps from './generated-reports/quality-report-opendatahub-io-agent-ops.html?url'

export const QUALITY_SAMPLE_META = {
  generatedAt: '2026-05-07 10:59:58',
  averageScore: '4.24/10',
  blurb:
    'Lightweight static-scan sample meant to validate the master/detail reporting flow.'
}

/** @type {Array<{ id: string, label: string, githubUrl: string, score: string, gaps: string, reportUrl: string }>} */
export const QUALITY_REPORTS = [
  {
    id: 'opendatahub-io-argo-workflows',
    label: 'opendatahub-io/argo-workflows',
    githubUrl: 'https://github.com/opendatahub-io/argo-workflows',
    score: '8.2/10',
    gaps: 'Agent guidance for testing is minimal',
    reportUrl: reportArgo
  },
  {
    id: 'opendatahub-io-autogluon',
    label: 'opendatahub-io/autogluon',
    githubUrl: 'https://github.com/opendatahub-io/autogluon',
    score: '5.2/10',
    gaps:
      'Agent guidance for testing is minimal, Coverage tracking and enforcement are missing',
    reportUrl: reportAutogluon
  },
  {
    id: 'opendatahub-io-ai-helpers',
    label: 'opendatahub-io/ai-helpers',
    githubUrl: 'https://github.com/opendatahub-io/ai-helpers',
    score: '4.4/10',
    gaps:
      'Coverage tracking and enforcement are missing, Limited integration and end-to-end coverage',
    reportUrl: reportAiHelpers
  },
  {
    id: 'opendatahub-io-agents',
    label: 'opendatahub-io/agents',
    githubUrl: 'https://github.com/opendatahub-io/agents',
    score: '2.1/10',
    gaps:
      'PR-time build validation is incomplete, Container image validation is weak',
    reportUrl: reportAgents
  },
  {
    id: 'opendatahub-io-agent-ops',
    label: 'opendatahub-io/agent-ops',
    githubUrl: 'https://github.com/opendatahub-io/agent-ops',
    score: '1.3/10',
    gaps:
      'Agent guidance for testing is minimal, PR-time build validation is incomplete',
    reportUrl: reportAgentOps
  }
]
