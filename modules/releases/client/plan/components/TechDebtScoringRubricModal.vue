<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="activeRubric === 'bug' ? 'bug-rubric-title' : 'vulnerability-rubric-title'"
    data-testid="vulnerability-scoring-rubric"
    @click.self="emit('close')"
  >
    <section class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      <header class="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-fuchsia-700 dark:text-fuchsia-300">Transparent prioritization</p>
          <h2 v-if="activeRubric === 'vulnerability'" id="vulnerability-rubric-title" class="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">Vulnerability priority scoring rubric</h2>
          <h2 v-else id="bug-rubric-title" class="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">Bug priority scoring rubric</h2>
          <p v-if="activeRubric === 'vulnerability'" class="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            The score combines delivery urgency, technical severity, action required, issue age, and tracking uncertainty. The raw maximum is 95 points.
          </p>
          <p v-else class="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            The score balances customer impact, delivery and security risk, detection source, Jira severity, due date, and age. Bugs and vulnerabilities are ranked together by effective priority score.
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Close scoring rubric"
          data-testid="vulnerability-rubric-close"
          @click="emit('close')"
        >
          Close
        </button>
      </header>

      <div class="overflow-y-auto px-5 py-5">
        <div class="mb-5 inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="tablist" aria-label="Scoring rubrics">
          <button
            type="button"
            role="tab"
            :aria-selected="activeRubric === 'vulnerability'"
            class="rounded-lg px-4 py-2 text-sm font-semibold transition"
            :class="activeRubric === 'vulnerability' ? 'bg-white text-fuchsia-700 shadow-sm dark:bg-gray-700 dark:text-fuchsia-300' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
            data-testid="vulnerability-rubric-tab"
            @click="activeRubric = 'vulnerability'"
          >
            Vulnerabilities
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeRubric === 'bug'"
            class="rounded-lg px-4 py-2 text-sm font-semibold transition"
            :class="activeRubric === 'bug' ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
            data-testid="bug-rubric-tab"
            @click="activeRubric = 'bug'"
          >
            Bugs
          </button>
        </div>

        <div v-if="activeRubric === 'vulnerability'" data-testid="vulnerability-rubric-content">
        <div class="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-100">
          <p class="font-semibold">Priority score = SLA + CVSS + due date + review outcome + age + uncertainty</p>
          <p class="mt-1 text-xs leading-5 text-primary-800 dark:text-primary-200">
            Missing or invalid values receive zero category points and only the uncertainty points listed below. Scores guide queue ordering and do not override mandatory security policy.
          </p>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <section v-for="category in scoreCategories" :key="category.name" class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <header class="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3 dark:bg-gray-800">
              <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ category.name }}</h3>
              <span class="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-300">Max {{ category.max }}</span>
            </header>
            <div class="divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <div v-for="row in category.rows" :key="row.label" class="flex items-center justify-between gap-3 px-4 py-2">
                <span class="text-gray-600 dark:text-gray-300">{{ row.label }}</span>
                <strong class="shrink-0 text-gray-900 dark:text-gray-100">{{ row.points }}</strong>
              </div>
            </div>
          </section>
        </div>

        <div class="mt-5 grid gap-4 lg:grid-cols-2">
          <section class="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Data uncertainty</h3>
            <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">Added to keep records with incomplete tracking data visible for triage.</p>
            <ul class="mt-3 grid gap-2 text-sm text-gray-700 dark:text-gray-200 sm:grid-cols-2">
              <li v-for="item in uncertaintyPoints" :key="item.label" class="flex justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 dark:bg-gray-900/50">
                <span>{{ item.label }}</span><strong>+{{ item.points }}</strong>
              </li>
            </ul>
          </section>

          <section class="rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20">
            <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Guardrails</h3>
            <ul class="mt-3 space-y-2 text-sm leading-5 text-gray-700 dark:text-gray-200">
              <li><strong>SLA breached:</strong> effective score is at least 70 (P1 — Urgent).</li>
              <li><strong>CVSS 9+ and urgent deadline:</strong> effective score is at least 85 (P0 — Immediate) when the SLA or Jira due date is overdue or within seven days.</li>
            </ul>
          </section>
        </div>

        <section class="mt-5 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <header class="bg-gray-50 px-4 py-3 dark:bg-gray-800">
            <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Priority bands and expected action</h3>
          </header>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
              <thead class="bg-white text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr><th class="px-4 py-2">Score</th><th class="px-4 py-2">Priority</th><th class="px-4 py-2">Expected action</th></tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr v-for="band in priorityBands" :key="band.score">
                  <td class="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">{{ band.score }}</td>
                  <td class="px-4 py-2 text-gray-700 dark:text-gray-200">{{ band.priority }}</td>
                  <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ band.action }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Queue ordering</h3>
          <p class="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">
            Bugs and vulnerabilities share one queue sorted by effective score (highest first), SLA date (earliest), Jira due date (earliest), CVSS (highest), then creation date (oldest).
          </p>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Date boundaries use UTC calendar days. “Within seven days” includes today; age uses completed seven-day periods.
          </p>
        </section>
        </div>

        <div v-else data-testid="bug-rubric-content">
          <div class="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100">
            <p class="font-semibold">Bug score = customer + delivery/security + detection + Jira severity + due date + age</p>
            <p class="mt-1 text-xs leading-5 text-indigo-800 dark:text-indigo-200">
              Only the highest matching rule in each dimension contributes points. Missing values receive zero points. The effective score controls position in the combined queue.
            </p>
          </div>

          <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <section v-for="category in bugScoreCategories" :key="category.name" class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <header class="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3 dark:bg-gray-800">
                <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ category.name }}</h3>
                <span class="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-300">Max {{ category.max }}</span>
              </header>
              <div class="divide-y divide-gray-100 text-sm dark:divide-gray-800">
                <div v-for="row in category.rows" :key="row.label" class="flex items-center justify-between gap-3 px-4 py-2">
                  <span class="text-gray-600 dark:text-gray-300">{{ row.label }}</span>
                  <strong class="shrink-0 text-gray-900 dark:text-gray-100">{{ row.points }}</strong>
                </div>
              </div>
            </section>
          </div>

          <div class="mt-5 grid gap-4 lg:grid-cols-2">
            <section class="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
              <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Primary Bug type precedence</h3>
              <ol class="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-200">
                <li v-for="label in bugTypePrecedence" :key="label">{{ label }}</li>
              </ol>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">All matched evidence remains visible even though only one primary type is assigned.</p>
            </section>

            <section class="rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20">
              <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Bug guardrails</h3>
              <ul class="mt-3 space-y-2 text-sm leading-5 text-gray-700 dark:text-gray-200">
                <li><strong>Approved Release Blocker:</strong> effective score is at least 70 (P1 — Urgent).</li>
                <li><strong>Affecting-customer high-severity Bug:</strong> effective score is at least 70 when Jira priority is Blocker, Highest, Critical, or High.</li>
              </ul>
            </section>
          </div>

          <section class="mt-5 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <header class="bg-gray-50 px-4 py-3 dark:bg-gray-800">
              <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Priority bands and expected action</h3>
            </header>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
                <thead class="bg-white text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr><th class="px-4 py-2">Score</th><th class="px-4 py-2">Priority</th><th class="px-4 py-2">Expected action</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                  <tr v-for="band in priorityBands" :key="band.score">
                    <td class="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">{{ band.score }}</td>
                    <td class="px-4 py-2 text-gray-700 dark:text-gray-200">{{ band.priority }}</td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ band.action }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="mt-5 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700" data-testid="bug-source-rules">
            <header class="bg-gray-50 px-4 py-3 dark:bg-gray-800">
              <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Jira evidence and source rules</h3>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Labels and reporter names are matched case-insensitively. Snyk SCA wins when SCA and SAST evidence overlap.</p>
            </header>
            <div class="divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <div v-for="rule in bugSourceRules" :key="rule.label" class="grid gap-1 px-4 py-2 sm:grid-cols-[12rem_1fr]">
                <strong class="text-gray-900 dark:text-gray-100">{{ rule.label }}</strong>
                <span class="text-gray-600 dark:text-gray-300">{{ rule.evidence }}</span>
              </div>
            </div>
          </section>

          <section class="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Active prioritization</h3>
            <p class="mt-1 text-sm leading-5 text-gray-700 dark:text-gray-200">
              Bug-v1 and vulnerability scores are active in one shared queue. Backlog ranks are global across both issue types, with each card exposing the score equation and supporting evidence.
            </p>
          </section>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits(['close'])
