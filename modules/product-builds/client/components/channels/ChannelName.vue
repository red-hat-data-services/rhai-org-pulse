<script setup>
import { computed } from 'vue'
import { acceleratorMeta, channelNameSegments } from '../../utils/channels'

const props = defineProps({
  channel: { type: Object, required: true },
  size: { type: String, default: 'sm' },
})

// Render the published channel name verbatim, weighting each identity segment
// so the accelerator, torch and OS parts read separately.
const segments = computed(() => {
  const parts = channelNameSegments(props.channel.name)
  if (parts.length !== 3) {
    return [{ text: parts[0], cls: 'font-semibold text-gray-900 dark:text-gray-100' }]
  }
  const [stack, torch, os] = parts
  return [
    { text: stack, cls: `font-semibold ${acceleratorMeta(props.channel.accelerator).text}` },
    { text: torch, cls: 'font-semibold text-gray-900 dark:text-gray-100' },
    { text: os, cls: 'text-gray-500 dark:text-gray-400' },
  ]
})
</script>

<template>
  <span
    class="font-mono whitespace-nowrap"
    :class="size === 'lg' ? 'text-lg sm:text-xl tracking-tight' : 'text-[13px]'"
    :title="channel.name"
  ><template v-for="(seg, i) in segments" :key="i"><span v-if="i > 0" class="text-gray-300 dark:text-gray-600">-</span><span :class="seg.cls">{{ seg.text }}</span></template></span>
</template>
