<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import OrgTreeNode from '../components/OrgTreeNode.vue'

const nav = inject('moduleNav')

const orgData = ref(null)
const loading = ref(true)
const search = ref('')
const selectedRoot = ref(0)

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

const currentTree = computed(() => {
  if (trees.value.length === 0) return null
  return trees.value[selectedRoot.value] || trees.value[0]
})

const treeStats = computed(() => {
  if (!currentTree.value) return null
  function count(node) {
    let total = 1
    let gh = node.github && node.github.username ? 1 : 0
    let gl = node.gitlab && node.gitlab.username ? 1 : 0
    if (node.children) {
      for (const c of node.children) {
        const sub = count(c)
        total += sub.total
        gh += sub.github
        gl += sub.gitlab
      }
    }
    return { total, github: gh, gitlab: gl }
  }
  return count(currentTree.value)
})

function onSelectPerson(uid) {
  nav.navigateTo('person-detail', { uid })
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
      <!-- Header -->
      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <!-- Org root selector -->
        <div v-if="trees.length > 1" class="flex gap-1">
          <button
            v-for="(tree, i) in trees"
            :key="tree.uid"
            @click="selectedRoot = i"
            class="px-3 py-1.5 text-sm rounded-md transition-colors"
            :class="selectedRoot === i ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
          >{{ tree.name }}</button>
        </div>

        <!-- Search -->
        <div class="flex-1 relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search within tree..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <!-- Stats -->
        <div v-if="treeStats" class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <span>{{ treeStats.total }} people</span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-400"></span>
            GitHub {{ Math.round(treeStats.github / treeStats.total * 100) }}%
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-orange-400"></span>
            GitLab {{ Math.round(treeStats.gitlab / treeStats.total * 100) }}%
          </span>
        </div>
      </div>

      <!-- VP banner -->
      <div v-if="orgData.vp" class="mb-2 text-xs text-gray-400 dark:text-gray-500">
        VP: <button @click="onSelectPerson(orgData.vp.uid)" class="text-primary-600 dark:text-primary-400 hover:underline">{{ orgData.vp.name }}</button>
      </div>

      <!-- Tree -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <OrgTreeNode
          v-if="currentTree"
          :node="currentTree"
          :depth="0"
          :search-term="search"
          @select="onSelectPerson"
        />
      </div>
    </template>
  </div>
</template>
