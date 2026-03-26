<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
    :class="badgeClass"
  >
    {{ value || 'Unspecified' }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: String, default: null }
})

const PALETTE = [
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-amber-100 text-amber-800',
  'bg-indigo-100 text-indigo-800',
  'bg-green-100 text-green-800',
  'bg-red-100 text-red-800',
  'bg-cyan-100 text-cyan-800',
  'bg-orange-100 text-orange-800'
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const badgeClass = computed(() => {
  if (!props.value) return 'bg-gray-100 text-gray-800'
  // Strip leading count (e.g. "3 QE" -> "QE") so the same role always gets the same color
  const colorKey = props.value.replace(/^\d+\s+/, '')
  return PALETTE[hashString(colorKey) % PALETTE.length]
})
</script>
