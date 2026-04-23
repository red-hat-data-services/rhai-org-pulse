<script setup>
import { computed } from 'vue'

const props = defineProps({
  text: { type: String, default: '' }
})

/**
 * Parse text into structured lines for safe rendering.
 * Supports:
 * - Bullet points (lines starting with - or *)
 * - Inline bold (**text**)
 * - Line breaks
 * No v-html is used anywhere.
 */
const feedbackLines = computed(() => {
  if (!props.text) return []
  return props.text.split('\n').map(line => {
    const trimmed = line.trimStart()
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ')
    return {
      type: isBullet ? 'bullet' : 'text',
      text: isBullet ? trimmed.slice(2) : line,
      segments: parseInlineBold(isBullet ? trimmed.slice(2) : line)
    }
  })
})

/**
 * Split text into segments of bold and normal text.
 * Handles **bold** markers without v-html.
 */
function parseInlineBold(text) {
  const segments = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ bold: false, text: text.slice(lastIndex, match.index) })
    }
    segments.push({ bold: true, text: match[1] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ bold: false, text: text.slice(lastIndex) })
  }

  if (segments.length === 0 && text) {
    segments.push({ bold: false, text })
  }

  return segments
}
</script>

<template>
  <div class="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
    <template v-for="(line, i) in feedbackLines" :key="i">
      <div v-if="line.type === 'bullet'" class="pl-4 flex">
        <span class="mr-2 text-gray-400">&bull;</span>
        <span>
          <template v-for="(seg, j) in line.segments" :key="j">
            <strong v-if="seg.bold">{{ seg.text }}</strong>
            <span v-else>{{ seg.text }}</span>
          </template>
        </span>
      </div>
      <div v-else-if="line.text.trim() === ''" class="h-2" />
      <div v-else>
        <template v-for="(seg, j) in line.segments" :key="j">
          <strong v-if="seg.bold">{{ seg.text }}</strong>
          <span v-else>{{ seg.text }}</span>
        </template>
      </div>
    </template>
  </div>
</template>
