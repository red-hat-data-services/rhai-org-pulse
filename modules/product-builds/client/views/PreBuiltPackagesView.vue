<script setup>
import { onMounted } from 'vue'
import { useWheelOverrides } from '../composables/useWheelCollections'

const wheelOverrides = useWheelOverrides()

const BUILDER_REPO_URL = 'https://gitlab.com/redhat/rhel-ai/wheels/fondue'
const OVERRIDE_VARIANTS = ['cpu-ubi9', 'cuda-ubi9', 'gaudi-ubi9', 'neuron-ubi9', 'rocm-ubi9', 'rubin-ubi9', 'spyre-ubi9', 'tpu-ubi9']

function getOverrideFileUrl(override) {
  if (!override.source_file) return null
  const ref = override.commit_sha || 'main'
  return `${BUILDER_REPO_URL}/-/blob/${ref}/${override.source_file}`
}

onMounted(() => {
  wheelOverrides.load()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Variant filter -->
    <div class="flex items-center gap-3">
      <select
        :value="wheelOverrides.variantFilter.value"
        @change="wheelOverrides.setVariantFilter($event.target.value)"
        class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      >
        <option value="">All variants</option>
        <option v-for="v in OVERRIDE_VARIANTS" :key="v" :value="v">{{ v }}</option>
      </select>
      <span v-if="!wheelOverrides.loading.value && wheelOverrides.overrides.value.length > 0" class="text-sm text-gray-500 dark:text-gray-400">
        {{ wheelOverrides.overrides.value.length }} package{{ wheelOverrides.overrides.value.length !== 1 ? 's' : '' }}
      </span>
      <span v-if="wheelOverrides.loading.value" class="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
    </div>

    <!-- Error -->
    <div v-if="wheelOverrides.error.value" class="text-sm text-red-600 dark:text-red-400">{{ wheelOverrides.error.value }}</div>

    <!-- Empty state -->
    <div v-else-if="!wheelOverrides.loading.value && wheelOverrides.overrides.value.length === 0" class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
      No pre-built packages found.
    </div>

    <!-- Table -->
    <template v-if="wheelOverrides.overrides.value.length > 0">
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 22%">Package</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 25%">Variants</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 33%">Reason</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 20%">Jira</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="pkg in wheelOverrides.overrides.value"
              :key="pkg.package_name"
              class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                {{ pkg.package_name }}
                <a v-if="getOverrideFileUrl(pkg)" :href="getOverrideFileUrl(pkg)" target="_blank" rel="noopener noreferrer" class="ml-1.5 inline-flex text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-blue-400" title="View source file">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-1 flex-wrap">
                  <span
                    v-for="v in pkg.pre_built_variants"
                    :key="v"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  >{{ v }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ pkg.reason || '—' }}</td>
              <td class="px-4 py-3 text-sm">
                <template v-if="pkg.jira_key">
                  <a :href="`https://redhat.atlassian.net/browse/${pkg.jira_key}`" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline">{{ pkg.jira_key }}</a>
                  <span v-if="pkg.jira_status" class="ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{{ pkg.jira_status }}</span>
                </template>
                <span v-else class="text-gray-400 dark:text-gray-500">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>