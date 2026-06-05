<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  item: { type: Object, required: true },
  jiraHost: { type: String, default: null },
  hero: { type: Boolean, default: false },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['navigate'])

const componentsExpanded = ref(false)

const stageTooltip = computed(() => {
  const tooltips = {
    'needs-revision': 'Has needs-attention label but NOT rubric-pass — failed the quality rubric and could not be auto-fixed.',
    'passed-with-caveats': 'Has BOTH rubric-pass AND needs-attention labels — passed scoring but flagged for minor issues the automation could not resolve.',
    'ready-to-advance': 'Has rubric-pass or tech-reviewed label, no scope label yet — quality gate passed, ready to queue.',
    'queued-for-pipeline': 'Has quality label + scope label — waiting for the automated pipeline to create a strategy feature.',
    'not-assessed': 'No pipeline labels yet — waiting for the quality rubric to run.',
    'rejected': 'AI review recommended rejecting this feature.',
    'revise-required': 'AI review found issues with feasibility, testability, scope, or architecture.',
    'awaiting-signoff': 'AI review passed — waiting for human sign-off from a staff engineer or SME.',
    'signed-off': 'Reviewed and approved by a human engineer.'
  }
  return tooltips[props.item.state.id] || ''
})

const accentClass = computed(() => {
  const color = props.item.state.color
  return {
    red: 'border-l-red-500',
    amber: 'border-l-amber-500',
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    gray: 'border-l-gray-400'
  }[color] || 'border-l-gray-400'
})

const stageBadgeClass = computed(() => {
  const color = props.item.state.color
  return {
    red: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }[color] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
})

const truncatedSummary = computed(() => {
  const s = props.item.summary || ''
  if (props.hero) return s
  return s.length > 120 ? s.slice(0, 120) + '...' : s
})

const scoresSummary = computed(() => {
  const scores = props.item.scores
  if (!scores) return null
  if (props.item.type === 'rfe') {
    const dims = [
      { label: 'WHAT', key: 'what' },
      { label: 'WHY', key: 'why' },
      { label: 'HOW', key: 'how' },
      { label: 'TASK', key: 'task' },
      { label: 'SIZE', key: 'size' }
    ]
    const parts = dims
      .filter(d => scores[d.key] !== undefined)
      .map(d => ({ label: d.label, value: scores[d.key], color: scoreColor(scores[d.key]), pillClass: scorePillClass(scores[d.key]) }))
    if (parts.length === 0) return null
    const total = parts.reduce((sum, p) => sum + p.value, 0)
    const max = parts.length * 2
    return { parts, total, max, totalPillClass: scoreTotalPillClass(total, max) }
  }
  // Feature scores
  const dims = [
    { label: 'Feasibility', key: 'feasibility' },
    { label: 'Testability', key: 'testability' },
    { label: 'Scope', key: 'scope' },
    { label: 'Architecture', key: 'architecture' }
  ]
  const parts = dims
    .filter(d => scores[d.key] !== undefined)
    .map(d => ({ label: d.label, value: scores[d.key], color: scoreColor(scores[d.key]), pillClass: scorePillClass(scores[d.key]) }))
  if (parts.length === 0) return null
  const total = scores.total ?? parts.reduce((s, p) => s + p.value, 0)
  const max = parts.length * 2
  return { parts, total, max, totalPillClass: scoreTotalPillClass(total, max) }
})

function scoreColor(val) {
  if (val === 0) return 'text-red-600 dark:text-red-400'
  if (val === 1) return 'text-amber-600 dark:text-amber-400'
  return 'text-green-600 dark:text-green-400'
}

function scoreTotalPillClass(total, max) {
  const pct = total / max
  if (pct < 0.5) return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
  if (pct < 0.8) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
}

function scorePillClass(val) {
  if (val === 0) return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
  if (val === 1) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
}

