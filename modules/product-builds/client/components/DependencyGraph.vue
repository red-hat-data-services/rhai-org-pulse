<script setup>
import { ref, watch, nextTick, markRaw } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import GraphPackageNode from './graph/GraphPackageNode.vue'
import GraphPackageSelector from './graph/GraphPackageSelector.vue'
import { useDependencyGraph } from '../composables/useDependencyGraph.js'

const props = defineProps({
  dependencyGraphJson: { type: String, required: true },
})

const {
  packageList,
  selectedPackage,
  showBuildDeps,
  nodes,
  edges,
  incomingDeps,
  outgoingDeps,
  stats,
  error,
} = useDependencyGraph(props.dependencyGraphJson)

const nodeTypes = { package: markRaw(GraphPackageNode) }

const vueFlowInstance = ref(null)

function onPaneReady(instance) {
  vueFlowInstance.value = instance
}

watch(nodes, () => {
  if (nodes.value.length > 0 && vueFlowInstance.value) {
    nextTick(() => {
      setTimeout(() => vueFlowInstance.value.fitView({ padding: 0.2, duration: 0 }), 100)
    })
  }
})

function onNodeClick({ node }) {
  if (node.id === 'root') return
  selectedPackage.value = node.id
}

function selectFromList(key) {
  selectedPackage.value = key
}

function miniMapColor(node) {
  if (node.data.isSelected) return '#f0ab00'
  if (node.data.isRoot) return '#3e8635'
  if (node.data.preBuilt) return '#009596'
  return '#0066cc'
}
</script>

<template>
  <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
    {{ error }}
  </div>

  <template v-else>
    <!-- Legend -->
    <div class="flex flex-wrap gap-5 py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded text-sm mb-3">
      <span class="font-semibold text-gray-700 dark:text-gray-300 mr-1">Legend:</span>
      <span class="flex items-center gap-2">
        <svg width="40" height="2"><line x1="0" y1="1" x2="40" y2="1" stroke="#0066cc" stroke-width="2" /></svg>
        <span class="text-gray-600 dark:text-gray-400">Install-time</span>
      </span>
      <span class="flex items-center gap-2">
        <svg width="40" height="2"><line x1="0" y1="1" x2="40" y2="1" stroke="#6a6e73" stroke-width="2" stroke-dasharray="5,5" /></svg>
        <span class="text-gray-600 dark:text-gray-400">Build-time</span>
      </span>
      <span class="flex items-center gap-2">
        <span class="inline-block w-[30px] h-[18px] border-2 border-dashed border-gray-500 rounded bg-white dark:bg-gray-700" />
        <span class="text-gray-600 dark:text-gray-400">Build-only packages</span>
      </span>
    </div>

    <!-- Package selector -->
    <GraphPackageSelector
      :packages="packageList"
      :model-value="selectedPackage"
      @update:model-value="selectedPackage = $event"
    />

    <!-- Build deps toggle -->
    <label
      v-if="selectedPackage"
      class="flex items-center gap-2 mb-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
    >
      <input v-model="showBuildDeps" type="checkbox" class="rounded" />
      Show build-time dependencies
    </label>

    <!-- Empty state -->
    <div
      v-if="!selectedPackage"
      class="h-96 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-10"
    >
      <svg class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300">Select a package to explore dependencies</h3>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
        Choose a package from the dropdown above to view all dependency paths
        from the root to that package, and from the package to its leaf dependencies.
      </p>
      <p class="mt-4 text-xs text-gray-400 dark:text-gray-500">
        {{ packageList.length }} packages available in this collection
      </p>
    </div>

    <!-- Graph + details -->
    <template v-else>
      <div class="h-[600px] w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <VueFlow
          :nodes="nodes"
          :edges="edges"
          :node-types="nodeTypes"
          :min-zoom="0.1"
          :max-zoom="2"
          fit-view-on-init
          @pane-ready="onPaneReady"
          @node-click="onNodeClick"
        >
          <Background />
          <Controls />
          <MiniMap :node-color="miniMapColor" mask-color="rgba(0,0,0,0.1)" />
        </VueFlow>
      </div>

      <!-- Stats -->
      <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
        Showing {{ stats.shownNodes }} of {{ stats.totalPackages }} packages, {{ stats.shownEdges }} dependencies
      </div>

      <!-- Direct dependencies -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        <!-- Incoming -->
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Packages depending on this ({{ incomingDeps.length }})
          </h4>
          <div v-if="incomingDeps.length === 0" class="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-500 dark:text-gray-400">
            No packages depend on this package
          </div>
          <div v-else class="max-h-[300px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
            <div
              v-for="dep in incomingDeps"
              :key="dep.key"
              class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-[13px] font-mono cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              @click="selectFromList(dep.key)"
            >
              <div class="font-medium text-blue-600 dark:text-blue-400">
                {{ dep.key === '' ? 'Top level' : dep.key }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ dep.req }}
                <span :class="(dep.reqType === 'install' || dep.reqType === 'toplevel') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'" class="ml-2">
                  ({{ (dep.reqType === 'install' || dep.reqType === 'toplevel') ? 'install' : 'build-time' }})
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Outgoing -->
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Direct dependencies ({{ outgoingDeps.length }})
          </h4>
          <div v-if="outgoingDeps.length === 0" class="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-500 dark:text-gray-400">
            No direct dependencies
          </div>
          <div v-else class="max-h-[300px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
            <div
              v-for="dep in outgoingDeps"
              :key="dep.key"
              class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-[13px] font-mono cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              @click="selectFromList(dep.key)"
            >
              <div class="font-medium text-blue-600 dark:text-blue-400">
                {{ dep.key === '' ? 'Top level' : dep.key }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ dep.req }}
                <span :class="(dep.reqType === 'install' || dep.reqType === 'toplevel') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'" class="ml-2">
                  ({{ (dep.reqType === 'install' || dep.reqType === 'toplevel') ? 'install' : 'build-time' }})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </template>
</template>
