<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const nav = inject('moduleNav')

const orgData = ref(null)
const loading = ref(true)
const search = ref('')
const selectedRoot = ref(0)
const drillPath = ref([])

async function loadOrgs() {
  loading.value = true
  try {
    orgData.value = await apiRequest('/modules/team-data/orgs')
  } catch {
    orgData.value = null
  } finally {
    loading.value = false
  }
}

const trees = computed(() => {
  if (!orgData.value) return []
  return orgData.value.trees || []
})

const rootTree = computed(() => {
  if (trees.value.length === 0) return null
  return trees.value[selectedRoot.value] || trees.value[0]
})

function countNode(node) {
  let total = 1
  let gh = node.github && node.github.username ? 1 : 0
  let gl = node.gitlab && node.gitlab.username ? 1 : 0
  if (node.children) {
    for (const c of node.children) {
      const sub = countNode(c)
      total += sub.total
      gh += sub.github
      gl += sub.gitlab
    }
  }
  return { total, github: gh, gitlab: gl }
}

const currentNode = computed(() => {
  if (!rootTree.value) return null
  let node = rootTree.value
  for (const uid of drillPath.value) {
    const child = (node.children || []).find(c => c.uid === uid)
    if (!child) break
    node = child
  }
  return node
})

const breadcrumbs = computed(() => {
  if (!rootTree.value) return []
  const crumbs = [{ uid: rootTree.value.uid, name: rootTree.value.name }]
  let node = rootTree.value
  for (const uid of drillPath.value) {
    const child = (node.children || []).find(c => c.uid === uid)
    if (!child) break
    crumbs.push({ uid: child.uid, name: child.name })
    node = child
  }
  return crumbs
})

const directReports = computed(() => {
  if (!currentNode.value || !currentNode.value.children) return []
  return currentNode.value.children
    .map(c => {
      const hasReports = c.children && c.children.length > 0
      return { ...c, hasReports, teamSize: hasReports ? countNode(c).total : 0 }
    })
    .sort((a, b) => b.teamSize - a.teamSize)
})

const currentStats = computed(() => {
  if (!currentNode.value) return null
  return countNode(currentNode.value)
})

const searchResults = computed(() => {
  if (!search.value || !rootTree.value) return null
  const term = search.value.toLowerCase()
  const results = []

  function walk(node, path) {
    const nameMatch = node.name && node.name.toLowerCase().includes(term)
    const titleMatch = node.title && node.title.toLowerCase().includes(term)
    if (nameMatch || titleMatch) {
      results.push({
        uid: node.uid,
        name: node.name,
        title: node.title,
        github: node.github,
        gitlab: node.gitlab,
        path: path.map(p => p.name).join(' > ')
      })
    }
    if (node.children) {
      for (const c of node.children) {
        walk(c, [...path, node])
      }
    }
  }

  walk(rootTree.value, [])
  return results.slice(0, 50)
})

function drillInto(uid) {
  drillPath.value = [...drillPath.value, uid]
}

function drillTo(index) {
  drillPath.value = drillPath.value.slice(0, index)
}

function openPerson(uid) {
  nav.navigateTo('person-detail', { uid })
}

function ghPct(stats) {
  return stats.total > 0 ? Math.round(stats.github / stats.total * 100) : 0
}

function glPct(stats) {
  return stats.total > 0 ? Math.round(stats.gitlab / stats.total * 100) : 0
}