const actionGuidance = computed(() => {
  const s = props.item.state.id
  const guideBase = '#/ai-impact/ai-factory-guide?from=state-of-the-union&section='
  if (props.item.type === 'rfe') {
    switch (s) {
      case 'needs-revision': return {
        text: 'This RFE failed the quality rubric and couldn\'t be auto-fixed. Open it in Jira, check the AI comments for what\'s wrong, and revise the description to clearly state the WHAT and WHY.',
        linkUrl: `${guideBase}rfe-review`,
        linkLabel: 'RFE Review guide'
      }
      case 'passed-with-caveats': return {
        text: 'This RFE passed scoring but was flagged for attention — usually minor issues the automation couldn\'t resolve. Check the Jira comments for specifics and address them.',
        linkUrl: `${guideBase}rfe-review`,
        linkLabel: 'RFE Review guide'
      }
      case 'ready-to-advance': return {
        text: 'This RFE passed quality checks and is ready for feature creation. Add the scope label in Jira to queue it for the strategy creation pipeline.',
        linkUrl: `${guideBase}rfe-review`,
        linkLabel: 'RFE Review guide'
      }
      case 'queued-for-pipeline': return {
        text: 'This RFE is queued and waiting for the automated pipeline to create a strategy feature from it. No action needed — the pipeline runs on a schedule.',
        linkUrl: `${guideBase}feature-review`,
        linkLabel: 'Feature Review guide'
      }
      default: return {
        text: 'This RFE hasn\'t been assessed yet. The pipeline will pick it up on its next run and score it against the quality rubric.',
        linkUrl: `${guideBase}rfe-review`,
        linkLabel: 'RFE Review guide'
      }
    }
  }
  switch (s) {
    case 'rejected': return {
      text: 'The AI review recommended rejecting this feature. Open it in Jira and check the review comments — decide whether to revise the underlying RFE or close it.',
      linkUrl: `${guideBase}feature-review`,
      linkLabel: 'Feature Review guide'
    }
    case 'revise-required': return {
      text: 'The AI review found issues with this feature\'s feasibility, testability, scope, or architecture. Check the scoring breakdown and revise the strategy in Jira.',
      linkUrl: `${guideBase}feature-review`,
      linkLabel: 'Feature Review guide'
    }
    case 'awaiting-signoff': return {
      text: 'This feature passed AI scoring and is ready for human sign-off. A staff engineer, architect, or SME should review and approve it in Jira.',
      linkUrl: `${guideBase}feature-review`,
      linkLabel: 'Feature Review guide'
    }
    case 'signed-off': return {
      text: 'This feature has been reviewed and approved. It\'s ready to move into implementation.',
      linkUrl: `${guideBase}implementation`,
      linkLabel: 'Implementation guide'
    }
    default: return {
      text: 'This feature is awaiting classification by the review pipeline.',
      linkUrl: `${guideBase}feature-review`,
      linkLabel: 'Feature Review guide'
    }
  }
})

const waitBadgeClass = computed(() => {
  const d = props.item.waitDays
  if (d >= 14) return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
  if (d >= 7) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
})

function handleNavigate() {
  emit('navigate', props.item)
}

const jiraUrl = computed(() => {
  if (!props.jiraHost) return null
  return `${props.jiraHost}/browse/${props.item.key}`
})

const visibleComponents = computed(() => {
  const comps = props.item.components || []
  if (comps.length <= 3 || componentsExpanded.value) return comps
  return comps.slice(0, 2)
})

const hiddenComponentCount = computed(() => {
  const comps = props.item.components || []
  if (comps.length <= 3 || componentsExpanded.value) return 0
  return comps.length - 2
})
</script>

<template>
  <div
    class="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-l-4 transition-colors"
    :class="accentClass"
  >
    <div class="p-4">
      <!-- Top row: identity left, metadata right -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <button
            @click="handleNavigate"
            class="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
          >{{ item.key }}</button>
          <a
            v-if="jiraUrl"
            :href="jiraUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            title="Open in Jira"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <span class="text-xs uppercase font-medium text-gray-400 dark:text-gray-500">{{ item.type }}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <div class="relative group">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-help"
              :class="stageBadgeClass"
            >
              {{ item.state.label }}
              <svg class="h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div v-if="stageTooltip" class="absolute top-full right-0 pt-1 z-20 hidden group-hover:block w-64">
              <div class="p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                <p>{{ stageTooltip }}</p>
              </div>
            </div>
          </div>
          <span
            v-if="item.priority && item.priority !== 'None' && item.priority !== 'Undefined'"
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          >{{ item.priority }}</span>
          <span
            v-if="item.waitDays > 0"
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="waitBadgeClass"
          >{{ item.waitDays }}d</span>
        </div>
      </div>

      <!-- Summary -->
      <p class="text-sm font-medium text-gray-800 dark:text-gray-200 mt-2">{{ truncatedSummary }}</p>

      <!-- Scores (hidden in compact mode) -->
      <div v-if="scoresSummary && !compact" class="mt-3 flex items-center gap-1.5 flex-wrap">
        <span
          v-for="part in scoresSummary.parts"
          :key="part.label"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          :class="part.pillClass"
        ><span class="opacity-75">{{ part.label }}</span> <span class="font-bold">{{ part.value }}</span></span>
        <span
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          :class="scoresSummary.totalPillClass"
        ><span class="opacity-75">Total</span> <span class="font-bold">{{ scoresSummary.total }}/{{ scoresSummary.max }}</span></span>
      </div>

      <!-- Components (collapsed, hidden in compact mode) -->
      <div v-if="item.components && item.components.length > 0 && !compact" class="mt-3 flex items-center gap-1.5 flex-wrap">
        <span
          v-for="comp in visibleComponents"
          :key="comp"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
        >{{ comp }}</span>
        <button
          v-if="hiddenComponentCount > 0"
          @click="componentsExpanded = true"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
        >+{{ hiddenComponentCount }} more</button>
      </div>

      <!-- Guidance (hidden in compact mode) -->
      <div v-if="!compact" class="mt-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2">
        <p class="text-sm text-green-700 dark:text-green-300">
          {{ actionGuidance.text }}
          <a
            v-if="actionGuidance.linkUrl"
            :href="actionGuidance.linkUrl"
            class="inline-flex items-center gap-0.5 font-medium text-green-600 dark:text-green-400 hover:underline ml-1"
          >{{ actionGuidance.linkLabel }}
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </a>
        </p>
      </div>
    </div>
  </div>
</template>
