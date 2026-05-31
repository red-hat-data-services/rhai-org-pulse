<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-600 dark:text-primary-400"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Pulse Social</h3>
      </div>
      <a
        href="#/pulse-social/feed"
        class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
      >
        View all &rarr;
      </a>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        <div class="flex-1">
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse mb-1"></div>
          <div class="h-3 bg-gray-100 dark:bg-gray-700/50 rounded w-full animate-pulse"></div>
        </div>
      </div>
    </div>

    <!-- Posts -->
    <div v-else-if="posts.length > 0" class="space-y-3">
      <a
        v-for="post in posts"
        :key="post.id"
        :href="'#/pulse-social/post-detail?id=' + post.id"
        class="flex items-start gap-2.5 py-1.5 group"
      >
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
          :style="{ backgroundColor: avatarColor(post.author_uid || post.author_name) }"
        >
          {{ getInitials(post.author_name) }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ post.author_name }}</span>
            <span
              v-if="post.label"
              class="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full"
              :class="labelClass(post.label)"
            >
              {{ labelIcon(post.label) }}
            </span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
            {{ truncateBody(post.body) }}
          </p>
        </div>
        <span v-if="post.reaction_count" class="text-xs text-gray-400 dark:text-gray-500 shrink-0">
          {{ post.reaction_count }}
        </span>
      </a>
    </div>

    <!-- Empty -->
    <div v-else class="text-center py-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">Pulse Social is live!</p>
      <a href="#/pulse-social/feed" class="text-xs text-primary-600 dark:text-primary-400 hover:underline">Share your first update</a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const posts = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await apiRequest('/modules/pulse-social/posts/recent')
    posts.value = data.posts || []
  } catch {
    // Module may not be enabled or backend down
  } finally {
    loading.value = false
  }
})

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

function avatarColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 45%, 55%)`
}

function truncateBody(body) {
  if (!body) return ''
  const clean = body.replace(/[#*_`~[\]]/g, '').replace(/\n+/g, ' ')
  return clean.length > 100 ? clean.slice(0, 100) + '...' : clean
}

const LABEL_ICONS = {
  'win': '🏆', 'customer-success': '🤝', 'til': '💡',
  'question': '❓', 'milestone': '🎯', 'shoutout': '✨'
}

const LABEL_CLASSES = {
  'win': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'customer-success': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'til': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'question': 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'milestone': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'shoutout': 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
}

function labelIcon(label) { return LABEL_ICONS[label] || '' }
function labelClass(label) { return LABEL_CLASSES[label] || '' }
</script>
