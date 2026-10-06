<template>
  <div>
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <button
        type="button"
        class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Back to Reports"
        @click="goBack"
      >
        <ArrowLeft :size="18" />
      </button>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Container Health Index</h2>
        <p v-if="data?.fetchedAt" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Snapshot: {{ formatDateTime(data.fetchedAt) }}
          <template v-if="currentEnv?.source">
            &middot; Source: {{ currentEnv.source }}
          </template>
        </p>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center items-center py-24">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>

    <div
      v-else-if="error"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
    >
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
      <button
        type="button"
        class="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
        @click="loadData"
      >
        Retry
      </button>
    </div>

    <div v-else-if="!data" class="text-center py-24">
      <Shield :size="48" class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No CHI hierarchy data yet</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Run the collection pipeline and POST to
        <code class="text-xs">/api/modules/releases/chi-hierarchy/bulk</code>.
      </p>
    </div>

    <div v-else class="space-y-6">
      <div class="flex flex-wrap items-center gap-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3">
        <div class="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden" role="group" aria-label="Environment">
          <button
            v-for="envKey in envKeys"
            :key="envKey"
            type="button"
            class="px-3 py-1.5 text-sm font-medium transition-colors"
            :class="selectedEnv === envKey
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
            :aria-pressed="selectedEnv === envKey"
            @click="selectedEnv = envKey"
          >
            {{ envKey === 'prod' ? 'Prod' : 'Stage' }}
          </button>
        </div>

        <div class="flex items-center gap-2">
          <label for="chi-version" class="text-sm font-medium text-gray-700 dark:text-gray-300">Version</label>
          <select
            id="chi-version"
            v-model="selectedVersionId"
            class="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option v-for="v in versionOptions" :key="v.id" :value="v.id">
              {{ v.id }} ({{ v.tag }})
            </option>
          </select>
        </div>

        <p v-if="!currentEnv" class="text-sm text-amber-600 dark:text-amber-400">
          No {{ selectedEnv }} snapshot in this payload.
        </p>
      </div>

      <div
        v-if="currentVersion"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-4"
      >
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Images</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ currentVersion.summary?.imageCount ?? 0 }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Stale (&gt;14d)</p>
            <p
              class="text-2xl font-bold"
              :class="(currentVersion.summary?.staleImageCount || 0) > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-900 dark:text-gray-100'"
            >
              {{ currentVersion.summary?.staleImageCount ?? 0 }}
            </p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Critical</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ currentVersion.summary?.critical ?? 0 }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Important</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ currentVersion.summary?.important ?? 0 }}</p>
          </div>
        </div>
        <div v-if="gradeDistributionEntries.length" class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="[grade, count] in gradeDistributionEntries"
            :key="grade"
            class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
          >
            <span
              class="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
              :class="chiGradeBadgeClass(grade)"
            >{{ grade }}</span>
            × {{ count }}
          </span>
        </div>
      </div>

      <div
        v-else-if="currentEnv"
        class="text-center py-12 text-sm text-gray-500 dark:text-gray-400"
      >
        No versions available for {{ selectedEnv }}.
      </div>

      <section v-if="currentVersion" class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Components</h3>

        <div
          v-for="component in currentVersion.components || []"
          :key="component.name"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <button
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            :aria-expanded="isExpanded(component.name)"
            @click="toggleComponent(component.name)"
          >
            <ChevronRight
              :size="16"
              class="flex-shrink-0 text-gray-400 transition-transform"
              :class="{ 'rotate-90': isExpanded(component.name) }"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ component.name }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ component.summary?.imageCount ?? component.images?.length ?? 0 }} images
                <template v-if="component.summary?.oldestImageAgeDays != null">
                  &middot; oldest {{ component.summary.oldestImageAgeDays }}d
                </template>
              </p>
            </div>
            <span
              v-if="component.summary?.worstGrade"
              class="inline-flex items-center px-2.5 py-1 rounded text-sm font-bold"
              :class="chiGradeBadgeClass(component.summary.worstGrade)"
              :title="'Worst grade'"
            >{{ component.summary.worstGrade }}</span>
          </button>

          <div v-if="isExpanded(component.name)" class="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Image</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Grade</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Grade date</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last updated</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vulns</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="image in component.images || []"
                  :key="image.name"
                  :class="isStale(image) ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''"
                >
                  <td class="px-4 py-2">
                    <a
                      v-if="image.catalogUrl"
                      :href="image.catalogUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >{{ image.name }}</a>
                    <span v-else class="font-medium text-gray-900 dark:text-gray-100">{{ image.name }}</span>
                  </td>
                  <td class="px-4 py-2">
                    <span
                      class="inline-flex items-center px-2.5 py-1 rounded text-sm font-bold"
                      :class="chiGradeBadgeClass(image.grade)"
                    >{{ image.grade || '—' }}</span>
                  </td>
                  <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ formatDate(image.gradeDate) }}</td>
                  <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ formatDate(image.lastUpdated) }}</td>
                  <td class="px-4 py-2">
                    <span
                      :class="isStale(image)
                        ? 'text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-gray-700 dark:text-gray-300'"
                    >
                      {{ image.ageDays != null ? image.ageDays + 'd' : '—' }}
                      <span v-if="isStale(image)" class="text-xs ml-1">(stale)</span>
                    </span>
                  </td>
                  <td class="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {{ image.vulnerabilityCount != null ? image.vulnerabilityCount : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ChevronRight, Shield } from 'lucide-vue-next'
