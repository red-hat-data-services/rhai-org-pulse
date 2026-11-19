<template>
  <section data-testid="jira-plan-view" class="space-y-5">
    <div class="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:flex-row md:items-start md:justify-between">
      <div class="max-w-3xl">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            Jira Plan mirror
          </span>
          <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            Read-only
          </span>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          RHAI Outcome to Feature Prioritization
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Open RHAISTRAT Outcomes in Jira Rank order, stopping above
          <a
            :href="sentinelUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >{{ sentinelKey }}</a>,
          <span class="font-medium">[🟢^^^RANKED OUTCOMES ABOVE THIS LINE^^🟢 ]</span>.
          Expand an Outcome to see its direct child work items. This page never writes back to Jira.
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          :disabled="loading || refreshing"
          @click="loadPlan(true)"
        >
          {{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
        <a
          :href="planUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Open in Jira
        </a>
      </div>
    </div>

    <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      Loading ranked Outcomes from Jira…
    </div>

    <div v-else-if="loadError" class="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <p class="font-semibold">Could not load the Jira Plan.</p>
      <p class="mt-1">{{ loadError }}</p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
        <p>
          <span class="font-semibold text-gray-800 dark:text-gray-200">{{ outcomes.length }}</span>
          ranked Outcomes above the cutoff
        </p>
        <p v-if="generatedAt">Fetched {{ formatDate(generatedAt) }}</p>
      </div>

      <div v-if="outcomes.length === 0" class="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        No ranked Outcomes were returned.
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <table class="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th class="w-20 px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Rank</th>
              <th class="min-w-[24rem] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Outcome</th>
              <th class="min-w-[8rem] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
              <th class="min-w-[14rem] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Target Version</th>
              <th class="min-w-[14rem] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Releases</th>
              <th class="min-w-[11rem] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Product Manager</th>
              <th class="min-w-[11rem] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Assignee</th>
              <th class="min-w-[13rem] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Components</th>
              <th class="min-w-[7rem] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Priority</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <template v-for="outcome in outcomes" :key="outcome.key">
              <tr
                data-testid="jira-plan-outcome-row"
                :data-outcome-key="outcome.key"
                class="align-top transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                <td class="px-4 py-4">
                  <button
                    type="button"
                    :data-testid="'jira-plan-toggle-' + outcome.key"
                    :aria-expanded="isExpanded(outcome.key)"
                    :aria-label="(isExpanded(outcome.key) ? 'Collapse' : 'Expand') + ' child work items for ' + outcome.key"
                    class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-200 dark:hover:bg-gray-700"
                    @click="toggleOutcome(outcome.key)"
                  >
                    <svg
                      class="h-4 w-4 transition-transform"
                      :class="{ 'rotate-90': isExpanded(outcome.key) }"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                    </svg>
                    {{ outcome.rank }}
                  </button>
                </td>
                <td class="px-4 py-4">
                  <a
                    :href="outcome.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-medium text-gray-900 hover:text-primary-600 hover:underline dark:text-gray-100 dark:hover:text-primary-400"
                  >{{ outcome.summary }}</a>
                  <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span class="font-mono">{{ outcome.key }}</span>
                    <span v-if="outcome.issueType"> · {{ outcome.issueType }}</span>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium" :class="statusClass(outcome.statusCategory)">
                    {{ outcome.status || 'Unknown' }}
                  </span>
                </td>
                <td class="px-4 py-4 text-gray-700 dark:text-gray-300">
                  <span v-if="outcome.targetVersions.length">{{ outcome.targetVersions.join(', ') }}</span>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td class="px-4 py-4 text-gray-700 dark:text-gray-300">
                  <span v-if="outcome.fixVersions && outcome.fixVersions.length">{{ outcome.fixVersions.join(', ') }}</span>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td class="px-4 py-4 text-gray-700 dark:text-gray-300">{{ outcome.productManager || '—' }}</td>
                <td class="px-4 py-4 text-gray-700 dark:text-gray-300">{{ outcome.assignee || 'Unassigned' }}</td>
                <td class="px-4 py-4 text-gray-700 dark:text-gray-300">
                  <div v-if="outcome.components.length" class="flex flex-wrap gap-1">
                    <span
                      v-for="component in outcome.components"
                      :key="component"
                      class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    >{{ component }}</span>
                  </div>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td class="px-4 py-4">
                  <span
                    v-if="outcome.priority"
                    class="inline-flex rounded-full px-2 py-1 text-xs font-medium"
                    :class="priorityClass(outcome.priority)"
                  >{{ outcome.priority }}</span>
                  <span v-else class="text-gray-400">—</span>
                </td>
              </tr>

              <tr v-if="isExpanded(outcome.key)" class="bg-gray-50 dark:bg-gray-900/30">
                <td colspan="9" class="px-6 py-3">
                  <div v-if="loadingChildren[outcome.key]" class="flex items-center gap-2 py-3 text-sm text-gray-500 dark:text-gray-400">
                    <span class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 dark:border-gray-600 dark:border-t-primary-400"></span>
                    Loading child work items…
                  </div>
                  <div v-else-if="childErrors[outcome.key]" class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    {{ childErrors[outcome.key] }}
                  </div>
                  <div v-else-if="childrenFor(outcome.key).length === 0" class="py-3 text-sm text-gray-500 dark:text-gray-400">
                    No open child work items are currently shown in the Plan.
                  </div>
                  <div v-else>
                    <div class="mb-2 flex items-center justify-between">
                      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Child work items
                      </h3>
                      <span class="text-xs text-gray-500 dark:text-gray-400">{{ childrenFor(outcome.key).length }} shown</span>
                    </div>
                    <div class="overflow-x-auto rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                      <table class="min-w-full divide-y divide-gray-100 text-left text-sm dark:divide-gray-700">
                        <thead class="bg-gray-100/70 dark:bg-gray-900/50">
                          <tr>
                            <th class="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Work item</th>
                            <th class="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Status</th>
                            <th class="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Target Version</th>
                            <th class="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Releases</th>
                            <th class="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Assignee</th>
                            <th class="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Priority</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                          <tr
                            v-for="child in childrenFor(outcome.key)"
                            :key="child.key"
                            data-testid="jira-plan-child-row"
                            class="align-top hover:bg-gray-50 dark:hover:bg-gray-700/40"
                          >
                            <td class="px-4 py-3">
                              <a
                                :href="child.url"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="font-medium text-gray-900 hover:text-primary-600 hover:underline dark:text-gray-100 dark:hover:text-primary-400"
                              >{{ child.summary }}</a>
                              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <span class="font-mono">{{ child.key }}</span>
                                <span v-if="child.issueType"> · {{ child.issueType }}</span>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium" :class="statusClass(child.statusCategory)">
                                {{ child.status || 'Unknown' }}
                              </span>
                            </td>
                            <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                              <span v-if="child.targetVersions.length">{{ child.targetVersions.join(', ') }}</span>
                              <span v-else class="text-gray-400">—</span>
                            </td>
                            <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                              <span v-if="child.fixVersions && child.fixVersions.length">{{ child.fixVersions.join(', ') }}</span>
                              <span v-else class="text-gray-400">—</span>
                            </td>
                            <td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ child.assignee || 'Unassigned' }}</td>
                            <td class="px-4 py-3">
                              <span
                                v-if="child.priority"
                                class="inline-flex rounded-full px-2 py-1 text-xs font-medium"
                                :class="priorityClass(child.priority)"
                              >{{ child.priority }}</span>
                              <span v-else class="text-gray-400">—</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const PLAN_URL = 'https://redhat.atlassian.net/jira/plans/5187/scenarios/5190/timeline?vid=7542'
