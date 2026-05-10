<script setup>
import { ref, computed, inject } from 'vue'

const props = defineProps({
  components: { type: Object, default: () => ({}) },
  detailCache: { type: Object, default: () => ({}) },
  jiraHost: { type: String, default: 'https://issues.redhat.com' }
})

const emit = defineEmits(['loadDetail'])

const moduleNav = inject('moduleNav', null)

const selectedKey = ref(null)

const componentList = computed(() =>
  Object.values(props.components).sort((a, b) => {
    if (a.completionStatus !== b.completionStatus) {
      return a.completionStatus === 'completed' ? -1 : 1
    }
    return (b.created || '').localeCompare(a.created || '')
  })
)

const STEPS = [
  { key: 'yamlValidated', label: 'YAML' },
  { key: 'quayRepoCreated', label: 'Quay' },
  { key: 'konfluxOnboarded', label: 'Konflux' },
  { key: 'pushPipelineConfigured', label: 'Push' },
  { key: 'operatorIntegrated', label: 'Operator' },
  { key: 'bundleConfigured', label: 'Bundle' },
  { key: 'deliveryRepoProvisioned', label: 'Delivery' },
  { key: 'productListingUpdated', label: 'Listing' },
  { key: 'renovateSetup', label: 'Renovate' }
]

function daysBetween(start, end) {
  if (!start || !end) return null
  const ms = new Date(end) - new Date(start)
  return Math.round(ms / 86400000)
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function selectRow(key) {
  selectedKey.value = selectedKey.value === key ? null : key
  if (key && !props.detailCache[key]) emit('loadDetail', key)
}

function navigateToFeature(featureKey) {
  if (moduleNav) moduleNav.navigateTo('feature-review', { select: featureKey })
}
</script>

<template>
  <div class="flex-1 overflow-auto">
    <!-- Table -->
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
      <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Key</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Component</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">Product</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Status</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Features</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Steps</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Created</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Days</th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <template v-for="component in componentList" :key="component.key">
          <!-- Main row -->
          <tr
            class="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            :class="{ 'bg-blue-50 dark:bg-blue-900/20': selectedKey === component.key }"
            @click="selectRow(component.key)"
          >
            <td class="px-4 py-3 font-mono text-xs">
              <a
                :href="`${jiraHost}/browse/${component.key}`"
                target="_blank"
                rel="noopener"
                class="text-blue-600 dark:text-blue-400 hover:underline"
                @click.stop
              >{{ component.key }}</a>
            </td>
            <td class="px-4 py-3">
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ component.componentName || component.summary }}</span>
              <p v-if="component.componentName" class="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{{ component.summary }}</p>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="component.productContext === 'RHOAI'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'"
              >{{ component.productContext }}</span>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                :class="component.completionStatus === 'completed'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'"
              >
                <span class="h-1.5 w-1.5 rounded-full"
                  :class="component.completionStatus === 'completed' ? 'bg-green-500' : 'bg-amber-500'"
                />
                {{ component.completionStatus === 'completed' ? 'Completed' : 'In Progress' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="feat in (component.linkedFeatures || [])"
                  :key="feat"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  @click.stop="navigateToFeature(feat)"
                  :title="`View ${feat} in Feature Review`"
                >{{ feat }}</button>
                <span v-if="!component.linkedFeatures?.length" class="text-xs text-gray-400">—</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex gap-0.5">
                <span
                  v-for="step in STEPS"
                  :key="step.key"
                  class="h-2.5 w-2.5 rounded-sm"
                  :class="component.onboardingSteps?.[step.key]
                    ? 'bg-green-500'
                    : 'bg-gray-200 dark:bg-gray-700'"
                  :title="step.label + ': ' + (component.onboardingSteps?.[step.key] ? 'done' : 'pending')"
                />
              </div>
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{{ formatDate(component.created) }}</td>
            <td class="px-4 py-3 text-xs">
              <span v-if="component.completionStatus === 'completed'" class="font-medium text-gray-700 dark:text-gray-300">
                {{ daysBetween(component.created, component.resolved) ?? '—' }}d
              </span>
              <span v-else class="text-gray-400 dark:text-gray-500">
                {{ daysBetween(component.created, new Date().toISOString()) ?? '—' }}d+
              </span>
            </td>
          </tr>

          <!-- Expanded detail row -->
          <tr v-if="selectedKey === component.key" class="bg-gray-50 dark:bg-gray-800/50">
            <td colspan="8" class="px-6 py-4">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <!-- Repo details -->
                <div v-if="component.repoUrl || detailCache[component.key]?.latest?.repoUrl" class="space-y-1">
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Repository</p>
                  <a
                    :href="component.repoUrl || detailCache[component.key]?.latest?.repoUrl"
                    target="_blank"
                    rel="noopener"
                    class="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all"
                  >{{ component.repoUrl || detailCache[component.key]?.latest?.repoUrl }}</a>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    Branch: <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">{{ (component.branch || detailCache[component.key]?.latest?.branch) || '—' }}</code>
                    &nbsp;|&nbsp;
                    Operator: {{ (component.isOperator ?? detailCache[component.key]?.latest?.isOperator) ? 'Yes' : 'No' }}
                  </p>
                </div>

                <!-- Step details -->
                <div class="space-y-1">
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Onboarding Steps</p>
                  <div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <div v-for="step in STEPS" :key="step.key" class="flex items-center gap-1.5 text-xs">
                      <span
                        class="h-2 w-2 rounded-full flex-shrink-0"
                        :class="component.onboardingSteps?.[step.key] ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'"
                      />
                      <span :class="component.onboardingSteps?.[step.key] ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'">
                        {{ step.label }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- History -->
                <div v-if="detailCache[component.key]?.history?.length" class="space-y-1">
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">History</p>
                  <div class="space-y-1.5 max-h-32 overflow-y-auto">
                    <div
                      v-for="h in detailCache[component.key].history"
                      :key="h.syncedAt"
                      class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
                    >
                      <span class="text-gray-300 dark:text-gray-600">{{ new Date(h.syncedAt).toLocaleDateString() }}</span>
                      <span
                        class="px-1.5 py-0.5 rounded-full text-xs"
                        :class="h.completionStatus === 'completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'"
                      >{{ h.completionStatus }}</span>
                      <span>{{ Object.values(h.onboardingSteps || {}).filter(Boolean).length }}/{{ STEPS.length }} steps</span>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <div v-if="!componentList.length" class="py-16 text-center text-gray-400 dark:text-gray-500">
      <svg class="h-10 w-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      No components match the current filters.
    </div>
  </div>
</template>
