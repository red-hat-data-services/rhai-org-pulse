<template>
  <div
    v-if="visible"
    class="absolute bottom-full left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg px-2 py-1.5 flex items-center gap-1 z-20"
    role="menu"
    aria-label="React with emoji"
  >
    <button
      v-for="e in emojis"
      :key="e.key"
      @click="$emit('select', e.key)"
      class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg cursor-pointer"
      role="menuitem"
      :aria-label="'React with ' + e.label"
      :title="e.label"
    >
      {{ e.icon }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false }
})

defineEmits(['select'])

const emojis = [
  { key: 'thumbsUp', icon: '👍', label: 'thumbs up' },
  { key: 'heart', icon: '❤️', label: 'heart' },
  { key: 'celebrate', icon: '🎉', label: 'celebrate' },
  { key: 'insightful', icon: '💡', label: 'insightful' },
  { key: 'curious', icon: '🤔', label: 'curious' },
  { key: 'rocket', icon: '🚀', label: 'rocket' }
]
</script>
