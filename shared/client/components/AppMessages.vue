<template>
  <div v-if="messages.length > 0" class="space-y-2 pb-2">
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="flex items-center gap-3 px-5 py-3 rounded-lg shadow-sm border-l-4 text-sm font-medium"
      :class="bannerClasses[msg.type] || bannerClasses.info"
    >
      <component :is="iconForType(msg.type)" class="w-5 h-5 flex-shrink-0" />
      <span class="flex-1">{{ msg.text }}</span>
      <a
        v-if="msg.link"
        :href="msg.link.href"
        class="text-xs font-semibold underline underline-offset-2 hover:no-underline whitespace-nowrap"
      >{{ msg.link.label }}</a>
      <button
        @click="$emit('dismiss', msg.id)"
        class="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { AlertTriangle, Info, AlertCircle, X } from 'lucide-vue-next'

defineProps({
  messages: { type: Array, default: () => [] }
})

defineEmits(['dismiss'])

const bannerClasses = {
  warning: 'bg-amber-900 dark:bg-amber-950 text-white border-amber-400',
  info:    'bg-blue-900 dark:bg-blue-950 text-white border-blue-400',
  error:   'bg-red-900 dark:bg-red-950 text-white border-red-400'
}

function iconForType(type) {
  if (type === 'warning') return AlertTriangle
  if (type === 'error') return AlertCircle
  return Info
}
</script>
