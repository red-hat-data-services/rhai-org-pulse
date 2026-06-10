<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import HygieneViolations from './HygieneViolations.vue'

const props = defineProps({
  feature: { type: Object, default: null },
  jiraBaseUrl: { type: String, default: 'https://issues.redhat.com/browse' }
})

const emit = defineEmits(['close'])

const open = computed(() => props.feature !== null)

const isHealthPipeline = computed(() => props.feature?.dataSource === 'health-pipeline')

const RUBRIC_DIMS = ['feasibility', 'testability', 'scope', 'architecture']

function reviewStatusClass(status) {
  switch (status) {
    case 'approved':        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'needs-review':    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'awaiting-review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
    default:                return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

function reviewStatusLabel(status) {
  switch (status) {
    case 'approved':        return 'Approved'
    case 'needs-review':    return 'Flagged'
    case 'awaiting-review': return 'Awaiting Sign-off'
    default:                return 'Awaiting Sign-off'
  }
}

function recommendationClass(rec) {
  switch (rec) {
    case 'approve': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'revise':  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'reject':  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    default:        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

function recommendationLabel(rec) {
  switch (rec) {
    case 'approve': return 'Approve'
    case 'revise':  return 'Needs Revision'
    case 'reject':  return 'Reject'
    default:        return rec || '—'
  }
}

function verdictClass(verdict) {
  switch (verdict) {
    case 'approve': return 'text-green-700 dark:text-green-400'
    case 'revise':  return 'text-amber-600 dark:text-amber-400'
    case 'reject':  return 'text-red-600 dark:text-red-400'
    default:        return 'text-gray-400 dark:text-gray-500'
  }
}

function verdictLabel(verdict) {
  switch (verdict) {
    case 'approve': return 'Approve'
    case 'revise':  return 'Revise'
    case 'reject':  return 'Reject'
    default:        return '—'
  }
}

function scoreFillClass(score) {
  if (score === 0) return 'bg-red-400 dark:bg-red-500'
  if (score === 1) return 'bg-amber-400 dark:bg-amber-500'
  return 'bg-green-400 dark:bg-green-500'
}

function blockingLabel(dim) {
  const name = dim.dimension
    ? dim.dimension.charAt(0).toUpperCase() + dim.dimension.slice(1)
    : '?'
  const score = dim.score != null ? dim.score : '?'
  return `${name} (${score}/2) — ${dim.verdict === 'reject' ? 'critical revision' : 'needs revision'}`
}

function relativeDate(dateStr) {
  if (!dateStr) return '—'
  const then = new Date(dateStr)
  if (isNaN(then.getTime())) return dateStr
  const days = Math.floor((Date.now() - then.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

function initials(name) {
  return (name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

const confidenceClass = computed(() => {
  switch (props.feature?.confidence) {
    case 'committed': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'ready':     return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
    case 'not-ready': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    default:          return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
})

const confidenceLabel = computed(() => {
  switch (props.feature?.confidence) {
    case 'committed': return 'Ready'
    case 'ready':     return 'Ready'
    case 'not-ready': return 'Not Ready'
    default:          return '—'
  }
})

const confidenceTooltip = computed(() => {
  switch (props.feature?.confidence) {
    case 'committed': return 'Committed — fix version assigned to a release'
    case 'ready':     return 'Ready — passes readiness gates, not yet committed'
    case 'not-ready': return 'Not Ready — does not pass readiness gates'
    default:          return ''
  }
})

const rubricTotal = computed(() => {
  if (!props.feature) return 0
  const s = props.feature.scores || {}
  return (s.feasibility || 0) + (s.testability || 0) + (s.scope || 0) + (s.architecture || 0)
})

const priorityDisplay = computed(() => {
  if (!props.feature) return '—'
  const score = props.feature.effectivePriorityScore
  if (score == null) return '—'
  return props.feature.priorityScoreFallback ? `~${score}` : String(score)
})

const hasBlockers = computed(() =>
  props.feature &&
  ((props.feature.blockingDimensions && props.feature.blockingDimensions.length > 0) ||
    !!props.feature.actionRequired)
)

const readinessGates = computed(() => props.feature?.readinessGates || null)

const violationsList = computed(() => props.feature?.violations || [])
const violationCount = computed(() => violationsList.value.length)

const hygieneExpanded = ref(true)
const breakdownExpanded = ref(false)

const scoreBreakdown = computed(() => {
  const bd = props.feature?.priorityScoreBreakdown
  if (!bd || !bd.signals) return null
  return bd
})

function onKey(e) {
  if (e.key === 'Escape' && open.value) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fr-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-30 bg-black/20 dark:bg-black/50"
        aria-hidden="true"
        @click="emit('close')"
      />
    </Transition>

    <!-- Drawer -->
    <Transition name="fr-slide">
      <aside
        v-if="open && feature"
        role="complementary"
        aria-label="Feature detail"
        class="fixed top-0 right-0 z-40 h-full w-[440px] flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl"
      >
        <!-- Header -->
        <div class="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 shrink-0">
          <div class="flex items-start gap-2">
            <a
              :href="`${jiraBaseUrl}/${feature.key}`"
              target="_blank"
              rel="noopener noreferrer"
              class="font-mono text-xs font-bold text-primary-600 dark:text-blue-400 hover:underline shrink-0 mt-0.5"
              @click.stop
            >{{ feature.key }}</a>
            <p class="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {{ feature.title || '—' }}
            </p>
            <button
              type="button"
              class="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Close detail panel"
              @click="emit('close')"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex flex-wrap gap-1.5 mt-2.5">
            <!-- Confidence badge (all features) -->
            <span
              v-if="feature.confidence"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
              :class="confidenceClass"
              :title="confidenceTooltip"
            >{{ confidenceLabel }}</span>

            <!-- Health pipeline badges -->
            <template v-if="isHealthPipeline">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Health Pipeline
              </span>
            </template>

            <!-- Strat-creator badges -->
            <template v-else>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" :class="reviewStatusClass(feature.humanReviewStatus)">
                {{ reviewStatusLabel(feature.humanReviewStatus) }}
              </span>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" :class="recommendationClass(feature.recommendation)">
                {{ recommendationLabel(feature.recommendation) }}
              </span>
            </template>

            <span
              v-if="feature.needsAttention"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
            >
              <span aria-hidden="true">⚠</span> Needs Attention
            </span>
          </div>
        </div>

        <!-- Scrollable body -->
        <div class="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">

          <!-- Priority Score -->
          <section class="px-4 py-4">
            <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Priority Score</p>
            <div class="flex items-center gap-3">
              <span
                class="text-3xl font-extrabold leading-none tabular-nums"
                :class="feature.priorityScoreFallback ? 'text-amber-500 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'"
              >{{ priorityDisplay }}</span>
              <div class="flex-1">
                <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all"
                    :style="{ width: (feature.effectivePriorityScore || 0) + '%' }"
                  />
                </div>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  {{ feature.priorityScoreFallback
                    ? 'Estimated — no pipeline score yet (tier + priority)'
                    : 'From prioritization pipeline' }}
                </p>
              </div>
            </div>
          </section>

          <!-- Score Breakdown -->
          <section v-if="scoreBreakdown" class="px-4 py-4">
            <button
              type="button"
              class="w-full flex items-center justify-between text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              @click="breakdownExpanded = !breakdownExpanded"
            >
              <span class="flex items-center gap-2">
                Score Breakdown
                <span
                  v-if="scoreBreakdown.completenessMultiplier < 1"
                  class="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                >{{ scoreBreakdown.signalCount }}/{{ scoreBreakdown.maxSignals }} signals</span>
              </span>
              <svg
                class="w-3.5 h-3.5 transition-transform"
                :class="breakdownExpanded ? 'rotate-180' : ''"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-if="breakdownExpanded" class="space-y-3">
              <div v-for="signal in scoreBreakdown.signals" :key="signal.name" class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-700 dark:text-gray-300">{{ signal.name }}</span>
                  <span class="text-gray-400 dark:text-gray-500 tabular-nums">{{ Math.round(signal.value * 100) }}% &times; {{ signal.weight }}w</span>
                </div>
                <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all"
                    :style="{ width: Math.round(signal.value * 100) + '%' }"
                  />
                </div>
              </div>
              <div v-if="scoreBreakdown.completenessMultiplier < 1" class="pt-2 border-t border-gray-100 dark:border-gray-800">
                <p class="text-xs text-amber-600 dark:text-amber-400">
                  Raw score {{ scoreBreakdown.rawScore }} &times; {{ scoreBreakdown.completenessMultiplier }} completeness
                  = {{ scoreBreakdown.score }}
                </p>
              </div>
              <div v-if="scoreBreakdown.missing && scoreBreakdown.missing.length > 0" class="text-xs text-gray-400 dark:text-gray-500">
                Missing: {{ scoreBreakdown.missing.join(', ') }}
              </div>
            </div>
          </section>

          <!-- Readiness Gates -->
          <section v-if="readinessGates" class="px-4 py-4">
            <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Readiness Gates</p>
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-xs">
                <span :class="readinessGates.ownerAssigned ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'">
                  {{ readinessGates.ownerAssigned ? '●' : '○' }}
                </span>
                <span class="text-gray-700 dark:text-gray-300">Owner assigned</span>
                <span v-if="feature.deliveryOwner" class="text-gray-400 dark:text-gray-500 ml-auto">{{ feature.deliveryOwner }}</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span :class="readinessGates.notBlocked ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'">
                  {{ readinessGates.notBlocked ? '●' : '○' }}
                </span>
                <span class="text-gray-700 dark:text-gray-300">No blockers</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span :class="readinessGates.pastRefinement ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'">
                  {{ readinessGates.pastRefinement ? '●' : '○' }}
                </span>
                <span class="text-gray-700 dark:text-gray-300">Status beyond Refinement</span>
                <span v-if="feature.status" class="text-gray-400 dark:text-gray-500 ml-auto">{{ feature.status }}</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span :class="readinessGates.hasTargetVersion ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'">
                  {{ readinessGates.hasTargetVersion ? '●' : '○' }}
                </span>
                <span class="text-gray-700 dark:text-gray-300">Target version assigned</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span :class="readinessGates.noBlockingViolations ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'">
                  {{ readinessGates.noBlockingViolations ? '●' : '○' }}
                </span>
                <span class="text-gray-700 dark:text-gray-300">No blocking hygiene violations</span>
              </div>
            </div>
          </section>

          <!-- Hygiene Violations -->
          <section class="px-4 py-4">
            <button
              type="button"
              class="w-full flex items-center justify-between text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              @click="hygieneExpanded = !hygieneExpanded"
            >
              <span class="flex items-center gap-2">
                Hygiene
                <span
                  v-if="violationCount > 0"
                  class="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                >{{ violationCount }}</span>
                <span
                  v-else
                  class="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                >All clear</span>
              </span>
              <svg
                class="w-3.5 h-3.5 transition-transform"
                :class="hygieneExpanded ? 'rotate-180' : ''"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-if="hygieneExpanded">
              <HygieneViolations :violations="violationsList" />
            </div>
          </section>

          <!-- Rubric (strat-creator features only) -->
          <section v-if="!isHealthPipeline" class="px-4 py-4">
            <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
              Rubric — {{ rubricTotal }} / 8
            </p>
            <div class="space-y-2.5">
              <div v-for="dim in RUBRIC_DIMS" :key="dim" class="flex items-center gap-2">
                <span class="w-24 text-xs text-gray-500 dark:text-gray-400 capitalize shrink-0">{{ dim }}</span>
                <div class="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="scoreFillClass(feature.scores?.[dim] ?? 0)"
                    :style="{ width: ((feature.scores?.[dim] ?? 0) / 2 * 100) + '%' }"
                  />
                </div>
                <span class="text-xs font-semibold w-8 text-right shrink-0" :class="verdictClass(feature.reviewers?.[dim])">
                  {{ feature.scores?.[dim] ?? 0 }}/2
                </span>
                <span class="text-xs w-14 shrink-0" :class="verdictClass(feature.reviewers?.[dim])">
                  {{ verdictLabel(feature.reviewers?.[dim]) }}
                </span>
              </div>
            </div>
          </section>

          <!-- Blocking / What needs to change (strat-creator features only) -->
          <section v-if="hasBlockers" class="px-4 py-4">
            <p class="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-3">
              What needs to change
            </p>
            <ul class="space-y-1.5 mb-3">
              <li
                v-for="dim in (feature.blockingDimensions || [])"
                :key="dim.dimension"
                class="flex items-start gap-2 text-xs"
                :class="dim.verdict === 'reject' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'"
              >
                <span class="mt-0.5 shrink-0" aria-hidden="true">●</span>
                <span>{{ blockingLabel(dim) }}</span>
              </li>
            </ul>
            <div
              v-if="feature.actionRequired"
              class="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300 leading-relaxed"
            >
              {{ feature.actionRequired }}
            </div>
          </section>

          <!-- Approved by (strat-creator features only) -->
          <section v-if="feature.approvedBy" class="px-4 py-4">
            <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Approved</p>
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 border border-primary-200 dark:border-primary-700 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300 shrink-0">
                {{ initials(feature.approvedBy) }}
              </div>
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ feature.approvedBy }}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500">{{ relativeDate(feature.approvedAt) }}</span>
            </div>
          </section>

          <!-- Metadata -->
          <section class="px-4 py-4">
            <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Details</p>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">

              <template v-if="feature.sourceRfe">
                <dt class="text-gray-400 dark:text-gray-500 self-start">Source RFE</dt>
                <dd>
                  <a
                    :href="`${jiraBaseUrl}/${feature.sourceRfe}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono font-semibold text-primary-600 dark:text-blue-400 hover:underline"
                    @click.stop
                  >{{ feature.sourceRfe }}</a>
                </dd>
              </template>

              <dt class="text-gray-400 dark:text-gray-500">Outcome</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.bigRock || '—' }}</dd>

              <dt class="text-gray-400 dark:text-gray-500 self-start">Target Version</dt>
              <dd>
                <div v-if="(feature.targetVersions || []).length">
                  <p v-if="(feature.targetVersions || []).length > 1" class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mb-1">
                    <span aria-hidden="true">⚠</span> Multiple target versions — Jira hygiene issue
                  </p>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="tv in feature.targetVersions"
                      :key="tv"
                      class="font-mono text-xs"
                      :class="(feature.targetVersions || []).length > 1 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'"
                    >{{ tv }}</span>
                  </div>
                </div>
                <span v-else class="font-mono text-gray-400 dark:text-gray-600">—</span>
              </dd>

              <dt class="text-gray-400 dark:text-gray-500">Fix Version</dt>
              <dd class="font-mono text-gray-700 dark:text-gray-300">{{ feature.fixVersion || '—' }}</dd>

              <dt class="text-gray-400 dark:text-gray-500 self-start">Components</dt>
              <dd>
                <div v-if="(feature.components || []).length" class="flex flex-wrap gap-1">
                  <span
                    v-for="comp in feature.components"
                    :key="comp"
                    class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                  >{{ comp }}</span>
                </div>
                <span v-else class="text-gray-400 dark:text-gray-600">—</span>
              </dd>

              <dt class="text-gray-400 dark:text-gray-500">Team</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.team || '—' }}</dd>

              <template v-if="feature.deliveryOwner">
                <dt class="text-gray-400 dark:text-gray-500">Delivery Owner</dt>
                <dd class="text-gray-700 dark:text-gray-300">{{ feature.deliveryOwner }}</dd>
              </template>

              <dt class="text-gray-400 dark:text-gray-500">Priority</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.priority || '—' }}</dd>

              <dt class="text-gray-400 dark:text-gray-500">T-shirt Size</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.size || '—' }}</dd>

              <template v-if="feature.riceScore != null">
                <dt class="text-gray-400 dark:text-gray-500">RICE Score</dt>
                <dd class="font-mono text-gray-700 dark:text-gray-300">{{ feature.riceScore }}</dd>
              </template>

              <dt class="text-gray-400 dark:text-gray-500">Jira Status</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.status || '—' }}</dd>

              <dt class="text-gray-400 dark:text-gray-500">Data Source</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ isHealthPipeline ? 'Health Pipeline' : 'Strategy Creator' }}</dd>

            </dl>
          </section>

        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fr-fade-enter-active,
.fr-fade-leave-active { transition: opacity 0.22s ease; }
.fr-fade-enter-from,
.fr-fade-leave-to { opacity: 0; }

.fr-slide-enter-active,
.fr-slide-leave-active { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.fr-slide-enter-from,
.fr-slide-leave-to { transform: translateX(100%); }
</style>