const SENTINEL_KEY = 'RHAISTRAT-2921'
const SENTINEL_URL = 'https://redhat.atlassian.net/browse/' + SENTINEL_KEY

const planUrl = PLAN_URL
const sentinelKey = SENTINEL_KEY
const sentinelUrl = SENTINEL_URL

const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const generatedAt = ref('')
const outcomes = ref([])
const expandedKeys = ref(new Set())
const childrenByKey = ref({})
const loadingChildren = ref({})
const childErrors = ref({})
var planGeneration = 0

function isExpanded(key) {
  return expandedKeys.value.has(key)
}

function childrenFor(key) {
  return childrenByKey.value[key] || []
}

function statusClass(category) {
  if (category === 'Done') return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
  if (category === 'In Progress') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function priorityClass(priority) {
  if (priority === 'Blocker') return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
  if (priority === 'Critical') return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
  if (priority === 'Major') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function formatDate(value) {
  if (!value) return ''
  var date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

async function loadPlan(forceRefresh) {
  if (forceRefresh) refreshing.value = true
  else loading.value = true
  loadError.value = ''

  try {
    var path = '/modules/releases/planning/jira-plan'
    if (forceRefresh) path += '?refresh=true'
    var data = await apiRequest(path)
    outcomes.value = Array.isArray(data && data.outcomes) ? data.outcomes : []
    generatedAt.value = data && data.generatedAt || ''
    expandedKeys.value = new Set()
    planGeneration += 1
    childrenByKey.value = {}
    loadingChildren.value = {}
    childErrors.value = {}
  } catch (err) {
    loadError.value = err && err.message ? err.message : 'Unknown error'
    outcomes.value = []
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function toggleOutcome(key) {
  var next = new Set(expandedKeys.value)
  if (next.has(key)) {
    next.delete(key)
    expandedKeys.value = next
    return
  }

  next.add(key)
  expandedKeys.value = next

  if (childrenByKey.value[key] || loadingChildren.value[key]) return
  loadingChildren.value = { ...loadingChildren.value, [key]: true }
  childErrors.value = { ...childErrors.value, [key]: '' }
  var generation = planGeneration

  try {
    var data = await apiRequest('/modules/releases/planning/jira-plan/outcomes/' + encodeURIComponent(key) + '/children')
    if (generation !== planGeneration) return
    childrenByKey.value = {
      ...childrenByKey.value,
      [key]: Array.isArray(data && data.children) ? data.children : []
    }
  } catch (err) {
    if (generation !== planGeneration) return
    childErrors.value = {
      ...childErrors.value,
      [key]: err && err.message ? err.message : 'Could not load child work items'
    }
  } finally {
    if (generation === planGeneration) loadingChildren.value = { ...loadingChildren.value, [key]: false }
  }
}

onMounted(function() {
  loadPlan(false)
})
</script>
