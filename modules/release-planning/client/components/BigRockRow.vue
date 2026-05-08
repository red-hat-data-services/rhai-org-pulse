<script setup>
import { computed } from 'vue'

const props = defineProps({
  rock: { type: Object, required: true },
  jiraBaseUrl: { type: String, default: '' },
  health: { type: Object, default: null },
  hasHealth: { type: Boolean, default: false },
  rockFeatures: { type: Array, default: () => [] },
  expanded: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-expand'])

const healthBadgeClass = computed(function() {
  if (!props.health) return ''
  var level = props.health.worstLevel
  if (level === 'red') return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
  if (level === 'yellow') return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
  return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
})

var healthLabel = computed(function() {
  if (!props.health) return '-'
  var level = props.health.worstLevel
  if (level === 'green') return 'OK'
  if (level === 'yellow') return 'At Risk'
  return 'Critical'
})

function handleBadgeClick(event) {
  event.stopPropagation()
  emit('toggle-expand')
}

function handleBadgeKeydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    event.stopPropagation()
    emit('toggle-expand')
  }
}
</script>

<template>
  <td class="px-3 py-2 text-gray-400 dark:text-gray-500 font-mono text-xs border border-gray-300 dark:border-gray-600">{{ rock.priority }}</td>
  <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
    <span class="text-xs text-gray-700 dark:text-gray-300">{{ rock.pillar }}</span>
  </td>
  <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
    <div class="text-gray-900 dark:text-gray-100 font-medium">{{ rock.name }}</div>
  </td>
  <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
    <template v-if="rock.outcomeKeys && rock.outcomeKeys.length > 0">
      <div v-for="key in rock.outcomeKeys" :key="key" class="mb-0.5">
        <a
          :href="`${jiraBaseUrl}/${key}`"
          target="_blank"
          rel="noopener"
          class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
          @click.stop
        >{{ key }}</a>
        <span v-if="rock.outcomeDescriptions && rock.outcomeDescriptions[key]" class="text-xs text-gray-500 dark:text-gray-400 ml-1">
          - {{ rock.outcomeDescriptions[key] }}
        </span>
      </div>
    </template>
    <span v-else class="text-xs text-gray-400 dark:text-gray-500 italic">TBD</span>
  </td>
  <td v-if="hasHealth" class="px-3 py-2 text-center border border-gray-300 dark:border-gray-600">
    <span
      v-if="health && rockFeatures.length > 0"
      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
      :class="[healthBadgeClass, 'cursor-pointer']"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      @click="handleBadgeClick"
      @keydown="handleBadgeKeydown"
    >
      <svg
        class="w-3 h-3 transition-transform"
        :class="expanded ? 'rotate-90' : ''"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      {{ healthLabel }}
    </span>
    <span v-else class="text-gray-400 dark:text-gray-600 text-xs">-</span>
  </td>
  <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
    <div class="mb-0.5">
      <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">PM</span>
      <span class="text-xs text-gray-700 dark:text-gray-300 ml-1">{{ rock.owner || '-' }}</span>
    </div>
    <div>
      <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">Eng. Lead</span>
      <span class="text-xs text-gray-700 dark:text-gray-300 ml-1">{{ rock.architect || '-' }}</span>
    </div>
  </td>
  <td class="px-3 py-2 text-center border border-gray-300 dark:border-gray-600">
    <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.featureCount }}</span>
    <span class="text-xs text-gray-500 dark:text-gray-400 ml-0.5">Features</span>
    <span class="mx-1 text-gray-300 dark:text-gray-600">|</span>
    <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.rfeCount }}</span>
    <span class="text-xs text-gray-500 dark:text-gray-400 ml-0.5">RFEs</span>
  </td>
</template>