const props = defineProps({
  initialTab: { type: String, default: 'vulnerability' }
})
const activeRubric = ref(props.initialTab === 'bug' ? 'bug' : 'vulnerability')

const scoreCategories = [
  {
    name: 'SLA urgency',
    max: 35,
    rows: [
      { label: 'Breached', points: 35 },
      { label: 'Due within 7 days', points: 30 },
      { label: 'Due in 8–30 days', points: 22 },
      { label: 'Due in 31–90 days', points: 12 },
      { label: 'Due after 90 days', points: 4 },
      { label: 'Missing or invalid', points: 0 }
    ]
  },
  {
    name: 'CVSS base score',
    max: 30,
    rows: [
      { label: '9.0–10.0', points: 30 },
      { label: '7.0–8.9', points: 23 },
      { label: '4.0–6.9', points: 14 },
      { label: '0–3.9', points: 5 },
      { label: 'Missing or invalid', points: 0 }
    ]
  },
  {
    name: 'Jira due date',
    max: 15,
    rows: [
      { label: 'Past due', points: 15 },
      { label: 'Due within 7 days', points: 13 },
      { label: 'Due in 8–30 days', points: 9 },
      { label: 'Due in 31–90 days', points: 5 },
      { label: 'Due after 90 days', points: 2 },
      { label: 'Missing', points: 0 }
    ]
  },
  {
    name: 'Review outcome',
    max: 10,
    rows: [
      { label: 'Needs action', points: 10 },
      { label: 'Not found', points: 8 },
      { label: 'Needs review', points: 7 },
      { label: 'Possibly resolved', points: 2 },
      { label: 'Missing or conflicting', points: 0 }
    ]
  },
  {
    name: 'Issue age',
    max: 5,
    rows: [
      { label: '13+ weeks', points: 5 },
      { label: '8–12 weeks', points: 4 },
      { label: '4–7 weeks', points: 3 },
      { label: '2–3 weeks', points: 2 },
      { label: '0–1 week', points: 0 }
    ]
  }
]

