<template>
  <div class="flex items-center pt-3.5 mt-3.5 border-t border-gray-100 dark:border-gray-700/40">
    <!-- Reactions + comment button -->
    <div class="flex items-center gap-2">
      <!-- All reaction pills (including thumbsUp) -->
      <button
        v-for="(count, emoji) in visibleReactions"
        :key="emoji"
        @click="handleToggle(emoji)"
        @mouseenter="loadTooltip(emoji)"
        @mouseleave="hideTooltip"
        class="relative flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer hover:scale-105 active:scale-95 border"
        :class="poppingEmoji === emoji
          ? 'reaction-burst border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/30'
          : isMyReaction(emoji)
            ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500'"
      >
        <span class="text-sm leading-none">{{ emojiIcons[emoji] }}</span>
        <span class="font-medium text-gray-700 dark:text-gray-300 tabular-nums" :class="{ 'count-bump': bumpingEmoji === emoji }">{{ count }}</span>

        <!-- Tooltip showing who reacted -->
        <div
          v-if="tooltipEmoji === emoji && tooltipNames.length > 0"
          class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-30 pointer-events-none"
        >
          {{ tooltipText }}
          <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      </button>

      <!-- Add reaction button -->
      <div
        class="relative"
        @mouseenter="showPickerDelayed"
        @mouseleave="hidePickerDelayed"
      >
        <button
          @click="togglePickerPinned"
          class="flex items-center justify-center w-7 h-7 rounded-full border transition-all cursor-pointer hover:scale-105"
          :class="pickerOpen
            ? 'border-primary-400 dark:border-primary-500 text-primary-500 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
            : 'border-dashed border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-400 hover:text-gray-600 dark:hover:text-gray-300'"
          aria-label="Add reaction"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
        </button>

        <!-- Emoji picker -->
        <div
          v-if="pickerOpen"
          @mouseenter="clearHideTimer"
          @mouseleave="hidePickerDelayed"
          class="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full shadow-lg px-2.5 py-2 flex items-center gap-1 z-30 picker-enter"
          role="menu"
        >
          <button
            v-for="e in allEmojis"
            :key="e.key"
            @click.stop="handlePickerSelect(e.key)"
            class="w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer text-xl hover:scale-125 hover:-translate-y-1 active:scale-100"
            :class="isEmojiActive(e.key)
              ? 'bg-primary-100 dark:bg-primary-800/60 scale-110'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'"
            :title="e.label"
          >
            {{ e.icon }}
          </button>
        </div>
      </div>

      <!-- Comment button -->
      <button
        @click="$emit('view-comments')"
        class="flex items-center gap-1.5 ml-1 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span v-if="commentCount > 0" class="text-xs font-medium tabular-nums">{{ commentCount }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const props = defineProps({
  reactions: { type: Object, default: () => ({}) },
  myReactions: { type: Array, default: () => [] },
  commentCount: { type: Number, default: 0 },
  postId: { type: String, default: '' }
})

const emit = defineEmits(['toggle', 'view-comments'])

const pickerOpen = ref(false)
const pickerPinned = ref(false)
const poppingEmoji = ref(null)
const bumpingEmoji = ref(null)
const tooltipEmoji = ref(null)
const tooltipNames = ref([])
let hoverTimer = null
let leaveTimer = null
let tooltipTimer = null
let cachedReactionDetails = null

const allEmojis = [
  { key: 'thumbsUp', icon: '👍', label: 'Like' },
  { key: 'heart', icon: '❤️', label: 'Love' },
  { key: 'celebrate', icon: '🎉', label: 'Celebrate' },
  { key: 'insightful', icon: '💡', label: 'Insightful' },
  { key: 'curious', icon: '🤔', label: 'Curious' },
  { key: 'rocket', icon: '🚀', label: 'Rocket' }
]

const emojiIcons = Object.fromEntries(allEmojis.map(e => [e.key, e.icon]))

const visibleReactions = computed(() => {
  const result = {}
  for (const [emoji, count] of Object.entries(props.reactions)) {
    if (count > 0) result[emoji] = count
  }
  return result
})

const tooltipText = computed(() => {
  const names = tooltipNames.value
  if (names.length === 0) return ''
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
})

function handleToggle(emoji) {
  animateAndEmit(emoji)
}

function handlePickerSelect(emoji) {
  animateAndEmit(emoji)
}

function togglePickerPinned() {
  if (pickerOpen.value && pickerPinned.value) {
    pickerOpen.value = false
    pickerPinned.value = false
  } else {
    pickerOpen.value = true
    pickerPinned.value = true
    clearTimeout(hoverTimer)
    clearTimeout(leaveTimer)
    document.addEventListener('click', handleClickOutsidePicker, true)
  }
}

function handleClickOutsidePicker(e) {
  const picker = e.target.closest('[role="menu"]')
  const trigger = e.target.closest('[aria-label="Add reaction"]')
  if (!picker && !trigger) {
    pickerOpen.value = false
    pickerPinned.value = false
    document.removeEventListener('click', handleClickOutsidePicker, true)
  }
}

function isEmojiActive(emoji) {
  return (props.reactions[emoji] || 0) > 0
}

function isMyReaction(emoji) {
  return props.myReactions.includes(emoji)
}

function animateAndEmit(emoji) {
  cachedReactionDetails = null
  poppingEmoji.value = emoji
  bumpingEmoji.value = emoji
  setTimeout(() => { poppingEmoji.value = null }, 300)
  setTimeout(() => { bumpingEmoji.value = null }, 300)
  emit('toggle', emoji)
}

function showPickerDelayed() {
  clearTimeout(leaveTimer)
  hoverTimer = setTimeout(() => { pickerOpen.value = true }, 200)
}

function hidePickerDelayed() {
  clearTimeout(hoverTimer)
  if (pickerPinned.value) return
  leaveTimer = setTimeout(() => { pickerOpen.value = false }, 200)
}

function clearHideTimer() {
  clearTimeout(leaveTimer)
}

async function loadTooltip(emoji) {
  clearTimeout(tooltipTimer)
  tooltipTimer = setTimeout(async () => {
    try {
      if (!props.postId) return
      if (!cachedReactionDetails) {
        const data = await apiRequest(`/modules/pulse-social/posts/${props.postId}/reactions`)
        cachedReactionDetails = data.reactions || {}
      }
      tooltipNames.value = cachedReactionDetails[emoji] || []
      tooltipEmoji.value = emoji
    } catch {
      tooltipNames.value = []
    }
  }, 400)
}

function hideTooltip() {
  clearTimeout(tooltipTimer)
  tooltipEmoji.value = null
  tooltipNames.value = []
}

onBeforeUnmount(() => {
  clearTimeout(hoverTimer)
  clearTimeout(leaveTimer)
  clearTimeout(tooltipTimer)
  document.removeEventListener('click', handleClickOutsidePicker, true)
})
</script>

<style scoped>
.picker-enter {
  animation: pickerIn 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes pickerIn {
  from { opacity: 0; transform: translateY(-4px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.reaction-burst {
  animation: burst 300ms ease-out;
}
@keyframes burst {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.count-bump {
  animation: countBump 300ms ease-out;
}
@keyframes countBump {
  0% { transform: translateY(0); }
  40% { transform: translateY(-3px); }
  100% { transform: translateY(0); }
}
</style>
