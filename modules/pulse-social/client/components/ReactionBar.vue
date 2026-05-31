<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-1 relative">
      <!-- Existing reactions -->
      <button
        v-for="(count, emoji) in reactions"
        :key="emoji"
        @click="handleToggle(emoji)"
        @mouseenter="loadTooltip(emoji)"
        @mouseleave="hideTooltip"
        class="relative flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
        :class="{ 'reaction-pop': poppingEmoji === emoji }"
        :aria-label="`${count} people reacted with ${emojiLabels[emoji]}. Click to toggle your reaction`"
      >
        <span class="text-base">{{ emojiIcons[emoji] }}</span>
        <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ count }}</span>

        <!-- Tooltip showing who reacted -->
        <div
          v-if="tooltipEmoji === emoji && tooltipNames.length > 0"
          class="absolute bottom-full left-0 mb-1.5 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-30 pointer-events-none"
        >
          {{ tooltipText }}
          <div class="absolute top-full left-3 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      </button>

      <!-- Add reaction trigger: click = default 👍, hover = show picker -->
      <div
        class="relative"
        @mouseenter="showPickerOnHover"
        @mouseleave="hidePickerOnLeave"
      >
        <button
          ref="triggerRef"
          @click="handleQuickReact"
          class="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          aria-label="React. Click for thumbs up, hover for more options."
          title="React"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
        </button>

        <!-- Picker: appears on hover, stays open while mouse is inside -->
        <div
          v-if="pickerOpen"
          class="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg px-1.5 py-1 flex items-center gap-0.5 z-20"
          role="menu"
          aria-label="React with emoji"
        >
          <button
            v-for="e in allEmojis"
            :key="e.key"
            @click="handlePickerSelect(e.key)"
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer text-lg hover:scale-125"
            role="menuitem"
            :aria-label="'React with ' + e.label"
            :title="e.label"
          >
            {{ e.icon }}
          </button>
        </div>
      </div>
    </div>

    <!-- Comment count -->
    <button
      v-if="commentCount !== undefined"
      @click="$emit('view-comments')"
      class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
      :aria-label="`${commentCount} comments. Click to view.`"
    >
      <span>💬</span>
      <span>{{ commentCount }} {{ commentCount === 1 ? 'comment' : 'comments' }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { apiRequest } from '@shared/client/services/api'

defineProps({
  reactions: { type: Object, default: () => ({}) },
  commentCount: { type: Number, default: undefined },
  postId: { type: String, default: '' },
  hovered: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle', 'view-comments'])

const pickerOpen = ref(false)
const poppingEmoji = ref(null)
const triggerRef = ref(null)
const tooltipEmoji = ref(null)
const tooltipNames = ref([])
let tooltipTimer = null
let hoverTimer = null
let leaveTimer = null
let cachedReactionDetails = null

const allEmojis = [
  { key: 'thumbsUp', icon: '👍', label: 'thumbs up' },
  { key: 'heart', icon: '❤️', label: 'heart' },
  { key: 'celebrate', icon: '🎉', label: 'celebrate' },
  { key: 'insightful', icon: '💡', label: 'insightful' },
  { key: 'curious', icon: '🤔', label: 'curious' },
  { key: 'rocket', icon: '🚀', label: 'rocket' }
]

const emojiIcons = Object.fromEntries(allEmojis.map(e => [e.key, e.icon]))
const emojiLabels = Object.fromEntries(allEmojis.map(e => [e.key, e.label]))

const tooltipText = computed(() => {
  const names = tooltipNames.value
  if (names.length === 0) return ''
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
})

function handleQuickReact() {
  clearTimeout(hoverTimer)
  pickerOpen.value = !pickerOpen.value
}

function handleToggle(emoji) {
  animateAndEmit(emoji)
}

function handlePickerSelect(emoji) {
  pickerOpen.value = false
  animateAndEmit(emoji)
}

function animateAndEmit(emoji) {
  cachedReactionDetails = null
  poppingEmoji.value = emoji
  setTimeout(() => { poppingEmoji.value = null }, 150)
  emit('toggle', emoji)
}

function showPickerOnHover() {
  clearTimeout(leaveTimer)
  hoverTimer = setTimeout(() => {
    pickerOpen.value = true
  }, 400)
}

function hidePickerOnLeave() {
  clearTimeout(hoverTimer)
  leaveTimer = setTimeout(() => {
    pickerOpen.value = false
  }, 200)
}

async function loadTooltip(emoji) {
  clearTimeout(tooltipTimer)
  tooltipTimer = setTimeout(async () => {
    try {
      const pid = triggerRef.value?.closest('[data-post-id]')?.dataset?.postId
      if (!pid) return
      if (!cachedReactionDetails) {
        const data = await apiRequest(`/modules/pulse-social/posts/${pid}/reactions`)
        cachedReactionDetails = data.reactions || {}
      }
      tooltipNames.value = cachedReactionDetails[emoji] || []
      tooltipEmoji.value = emoji
    } catch {
      tooltipNames.value = []
    }
  }, 300)
}

function hideTooltip() {
  clearTimeout(tooltipTimer)
  tooltipEmoji.value = null
  tooltipNames.value = []
}

onBeforeUnmount(() => {
  clearTimeout(tooltipTimer)
  clearTimeout(hoverTimer)
  clearTimeout(leaveTimer)
})
</script>

<style scoped>
.reaction-pop {
  animation: pop 150ms ease-out;
}
@keyframes pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
</style>
