<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  text: { type: String, default: '' }
})

const expandedSections = ref({})

/**
 * Parse gap analysis markdown into structured sections.
 * Supports:
 * - Section headers (## Title)
 * - Bullet points with bold titles (**Title** — description)
 * - Inline bold (**text**)
 */
const sections = computed(() => {
  if (!props.text) return []

  const lines = props.text.split('\n')
  const result = []
  let currentSection = null

  for (const line of lines) {
    const trimmed = line.trim()

    // Section header (## Title)
    if (trimmed.startsWith('## ')) {
      if (currentSection) result.push(currentSection)
      currentSection = {
        title: trimmed.slice(3),
        items: []
      }
      continue
    }

    // Bullet point
    if ((trimmed.startsWith('- ') || trimmed.startsWith('* ')) && currentSection) {
      const text = trimmed.slice(2)
      currentSection.items.push({
        segments: parseInlineBold(text)
      })
      continue
    }

    // Empty line - skip
    if (trimmed === '') continue
  }

  if (currentSection) result.push(currentSection)

  // Initialize all sections as collapsed
  result.forEach((section, idx) => {
    if (expandedSections.value[idx] === undefined) {
      expandedSections.value[idx] = false
    }
  })

  return result
})

/**
 * Split text into segments of bold and normal text.
 * Handles **bold** markers.
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

function toggleSection(idx) {
  expandedSections.value[idx] = !expandedSections.value[idx]
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="(section, sIdx) in sections" :key="sIdx">
      <!-- Section header - clickable -->
      <button
        @click="toggleSection(sIdx)"
        class="w-full flex items-center justify-between text-left group hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-2 py-1.5 -mx-2 transition-colors"
      >
        <div class="flex items-center gap-2">
          <!-- Chevron icon -->
          <svg
            class="w-3.5 h-3.5 text-gray-400 transition-transform"
            :class="{ 'rotate-90': expandedSections[sIdx] }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>

          <!-- Section title -->
          <h5 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            {{ section.title }}
          </h5>

          <!-- Count badge -->
          <span class="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            {{ section.items.length }}
          </span>
        </div>
      </button>

      <!-- Gap items - collapsible -->
      <div
        v-if="expandedSections[sIdx]"
        class="mt-2 space-y-2 ml-5 animate-in slide-in-from-top-2 duration-200"
      >
        <div
          v-for="(item, iIdx) in section.items"
          :key="iIdx"
          class="text-sm text-gray-600 dark:text-gray-400 pl-4 flex"
        >
          <span class="mr-2 text-gray-400 flex-shrink-0">&bull;</span>
          <span class="flex-1">
            <template v-for="(seg, j) in item.segments" :key="j">
              <strong v-if="seg.bold" class="text-gray-700 dark:text-gray-300">{{ seg.text }}</strong>
              <span v-else>{{ seg.text }}</span>
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
