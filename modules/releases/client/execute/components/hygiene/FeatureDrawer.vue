<script setup>
import { computed, watch, onMounted, onUnmounted } from 'vue'
import HygieneViolations from '@shared/client/components/HygieneViolations.vue'

const props = defineProps({
  feature: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'view-details'])

const JIRA_BASE = 'https://redhat.atlassian.net/browse'

const open = computed(() => !!props.feature)

const jiraUrl = computed(() =>
  props.feature ? `${JIRA_BASE}/${props.feature.key}` : null
)

const violations = computed(() =>
  Array.isArray(props.feature?.violations) ? props.feature.violations : []
)

const colorStatus = computed(() => props.feature?.colorStatus || null)

const fixVersionLabel = computed(() => {
  const v = props.feature?.fixVersions
  return v && v.length ? v.join(', ') : '—'
})

const targetVersionLabel = computed(() => {
  const v = props.feature?.targetVersions
  return v && v.length ? v.join(', ') : '—'
})

// Fix Version is the source of truth once set; flag when the PM's Target Version
// resolves to a different release (mirrors the target-fix-version-mismatch rule).
const versionMismatch = computed(() =>
  !!(props.feature?.fixReleaseId &&
    props.feature?.targetReleaseId &&
    props.feature.fixReleaseId !== props.feature.targetReleaseId)
)

const colorDotClass = computed(() => {
  const s = (colorStatus.value || '').toLowerCase()
  if (s === 'green') return 'bg-emerald-500'
  if (s === 'yellow') return 'bg-amber-400'
  if (s === 'red') return 'bg-red-500'
  return 'bg-gray-300 dark:bg-gray-600'
})

// Jira's statusSummary comes from renderedFields as an HTML string (and may be a
// raw string via the serializeField fallback). Extract plain text with DOMParser
// — it builds an inert document (no script execution, no resource loading) and
// avoids both an HTML injection sink and incomplete regex-based stripping.
function htmlToText(html) {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return String(html).trim()
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  return (doc.body.textContent || '').trim()
}

const statusSummaryText = computed(() => htmlToText(props.feature?.statusSummary))

const hasStatusSummary = computed(() => !!statusSummaryText.value)

function handleEscape(e) {
  if (e.key === 'Escape' && open.value) emit('close')
}

// Lock background scroll while the drawer is open.
watch(open, (isOpen) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }
})

onMounted(() => document.addEventListener('keydown', handleEscape))
onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50" role="dialog" aria-modal="true" :aria-label="feature ? feature.key + ' details' : 'Feature details'">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="emit('close')"></div>

        <!-- Panel -->
        <Transition
          enter-active-class="transition-transform duration-200 ease-out"
          enter-from-class="translate-x-full"
          leave-active-class="transition-transform duration-200 ease-in"
          leave-to-class="translate-x-full"
        >
          <div
            v-if="open"
            data-testid="feature-drawer"
            class="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl flex flex-col"
          >
            <!-- Header -->
            <div class="shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <a
                    :href="jiraUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                  >{{ feature?.key }}</a>
                  <span
                    v-if="feature?.issueType"
                    class="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  >{{ feature.issueType }}</span>
                </div>
                <h2 class="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                  {{ feature?.summary }}
                </h2>
              </div>
              <button
                type="button"
                @click="emit('close')"
                class="shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Close"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              <!-- Key info -->
              <dl class="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                <dt class="col-span-1 text-gray-500 dark:text-gray-400">Status</dt>
                <dd class="col-span-2 text-gray-900 dark:text-gray-100">{{ feature?.status || '—' }}</dd>

                <dt class="col-span-1 text-gray-500 dark:text-gray-400">Assignee</dt>
                <dd
                  class="col-span-2"
                  :class="feature?.assignee ? 'text-gray-900 dark:text-gray-100' : 'text-yellow-600 dark:text-yellow-400 font-medium'"
                >{{ feature?.assignee || 'Unassigned' }}</dd>

                <dt class="col-span-1 text-gray-500 dark:text-gray-400">Team</dt>
                <dd class="col-span-2 text-gray-900 dark:text-gray-100">{{ feature?.team || '—' }}</dd>

                <dt v-if="feature?.priority" class="col-span-1 text-gray-500 dark:text-gray-400">Priority</dt>
                <dd v-if="feature?.priority" class="col-span-2 text-gray-900 dark:text-gray-100">{{ feature.priority }}</dd>

                <dt class="col-span-1 text-gray-500 dark:text-gray-400">Fix Version</dt>
                <dd class="col-span-2 text-gray-900 dark:text-gray-100 font-mono text-xs">{{ fixVersionLabel }}</dd>

                <dt class="col-span-1 text-gray-500 dark:text-gray-400">Target Version</dt>
                <dd
                  class="col-span-2 font-mono text-xs"
                  :class="versionMismatch ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-900 dark:text-gray-100'"
                >
                  {{ targetVersionLabel }}
                  <span v-if="versionMismatch" class="ml-1 font-sans not-italic text-[10px]">(differs from Fix Version)</span>
                </dd>

                <dt class="col-span-1 text-gray-500 dark:text-gray-400">Color</dt>
                <dd class="col-span-2 flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
                  <span class="w-2.5 h-2.5 rounded-full" :class="colorDotClass"></span>
                  {{ colorStatus || 'Not Selected' }}
                </dd>

                <dt v-if="feature?.components && feature.components.length" class="col-span-1 text-gray-500 dark:text-gray-400">Components</dt>
                <dd v-if="feature?.components && feature.components.length" class="col-span-2 text-gray-900 dark:text-gray-100">{{ feature.components.join(', ') }}</dd>
              </dl>

              <!-- Status summary -->
              <div>
                <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Status Summary</h3>
                <p
                  v-if="hasStatusSummary"
                  class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line break-words"
                >{{ statusSummaryText }}</p>
                <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">No status summary provided.</p>
              </div>

              <!-- Hygiene violations -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hygiene Violations</h3>
                  <span
                    v-if="violations.length"
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                  >{{ violations.length }}</span>
                </div>
                <HygieneViolations :violations="violations" :feature-key="feature?.key" :jira-base-url="JIRA_BASE" />
              </div>
            </div>

            <!-- Footer actions -->
            <div class="shrink-0 px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <button
                type="button"
                @click="emit('view-details')"
                class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                View full details
              </button>
              <a
                :href="jiraUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Open in Jira
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
