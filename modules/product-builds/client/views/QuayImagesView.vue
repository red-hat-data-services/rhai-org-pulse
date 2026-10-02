<script setup>
import { ref, onMounted, computed } from 'vue'
import { useQuayImages } from '../composables/useQuayImages'
import { formatDate } from '../utils/formatting'

const { repos, refreshedAt, loading, error, load } = useQuayImages()
const streamFilter = ref('')
const expandedRepos = ref(new Set())

onMounted(() => load())

const streams = computed(() => {
  const set = new Set(repos.value.map(r => r.stream))
  return Array.from(set).sort()
})

const filteredRepos = computed(() => {
  let result = repos.value
  if (streamFilter.value) {
    result = result.filter(r => r.stream === streamFilter.value)
  }
  return result
})

const groupedByComponent = computed(() => {
  const map = new Map()
  for (const repo of filteredRepos.value) {
    const key = repo.component
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(repo)
  }
  return Array.from(map, ([component, repos]) => ({ component, repos }))
})

function latestTag(repo) {
  if (!repo.tags || repo.tags.length === 0) return null
  return repo.tags.reduce((latest, t) => {
    if (!latest) return t
    const lm = new Date(t.last_modified)
    const ll = new Date(latest.last_modified)
    return lm > ll ? t : latest
  }, null)
}

function formatSize(bytes) {
  if (!bytes) return '\u2014'
  if (bytes > 1_000_000_000) return (bytes / 1_000_000_000).toFixed(1) + ' GB'
  if (bytes > 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB'
  if (bytes > 1_000) return (bytes / 1_000).toFixed(1) + ' KB'
  return bytes + ' B'
}

function toggleExpand(pullspec) {
  const next = new Set(expandedRepos.value)
  if (next.has(pullspec)) {
    next.delete(pullspec)
  } else {
    next.add(pullspec)
  }
  expandedRepos.value = next
}

function shortRepo(pullspec) {
  return pullspec.replace('quay.io/', '')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Quay Image Tags</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Container image tags from tracked Quay.io repositories
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="refreshedAt" class="text-xs text-gray-400 dark:text-gray-500">
          Updated {{ formatDate(refreshedAt) }}
        </span>
        <select
          v-model="streamFilter"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">All streams</option>
          <option v-for="s in streams" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading && repos.length === 0" class="text-sm text-gray-500 dark:text-gray-400">Loading image data\u2026</div>
    <div v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>

    <template v-if="!loading || repos.length > 0">
      <div v-if="groupedByComponent.length === 0 && !loading" class="text-sm text-gray-500 dark:text-gray-400">
        No tracked repositories found.
      </div>

      <!-- Grouped tables -->
      <div v-for="group in groupedByComponent" :key="group.component" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ group.component }}</h3>
        </div>

        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/30">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[30%]">Repository</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Stream</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[20%]">Latest Tag</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Size</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[20%]">Last Modified</th>
              <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Tags</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <template v-for="repo in group.repos" :key="repo.pullspec">
              <!-- Summary row -->
              <tr
                @click="toggleExpand(repo.pullspec)"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <td class="px-4 py-3 text-sm">
                  <a
                    :href="repo.quay_url"
                    target="_blank"
                    rel="noopener"
                    class="text-primary-600 dark:text-blue-400 hover:underline"
                    @click.stop
                  >{{ shortRepo(repo.pullspec) }}</a>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    :class="repo.stream === 'RHOAI'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'"
                  >{{ repo.stream }}</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                  <template v-if="latestTag(repo)">{{ latestTag(repo).name }}</template>
                  <span v-else class="text-gray-400">\u2014</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {{ latestTag(repo) ? formatSize(latestTag(repo).size) : '\u2014' }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {{ latestTag(repo) ? formatDate(latestTag(repo).last_modified) : '\u2014' }}
                </td>
                <td class="px-4 py-3 text-center">
                  <span v-if="repo.error" class="text-xs text-red-500" :title="repo.error">Error</span>
                  <span v-else class="text-sm text-gray-600 dark:text-gray-300">{{ repo.tags ? repo.tags.length : 0 }}</span>
                </td>
              </tr>

              <!-- Expanded tag detail -->
              <tr v-if="expandedRepos.has(repo.pullspec) && repo.tags && repo.tags.length > 0">
                <td colspan="6" class="px-0 py-0">
                  <div class="bg-gray-50 dark:bg-gray-900/30 px-8 py-3">
                    <table class="min-w-full">
                      <thead>
                        <tr>
                          <th class="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tag</th>
                          <th class="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Digest</th>
                          <th class="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Size</th>
                          <th class="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Modified</th>
                          <th class="px-3 py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Manifest List</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="tag in repo.tags" :key="tag.name" class="border-t border-gray-200 dark:border-gray-700">
                          <td class="px-3 py-1.5 text-xs font-mono text-gray-700 dark:text-gray-300">{{ tag.name }}</td>
                          <td class="px-3 py-1.5 text-xs font-mono text-gray-500 dark:text-gray-400 truncate max-w-[200px]" :title="tag.manifest_digest">
                            {{ tag.manifest_digest ? tag.manifest_digest.slice(0, 19) + '\u2026' : '\u2014' }}
                          </td>
                          <td class="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">{{ formatSize(tag.size) }}</td>
                          <td class="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">{{ formatDate(tag.last_modified) }}</td>
                          <td class="px-3 py-1.5 text-center">
                            <span v-if="tag.is_manifest_list" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">Multi-arch</span>
                            <span v-else class="text-xs text-gray-400">\u2014</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
