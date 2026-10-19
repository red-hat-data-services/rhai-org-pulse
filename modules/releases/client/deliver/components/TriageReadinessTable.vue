<template>
  <section data-testid="triage-readiness" class="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
      <div>
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100">Triage Readiness</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Proposed release blockers and the evidence required before exception triage.</p>
      </div>
      <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
        {{ readyCount }} of {{ issues.length }} ready
      </span>
    </div>

    <div v-if="issues.length" class="max-h-96 overflow-auto">
      <table class="w-full min-w-[1050px] text-sm">
        <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Jira Key</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Summary</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ready for Triage</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Assignee</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Release Blocker</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Is Regression</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fix Version</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="issue in issues" :key="issue.key" class="hover:bg-gray-50/80 dark:hover:bg-gray-700/40">
            <td class="whitespace-nowrap px-4 py-3">
              <a :href="issue.link" target="_blank" rel="noopener" class="font-mono text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">{{ issue.key }}</a>
            </td>
            <td class="max-w-sm px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
              <span class="line-clamp-2" :title="issue.summary">{{ issue.summary }}</span>
            </td>
            <td class="px-4 py-3">
              <div class="min-w-[280px]" :title="readinessTitle(issue)">
                <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="readinessFor(issue).ready ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'">
                  {{ readinessFor(issue).ready ? 'Ready' : 'Not Ready' }}
                </span>
                <ul class="mt-2 space-y-1.5" aria-label="Triage readiness criteria">
                  <li
                    v-for="criterion in criteriaFor(issue)"
                    :key="criterion.key"
                    :data-testid="'triage-criterion-' + criterion.key"
                    class="text-[11px] leading-4"
                    :class="criterion.complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'"
                  >
                    <div class="flex items-start gap-1.5">
                      <span aria-hidden="true" class="mt-px w-3 shrink-0 text-center font-bold">{{ criterion.complete ? '✓' : '✕' }}</span>
                      <span>
                        <span class="font-medium">{{ criterion.label }}</span>
                        <span v-if="criterion.detail" class="text-gray-500 dark:text-gray-400"> — {{ criterion.detail }}</span>
                      </span>
                    </div>
                    <ul v-if="criterion.key === 'assessmentCompleted'" class="ml-[18px] mt-1 space-y-0.5 border-l border-gray-200 pl-2 dark:border-gray-600">
                      <li v-for="question in criterion.questions" :key="question.key" class="flex items-start gap-1.5" :class="question.complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
                        <span aria-hidden="true" class="w-3 shrink-0 text-center font-bold">{{ question.complete ? '✓' : '✕' }}</span>
                        <span>{{ question.label }}</span>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>
            </td>
            <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{{ issue.assignee || '—' }}</td>
            <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{{ issue.status || '—' }}</td>
            <td class="px-4 py-3">
              <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{{ issue.releaseBlockerStatus }}</span>
            </td>
            <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{{ issue.isRegression || 'Unknown' }}</td>
            <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{{ (issue.fixVersions || []).join(', ') || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="px-5 py-12 text-center">
      <p class="text-sm text-gray-400 dark:text-gray-500">No Proposed release blockers match the selected page filters.</p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

var props = defineProps({
  issues: { type: Array, default: function () { return [] } }
})

var readinessCriteria = [
  { key: 'fixVersion', label: 'Fix Version assigned' },
  { key: 'linkedPullRequest', label: 'Active red-hat-data-services PR/MR linked' },
  { key: 'assessmentCompleted', label: 'All five assessment questions answered' },
  { key: 'pmAcknowledgement', label: 'PM acknowledgement (z-stream only)' }
]

var assessmentQuestions = [
  { key: 'workaround', label: 'Workaround' },
  { key: 'impact', label: 'Impact' },
  { key: 'earlyCatch', label: 'Early-catch' },
  { key: 'regression', label: 'Regression' },
  { key: 'reviewsAndTests', label: 'Reviews/tests' }
]

var unavailableReadiness = {
  ready: false,
  criteria: {
    fixVersion: false,
    linkedPullRequest: false,
    assessmentCompleted: false,
    pmAcknowledgement: false
  },
  missingCriteria: ['readiness evidence'],
  assessmentAnswers: {},
  activePullRequests: [],
  isZStream: false,
  pmAcknowledgementRequired: true
}

var readyCount = computed(function () {
  return props.issues.filter(function (issue) {
    return issue.triageReadiness && issue.triageReadiness.ready
  }).length
})

function readinessFor(issue) {
  return issue.triageReadiness || unavailableReadiness
}

function criterionComplete(readiness, key) {
  if (readiness.criteria && typeof readiness.criteria[key] === 'boolean') return readiness.criteria[key]
  return Boolean(readiness.ready)
}

function assessmentComplete(readiness, key) {
  if (readiness.assessmentAnswers && typeof readiness.assessmentAnswers[key] === 'boolean') {
    return readiness.assessmentAnswers[key]
  }
  return criterionComplete(readiness, 'assessmentCompleted')
}

function criteriaFor(issue) {
  var readiness = readinessFor(issue)
  return readinessCriteria.map(function (criterion) {
    var complete = criterionComplete(readiness, criterion.key)
    var detail = ''
    var questions = []

    if (criterion.key === 'fixVersion') {
      detail = complete ? ((issue.fixVersions || []).join(', ') || 'Assigned') : 'Missing'
    } else if (criterion.key === 'linkedPullRequest') {
      var pullRequestCount = (readiness.activePullRequests || []).length
      detail = complete ? pullRequestCount + ' active link' + (pullRequestCount === 1 ? '' : 's') : 'Missing'
    } else if (criterion.key === 'assessmentCompleted') {
      questions = assessmentQuestions.map(function (question) {
        return {
          key: question.key,
          label: question.label,
          complete: assessmentComplete(readiness, question.key)
        }
      })
      var answeredCount = questions.filter(function (question) { return question.complete }).length
      detail = answeredCount + ' of ' + questions.length + ' answered'
    } else if (criterion.key === 'pmAcknowledgement') {
      detail = readiness.pmAcknowledgementRequired === false
        ? 'Not required for this release'
        : (complete ? 'Acknowledged' : 'Missing')
    }

    return {
      key: criterion.key,
      label: criterion.label,
      complete: complete,
      detail: detail,
      questions: questions
    }
  })
}

function readinessTitle(issue) {
  var readiness = readinessFor(issue)
  if (readiness.ready) return 'All triage readiness criteria are satisfied.'
  return 'Missing: ' + ((readiness.missingCriteria || []).join(', ') || 'readiness evidence')
}
</script>