const uncertaintyPoints = [
  { label: 'Missing SLA', points: 2 },
  { label: 'Missing CVSS', points: 1 },
  { label: 'Missing due date', points: 1 },
  { label: 'Missing/conflicting outcome', points: 1 }
]

const bugScoreCategories = [
  {
    name: 'Customer impact',
    max: 30,
    rows: [
      { label: 'Affecting customer (SFDC)', points: 30 },
      { label: 'BU/SSA/field feedback', points: 15 },
      { label: 'No matching signal', points: 0 }
    ]
  },
  {
    name: 'Delivery/security risk',
    max: 25,
    rows: [
      { label: 'Pre-release CVE', points: 25 },
      { label: 'Approved Release Blocker', points: 22 },
      { label: 'Snyk SCA', points: 20 },
      { label: 'Snyk SAST', points: 16 },
      { label: 'Generic Snyk', points: 14 },
      { label: 'Security/Conforma/TLS', points: 12 },
      { label: 'No matching signal', points: 0 }
    ]
  },
  {
    name: 'Detection source',
    max: 5,
    rows: [
      { label: 'Operator auto E2E blocker', points: 5 },
      { label: 'DevTestOps test failure', points: 4 },
      { label: 'Workflow validation', points: 3 },
      { label: 'CI/nightly/gate/human test', points: 2 },
      { label: 'No matching signal', points: 0 }
    ]
  },
  {
    name: 'Jira severity',
    max: 20,
    rows: [
      { label: 'Blocker / Highest', points: 20 },
      { label: 'Critical / High', points: 16 },
      { label: 'Major', points: 12 },
      { label: 'Medium / Normal', points: 8 },
      { label: 'Low / Minor', points: 4 },
      { label: 'Lowest', points: 2 },
      { label: 'Missing/unrecognized', points: 0 }
    ]
  },
  {
    name: 'Jira due date',
    max: 15,
    rows: [
      { label: 'Past due', points: 15 },
      { label: 'Due within 7 days', points: 13 },
      { label: 'Due in 8–30 days', points: 9 },
      { label: 'Due in 31–90 days', points: 5 },
      { label: 'Due after 90 days', points: 2 },
      { label: 'Missing', points: 0 }
    ]
  },
  {
    name: 'Issue age',
    max: 5,
    rows: [
      { label: '13+ weeks', points: 5 },
      { label: '8–12 weeks', points: 4 },
      { label: '4–7 weeks', points: 3 },
      { label: '2–3 weeks', points: 2 },
      { label: '0–1 week', points: 0 }
    ]
  }
]

const bugTypePrecedence = [
  'Affecting customer',
  'Pre-release CVE',
  'Approved Release Blocker',
  'BU/SSA/field feedback',
  'DevTestOps/E2E bug',
  'Workflow-validation bug',
  'Component-team/unclassified Bug'
]

const bugSourceRules = [
  { label: 'Affecting customer', evidence: 'SFDC Cases Counter > 0 from the parallel cohort-scoped Jira lookup.' },
  { label: 'Field feedback', evidence: 'AIBU_Feedback, AISSA_Feedback, or BU_EarlyAccess_Feedback label without SFDC.' },
  { label: 'Pre-release CVE', evidence: 'prerelease-cve-remediation label plus DevTestOps Jira Bot reporter.' },
  { label: 'Release blocker', evidence: 'Release Blocker custom field is Approved (option 16772).' },
  { label: 'Snyk', evidence: 'snyk label plus RHOAIENG AutomationBot reporter; dependency/vuln means SCA, code-analysis/CWE means SAST.' },
  { label: 'DevTestOps/E2E', evidence: 'test-failed plus DevTestOps Jira Bot, or odh-operator-auto-e2e-blocker plus RHOAIENG AutomationBot.' },
  { label: 'Workflow validation', evidence: 'Workflow Validation reporter.' },
  { label: 'Other detection', evidence: 'CI/nightly, release tooling, human test-failed, or human-filed gate:* labels.' }
]

const priorityBands = [
  { score: '85+', priority: 'P0 — Immediate', action: 'Begin within 1–2 business days' },
  { score: '70–84', priority: 'P1 — Urgent', action: 'Begin within 2–4 business days' },
  { score: '50–69', priority: 'P2 — Planned', action: 'Commit to the current or next sprint' },
  { score: '30–49', priority: 'P3 — Monitor', action: 'Review within 30 days' },
  { score: '0–29', priority: 'P4 — Backlog', action: 'Review monthly' }
]

function closeOnEscape(event) {
  if (event.key === 'Escape') emit('close')
}

onMounted(function () {
  document.addEventListener('keydown', closeOnEscape)
})

onBeforeUnmount(function () {
  document.removeEventListener('keydown', closeOnEscape)
})
</script>
