<script setup>
import { ref } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  searchTerm: { type: String, default: '' }
})

const emit = defineEmits(['select'])

const expanded = ref(props.depth < 1)

function toggle() {
  expanded.value = !expanded.value
}

function matchesSearch(node) {
  if (!props.searchTerm) return true
  var term = props.searchTerm.toLowerCase()
  if (node.name.toLowerCase().includes(term)) return true
  if (node.title && node.title.toLowerCase().includes(term)) return true
  if (node.children) {
    return node.children.some(function(c) { return matchesSearch(c) })
  }
  return false
}
</script>

<template>
  <div v-if="matchesSearch(node)" class="select-none">
    <div
      class="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer group"
      :style="{ paddingLeft: (depth * 20 + 8) + 'px' }"
    >
      <button
        v-if="node.children && node.children.length > 0"
        @click.stop="toggle"
        class="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
      >
        <svg class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-90': expanded }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <span v-else class="w-5 h-5 flex-shrink-0"></span>

      <button @click="emit('select', node.uid)" class="flex-1 text-left flex items-center gap-2 min-w-0">
        <span class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{{ node.name }}</span>
        <span v-if="node.title" class="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:inline">{{ node.title }}</span>
      </button>

      <div class="flex items-center gap-2 flex-shrink-0">
        <span v-if="node.teamSize > 0" class="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{{ node.teamSize }}</span>
        <span
          class="w-2 h-2 rounded-full flex-shrink-0"
          :class="node.github && node.github.username ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'"
          :title="node.github && node.github.username ? 'GitHub: ' + node.github.username : 'No GitHub'"
        ></span>
        <span
          class="w-2 h-2 rounded-full flex-shrink-0"
          :class="node.gitlab && node.gitlab.username ? 'bg-orange-400' : 'bg-gray-300 dark:bg-gray-600'"
          :title="node.gitlab && node.gitlab.username ? 'GitLab: ' + node.gitlab.username : 'No GitLab'"
        ></span>
      </div>
    </div>

    <div v-if="expanded && node.children && node.children.length > 0">
      <OrgTreeNode
        v-for="child in node.children"
        :key="child.uid"
        :node="child"
        :depth="depth + 1"
        :search-term="searchTerm"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