import { useChiHierarchy } from './composables/useChiHierarchy'

const STALE_AGE_DAYS = 14

const CHI_GRADE_CLASSES = {
  A: 'bg-green-600 text-white',
  B: 'bg-lime-500 text-white',
  C: 'bg-yellow-400 text-gray-900',
  D: 'bg-orange-500 text-white',
  E: 'bg-amber-600 text-white',
  F: 'bg-red-700 text-white',
  Unknown: 'bg-gray-400 text-white'
}

const nav = inject('moduleNav')
const { data, loading, error, loadData } = useChiHierarchy()

const selectedEnv = ref('prod')
const selectedVersionId = ref('')
const expanded = ref({})

const envKeys = ['prod', 'stage']

const currentEnv = computed(() => data.value?.environments?.[selectedEnv.value] || null)

const versionOptions = computed(() => {
  const versions = currentEnv.value?.versions || []
  if (!versions.length) return []
  const streams = data.value?.activeStreams || []
  const streamSet = new Set(streams)
  const active = versions.filter(v => streamSet.size === 0 || streamSet.has(v.id))
  return (active.length ? active : versions).slice().sort((a, b) => String(b.id).localeCompare(String(a.id)))
})

const currentVersion = computed(() => {
  return versionOptions.value.find(v => v.id === selectedVersionId.value) || null
})

const gradeDistributionEntries = computed(() => {
  const dist = currentVersion.value?.summary?.gradeDistribution || {}
  return Object.entries(dist).sort((a, b) => a[0].localeCompare(b[0]))
})

watch(versionOptions, (opts) => {
  if (!opts.length) {
    selectedVersionId.value = ''
    return
  }
  if (!opts.some(v => v.id === selectedVersionId.value)) {
    selectedVersionId.value = opts[0].id
  }
}, { immediate: true })

watch(selectedEnv, () => {
  expanded.value = {}
})

function chiGradeBadgeClass(grade) {
  return CHI_GRADE_CLASSES[grade] || CHI_GRADE_CLASSES.Unknown
}

function isStale(image) {
  return image?.ageDays != null && image.ageDays > STALE_AGE_DAYS
}

function isExpanded(name) {
  return !!expanded.value[name]
}

function toggleComponent(name) {
  expanded.value = { ...expanded.value, [name]: !expanded.value[name] }
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function goBack() {
  nav.navigateTo('reports')
}

onMounted(() => {
  loadData()
})
</script>
