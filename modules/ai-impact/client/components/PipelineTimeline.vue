<script setup>
const props = defineProps({
  rfe: { type: Object, default: null },
  feature: { type: Object, default: null },
  testPlan: { type: Object, default: null },
  phases: { type: Array, required: true },
  jiraHost: { type: String, default: null }
})

const emit = defineEmits(['navigateToRFE', 'navigateToFeature', 'navigateToTestPlan'])

function getPhaseSignal(phaseId) {
  if (props.testPlan && !props.rfe && !props.feature) {
    return getTestPlanContextSignal(phaseId)
  }
  if (phaseId === 'test-plan-review' && props.testPlan) {
    return getTestPlanPhaseSignal()
  }
  if (props.feature) return getFeaturePhaseSignal(phaseId)
  if (props.rfe) return getRFEPhaseSignal(phaseId)
  return { completed: false, aiUsed: null, detail: 'No signals yet' }
}

function getTestPlanPhaseSignal() {
  const tp = props.testPlan
  const aiUsed = (tp.labels || []).some(l => l === 'test-plan-auto-created')
  const approved = tp.humanReviewStatus === 'approved'
  return {
    completed: approved,
    current: !approved && tp.verdict !== undefined,
    aiUsed,
    detail: `${tp.verdict} — ${tp.score}/10`,
    linkedKey: tp.sourceKey || tp.key
  }
}

function getTestPlanContextSignal(phaseId) {
  const tp = props.testPlan
  switch (phaseId) {
    case 'rfe-review':
      return {
        completed: true,
        current: false,
        aiUsed: true,
        detail: 'RFE reviewed'
      }
    case 'feature-review':
      return {
        completed: true,
        current: false,
        aiUsed: true,
        detail: tp.sourceKey,
        linkedKey: tp.sourceKey
      }
    case 'test-plan-review':
      return getTestPlanPhaseSignal()
    default:
      return { completed: false, current: false, aiUsed: null, detail: 'No signals yet' }
  }
}

function getRFEPhaseSignal(phaseId) {
  const rfe = props.rfe
  switch (phaseId) {
    case 'rfe-review':
      return {
        completed: false,
        current: true,
        aiUsed: rfe.aiInvolvement !== 'none',
        detail: rfe.aiInvolvement !== 'none'
          ? `AI ${rfe.aiInvolvement === 'both' ? 'created & revised' : rfe.aiInvolvement}`
          : 'No AI involvement'
      }
    case 'feature-review':
      if (rfe.linkedFeature) {
        return {
          completed: false,
          current: false,
          aiUsed: null,
          detail: `${rfe.linkedFeature.key} - ${rfe.linkedFeature.status}`,
          linkedKey: rfe.linkedFeature.key,
          fixVersions: rfe.linkedFeature.fixVersions
        }
      }
      return { completed: false, current: false, aiUsed: null, detail: 'No linked feature' }
    case 'test-plan-review':
      if (props.testPlan) {
        return getTestPlanPhaseSignal()
      }
      return { completed: false, current: false, aiUsed: null, detail: 'No signals yet' }
    case 'build-release':
      if (rfe.linkedFeature?.fixVersions?.length > 0) {
        return {
          completed: false,
          current: false,
          aiUsed: null,
          detail: `Target: ${rfe.linkedFeature.fixVersions.join(', ')}`
        }
      }
      return { completed: false, current: false, aiUsed: null, detail: 'No signals yet' }
    default:
      return { completed: false, current: false, aiUsed: null, detail: 'No signals yet' }
  }
}

function getFeaturePhaseSignal(phaseId) {
  const feature = props.feature
  switch (phaseId) {
    case 'rfe-review':
      return {
        completed: true,
        current: false,
        aiUsed: true,
        detail: feature.sourceRfe,
        linkedKey: feature.sourceRfe,
        isSourceRfe: true
      }
    case 'feature-review': {
      const aiLabels = (feature.labels || []).filter(l => l.startsWith('strat-creator-'))
      const aiUsed = aiLabels.some(l => l === 'strat-creator-auto-created' || l === 'strat-creator-auto-refined')
      return {
        completed: false,
        current: true,
        aiUsed,
        detail: `${feature.recommendation} — ${feature.scores?.total || 0}/8`
      }
    }
    default:
      return { completed: false, current: false, aiUsed: null, detail: 'No signals yet' }
  }
}
</script>

