<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  text: { type: String, default: '' }
})

const expandedSections = ref({})

/**
 * Detect section type based on title.
 * @param {string} title - Section title
 * @returns {'resolved' | 'new' | 'open'} Section type
 */
function detectSectionType(title) {
  const lower = title.toLowerCase()
  if (lower.includes('resolved') || lower.includes('closed')) {
    return 'resolved'
  }
  if (lower.includes('new gaps identified') || lower.includes('new gaps')) {
    return 'new'
  }
  return 'open'
}

/**
 * Parse gap analysis markdown into structured sections.
 * Supports:
 * - Section headers (## Title)
 * - Bullet points with bold titles (**Title** — description)
 * - Inline bold (**text**)
 * - Section types: resolved (closed gaps), new (newly identified), open (active gaps)
 */
const sections = computed(() => {
  if (!props.text) return []

  const lines = props.text.split('\n')
  const result = []
  let currentSection = null
  let currentBullet = null

  for (const line of lines) {
    const trimmed = line.trim()

    const isHeader = trimmed.startsWith('## ')
    const isBullet = (trimmed.startsWith('- ') || trimmed.startsWith('* '))
    const isEmpty = trimmed === ''

    // Flush previous bullet when a new structural element starts
    if ((isHeader || isBullet || isEmpty) && currentBullet !== null) {
      currentSection.items.push({
        segments: parseInlineBold(currentBullet)
      })
      currentBullet = null
    }

    if (isHeader) {
      if (currentSection) result.push(currentSection)
      const title = trimmed.slice(3)
      currentSection = {
        title,
        type: detectSectionType(title),
        items: []
      }
      continue
    }

    if (isBullet && currentSection) {
      currentBullet = trimmed.slice(2)
      continue
    }

    // Continuation line — append to current bullet
    if (trimmed && currentBullet !== null) {
      currentBullet += ' ' + trimmed
      continue
    }
  }

  // Flush final bullet
  if (currentBullet !== null && currentSection) {
    currentSection.items.push({
      segments: parseInlineBold(currentBullet)
    })
  }

  if (currentSection) result.push(currentSection)

  // Initialize all sections as collapsed by default
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
        :class="{
          'opacity-60': section.type === 'resolved'
        }"
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

          <!-- Type icon -->
          <svg
            v-if="section.type === 'resolved'"
            class="w-3.5 h-3.5 text-green-600 dark:text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg
            v-else-if="section.type === 'new'"
            class="w-3.5 h-3.5 text-amber-600 dark:text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>

          <!-- Section title -->
          <h5
            class="text-xs font-semibold uppercase tracking-wide"
            :class="{
              'text-green-700 dark:text-green-400': section.type === 'resolved',
              'text-amber-700 dark:text-amber-400': section.type === 'new',
              'text-gray-700 dark:text-gray-300': section.type === 'open'
            }"
          >
            {{ section.title }}
          </h5>

          <!-- Count badge -->
          <span
            class="px-1.5 py-0.5 text-xs font-medium rounded"
            :class="{
              'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400': section.type === 'resolved',
              'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400': section.type === 'new',
              'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400': section.type === 'open'
            }"
          >
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
          class="text-sm pl-4 flex"
          :class="{
            'text-gray-500 dark:text-gray-500': section.type === 'resolved',
            'text-gray-600 dark:text-gray-400': section.type !== 'resolved'
          }"
        >
          <span class="mr-2 flex-shrink-0"
            :class="{
              'text-gray-400': section.type !== 'resolved',
              'text-gray-500': section.type === 'resolved'
            }"
          >&bull;</span>
          <span class="flex-1">
            <template v-for="(seg, j) in item.segments" :key="j">
              <strong
                v-if="seg.bold"
                :class="{
                  'text-green-700 dark:text-green-500': section.type === 'resolved',
                  'text-gray-700 dark:text-gray-300': section.type !== 'resolved'
                }"
              >{{ seg.text }}</strong>
              <span v-else>{{ seg.text }}</span>
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
