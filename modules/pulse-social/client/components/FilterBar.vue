<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      @click="$emit('filter', null)"
      class="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer"
      :class="!active
        ? 'bg-primary-600 text-white border-primary-600'
        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'"
    >
      All
    </button>
    <button
      v-for="l in labels"
      :key="l.key"
      @click="$emit('filter', l.key)"
      class="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer"
      :class="active === l.key ? l.activeClasses : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'"
    >
      {{ l.icon }} {{ l.display }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  active: { type: String, default: null }
})

defineEmits(['filter'])

const labels = [
  { key: 'win', display: 'Wins', icon: '🏆', activeClasses: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' },
  { key: 'til', display: 'TIL', icon: '💡', activeClasses: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700' },
  { key: 'customer-success', display: 'Customer', icon: '🤝', activeClasses: 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  { key: 'question', display: 'Questions', icon: '❓', activeClasses: 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700' },
  { key: 'milestone', display: 'Milestones', icon: '🎯', activeClasses: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' }
]
</script>