<template>
  <div>
    <h5 class="text-sm font-medium mb-3 dark:text-gray-200">Pipeline Progress</h5>
    <div class="relative">
      <!-- Timeline line -->
      <div class="absolute left-4 top-6 bottom-6 w-px bg-gray-200 dark:bg-gray-700" />

      <div class="space-y-4">
        <div
          v-for="phase in phases"
          :key="phase.id"
          class="flex items-start gap-4 relative"
        >
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center z-10"
            :class="{
              'bg-green-500 text-white': getPhaseSignal(phase.id).completed,
              'bg-blue-500 text-white': getPhaseSignal(phase.id).current && !getPhaseSignal(phase.id).completed,
              'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600': !getPhaseSignal(phase.id).completed && !getPhaseSignal(phase.id).current
            }"
          >
            <!-- Checkmark for completed -->
            <svg v-if="getPhaseSignal(phase.id).completed" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Circle for current phase -->
            <svg v-else-if="getPhaseSignal(phase.id).current" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke-width="2" />
            </svg>
            <!-- Lock for coming-soon -->
            <svg v-else-if="phase.status === 'coming-soon'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <!-- Dot for future phases -->
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" stroke-width="2" />
            </svg>
          </div>

          <div class="flex-1 pt-1">
            <div class="flex items-center gap-2">
              <span
                class="text-sm font-medium dark:text-gray-200"
                :class="{ 'text-gray-300 dark:text-gray-600': phase.status === 'coming-soon' && phase.id !== 'build-release' }"
              >
                {{ phase.name }}
              </span>
              <svg
                v-if="getPhaseSignal(phase.id).aiUsed"
                class="h-3 w-3 text-blue-500 dark:text-blue-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>

            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <!-- Source RFE link (feature context) -->
              <template v-if="getPhaseSignal(phase.id).isSourceRfe && getPhaseSignal(phase.id).linkedKey">
                <button
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  @click="emit('navigateToRFE', getPhaseSignal(phase.id).linkedKey)"
                >
                  {{ getPhaseSignal(phase.id).linkedKey }}
                </button>
                <a
                  v-if="jiraHost"
                  :href="`${jiraHost}/browse/${getPhaseSignal(phase.id).linkedKey}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  title="View in Jira"
                >
                  <svg class="inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </template>
              <!-- Linked feature link (RFE context) -->
              <template v-else-if="phase.id === 'feature-review' && getPhaseSignal(phase.id).linkedKey">
                <button
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  @click="emit('navigateToFeature', getPhaseSignal(phase.id).linkedKey)"
                >
                  {{ getPhaseSignal(phase.id).linkedKey }}
                </button>
                <a
                  v-if="jiraHost"
                  :href="`${jiraHost}/browse/${getPhaseSignal(phase.id).linkedKey}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  title="View in Jira"
                >
                  <svg class="inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                - {{ getPhaseSignal(phase.id).detail.split(' - ')[1] }}
                <span v-if="getPhaseSignal(phase.id).fixVersions?.length > 0" class="ml-1">
                  ({{ getPhaseSignal(phase.id).fixVersions.join(', ') }})
                </span>
              </template>
              <!-- Test plan link (test-plan-review phase) -->
              <template v-else-if="phase.id === 'test-plan-review' && getPhaseSignal(phase.id).linkedKey && testPlan">
                <button
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  @click="emit('navigateToTestPlan', getPhaseSignal(phase.id).linkedKey)"
                >
                  {{ getPhaseSignal(phase.id).detail }}
                </button>
                <a
                  v-if="testPlan.gitlabPath"
                  :href="`https://gitlab.com/redhat/rhel-ai/agentic-ci/test-plans-data/-/tree/main/${testPlan.gitlabPath}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  title="View test plan in GitLab"
                >
                  <svg class="inline h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
                  </svg>
                </a>
              </template>
              <template v-else-if="phase.status === 'coming-soon' && phase.id !== 'feature-review' && phase.id !== 'build-release'">
                <span class="text-gray-300 dark:text-gray-600">No signals yet</span>
              </template>
              <template v-else>
                {{ getPhaseSignal(phase.id).detail }}
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
