<script setup>
import { ref, watch, nextTick, markRaw, onUnmounted } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import GraphImageNode from './graph/GraphImageNode.vue'

const props = defineProps({
  graphData: { type: Object, required: true },
})

const emit = defineEmits(['node-click'])

const nodeTypes = { imageNode: markRaw(GraphImageNode) }
const vueFlowInstance = ref(null)
let fitViewTimer = null

function onPaneReady(instance) {
  vueFlowInstance.value = instance
}

watch(() => props.graphData.nodes, () => {
  if (props.graphData.nodes.length > 0 && vueFlowInstance.value) {
    nextTick(() => {
      clearTimeout(fitViewTimer)
      fitViewTimer = setTimeout(() => vueFlowInstance.value?.fitView({ padding: 0.15, duration: 0 }), 100)
    })
  }
})

onUnmounted(() => clearTimeout(fitViewTimer))

function onNodeClick({ node }) {
  emit('node-click', node)
}

const PRODUCT_LEGEND = [
  { label: 'Base Images', color: '#14b8a6' },
  { label: 'RHAIIS', color: '#3b82f6' },
  { label: 'vLLM', color: '#d97706' },
]

function miniMapColor(node) {
  return node.data?.colors?.border || '#6b7280'
}
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-4 py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded text-xs mb-3">
      <span class="font-semibold text-gray-700 dark:text-gray-300">Legend:</span>
      <span v-for="item in PRODUCT_LEGEND" :key="item.label" class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm border" :style="{ backgroundColor: item.color + '40', borderColor: item.color }" />
        <span class="text-gray-600 dark:text-gray-400">{{ item.label }}</span>
      </span>
    </div>

    <div v-if="graphData.nodes.length === 0" class="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
      <p class="text-sm text-gray-500 dark:text-gray-400">No production artifacts with image dependencies found</p>
    </div>

    <div v-else class="h-[400px] w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <VueFlow
        :nodes="graphData.nodes"
        :edges="graphData.edges"
        :node-types="nodeTypes"
        :min-zoom="0.2"
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

    <div v-if="graphData.nodes.length > 0" class="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
      {{ graphData.nodes.length }} images, {{ graphData.edges.length }} dependencies
    </div>
  </div>
</template>