onMounted(loadOrgs)
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!orgData || trees.length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
      <div class="text-gray-400 dark:text-gray-500 mb-2">
        <svg class="w-12 h-12 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No Org Data</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">Run a sync to populate the org tree.</p>
    </div>

    <template v-else>
      <!-- Header: search + stats -->
      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <div v-if="trees.length > 1" class="flex gap-1">
          <button
            v-for="(tree, i) in trees"
            :key="tree.uid"
            @click="selectedRoot = i; drillPath = []"
            class="px-3 py-1.5 text-sm rounded-md transition-colors"
            :class="selectedRoot === i ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
          >{{ tree.name }}</button>
        </div>

        <div class="flex-1 relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search all people..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div v-if="currentStats" class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <span>{{ currentStats.total }} people</span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-400"></span>
            GitHub {{ ghPct(currentStats) }}%
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-orange-400"></span>
            GitLab {{ glPct(currentStats) }}%
          </span>
        </div>
      </div>

      <!-- Search results overlay -->
      <div v-if="searchResults" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
        <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {{ searchResults.length }}{{ searchResults.length >= 50 ? '+' : '' }} results
        </div>
        <div v-if="searchResults.length === 0" class="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">No matches found</div>
        <div v-else class="divide-y divide-gray-100 dark:divide-gray-700/50">
          <button
            v-for="r in searchResults"
            :key="r.uid"
            @click="openPerson(r.uid)"
            class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 flex items-center justify-between gap-4 transition-colors"
          >
            <div class="min-w-0">
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ r.name }}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500 ml-2">{{ r.title }}</span>
              <div v-if="r.path" class="text-[10px] text-gray-400 dark:text-gray-500 truncate">{{ r.path }}</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <span v-if="r.github && r.github.username" class="text-xs text-primary-600 dark:text-primary-400">{{ r.github.username }}</span>
              <span v-if="r.gitlab && r.gitlab.username" class="text-xs text-orange-600 dark:text-orange-400">{{ r.gitlab.username }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Drill-down view (hidden when searching) -->
      <template v-if="!searchResults">
        <!-- Breadcrumb -->
        <div class="flex items-center gap-1 mb-3 text-sm">
          <button
            v-for="(crumb, i) in breadcrumbs"
            :key="crumb.uid"
            @click="drillTo(i)"
            class="flex items-center gap-1"
          >
            <span v-if="i > 0" class="text-gray-300 dark:text-gray-600 mx-1">›</span>
            <span
              class="transition-colors"
              :class="i === breadcrumbs.length - 1 ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-primary-600 dark:text-primary-400 hover:underline'"
            >{{ crumb.name }}</span>
          </button>
          <span v-if="currentStats" class="text-xs text-gray-400 dark:text-gray-500 ml-2">{{ currentStats.total }} people</span>
        </div>

        <!-- Unified reports table -->
        <div v-if="directReports.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Title</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16">Team</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">GitHub</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">GitLab</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
              <tr
                v-for="p in directReports"
                :key="p.uid"
                @click="p.hasReports ? drillInto(p.uid) : openPerson(p.uid)"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ p.name }}</span>
                    <svg v-if="p.hasReports" class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{{ p.title }}</td>
                <td class="px-4 py-3 text-right">
                  <span v-if="p.hasReports" class="text-sm tabular-nums text-gray-900 dark:text-gray-100">{{ p.teamSize }}</span>
                </td>
                <td class="px-4 py-3 text-sm" @click.stop>
                  <a v-if="p.github && p.github.username" :href="'https://github.com/' + p.github.username" target="_blank" rel="noopener" class="text-primary-600 dark:text-primary-400 hover:underline">{{ p.github.username }}</a>
                  <span v-else class="text-gray-300 dark:text-gray-600">&mdash;</span>
                </td>
                <td class="px-4 py-3 text-sm hidden md:table-cell" @click.stop>
                  <a v-if="p.gitlab && p.gitlab.username" :href="'https://gitlab.com/' + p.gitlab.username" target="_blank" rel="noopener" class="text-primary-600 dark:text-primary-400 hover:underline">{{ p.gitlab.username }}</a>
                  <span v-else class="text-gray-300 dark:text-gray-600">&mdash;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty drill level -->
        <div v-if="directReports.length === 0 && currentNode" class="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
          No reports found for {{ currentNode.name }}
        </div>
      </template>
    </template>
  </div>
</template>
