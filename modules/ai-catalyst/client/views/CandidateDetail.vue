<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useCategories } from '../composables/useCategories.js'
import CategoryBadge from '../components/CategoryBadge.vue'
import ScoreGauge from '../components/ScoreGauge.vue'
import ScoreBreakdown from '../components/ScoreBreakdown.vue'

const nav = inject('moduleNav')
const MODULE_API = '/modules/ai-catalyst'

const { getDecisionStatus, getDecisionMeta, getSourceLabel } = useCategories()

const candidate = ref(null)
const loading = ref(true)
const error = ref(null)

const candidateId = computed(() => nav.params.value.id)

async function load() {
  if (!candidateId.value) return
  loading.value = true
  error.value = null
  try {
    candidate.value = await apiRequest(`${MODULE_API}/candidates/${encodeURIComponent(candidateId.value)}`)
  } catch (err) {
    error.value = err.message || 'Failed to load candidate'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const decisionStatus = computed(() => candidate.value ? getDecisionStatus(candidate.value) : 'pending')
const decisionMeta = computed(() => getDecisionMeta(decisionStatus.value))

const starsDisplay = computed(() => {
  const s = candidate.value?.stars
  if (s == null) return '—'
  return s >= 1000 ? (s / 1000).toFixed(1) + 'K' : String(s)
})

const sourceLinkLabel = computed(() => {
  const src = candidate.value?.source
  if (src === 'reddit') return 'Reddit Post'
  if (src === 'hn' || src === 'hackernews') return 'Hacker News Post'
  return 'Repository'
})

const isRepoProject = computed(() => {
  const src = candidate.value?.source
  return src === 'github'
})

function hasValue(val) {
  const text = String(val ?? '').trim()
  return text !== '' && !/^(none|n\/a|null|-)$/i.test(text)
}

function isHttpUrl(val) {
  return /^https?:\/\//i.test(String(val || '').trim())
}

function reviewMeta(decision) {
  return getDecisionMeta(getDecisionStatus({ pmDecision: decision }))
}

const resourceLinks = computed(() => {
  if (!candidate.value) return []
  const links = []
  // The feed puts run outcomes and local paths in these columns; only real
  // http(s) URLs become anchors, the rest render as text.
  const add = (label, val) => {
    if (!hasValue(val)) return
    const text = String(val).trim()
    links.push({ label, value: text, url: isHttpUrl(text) ? text : null })
  }
  add(sourceLinkLabel.value, candidate.value.link)
  add('POC Repo', candidate.value.pocRepo)
  add('POC Image', candidate.value.pocImage)
  add('POC Report', candidate.value.pocReport)
  add('Blog Post', candidate.value.pocBlog)
  return links
})

function goBack() {
  nav.goBack()
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <!-- Back button -->
    <button
      class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      @click="goBack"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Back to Board
    </button>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-64"></div>
      <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-96"></div>
      <div class="h-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <template v-else-if="candidate">
      <!-- Header -->
      <div>
        <div class="flex items-start gap-3">
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ candidate.title }}</h1>
            <div class="flex items-center gap-2 mt-2 flex-wrap">
              <CategoryBadge :category="candidate.category" :pillar="candidate.pillar" />
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ getSourceLabel(candidate.source) }}</span>
              <span v-if="candidate.itemType === 'trend'" class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">trend</span>
              <span v-if="candidate.classification" class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{{ candidate.classification }}</span>
              <span :class="['text-xs px-1.5 py-0.5 rounded', decisionMeta.bgClass, decisionMeta.textClass]">{{ decisionMeta.label }}</span>
            </div>
          </div>
          <a
            v-if="isHttpUrl(candidate.link)"
            :href="candidate.link"
            target="_blank"
            rel="noopener"
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
          >
            {{ isRepoProject ? 'View repo' : 'View source' }} &rarr;
          </a>
        </div>
      </div>

      <!-- Scores overview -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex items-center gap-6 mb-4">
          <ScoreGauge :score="candidate.impactScore" label="Impact" />
          <ScoreGauge
            :score="candidate.boardFeasibilityScore ?? candidate.feasibilityScore"
            label="Feasibility"
            :estimated="candidate.boardFeasibilityEstimated"
          />
          <div class="flex-1"></div>
          <div class="text-right space-y-1">
            <div class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
              {{ starsDisplay }}
            </div>
            <div
              v-if="candidate.boardPassesGate != null"
              :class="[
                'text-xs px-2 py-0.5 rounded inline-block',
                candidate.boardPassesGate
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              ]"
            >
              Gate: {{ candidate.boardPassesGate ? 'Pass' : 'Fail' }}
            </div>
          </div>
        </div>
        <ScoreBreakdown :candidate="candidate" />
        <p v-if="candidate.boardGateReason" class="text-xs text-gray-500 dark:text-gray-400 mt-3">{{ candidate.boardGateReason }}</p>
      </div>

      <!-- Generated content -->
      <div v-if="candidate.problemStatement || candidate.proposedPoc || candidate.expectedOutcome" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div v-if="candidate.problemStatement">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Problem Statement</h3>
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ candidate.problemStatement }}</p>
        </div>
        <div v-if="candidate.proposedPoc">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Proposed POC</h3>
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ candidate.proposedPoc }}</p>
        </div>
        <div v-if="candidate.expectedOutcome">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Expected Outcome</h3>
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ candidate.expectedOutcome }}</p>
        </div>
        <div v-if="candidate.customerRelevance">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Customer Relevance</h3>
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ candidate.customerRelevance }}</p>
        </div>
      </div>

      <!-- Technical profile -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Technical Profile</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div v-if="candidate.language">
            <span class="text-gray-500 dark:text-gray-400 text-xs">Language</span>
            <p class="text-gray-900 dark:text-gray-100">{{ candidate.language }}</p>
          </div>
          <div v-if="candidate.license">
            <span class="text-gray-500 dark:text-gray-400 text-xs">License</span>
            <p class="text-gray-900 dark:text-gray-100">{{ candidate.license }}</p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400 text-xs">GPU Required</span>
            <p class="text-gray-900 dark:text-gray-100">{{ candidate.gpuRequired == null ? '—' : (candidate.gpuRequired ? 'Yes' : 'No') }}<span v-if="candidate.vramGb"> ({{ candidate.vramGb }} GB)</span></p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400 text-xs">Dockerfile</span>
            <p class="text-gray-900 dark:text-gray-100">{{ candidate.hasDockerfile == null ? '—' : (candidate.hasDockerfile ? 'Yes' : 'No') }}</p>
          </div>
          <div v-if="candidate.contributors != null">
            <span class="text-gray-500 dark:text-gray-400 text-xs">Contributors</span>
            <p class="text-gray-900 dark:text-gray-100">{{ candidate.contributors }}</p>
          </div>
          <div v-if="candidate.openIssues != null">
            <span class="text-gray-500 dark:text-gray-400 text-xs">Open Issues</span>
            <p class="text-gray-900 dark:text-gray-100">{{ candidate.openIssues }}</p>
          </div>
          <div v-if="candidate.starsVelocity != null">
            <span class="text-gray-500 dark:text-gray-400 text-xs">Stars Velocity</span>
            <p class="text-gray-900 dark:text-gray-100">{{ candidate.starsVelocity }}/day</p>
          </div>
          <div v-if="candidate.lastCommit">
            <span class="text-gray-500 dark:text-gray-400 text-xs">Last Commit</span>
            <p class="text-gray-900 dark:text-gray-100">{{ new Date(candidate.lastCommit).toLocaleDateString() }}</p>
          </div>
        </div>
        <div v-if="candidate.installSteps" class="mt-3">
          <span class="text-gray-500 dark:text-gray-400 text-xs">Install</span>
          <code class="block mt-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-800 dark:text-gray-200">{{ candidate.installSteps }}</code>
        </div>
      </div>

      <!-- Red Hat stack & tags -->
      <div v-if="(candidate.redHatStack && candidate.redHatStack.length) || (candidate.capabilityLabels && candidate.capabilityLabels.length)" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <div v-if="candidate.redHatStack && candidate.redHatStack.length">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Red Hat Stack Alignment</h3>
          <div class="flex flex-wrap gap-1">
            <span v-for="tag in candidate.redHatStack" :key="tag" class="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{{ tag }}</span>
          </div>
        </div>
        <div v-if="candidate.capabilityLabels && candidate.capabilityLabels.length">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Capability Labels</h3>
          <div class="flex flex-wrap gap-1">
            <span v-for="tag in candidate.capabilityLabels" :key="tag" class="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{{ tag }}</span>
          </div>
        </div>
        <div v-if="candidate.relationshipToRedHatAi">
          <span class="text-xs text-gray-500 dark:text-gray-400">Relationship: </span>
          <span class="text-xs text-gray-700 dark:text-gray-300">{{ candidate.relationshipToRedHatAi }}</span>
          <span v-if="candidate.duplicateRisk" class="text-xs text-gray-500 dark:text-gray-400"> &middot; Duplicate risk: {{ candidate.duplicateRisk }}</span>
        </div>
      </div>

      <!-- Blockers & risks -->
      <div v-if="candidate.blockers || candidate.risks" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <div v-if="candidate.blockers">
          <h3 class="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-1">Blockers</h3>
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ candidate.blockers }}</p>
        </div>
        <div v-if="candidate.risks">
          <h3 class="text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider mb-1">Risks</h3>
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ candidate.risks }}</p>
        </div>
      </div>

      <!-- Review status -->
      <div v-if="candidate.pmDecision || (candidate.pmReviewHistory && candidate.pmReviewHistory.length)" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Review Status</h3>
        <div v-if="candidate.pmReviewHistory && candidate.pmReviewHistory.length" class="space-y-2">
          <div v-for="(review, idx) in candidate.pmReviewHistory" :key="idx" class="flex items-start gap-2 text-sm">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-32 shrink-0">{{ review.timestamp ? new Date(review.timestamp).toLocaleDateString() : '' }}</span>
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ review.reviewer }}</span>
            <span :class="['text-xs px-1.5 py-0.5 rounded', reviewMeta(review.decision).bgClass, reviewMeta(review.decision).textClass]">{{ review.decision }}</span>
            <span v-if="review.comments" class="text-gray-500 dark:text-gray-400">{{ review.comments }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">No reviews yet</p>
      </div>

      <!-- Resource links -->
      <div v-if="resourceLinks.length" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Resources</h3>
        <div class="flex flex-wrap gap-2">
          <template v-for="link in resourceLinks" :key="link.label + link.value">
            <a
              v-if="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener"
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              {{ link.label }} &rarr;
            </a>
            <span v-else class="text-sm text-gray-600 dark:text-gray-400">
              {{ link.label }}: {{ link.value }}
            </span>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
