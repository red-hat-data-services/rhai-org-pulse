<template>
  <div
    class="rounded-full flex items-center justify-center font-medium text-white select-none shrink-0"
    :class="[sizeClasses, darkRing]"
    :style="{ backgroundColor: bgColor }"
    :title="name"
  >
    {{ initials }}
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  uid: { type: String, default: '' },
  size: { type: String, default: 'md' }
})

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
})

const bgColor = computed(() => {
  let hash = 0
  const str = props.uid || props.name
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 55%)`
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'xs': return 'w-7 h-7 text-[10px]'
    case 'sm': return 'w-8 h-8 text-xs'
    case 'md': return 'w-10 h-10 text-sm'
    case 'lg': return 'w-11 h-11 text-sm'
    case 'xl': return 'w-14 h-14 text-base'
    default: return 'w-10 h-10 text-sm'
  }
})

const darkRing = 'dark:ring-2 dark:ring-gray-700'
</script>
